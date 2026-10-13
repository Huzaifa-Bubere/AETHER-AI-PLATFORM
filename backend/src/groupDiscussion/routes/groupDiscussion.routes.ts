import { Router } from 'express';
import express from 'express';
import path from 'path';
import multer from 'multer';
import mongoose from 'mongoose';
import { body, param, query } from 'express-validator';
import { asyncHandler } from '../../middleware/errorHandler';
import { authenticateToken, requireCandidate, requireAdmin } from '../../middleware/auth';
import { GroupDiscussionTopic } from '../models/GroupDiscussionTopic';
import { GroupDiscussionSession } from '../models/GroupDiscussionSession';
import {
  AI_PARTICIPANTS,
  nextAiSpeaker,
  metrics,
  nextAiTurn,
  qualitativeFeedback,
  score,
} from '../services/groupDiscussion.service';
import { recordActivity } from '../../services/activity.service';
import localStorageService from '../../services/localStorage';
import cloudinaryService from '../../services/cloudinary';
import logger from '../../utils/logger';

const router = Router();

const uid = (r: any) => r.user.userId;

const ownedSession = async (req: any) =>
  GroupDiscussionSession.findOne({ _id: req.params.id, userId: uid(req) });

/**
 * Voice recordings ride the same durable local storage as interview recordings
 * (uploads/videos) with a best-effort Cloudinary mirror. A recording is only
 * ever stored if a real file was captured — the previous implementation stored a
 * client-invented `storageKey` string, which made an unrecorded session look
 * recorded.
 */
const MAX_GD_RECORDING_BYTES = 60 * 1024 * 1024;

const gdRecordingStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    localStorageService
      .ensureRecordingDir()
      .then((dir) => cb(null, dir))
      .catch((err) => cb(err as Error, ''));
  },
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.webm').toLowerCase();
    const safeExt = ['.webm', '.mp4', '.ogg', '.m4a', '.mp3', '.wav'].includes(ext) ? ext : '.webm';
    cb(null, `gd_incoming_${Date.now()}${Math.random().toString(36).slice(2, 8)}${safeExt}`);
  },
});

const gdRecordingUpload = multer({
  storage: gdRecordingStorage,
  limits: { fileSize: MAX_GD_RECORDING_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    // Browsers report MediaRecorder output as video/webm or audio/webm; both are
    // audio-only captures from the microphone here.
    const okMime = /^(audio|video)\//.test(file.mimetype);
    if (okMime) return cb(null, true);
    cb(new Error('Only audio recordings (webm/ogg/m4a) are accepted'));
  },
});

function handleGdRecordingError(err: any, _req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (err && (err instanceof multer.MulterError || err.message?.includes('recording') || err.message?.includes('audio'))) {
    const f = (_req as any).file;
    if (f?.path) { try { require('fs').unlinkSync(f.path); } catch { /* ignore */ } }
  }
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return void res.status(413).json({ success: false, error: 'Recording too large (max 60MB)' });
    }
    return void res.status(400).json({ success: false, error: `Recording upload error: ${err.message}` });
  }
  if (err) {
    return void res.status(400).json({ success: false, error: err.message });
  }
  next();
}

// ── Topics (candidate) ───────────────────────────────────────────────────────

router.get(
  '/topics',
  authenticateToken,
  requireCandidate,
  asyncHandler(async (req, res) => {
    const q: any = { isPublished: true };
    if (req.query.category) q.category = String(req.query.category).toUpperCase();
    if (req.query.difficulty) q.difficulty = String(req.query.difficulty).toUpperCase();

    let byRole = false;
    if (req.query.roleSlug) {
      const roleSlug = String(req.query.roleSlug).toLowerCase().trim();
      if (roleSlug) {
        q.roleSlugs = { $in: [roleSlug] };
        byRole = true;
      }
    }

    const [roleAligned, fallback] = await Promise.all([
      byRole
        ? GroupDiscussionTopic.find(q).sort({ usageCount: -1, createdAt: -1 }).lean()
        : GroupDiscussionTopic.find(q).sort({ createdAt: -1 }).lean(),
      byRole
        ? GroupDiscussionTopic.find({ isPublished: true }).sort({ usageCount: -1, createdAt: -1 }).lean()
        : null,
    ]);

    const data = byRole && roleAligned.length
      ? roleAligned
      : fallback ?? roleAligned;

    res.json({ success: true, data });
  }),
);

