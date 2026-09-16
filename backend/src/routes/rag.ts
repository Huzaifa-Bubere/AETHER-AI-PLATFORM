import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import RagSource from '../models/RagSource';
import AptitudeQuestion, { CATEGORIES } from '../models/AptitudeQuestion';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { validateSourceUrl } from '../services/rag/documents';
import { claimIngestion, runIngestion } from '../services/rag/ingestion';
import { generateGroundedQuestions } from '../services/rag/generation';
import { DIFFICULTIES } from '../services/questions/difficulty';
import logger from '../utils/logger';

const router = Router();
router.use(authenticateToken, requireAdmin);
function validate(req: any, res: any, next: any) {
  if (!validationResult(req).isEmpty()) return res.status(400).json({ success: false, error: 'Invalid source or generation parameters.' });
  return next();
}
router.get('/sources', asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await RagSource.find().sort({ updatedAt: -1 }).limit(200).lean() });
}));
router.post('/sources', [body('title').isString().trim().isLength({ min: 3, max: 160 }), body('url').isString().isLength({ max: 2000 }),
  body('topic').isString().trim().isLength({ min: 2, max: 80 }), body('license').isString().trim().isLength({ min: 10, max: 500 })], validate,
asyncHandler(async (req, res) => {
  const url = validateSourceUrl(req.body.url).toString();
  const source = await RagSource.create({ title: req.body.title, url, topic: req.body.topic, license: req.body.license, createdBy: req.user!.userId });
  res.status(201).json({ success: true, data: source });
}));
router.post('/sources/:id/ingest', [param('id').isMongoId(), body('text').optional().isString().isLength({ min: 200, max: 1000000 })], validate,
asyncHandler(async (req, res) => {
  const source = await RagSource.findById(req.params.id);
  if (!source || !source.enabled) return res.status(404).json({ success: false, error: 'Source not found or disabled.' });
  // Persisted source status supports polling and recovery after a process restart.
  const claim = await claimIngestion(String(source._id));
  void runIngestion(claim, req.body.text).catch(() => logger.warn('rag.ingestion.job_failed', { sourceId: String(source._id) }));
  return res.status(202).json({ success: true, data: { sourceId: source._id, status: 'ingesting' } });
}));
router.patch('/sources/:id', [param('id').isMongoId(), body('enabled').isBoolean({ strict: true })], validate, asyncHandler(async (req, res) => {
  const source = await RagSource.findByIdAndUpdate(req.params.id, { $set: { enabled: req.body.enabled } }, { new: true });
  if (!source) return res.status(404).json({ success: false, error: 'Source not found.' });
  return res.json({ success: true, data: source });
}));
router.post('/generate', [body('topic').isString().trim().isLength({ min: 2, max: 80 }), body('category').isIn(CATEGORIES),
  body('roundType').isIn(['aptitude', 'technical']), body('difficulty').isIn(DIFFICULTIES), body('count').isInt({ min: 1, max: 10 }).toInt()], validate,
asyncHandler(async (req, res) => {
  const questions = await generateGroundedQuestions({ topic: req.body.topic, category: req.body.category, roundType: req.body.roundType,
    difficulty: req.body.difficulty, count: req.body.count, userId: req.user!.userId });
  res.status(201).json({ success: true, data: questions });
}));
router.get('/cache', asyncHandler(async (_req, res) => {
  const questions = await AptitudeQuestion.find({ generation: { $exists: true } }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ success: true, data: questions });
}));
export default router;
