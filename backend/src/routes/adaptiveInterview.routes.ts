import express from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import AdaptiveInterview, {
  IAdaptiveInterview, IAdaptiveQuestion, IProctorEvent, computeIntegrityScore,
} from '../models/AdaptiveInterview';
import { asyncHandler } from '../middleware/errorHandler';
import cloudinaryService from '../services/cloudinary';
import localStorageService from '../services/localStorage';
import {
  startAdaptiveSession, generateFirstQuestion, generateAdaptiveQuestion,
  evaluateAnswer, decideNextAction, generateFinalReport, toClientQuestion,
  extractJobRequirements,
} from '../services/adaptiveInterview.service';
import { analyzeDelivery, analyzeStar } from '../services/speechAnalysis';
import { runBehaviorAnalysis } from '../services/behaviorAnalysis';
import { recordAskedQuestion } from '../services/questionHistory';
import { followUpTrail, learningRecommendations } from '../services/interviewReportEnhancer';
import logger from '../utils/logger';

// ── Webcam recording upload (disk storage → durable local copy, Cloudinary mirror) ──
const MAX_RECORDING_BYTES = 100 * 1024 * 1024; // 100MB ≈ 1h at low bitrate; MediaRecorder webm is small
const recordingStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // Write into the durable local store FIRST — the recording survives even if
    // Cloudinary mirroring fails later.
    localStorageService
      .ensureRecordingDir()
      .then(dir => cb(null, dir))
      .catch(err => cb(err as Error, ''));
  },
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.webm').toLowerCase();
    const safeExt = ['.webm', '.mp4', '.mkv', '.ogg', '.m4a'].includes(ext) ? ext : '.webm';
    cb(null, `recording_incoming_${Date.now()}${Math.random().toString(36).slice(2, 8)}${safeExt}`);
  },
});
const recordingUpload = multer({
  storage: recordingStorage,
  limits: { fileSize: MAX_RECORDING_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const okMime = /^video\//.test(file.mimetype) || file.mimetype === 'audio/webm';
    const okExt = ['.webm', '.mp4', '.mkv', '.ogg', '.m4a'].includes(ext) || !ext; // browsers may send blob names
    if (okMime && okExt) return cb(null, true);
    cb(new Error('Only video recordings (webm/mp4) are accepted'));
  },
});

function handleRecordingMulterError(err: any, _req: express.Request, res: express.Response, next: express.NextFunction): void {
  // Clean up any partially-written temp file on failure.
  if (err && (err instanceof multer.MulterError || err.message?.includes('recording'))) {
    const f = (_req as any).file;
    if (f?.path) { try { require('fs').unlinkSync(f.path); } catch { /* ignore */ } }
  }
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ success: false, error: 'Recording too large (max 100MB)' });
      return;
    }
    res.status(400).json({ success: false, error: `Recording upload error: ${err.message}` });
    return;
  }
  if (err) {
    res.status(400).json({ success: false, error: err.message });
    return;
  }
  next();
}

const router = express.Router();

const DOMAINS = [
  'Data Structures & Algorithms', 'Web Development', 'DBMS', 'Operating Systems',
  'Computer Networks', 'Java', 'Python', 'JavaScript', 'React', 'Node.js',
  'Machine Learning', 'System Design', 'OOP', 'Software Testing', 'Cloud & DevOps',
] as const;

function badRequest(res: any, details: unknown) {
  return res.status(400).json({ success: false, error: 'Validation failed', details });
}

async function loadSession(req: any, res: any): Promise<IAdaptiveInterview | null> {
  const s = await AdaptiveInterview.findOne({ _id: req.params.id, userId: req.user!.userId });
  if (!s) {
    res.status(404).json({ success: false, error: 'Interview not found' });
    return null;
  }
  return s;
}

