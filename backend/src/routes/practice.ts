import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler';
import geminiService from '../services/gemini';
import PracticeSession from '../models/PracticeSession';
import logger from '../utils/logger';

const router = express.Router();

// ── Generate practice questions + create session ──────────────────────────────
router.post(
  '/questions',
  [
    body('type')
      .isIn(['behavioral', 'technical', 'coding', 'system-design'])
      .withMessage('Type must be one of: behavioral, technical, coding, system-design'),
    body('difficulty')
      .isIn(['easy', 'medium', 'hard'])
      .withMessage('Difficulty must be one of: easy, medium, hard'),
    body('count').isInt({ min: 1, max: 10 }).withMessage('Count must be between 1 and 10'),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
      return;
    }

    const { type, difficulty, count, role } = req.body;

    logger.info(`Generating ${count} practice questions: ${type} - ${difficulty}`);

    const questions = await geminiService.generateInterviewQuestions({
      role: role || 'Software Engineer',
      experienceLevel: 'mid',
      interviewType: type,
      difficulty,
      count,
    });

    const session = await PracticeSession.create({
      userId: req.user!.userId,
      type,
      difficulty,
      role: role || 'Software Engineer',
      questions,
      responses: [],
      status: 'active',
      startTime: new Date(),
    });

    logger.info(`Practice session created in DB: ${session._id}`);

    res.json({
      success: true,
      data: { sessionId: session._id.toString(), questions },
      message: 'Practice questions generated',
    });
  })
);

// ── Submit a practice response ────────────────────────────────────────────────
router.post(
  '/response',
  [
    body('sessionId').notEmpty(),
    body('questionId').notEmpty(),
    body('answer').notEmpty().trim(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
      return;
    }

    const { sessionId, questionId, answer } = req.body;

    const session = await PracticeSession.findOne({
      _id: sessionId,
      userId: req.user!.userId,
    });

    if (!session) {
      res.status(404).json({ success: false, error: 'Practice session not found' });
      return;
    }

    const question = session.questions.find((q) => q.id === questionId);
    if (!question) {
      res.status(404).json({ success: false, error: 'Question not found' });
      return;
    }

    const analysis = await geminiService.analyzeResponse({
      question: question.text,
      answer,
      role: session.role,
    });

    session.responses.push({
      questionId,
      answer,
      analysis,
      timestamp: new Date(),
    });

    await session.save();

    res.json({
      success: true,
      data: {
        analysis,
        questionsRemaining: session.questions.length - session.responses.length,
      },
      message: 'Response analyzed successfully',
    });
  })
);

// ── Get a practice session ────────────────────────────────────────────────────
router.get(
  '/session/:sessionId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const session = await PracticeSession.findOne({
      _id: req.params.sessionId,
      userId: req.user!.userId,
    });

    if (!session) {
      res.status(404).json({ success: false, error: 'Practice session not found' });
      return;
    }

    res.json({ success: true, data: session });
  })
);

// ── End a practice session ────────────────────────────────────────────────────
router.post(
  '/session/:sessionId/end',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const session = await PracticeSession.findOne({
      _id: req.params.sessionId,
      userId: req.user!.userId,
    });

    if (!session) {
      res.status(404).json({ success: false, error: 'Practice session not found' });
      return;
    }

    const endTime = new Date();
    const durationMs = endTime.getTime() - session.startTime.getTime();
    const durationMin = Math.round(durationMs / 1000 / 60);

    const answeredQuestions = session.responses.length;
    const avgScore =
      answeredQuestions > 0
        ? Math.round(
            session.responses.reduce((sum, r) => {
              const scores = Object.values((r.analysis?.scores as Record<string, number>) || {});
              const q = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
              return sum + q;
            }, 0) / answeredQuestions
          )
        : 0;

    session.status = 'completed';
    session.endTime = endTime;
    session.summary = {
      totalQuestions: session.questions.length,
      answeredQuestions,
      averageScore: avgScore,
      duration: durationMin,
    };

    await session.save();

    res.json({
      success: true,
      data: { session, summary: session.summary },
      message: 'Practice session ended',
    });
  })
);

// ── Practice history (persisted in MongoDB) ───────────────────────────────────
router.get(
  '/history',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const sessions = await PracticeSession.find({ userId: req.user!.userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('-questions -responses'); // lightweight list

    res.json({ success: true, data: sessions });
  })
);

export default router;
