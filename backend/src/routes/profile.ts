import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken, requireCandidate } from '../middleware/auth';
import { getProfessionalProfile } from '../services/profile.service';

/**
 * Professional profile read API (spec §24–§28).
 *
 * One request assembles the hero, completeness, target roles, role progress,
 * evidenced skills, streak, activity and saved resumes.
 */
const router = Router();

router.get(
  '/me',
  authenticateToken,
  requireCandidate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await getProfessionalProfile(req.user!.userId);
    return res.json({ success: true, data });
  }),
);

export default router;