import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { getProfessionalProfile } from '../services/profile.service';

/**
 * Professional profile read API (spec §24–§28).
 *
 * One request assembles the hero, completeness, target roles, role progress,
 * evidenced skills, streak, activity and saved resumes.
 *
 * Any authenticated account may read its OWN profile — this endpoint returns the
 * caller's own document (`req.user.userId`) and never another user's, so it is
 * not a candidate-only action like taking an assessment. `/profile` is in fact
 * the one route the frontend deliberately opens to admins (see
 * `ProtectedRoute allowAdmin` in App.tsx), and the candidate-only sections
 * (role progress, evidenced skills, streak, resumes) degrade to honest empty
 * states for an account that has none, rather than failing the whole page.
 * Guarding this with requireCandidate made an admin's profile page impossible to
 * load — it returned 403 while the UI only ever showed "Could not load your
 * profile".
 */
const router = Router();

router.get(
  '/me',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await getProfessionalProfile(req.user!.userId);
    return res.json({ success: true, data });
  }),
);

export default router;