// ── Create session ───────────────────────────────────────────────────────────
router.post(
  '/create',
  [
    body('domain').isString().trim().isLength({ min: 2, max: 60 }),
    body('role').optional({ nullable: true }).isString().trim().isLength({ max: 80 }),
    body('difficulty').isIn(['easy', 'medium', 'hard']),
    body('questionCount').optional().isInt({ min: 3, max: 15 }).toInt(),
    body('experienceLevel').optional({ nullable: true }).isString().trim().isLength({ max: 40 }),
    body('interviewType').optional().isIn(['technical', 'behavioral', 'hr', 'project', 'mixed']),
    body('resumeId').optional({ nullable: true }).isMongoId(),
    body('jobDescription').optional({ nullable: true }).isString().trim().isLength({ max: 8000 }),
    body('consentRecording').optional().isBoolean(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return badRequest(res, errors.array().map((e: any) => ({ field: e.param || e.path, message: e.msg })));

    const { domain, role = '', difficulty, questionCount = 6 } = req.body;
    const session = await startAdaptiveSession({
      userId: req.user!.userId, domain, role, difficulty, plannedQuestions: questionCount,
      experienceLevel: req.body.experienceLevel,
      interviewType: req.body.interviewType,
      resumeId: req.body.resumeId || null,
      jobDescription: req.body.jobDescription || '',
    });

    // Explicit recording consent (spec §37) — stored timestamp, never implicit.
    if (req.body.consentRecording === true) {
      session.consent = { recording: true, consentedAt: new Date(), policyVersion: '2026-09' };
      await session.save();
    }
    const firstQuestion = await generateFirstQuestion(session.domain, session.role, session.difficulty, session.plan[0].topic);
    session.plan[0].asked = 1;
    session.questions.push(firstQuestion);
    await session.save();

    logger.info(`Adaptive interview created: ${session._id} for user ${req.user!.userId} (domain: ${domain})`);
    res.status(201).json({
      success: true,
      data: {
        sessionId: session._id, domain: session.domain, difficulty: session.difficulty,
        plannedQuestions: session.plannedQuestions, plan: session.plan,
        question: toClientQuestion(firstQuestion),
      },
    });
  }),
);

// ── Get session state (resume) ───────────────────────────────────────────────
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const session = await loadSession(req, res);
    if (!session) return;
    const answeredIds = new Set(session.responses.map(r => r.questionId));
    const pending = session.questions.find(q => !answeredIds.has(q.id));
    res.json({
      success: true,
      data: {
        sessionId: session._id, domain: session.domain, difficulty: session.difficulty,
        plannedQuestions: session.plannedQuestions, plan: session.plan,
        status: session.status, proctorEvents: session.proctorEvents,
        integrityScore: session.integrityScore, report: session.report,
        startedAt: session.startedAt,
        question: session.status === 'in-progress' ? (pending ? toClientQuestion(pending) : null) : null,
        answeredCount: session.responses.length,
        lastFeedback: session.responses.length ? session.responses[session.responses.length - 1] : null,
      },
    });
  }),
);

