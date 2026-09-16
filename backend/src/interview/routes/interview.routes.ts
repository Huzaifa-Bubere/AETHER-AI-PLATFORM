import express from 'express';
import { body, param, query } from 'express-validator';
import { interviewController } from '../controllers/interview.controller';
import { asyncHandler } from '../../middleware/errorHandler';

const router = express.Router();

// POST /api/interview/create
router.post(
  '/create',
  [
    body('role').optional().trim(),
    body('experienceLevel').optional().trim(),
    body('interviewType').optional().isIn(['technical', 'behavioral', 'hr', 'system-design', 'mixed', 'coding', 'skill-based']),
    body('difficultyMode').optional().isIn(['easy', 'medium', 'hard', 'adaptive']),
  ],
  asyncHandler((req, res) => interviewController.createInterview(req, res))
);

// POST /api/interview/:id/start
router.post(
  '/:id/start',
  [param('id').isMongoId().withMessage('Valid interview ID required')],
  asyncHandler((req, res) => interviewController.startInterview(req, res))
);

// POST /api/interview/:id/answer
router.post(
  '/:id/answer',
  [
    param('id').isMongoId().withMessage('Valid interview ID required'),
    body('answer').optional().isString(),
    body('answerSource').optional().isIn(['voice', 'text']),
  ],
  asyncHandler((req, res) => interviewController.submitAnswer(req, res))
);

// POST /api/interview/:id/end
router.post(
  '/:id/end',
  [param('id').isMongoId().withMessage('Valid interview ID required')],
  asyncHandler((req, res) => interviewController.endInterview(req, res))
);

// GET /api/interview/history/me and /history
router.get(
  '/history/me',
  asyncHandler((req, res) => interviewController.getHistory(req, res))
);
router.get(
  '/history',
  asyncHandler((req, res) => interviewController.getHistory(req, res))
);

// GET /api/interview/:id/result
router.get(
  '/:id/result',
  [param('id').isMongoId().withMessage('Valid interview ID required')],
  asyncHandler((req, res) => interviewController.getInterviewResult(req, res))
);

// Backward-compatible result routes
router.get(
  '/:id/feedback',
  [param('id').isMongoId().withMessage('Valid interview ID required')],
  asyncHandler((req, res) => interviewController.getInterviewResult(req, res))
);
router.get(
  '/:id/analysis',
  [param('id').isMongoId().withMessage('Valid interview ID required')],
  asyncHandler((req, res) => interviewController.getInterviewResult(req, res))
);

// POST /api/interview/:id/integrity
router.post(
  '/:id/integrity',
  [
    param('id').isMongoId().withMessage('Valid interview ID required'),
    body('type').isString().notEmpty().withMessage('Integrity event type required'),
  ],
  asyncHandler((req, res) => interviewController.recordIntegrityEvent(req, res))
);

// Backward-compatible proctoring route
router.post(
  '/:id/proctoring',
  [param('id').isMongoId().withMessage('Valid interview ID required')],
  asyncHandler((req, res) => interviewController.recordIntegrityEvent(req, res))
);

// Backward-compatible response route
router.post(
  '/:id/response',
  [param('id').isMongoId().withMessage('Valid interview ID required')],
  asyncHandler((req, res) => interviewController.submitAnswer(req, res))
);

// GET /api/interview/:id
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Valid interview ID required')],
  asyncHandler((req, res) => interviewController.getInterview(req, res))
);

export default router;