// ── Sessions (candidate) ─────────────────────────────────────────────────────

router.post(
  '/sessions',
  authenticateToken,
  requireCandidate,
  [
    body('topicId').isMongoId(),
    body('durationMinutes').isInt({ min: 5, max: 15 }),
    body('aiParticipants').optional().isInt({ min: 2, max: 3 }),
  ],
  asyncHandler(async (req: any, res) => {
    const topic = await GroupDiscussionTopic.findOne({
      _id: req.body.topicId,
      isPublished: true,
    }).lean();
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Published topic not found' });
    }

    const aiCount = Math.min(Math.max(Number(req.body.aiParticipants) || 3, 2), 3);
    const participants = AI_PARTICIPANTS.slice(0, aiCount);

    const session = await GroupDiscussionSession.create({
      userId: uid(req),
      topicId: topic._id,
      topicSnapshot: {
        title: topic.title,
        description: topic.description,
        keywords: topic.keywords,
        openingContext: topic.openingContext,
        category: topic.category,
        difficulty: topic.difficulty,
        roleSlugs: topic.roleSlugs,
      },
      roleSlug: String(req.body.roleSlug || topic.roleSlugs[0] || ''),
      difficulty: String(req.body.difficulty || topic.difficulty),
      durationMinutes: Number(req.body.durationMinutes),
      participants,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    });

    await GroupDiscussionTopic.updateOne(
      { _id: topic._id },
      { $inc: { usageCount: 1 } },
    ).catch(() => {});

    const firstSpeaker = nextAiSpeaker(
      participants as Array<{ id: string; name: string; style: string }>,
      [] as Array<{ speakerType: string; speakerId?: string }>,
    );
    if (firstSpeaker) {
      const opening = await nextAiTurn({
        participant: firstSpeaker,
        topic,
        turns: [],
        roleSlug: session.roleSlug || undefined,
      });
      if (opening) {
        session.turns.push({
          speakerType: 'AI',
          speakerId: firstSpeaker.id,
          speakerName: firstSpeaker.name,
          text: opening,
          startedAt: new Date(),
          endedAt: new Date(),
          durationSeconds: 0,
          source: 'TEXT',
          sequence: 1,
        });
      }
    }

    await session.save();
    res.status(201).json({ success: true, data: session });
  }),
);

router.get(
  '/sessions',
  authenticateToken,
  requireCandidate,
  asyncHandler(async (req: any, res) => {
    const q: any = { userId: uid(req) };
    if (req.query.status) q.status = String(req.query.status).toUpperCase();
    if (req.query.roleSlug) q.roleSlug = String(req.query.roleSlug).toLowerCase();

    const sessions = await GroupDiscussionSession.find(q)
      .sort({ createdAt: -1 })
      .select(
        'topicSnapshot roleSlug durationMinutes status overallScore createdAt candidateMetrics recording recordingConsent',
      )
      .lean();

    res.json({ success: true, data: sessions });
  }),
);

router.get(
  '/sessions/:id',
  authenticateToken,
  requireCandidate,
  asyncHandler(async (req: any, res) => {
    const session = await ownedSession(req);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    res.json({ success: true, data: session });
  }),
);

router.post(
  '/sessions/:id/turns',
  authenticateToken,
  requireCandidate,
  [body('text').isString().trim().isLength({ min: 1, max: 6000 })],
  asyncHandler(async (req: any, res) => {
    const session = await ownedSession(req);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    if (session.status !== 'IN_PROGRESS') {
      return res.status(409).json({ success: false, error: 'Discussion is not active' });
    }

    const deadline = new Date(session.startedAt).getTime() + session.durationMinutes * 60000;
    if (Date.now() > deadline) {
      return res.status(409).json({
        success: false,
        error: 'Discussion time has expired. End the discussion to view the report.',
      });
    }

    session.turns.push({
      speakerType: 'CANDIDATE',
      speakerId: uid(req),
      speakerName: 'You',
      text: req.body.text.trim(),
      startedAt: new Date(),
      endedAt: new Date(),
      durationSeconds: Math.max(0, Number(req.body.durationSeconds) || 0),
      source: req.body.source === 'VOICE' ? 'VOICE' : 'TEXT',
      sequence: session.turns.length + 1,
    });

    const nextSpeaker = nextAiSpeaker(
      session.participants as Array<{ id: string; name: string; style: string }>,
      session.turns as Array<{ speakerType: string; speakerId?: string }>,
    );
    // Whether an AI participant actually managed to respond. The UI uses this to
    // say "AI participants are offline" instead of silently looking stuck — the
    // candidate must be able to keep talking either way.
    let aiReplied = false;
    if (nextSpeaker) {
      const aiText = await nextAiTurn({
        participant: nextSpeaker,
        topic: session.topicSnapshot,
        turns: session.turns,
        roleSlug: session.roleSlug || undefined,
      });
      if (aiText) {
        session.turns.push({
          speakerType: 'AI',
          speakerId: nextSpeaker.id,
          speakerName: nextSpeaker.name,
          text: aiText,
          startedAt: new Date(),
          endedAt: new Date(),
          durationSeconds: 0,
          source: 'VOICE',
          sequence: session.turns.length + 1,
        });
        aiReplied = true;
      }
    }

    await session.save();
    res.json({ success: true, data: session, aiReplied });
  }),
);