// ── Submit answer → evaluate → decide → next question ───────────────────────
router.post(
  '/:id/answer',
  [body('questionId').isString().notEmpty(), body('answer').isString().isLength({ max: 8000 }), body('durationSeconds').optional().isFloat({ min: 0, max: 7200 }).toFloat()],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return badRequest(res, errors.array().map((e: any) => ({ field: e.param || e.path, message: e.msg })));

    const { questionId, answer, durationSeconds = 0 } = req.body;
    const answerSource = req.body.answerSource === 'voice' ? 'voice' as const : 'text' as const;
    const session = await loadSession(req, res);
    if (!session) return;
    if (session.status !== 'in-progress') {
      return res.status(409).json({ success: false, error: 'This interview has already ended' });
    }

    const question = session.questions.find(q => q.id === questionId);
    if (!question) return res.status(404).json({ success: false, error: 'Question not found' });
    if (session.responses.some(r => r.questionId === questionId)) {
      return res.status(409).json({ success: false, error: 'This question has already been answered' });
    }

    // 1. Evaluate the answer (Gemini, heuristic fallback)
    const evaluation = await evaluateAnswer(session, question, answer, durationSeconds);

    // 2. Deterministic delivery + STAR analysis (observable metrics only)
    const delivery = analyzeDelivery(answer, durationSeconds);
    const star = session.interviewType === 'behavioral' || session.interviewType === 'mixed' || /behavior|team|conflict|leadership|time when/i.test(question.topic)
      ? analyzeStar(answer)
      : null;

    // 3. Persist response
    session.responses.push({
      questionId, questionText: question.text, topic: question.topic,
      answer, answerSource, durationSeconds: Math.round(durationSeconds),
      scores: evaluation.scores, overallScore: evaluation.overallScore, verdict: evaluation.verdict,
      strengths: evaluation.strengths, improvements: evaluation.improvements,
      matchedKeywords: evaluation.matchedKeywords, missingKeywords: evaluation.missingKeywords,
      aiSummary: evaluation.aiSummary,
      nextFocus: evaluation.nextFocus,
      delivery: {
        wordCount: delivery.wordCount,
        fillerCount: delivery.fillerCount,
        wordsPerMinute: delivery.wordsPerMinute,
      },
      star,
      timestamp: new Date(),
    });

    // Question history for cross-interview non-repetition (spec §23).
    void recordAskedQuestion({
      userId: String(session.userId),
      questionId,
      text: question.text,
      topic: question.topic,
      role: session.role || session.domain,
    }).catch(() => undefined);

    // 3. Update plan bookkeeping
    const planItem = session.plan.find(p => p.topic === question.topic);
    if (planItem) {
      planItem.avgScore = planItem.avgScore == null
        ? evaluation.overallScore
        : Math.round((planItem.avgScore * (planItem.asked) + evaluation.overallScore) / (planItem.asked + 1));
    }

    // 4. Adaptive decision (now async — runs the FollowUpDecision engine)
    const decision = await decideNextAction(session, evaluation);
    let nextQuestion: IAdaptiveQuestion | null = null;
    if (decision.action === 'continue') {
      nextQuestion = await generateAdaptiveQuestion(session, decision);
      session.questions.push(nextQuestion);
      const target = session.plan.find(p => p.topic === nextQuestion!.topic);
      if (target) target.asked += 1;
    } else {
      session.status = 'completed';
      session.endedAt = new Date();
    }

    await session.save();

    res.json({
      success: true,
      data: {
        feedback: {
          scores: evaluation.scores, overallScore: evaluation.overallScore, verdict: evaluation.verdict,
          strengths: evaluation.strengths, improvements: evaluation.improvements,
          matchedKeywords: evaluation.matchedKeywords, aiSummary: evaluation.aiSummary,
        },
        nextQuestion: nextQuestion ? toClientQuestion(nextQuestion) : null,
        completed: decision.action === 'end',
        answeredCount: session.responses.length,
        plannedQuestions: session.plannedQuestions,
        reason: decision.reason,
      },
    });
  }),
);

// ── Proctoring events ────────────────────────────────────────────────────────
router.post(
  '/:id/proctor',
  [body('type').isString().notEmpty()],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return badRequest(res, errors.array());

    const session = await loadSession(req, res);
    if (!session) return;
    if (session.status !== 'in-progress') return res.json({ success: true });

    const VALID = new Set([
      'tab-switch', 'window-blur', 'copy-attempt', 'paste-attempt', 'screenshot-key',
      'devtools-shortcut', 'fullscreen-exit', 'camera-off', 'mic-off', 'face-missing', 'no-face-long',
    ]);
    const type = String(req.body.type);
    if (!VALID.has(type)) return badRequest(res, { type: 'unknown proctor event type' });

    const event: IProctorEvent = { type: type as IProctorEvent['type'], at: new Date(), detail: String(req.body.detail || '').slice(0, 200) };
    session.proctorEvents.push(event);
    session.integrityScore = computeIntegrityScore(session.proctorEvents);
    await session.save();

    res.json({ success: true, data: { integrityScore: session.integrityScore, totalEvents: session.proctorEvents.length } });
  }),
);

// ── End interview (early finish) → generate report ──────────────────────────
router.post(
  '/:id/end',
  asyncHandler(async (req, res) => {
    const session = await loadSession(req, res);
    if (!session) return;
    if (session.status === 'completed') {
      return res.json({ success: true, data: { sessionId: session._id, completed: true, report: session.report } });
    }

    session.status = 'completed';
    session.endedAt = new Date();
    // Integrity force-end: the shared integrity system reached warning 5.
    if (req.body?.terminationReason === 'INTEGRITY_WARNING_LIMIT') {
      session.terminationReason = 'INTEGRITY_WARNING_LIMIT';
    }
    session.report = await generateFinalReport(session, session.proctorEvents);
    await session.save();

    logger.info(`Adaptive interview ${session._id} ended. Score: ${session.report.overallScore}, integrity: ${session.integrityScore}`);
    res.json({ success: true, data: { sessionId: session._id, completed: true, report: session.report } });
  }),
);

