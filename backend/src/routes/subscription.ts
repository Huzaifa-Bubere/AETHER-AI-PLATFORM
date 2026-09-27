/**
 * AETHER — Subscription & billing API (spec §53, §58, §65).
 *
 * Extends the existing /api/payment routes with:
 *   - plans-config      (central plan/price/feature config for the UI)
 *   - me                (current plan + status + usage meters for the billing page)
 * Usage metering lives in the entitlement service.
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { publicPlanConfig } from '../config/plans';
import { getCurrentPlan, getUsage } from '../services/entitlement.service';
import { Subscription } from '../models/Subscription';

const router = Router();

/** Public plan catalogue — prices, features, savings; nothing hardcoded in UI. */
router.get('/plans-config', asyncHandler(async (_req, res) => {
  res.json({ success: true, data: publicPlanConfig() });
}));

/** Current plan, billing state and usage meters for the billing page (§58). */
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
  const userId = String((req as any).user.userId);
  const legacy = (req as any).user.plan;
  const ctx = await getCurrentPlan(userId, legacy);
  const sub = await Subscription.getOrCreateForUser(userId);

  const [aiCreditsUsed, aiInterviewsUsed, resumeVersionsUsed] = await Promise.all([
    getUsage(userId, 'aiCredits'),
    getUsage(userId, 'aiInterviews'),
    getUsage(userId, 'resumeVersions'),
  ]);

  res.json({
    success: true,
    data: {
      planId: ctx.planId,
      status: ctx.status,
      billingInterval: ctx.billingInterval ?? null,
      currentPeriodEnd: ctx.currentPeriodEnd,
      cancelAtPeriodEnd: ctx.cancelAtPeriodEnd,
      accessEndsAt: ctx.accessEndsAt,
      entitlements: ctx.entitlements,
      limits: ctx.limits,
      usage: {
        aiCredits: { used: aiCreditsUsed, quota: ctx.limits.aiCreditsPerMonth },
        aiInterviews: { used: aiInterviewsUsed, quota: ctx.limits.aiInterviewsPerMonth },
        resumeVersions: { used: resumeVersionsUsed, quota: ctx.limits.resumeVersions },
      },
      provider: sub.provider,
      // Portal/cancel actions stay on the existing /api/payment routes.
      manageUrl: '/api/payment/create-portal-session',
    },
  });
}));

/**
 * Development/manual plan activation (no Stripe configured). Guarded so it
 * CANNOT be used when Stripe is live — webhook state is authoritative then.
 */
router.post('/activate-manual', authenticateToken, asyncHandler(async (req, res) => {
  if (process.env.STRIPE_SECRET_KEY) {
    return res.status(403).json({ success: false, error: 'Stripe is configured — use checkout.' });
  }
  if (process.env.ALLOW_MANUAL_PLAN_ACTIVATION !== 'true') {
    return res.status(403).json({ success: false, error: 'Manual plan activation is disabled.' });
  }
  const userId = String((req as any).user.userId);
  const { planId } = (req.body || {}) as { planId?: 'free' | 'pro' | 'campus' };
  if (!planId || !['free', 'pro', 'campus'].includes(planId)) {
    return res.status(400).json({ success: false, error: 'planId must be free|pro|campus' });
  }
  const sub = await Subscription.getOrCreateForUser(userId);
  sub.planId = planId;
  sub.provider = 'manual';
  sub.status = 'ACTIVE';
  sub.history.push({ at: new Date(), event: 'MANUAL_ACTIVATE', detail: planId });
  await sub.save();
  res.json({ success: true, data: { planId } });
}));

export default router;