// ── Recording (consent-gated, owner-scoped, real capture only) ───────────────

router.post(
  '/sessions/:id/recording/consent',
  authenticateToken,
  requireCandidate,
  asyncHandler(async (req: any, res) => {
    const session = await ownedSession(req);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    if (session.status !== 'IN_PROGRESS') {
      return res.status(409).json({ success: false, error: 'Recording consent is only meaningful during an active discussion.' });
    }
    const consented = Boolean(req.body.consent);
    session.recordingConsent = consented;
    await session.save();
    res.json({ success: true, data: { recordingConsent: consented } });
  }),
);

router.post(
  '/sessions/:id/recording',
  authenticateToken,
  requireCandidate,
  gdRecordingUpload.single('recording'),
  handleGdRecordingError,
  asyncHandler(async (req: any, res) => {
    const session = await ownedSession(req);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    if (!session.recordingConsent) {
      return res.status(409).json({ success: false, error: 'Recording was not consented to for this session.' });
    }
    if (session.status === 'COMPLETED') {
      return res.status(409).json({ success: false, error: 'Cannot attach recording after the discussion is completed.' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'A recorded audio file is required.' });
    }

    const mimeType = req.file.mimetype || 'audio/webm';
    const tmpPath = (req.file as any).path as string;
    const durationSeconds = Math.max(0, Math.round(Number(req.body.durationSeconds) || 0));

    const local = await localStorageService.adoptRecordingFile(tmpPath, {
      sessionId: String(session._id),
      userId: uid(req),
      mimeType,
    });

    let mirroredUrl = '';
    if (cloudinaryService.isHealthy()) {
      try {
        const buffer = await (await import('fs/promises')).readFile(local.filePath);
        const result = await cloudinaryService.uploadVideo(buffer, {
          folder: 'smart-interview-ai/group-discussions',
          public_id: `group-discussions/recording_${session._id}_${Date.now()}`,
        });
        mirroredUrl = result.secure_url;
      } catch (err: any) {
        // The durable local copy is already saved — a mirror failure is not fatal.
        logger.warn(`GD recording Cloudinary mirror failed (local copy kept): ${err?.message}`);
      }
    }

    session.recording = {
      storageKey: local.publicId,
      contentType: mimeType,
      durationSeconds,
      sizeBytes: req.file.size,
      consentedAt: session.recording?.consentedAt ?? new Date(session.createdAt || Date.now()),
      uploadedAt: new Date(),
    };
    session.markModified('recording');
    await session.save();

    res.status(201).json({
      success: true,
      data: {
        storageKey: local.publicId,
        contentType: mimeType,
        sizeBytes: req.file.size,
        durationSeconds,
        mirrored: !!mirroredUrl,
      },
    });
  }),
);