// ── Report (fetch) ───────────────────────────────────────────────────────────
router.get(
  '/:id/report',
  asyncHandler(async (req, res) => {
    const session = await loadSession(req, res);
    if (!session) return;
    if (session.status !== 'completed') {
      return res.status(409).json({ success: false, error: 'Report is not available yet' });
    }
    // Sessions that auto-complete via the last answer have no report yet — generate on demand.
    if (!session.report) {
      session.report = await generateFinalReport(session, session.proctorEvents);
      await session.save();
      logger.info(`Adaptive interview ${session._id} report generated on demand`);
    }
    res.json({
      success: true,
      data: {
        sessionId: session._id,
        domain: session.domain,
        role: session.role,
        difficulty: session.difficulty,
        durationSeconds: session.endedAt ? Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 1000) : 0,
        report: session.report,
        speakingMetrics: session.speakingMetrics || null,
        englishAnalysis: session.englishAnalysis || null,
        behaviorAnalysis: session.behaviorAnalysis || null,
        followUpTrail: followUpTrail(session),
        learningRecommendations: learningRecommendations(session),
        starByQuestion: session.responses.map(r => ({ questionId: r.questionId, star: r.star || null })),
        recording: session.recording?.publicId
          ? {
              available: true,
              storageType: session.recording.storageType,
              sizeBytes: session.recording.sizeBytes,
              durationSeconds: session.recording.durationSeconds ?? null,
              // Local recordings stream through the authorized route; Cloudinary ones are proxied too.
              playbackUrl: `/api/adaptive-interview/${session._id}/recording`,
              uploadedAt: session.recording.uploadedAt,
            }
          : { available: false, playbackUrl: null },
        transcript: session.responses.map(r => ({
          questionId: r.questionId, questionText: r.questionText, topic: r.topic,
          answer: r.answer, durationSeconds: r.durationSeconds,
          overallScore: r.overallScore, verdict: r.verdict,
          strengths: r.strengths, improvements: r.improvements, aiSummary: r.aiSummary,
          timestamp: r.timestamp,
        })),
      },
    });
  }),
);

// ── Upload webcam recording (called once, right after the interview ends) ──
router.post(
  '/:id/recording',
  recordingUpload.single('recording'),
  handleRecordingMulterError,
  asyncHandler(async (req, res) => {
    const session = await loadSession(req, res);
    if (!session) return;
    if (!req.file) return res.status(400).json({ success: false, error: 'Recording file is required' });

    // Idempotent: a re-upload (e.g. browser retried after a timeout) replaces
    // the previous file instead of failing the whole interview flow.
    const previous = session.recording?.publicId;
    if (session.recording?.url || previous) {
      logger.warn(`Recording re-upload for session ${session._id} — replacing previous entry`);
      try {
        if (session.recording?.storageType === 'local' && previous) {
          localStorageService.deleteFile(previous);
        }
      } catch { /* best effort cleanup */ }
    }

    const mimeType = req.file.mimetype || 'video/webm';
    const tmpPath = (req.file as any).path as string;

    // 1) Durable local copy — primary storage, always succeeds or the request fails.
    const local = await localStorageService.adoptRecordingFile(tmpPath, {
      sessionId: String(session._id),
      userId: String(session.userId),
      mimeType,
    });
    let storageType: 'cloudinary' | 'local' = 'local';
    let cloudinaryUrl = '';

    // 2) Best-effort Cloudinary mirror for off-site backup (never blocks save).
    if (cloudinaryService.isHealthy()) {
      try {
        const buffer = (await import('fs/promises')).readFile(local.filePath);
        const result = await cloudinaryService.uploadVideo(buffer, {
          folder: 'smart-interview-ai/adaptive-interviews',
          public_id: `adaptive-interviews/recording_${session._id}_${Date.now()}`,
        });
        cloudinaryUrl = result.secure_url;
        storageType = 'cloudinary';
        logger.info(`Recording mirrored to Cloudinary: ${result.public_id} (${req.file.size} bytes)`);
      } catch (err: any) {
        logger.warn(`Cloudinary recording mirror failed (local copy kept): ${err.message}`);
      }
    }

    session.recording = {
      url: storageType === 'cloudinary' ? cloudinaryUrl : '',
      publicId: local.publicId,
      storageType,
      mimeType,
      sizeBytes: req.file.size,
      durationSeconds: Number(req.body.durationSeconds) > 0 ? Math.round(Number(req.body.durationSeconds)) : undefined,
      uploadedAt: new Date(),
    };
    session.markModified('recording');
    await session.save();

    // 3) Behavior/confidence analysis runs AFTER the durable save (§: never block).
    void runBehaviorAnalysis(String(session._id)).catch(err =>
      logger.warn(`Background behavior analysis failed for ${session._id}: ${err?.message || err}`));

    res.status(201).json({
      success: true,
      data: {
        storageType, sizeBytes: req.file.size,
        playbackUrl: `/api/adaptive-interview/${session._id}/recording`,
        behaviorAnalysis: session.behaviorAnalysis ?? null,
      },
    });
  }),
);

