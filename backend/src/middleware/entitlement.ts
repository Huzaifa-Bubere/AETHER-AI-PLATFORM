/**
 * AETHER — Entitlement middleware (spec §50).
 *
 * Backend-enforced access control. The frontend PRO badge is presentation;
 * these guards are the actual gate.
 */

import type { NextFunction, Request, Response } from 'express';
import type { EntitlementKey } from '../config/plans';
import {
  assertAiCredits, consumeUsage, getCurrentPlan, hasEntitlement,
} from '../services/entitlement.service';

declare module 'express-serve-static-core' {
  interface Request {
    planContext?: import('../services/entitlement.service').PlanContext;
  }
}

/** Attach the user's plan context for downstream handlers. */
export async function attachPlanContext(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = String(req.user!.userId);
    const legacy = (req.user as any)?.plan;
    req.planContext = await getCurrentPlan(userId, legacy);
    next();
  } catch (err) { next(err); }
}

/** Block the request unless the user holds the entitlement. */
export function requireEntitlement(feature: EntitlementKey) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = String(req.user!.userId);
      const legacy = (req.user as any)?.plan;
      const ok = await hasEntitlement(userId, feature, legacy);
      if (!ok) {
        res.status(402).json({
          success: false,
          error: 'UPGRADE_REQUIRED',
          message: `This feature requires AETHER Pro (${feature}).`,
          feature,
        });
        return;
      }
      next();
    } catch (err) { next(err); }
  };
}

/**
 * Enforce + consume AI credits for an operation. Cost comes from the central
 * config — handlers never hardcode credit prices.
 */
export function requireAiCredits(operation: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = String(req.user!.userId);
      const legacy = (req.user as any)?.plan;
      await assertAiCredits(userId, operation, legacy);
      res.on('finish', () => {
        // Only bill on success — failed requests don't consume credits.
        if (res.statusCode < 400) {
          void consumeUsage(userId, 'aiCredits', 1, operation).catch(() => {});
        }
      });
      next();
    } catch (err) { next(err); }
  };
}

export { consumeUsage };
