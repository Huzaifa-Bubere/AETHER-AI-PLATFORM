import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken, requireCandidate } from '../middleware/auth';
import { getActivityTimeline } from '../services/activity.service';
import { getStreak, HEATMAP_DAYS, isValidUserId } from '../services/streak.service';

/**
 * AETHER activity + streak (spec §5, §18–§23).
 *
 * Thin HTTP layer: every number is computed by ActivityService / StreakService
 * from stored documents. Nothing here generates, samples or approximates data.
 */
const router = Router();

router.use(authenticateToken, requireCandidate);

/** Clamp a caller-supplied limit into a sane range instead of trusting it. */
function parseLimit(value: unknown, fallback: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), max);
}

/**
 * GET /api/activity/timeline
 * Recent qualifying activity grouped by the candidate's local calendar day.
 * Query: ?limit=25&roleId=backend-developer
 */
router.get(
  '/timeline',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    if (!isValidUserId(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user' });
    }
    const roleId = typeof req.query.roleId === 'string' && req.query.roleId.trim()
      ? req.query.roleId.trim().toLowerCase()
      : undefined;

    const data = await getActivityTimeline(userId, {
      limit: parseLimit(req.query.limit, 25, 200),
      roleId,
    });
    return res.json({ success: true, data });
  }),
);

/**
 * GET /api/activity/streak
 * 365-day heatmap plus current/longest streak, in the candidate's timezone.
 * Query: ?days=365&roleId=backend-developer
 */
router.get(
  '/streak',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    if (!isValidUserId(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user' });
    }
    const roleId = typeof req.query.roleId === 'string' && req.query.roleId.trim()
      ? req.query.roleId.trim().toLowerCase()
      : undefined;

    const data = await getStreak(userId, {
      days: parseLimit(req.query.days, HEATMAP_DAYS, 730),
      roleId,
    });
    return res.json({ success: true, data });
  }),
);

export default router;