// ── Re-run behavior analysis (used when the first pass failed or AI server was down) ──
router.post(
  '/:id/behavior-analysis',
  asyncHandler(async (req, res) => {
    const session = await loadSession(req, res);
    if (!session) return;
    if (!session.recording?.publicId) {
      return res.status(400).json({ success: false, error: 'No recording available for this interview' });
    }
    try {
      await runBehaviorAnalysis(String(session._id));
    } catch (err: any) {
      logger.warn(`Manual behavior analysis failed for ${session._id}: ${err?.message || err}`);
      return res.status(503).json({ success: false, error: 'Analysis service is temporarily unavailable. Try again shortly.' });
    }
    const fresh = await AdaptiveInterview.findOne({ _id: session._id });
    res.json({ success: true, data: { behaviorAnalysis: fresh?.behaviorAnalysis ?? null } });
  }),
);

// ── Stream the recording (authorized playback for the owner) ────────────────
router.get(
  '/:id/recording',
  asyncHandler(async (req, res) => {
    const session = await loadSession(req, res);
    if (!session) return;
    if (!session.recording?.publicId) {
      return res.status(404).json({ success: false, error: 'No recording available for this interview' });
    }

    if (session.recording.storageType === 'cloudinary' && session.recording.url) {
      // Proxy so the Cloudinary URL and credentials never reach the browser.
      const axios = (await import('axios')).default;
      const upstream = await axios.get(session.recording.url, { responseType: 'stream', timeout: 20000 });
      res.setHeader('Content-Type', session.recording.mimeType || 'video/webm');
      res.setHeader('Content-Disposition', `inline; filename="interview-${session._id}.webm"`);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      (upstream.data as any).pipe(res);
      return;
    }

    // Local storage — stream from disk with range support (seeking).
    const fs = await import('fs');
    const filePath = localStorageService.getFilePath(session.recording.publicId);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Recording file missing on server' });
    }
    const stat = fs.statSync(filePath);
    const range = req.headers.range;
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', session.recording.mimeType || 'video/webm');
    res.setHeader('Content-Disposition', `inline; filename="interview-${session._id}.webm"`);
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      const start = match && match[1] ? parseInt(match[1], 10) : 0;
      const end = match && match[2] ? Math.min(parseInt(match[2], 10), stat.size - 1) : stat.size - 1;
      if (start >= stat.size || start > end) {
        res.status(416).setHeader('Content-Range', `bytes */${stat.size}`);
        return res.end();
      }
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      res.setHeader('Content-Length', String(end - start + 1));
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.setHeader('Content-Length', String(stat.size));
      fs.createReadStream(filePath).pipe(res);
    }
  }),
);

// ── History ──────────────────────────────────────────────────────────────────
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit)) || 10));
    const query = { userId: req.user!.userId };
    const [items, total] = await Promise.all([
      AdaptiveInterview.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
        .select('domain role difficulty status plannedQuestions startedAt endedAt integrityScore report.overallScore report.domainReadiness'),
      AdaptiveInterview.countDocuments(query),
    ]);
    res.json({
      success: true, data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }),
);

export default router;
