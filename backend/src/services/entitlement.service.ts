/**
 * AETHER — Entitlement & usage service (spec §50-§51, §63, §65).
 *
 * Central gatekeeping: getCurrentPlan, hasEntitlement, getUsage, consumeUsage,
 * getRemainingUsage. Routes call these instead of scattering plan checks.
 *
 * Downgrade rule (§63): data is never deleted — limits apply to NEW creation;
 * existing rows remain viewable.
 */

import type { BillingInterval, EntitlementKey, PlanId } from '../config/plans';
import { AI_CREDIT_COSTS, PLANS } from '../config/plans';
import { Subscription, ISubscription } from '../models/Subscription';
import { UsageLedger } from '../models/UsageLedger';

export interface PlanContext {
  planId: PlanId;
  status: ISubscription['status'];
  entitlements: EntitlementKey[];
  limits: (typeof PLANS)[PlanId]['limits'];
  billingInterval?: BillingInterval;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd: boolean;
  accessEndsAt?: Date | null;
}

/** Map legacy User.subscription.plan onto the plan config. */
function normalizeLegacyPlan(plan?: string): PlanId {
  // Case-insensitive: legacy rows may hold 'Pro'/'PRO'/'Enterprise'. An
  // unrecognised value must resolve to free, never throw, so entitlement
  // checks can never block a request.
  const lowered = String(plan ?? '').trim().toLowerCase();
  if (lowered === 'pro' || lowered === 'enterprise') return 'pro';
  return 'free';
}

/** A subscription grants paid access while ACTIVE/TRIALING/PAST_DUE within period. */
function isPaidAccessActive(sub: ISubscription): boolean {
  if (!['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED'].includes(sub.status)) return false;
  if (sub.status === 'CANCELED' && !sub.cancelAtPeriodEnd) return false;
  if (sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() < Date.now()) return false;
  if (sub.accessEndsAt && sub.accessEndsAt.getTime() < Date.now()) return false;
  return sub.planId !== 'free';
}

export async function getCurrentPlan(userId: string, legacyPlan?: string): Promise<PlanContext> {
  const sub = await Subscription.getOrCreateForUser(userId);
  const planId: PlanId = isPaidAccessActive(sub) ? sub.planId : normalizeLegacyPlan(legacyPlan);
  const def = PLANS[planId];
  return {
    planId,
    status: sub.status,
    entitlements: def.entitlements,
    limits: def.limits,
    billingInterval: sub.billingInterval,
    currentPeriodEnd: sub.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    accessEndsAt: sub.accessEndsAt ?? null,
  };
}

export async function hasEntitlement(userId: string, feature: EntitlementKey, legacyPlan?: string): Promise<boolean> {
  const ctx = await getCurrentPlan(userId, legacyPlan);
  return ctx.entitlements.includes(feature);
}

/** Start of the current monthly quota window (calendar month, UTC). */
export function currentPeriodStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getUsage(userId: string, feature: string): Promise<number> {
  return UsageLedger.sumForPeriod(userId, feature, currentPeriodStart());
}

export async function getRemainingUsage(userId: string, feature: string, legacyPlan?: string): Promise<number | null> {
  const ctx = await getCurrentPlan(userId, legacyPlan);
  const quota = feature === 'aiCredits'
    ? ctx.limits.aiCreditsPerMonth
    : feature === 'aiInterviews'
      ? ctx.limits.aiInterviewsPerMonth
      : feature === 'resumeVersions'
        ? ctx.limits.resumeVersions
        : feature === 'aptitudeAttempts'
          ? ctx.limits.aptitudeAttemptsPerMonth
          : null;
  if (quota === null || quota === undefined) return null; // unlimited / not metered
  const used = await getUsage(userId, feature);
  return Math.max(0, quota - used);
}

export async function consumeUsage(
  userId: string,
  feature: string,
  amount: number,
  operation?: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  await UsageLedger.create({ userId, feature, amount, operation, meta });
}

/** Cost in AI credits for an operation (centralized, spec §48). */
export function creditCost(operation: keyof typeof AI_CREDIT_COSTS | string): number {
  return AI_CREDIT_COSTS[operation] ?? 1;
}

/**
 * Throws when the monthly AI-credit allowance is exhausted.
 * Returns remaining credits after the check.
 */
export async function assertAiCredits(userId: string, operation: string, legacyPlan?: string): Promise<number> {
  const ctx = await getCurrentPlan(userId, legacyPlan);
  const quota = ctx.limits.aiCreditsPerMonth;
  if (quota === null || quota === undefined) return Number.MAX_SAFE_INTEGER;
  const cost = creditCost(operation);
  const used = await getUsage(userId, 'aiCredits');
  if (used + cost > quota) {
    const err: any = new Error(
      `Monthly AI credits exhausted (${used}/${quota} used). Upgrade to AETHER Pro for a higher allowance.`,
    );
    err.statusCode = 402;
    err.code = 'AI_CREDITS_EXHAUSTED';
    throw err;
  }
  return quota - used - cost;
}

export { PLANS };