router.post(
  '/sessions/:id/end',
  authenticateToken,
  requireCandidate,
  asyncHandler(async (req: any, res) => {
    const session = await ownedSession(req);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (session.status !== 'COMPLETED') {
      const candidateMetrics = metrics(session.turns, session.topicSnapshot?.keywords || []);

      // A discussion with no candidate turn is not assessment evidence. Scoring it
      // produced a legitimate-looking 0/100 that the dashboard and the activity
      // timeline counted as "completed a group discussion", so an abandoned room
      // inflated both. Only a discussion the candidate actually took part in is
      // scored and recorded.
      if (candidateMetrics.candidateTurns === 0) {
        session.candidateMetrics = candidateMetrics;
        session.status = 'ABANDONED';
        session.endedAt = new Date();
        await session.save();
        return res.json({ success: true, data: session, recordedEvidence: false });
      }

      session.candidateMetrics = candidateMetrics;
      session.scoreBreakdown = score(session.candidateMetrics);
      session.overallScore = session.scoreBreakdown.total;
      session.feedback = await qualitativeFeedback(session);
      session.status = 'COMPLETED';
      session.endedAt = new Date();
      await session.save();

      await recordActivity({
        userId: uid(req),
        eventType: 'GROUP_DISCUSSION_COMPLETED',
        entityType: 'GROUP_DISCUSSION_SESSION',
        entityId: String(session._id),
        entityLabel: session.topicSnapshot?.title,
        roleId: session.roleSlug || undefined,
        metadata: {
          overallScore: session.overallScore,
          candidateTurns: session.candidateMetrics.candidateTurns,
          category: session.topicSnapshot?.category,
          difficulty: session.topicSnapshot?.difficulty,
        },
      });

      return res.json({ success: true, data: session, recordedEvidence: true });
    }

    res.json({ success: true, data: session, recordedEvidence: session.overallScore != null });
  }),
);

// ── Admin topic management ────────────────────────────────────────────────────

router.post(
  '/admin/topics',
  authenticateToken,
  requireAdmin,
  [
    body('title').isString().trim().isLength({ min: 5, max: 240 }),
    body('description').isString().trim().isLength({ min: 10, max: 2000 }),
    body('category').isIn(['TECHNOLOGY', 'BUSINESS', 'WORKPLACE', 'SOCIAL', 'ABSTRACT', 'ROLE_SPECIFIC']),
    body('difficulty').isIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  ],
  asyncHandler(async (req: any, res) => {
    const topic = await GroupDiscussionTopic.create({
      ...req.body,
      roleSlugs: (req.body.roleSlugs || [])
        .map(String)
        .map((s) => s.toLowerCase().trim())
        .filter(Boolean),
      keywords: (req.body.keywords || [])
        .map(String)
        .map((s) => s.toLowerCase().trim())
        .filter(Boolean),
      keyPoints: (req.body.keyPoints || [])
        .map(String)
        .map((s) => s.trim())
        .filter(Boolean),
      createdBy: uid(req),
    });
    res.status(201).json({ success: true, data: topic });
  }),
);

router.put(
  '/admin/topics/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const topic = await GroupDiscussionTopic.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          ...(req.body.title !== undefined && { title: String(req.body.title).trim() }),
          ...(req.body.description !== undefined && { description: String(req.body.description).trim() }),
          ...(req.body.category !== undefined && { category: String(req.body.category).toUpperCase() }),
          ...(req.body.difficulty !== undefined && { difficulty: String(req.body.difficulty).toUpperCase() }),
          ...(req.body.openingContext !== undefined && { openingContext: String(req.body.openingContext).trim() }),
          ...(req.body.brandingNote !== undefined && { brandingNote: String(req.body.brandingNote).trim() }),
          roleSlugs: (req.body.roleSlugs || [])
            .map(String)
            .map((s) => s.toLowerCase().trim())
            .filter(Boolean),
          keywords: (req.body.keywords || [])
            .map(String)
            .map((s) => s.toLowerCase().trim())
            .filter(Boolean),
          keyPoints: (req.body.keyPoints || [])
            .map(String)
            .map((s) => s.trim())
            .filter(Boolean),
        },
      },
      { new: true },
    );
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }
    res.json({ success: true, data: topic });
  }),
);

router.put(
  '/admin/topics/:id/publish',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const topic = await GroupDiscussionTopic.findByIdAndUpdate(
      req.params.id,
      { $set: { isPublished: Boolean(req.body.published ?? true) } },
      { new: true },
    );
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }
    res.json({ success: true, data: topic });
  }),
);

router.get(
  '/admin/topics',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const usageRows = await GroupDiscussionSession.aggregate([
      { $match: {} },
      { $group: { _id: '$topicId', usageCount: { $sum: 1 } } },
      { $sort: { usageCount: -1 } },
    ]);
    const usageByTopic = new Map(usageRows.map((t: any) => [String(t._id), t.usageCount]));

    const all = await GroupDiscussionTopic.find()
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: all.map((t: any) => ({
        ...t,
        usageCount: usageByTopic.get(String(t._id)) ?? t.usageCount ?? 0,
      })),
    });
  }),
);

export default router;
