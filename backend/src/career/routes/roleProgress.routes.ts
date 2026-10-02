import { Router, Request, Response } from 'express';
import { body, param } from 'express-validator';
import { authenticateToken, requireCandidate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { addRoleGoal, listRoleGoals, removeRoleGoal, RoleGoalError, setPrimaryGoal, updateRoleGoal } from '../services/roleGoals.service';
import { getRoleProgress, getUserRoleProgress } from '../services/userRoleProgress.service';
import { getSkillProfileSnapshot } from '../services/skillEvidence.service';
import { isValidRoleSlug } from '../services/roleProgress.service';
import { ROLE_GOAL_STATUSES, ROLE_TARGET_LEVELS } from '../models/UserCareerGoal';
import logger from '../../utils/logger';

/**
 * Multi-role goals, requirement matrix and per-role progress (spec §29–§41).
 *
 * Mounted alongside careerRoutes under /api/careers. Every number returned here
 * comes from RoleProgressService / SkillEvidenceService, so the dashboard, the
 * profile and these endpoints always report the same figure.
 */
const router = Router();

router.use(authenticateToken, requireCandidate);

const userId = (req: Request): string => (req as any).user.userId;

function handleGoalError(res: Response, error: unknown): void {
  if (error instanceof RoleGoalError) {
    const status = error.code === 'ROLE_NOT_FOUND' ? 404 : error.code === 'DUPLICATE_GOAL' ? 409 : 400;
    res.status(status).json({ success: false, error: error.message, code: error.code });
    return;
  }
  logger.error('[career.roles] unexpected error', error);
  res.status(500).json({ success: false, error: 'Could not update your target roles' });
}

/** GET /api/careers/me/goals — every target role, primary first. */
router.get(
  '/me/goals',
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await listRoleGoals(userId(req)) });
  }),
);

/** POST /api/careers/me/goals — start targeting another role. */
router.post(
  '/me/goals',
  [body('roleSlug').isString().notEmpty()],
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const goal = await addRoleGoal(userId(req), req.body);
      res.status(201).json({ success: true, data: goal });
    } catch (error) {
      handleGoalError(res, error);
    }
  }),
);

/** PATCH /api/careers/me/goals/:roleSlug — plan settings, status, priority. */
router.patch(
  '/me/goals/:roleSlug',
  [
    param('roleSlug').isString().notEmpty(),
    body('priority').optional().isInt({ min: 0, max: 100 }),
    body('targetLevel').optional().isIn(ROLE_TARGET_LEVELS as unknown as string[]),
    body('status').optional().isIn(ROLE_GOAL_STATUSES as unknown as string[]),
    body('hoursPerWeek').optional().isInt({ min: 1, max: 80 }),
    body('targetTimelineWeeks').optional().isInt({ min: 1, max: 104 }),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const goal = await updateRoleGoal(userId(req), req.params.roleSlug, req.body);
      if (!goal) {
        res.status(404).json({ success: false, error: 'You are not targeting this role' });
        return;
      }
      res.json({ success: true, data: goal });
    } catch (error) {
      handleGoalError(res, error);
    }
  }),
);

/** POST /api/careers/me/goals/:roleSlug/primary — make this the dashboard role. */
router.post(
  '/me/goals/:roleSlug/primary',
  [param('roleSlug').isString().notEmpty()],
  asyncHandler(async (req: Request, res: Response) => {
    const ok = await setPrimaryGoal(userId(req), String(req.params.roleSlug).toLowerCase());
    if (!ok) {
      res.status(404).json({ success: false, error: 'You are not targeting this role' });
      return;
    }
    res.json({ success: true, data: await listRoleGoals(userId(req)) });
  }),
);

/** DELETE /api/careers/me/goals/:roleSlug — archive; history is preserved. */
router.delete(
  '/me/goals/:roleSlug',
  [param('roleSlug').isString().notEmpty()],
  asyncHandler(async (req: Request, res: Response) => {
    const removed = await removeRoleGoal(userId(req), String(req.params.roleSlug).toLowerCase());
    if (!removed) {
      res.status(404).json({ success: false, error: 'You are not targeting this role' });
      return;
    }
    res.json({ success: true, data: await listRoleGoals(userId(req)) });
  }),
);

/** GET /api/careers/me/progress — readiness for every target role. */
router.get(
  '/me/progress',
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await getUserRoleProgress(userId(req)) });
  }),
);

/**
 * GET /api/careers/roles/:roleSlug/requirements
 * The requirement matrix for a role with live evidence applied:
 * required level, current level, status and a link to close the gap.
 */
router.get(
  '/roles/:roleSlug/requirements',
  [param('roleSlug').isString().notEmpty()],
  asyncHandler(async (req: Request, res: Response) => {
    const roleSlug = String(req.params.roleSlug).toLowerCase();
    if (!isValidRoleSlug(roleSlug)) {
      res.status(400).json({ success: false, error: 'Invalid role' });
      return;
    }
    const progress = await getRoleProgress(userId(req), roleSlug);
    if (!progress) {
      res.status(404).json({ success: false, error: 'Career role not found' });
      return;
    }
    res.json({ success: true, data: progress });
  }),
);

/**
 * GET /api/careers/me/skills
 * Every evidenced skill with its level and the sources behind it (spec §27/§90).
 * Query: ?rebuild=true forces a recompute from the source modules.
 */
router.get(
  '/me/skills',
  asyncHandler(async (req: Request, res: Response) => {
    const snapshot = await getSkillProfileSnapshot(userId(req), {
      rebuild: req.query.rebuild === 'true',
    });
    res.json({ success: true, data: snapshot });
  }),
);

export default router;
