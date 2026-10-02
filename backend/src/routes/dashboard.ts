import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken, requireCandidate } from '../middleware/auth';
import { getDashboardSummary } from '../services/dashboard.service';
import { isValidRoleSlug } from '../career/services/roleProgress.service';

/**
 * Dashboard read API (spec §14).
 *
 * `GET /api/dashboard/summary` returns everything the home dashboard renders in
 * one request. The per-metric analytics endpoints under /api/analytics remain
 * available for the deep-dive Analytics page, but the dashboard does not fan
 * out into a dozen calls to paint one screen.
 */
const router = Router();

router.get(
  '/summary',
  authenticateToken,
  requireCandidate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    // ?role= switches the dashboard to one of the candidate's target roles.
    const roleParam = String(req.query.role ?? '').toLowerCase().trim();
    const roleSlug = isValidRoleSlug(roleParam) ? roleParam : undefined;

    const summary = await getDashboardSummary(userId, { roleSlug });
    return res.json({ success: true, data: summary });
  }),
);

export default router;