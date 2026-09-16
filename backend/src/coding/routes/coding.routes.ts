import express from 'express';
import { body, query } from 'express-validator';
import { codingProblemsController } from '../controllers/coding.problems.controller';
import { codingSubmissionsController } from '../controllers/coding.submissions.controller';
import { asyncHandler } from '../../middleware/errorHandler';

const router = express.Router();

// ── Problems ─────────────────────────────────────────────────────────────────

router.get(
  '/problems',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('difficulty').optional().isIn(['all', 'Easy', 'Medium', 'Hard']),
    query('status').optional().isIn(['all', 'solved', 'unsolved', 'attempted']),
  ],
  asyncHandler((req, res) => codingProblemsController.listProblems(req, res))
);

router.get(
  '/problems/:slug',
  asyncHandler((req, res) => codingProblemsController.getProblem(req, res))
);

// ── Execution ──────────────────────────────────────────────────────────────

router.post(
  '/run',
  [
    body('language').isString().notEmpty(),
    body('sourceCode').isString().notEmpty(),
    body('problemSlug').optional().isString(),
    body('customInput').optional().isString(),
  ],
  asyncHandler((req, res) => codingSubmissionsController.runCode(req, res))
);

router.post(
  '/submit',
  [
    body('problemSlug').isString().notEmpty(),
    body('language').isString().notEmpty(),
    body('sourceCode').isString().notEmpty(),
  ],
  asyncHandler((req, res) => codingSubmissionsController.submitCode(req, res))
);

router.post(
  '/analyze',
  [
    body('language').isString().notEmpty(),
    body('sourceCode').isString().notEmpty(),
    body('problemSlug').optional().isString(),
  ],
  (req, res) => codingSubmissionsController.analyzeCode(req, res)
);

router.get(
  '/submissions/me',
  asyncHandler((req, res) => codingSubmissionsController.listMySubmissions(req, res))
);

router.get(
  '/submissions/:id',
  asyncHandler((req, res) => codingSubmissionsController.getSubmissionDetail(req, res))
);

router.get(
  '/progress/me',
  asyncHandler((req, res) => codingSubmissionsController.getMyProgress(req, res))
);

router.get(
  '/recommendations',
  asyncHandler((req, res) => codingSubmissionsController.getRecommendations(req, res))
);

export default router;
