import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { ResumeVersion, ATS_TEMPLATE, ATS_TEMPLATES, normalizeTemplate } from '../models/ResumeVersion';
import { authenticateToken, requireCandidate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { computeAtsScore, matchJobDescription, IResumeData } from '../services/atsEngine';
import Resume from '../models/Resume';
import logger from '../utils/logger';
import { getCurrentPlan, getRemainingUsage, consumeUsage, assertAiCredits } from '../services/entitlement.service';
import { UsageLedger } from '../models/UsageLedger';
import { recordActivity } from '../services/activity.service';

/**
 * AETHER Resume — deterministic ATS + builder routes (spec §54–64).
 * ATS scores are always computed server-side from structured evidence.
 * Gemini only narrates; when unavailable the deterministic result stands alone.
 */

const router = Router();

function badRequest(res: Response, details: unknown) {
  return res.status(400).json({ success: false, error: 'Validation failed', details });
}

function requireResumeData(body: any): IResumeData | null {
  if (!body || typeof body !== 'object') return null;
  const typography = body.typography && typeof body.typography === 'object' ? {
    fontFamily: body.typography.fontFamily ? String(body.typography.fontFamily) : undefined,
    fontSize: Number.isFinite(Number(body.typography.fontSize)) ? Number(body.typography.fontSize) : undefined,
    lineHeight: Number.isFinite(Number(body.typography.lineHeight)) ? Number(body.typography.lineHeight) : undefined,
    margin: Number.isFinite(Number(body.typography.margin)) ? Number(body.typography.margin) : undefined,
  } : undefined;
  return {
    name: body.name || '',
    title: body.title || '',
    email: body.email || '',
    phone: body.phone || '',
    location: body.location || '',
    links: Array.isArray(body.links) ? body.links.filter(Boolean) : [],
    summary: body.summary || '',
    education: Array.isArray(body.education) ? body.education : [],
    experience: Array.isArray(body.experience) ? body.experience : [],
    projects: Array.isArray(body.projects) ? body.projects : [],
    skills: Array.isArray(body.skills) ? body.skills : [],
    certifications: Array.isArray(body.certifications) ? body.certifications : [],
    achievements: Array.isArray(body.achievements) ? body.achievements : [],
    languages: Array.isArray(body.languages) ? body.languages : [],
    customSections: Array.isArray(body.customSections) ? body.customSections : [],
    sectionOrder: Array.isArray(body.sectionOrder) ? body.sectionOrder : [],
    pageSize: body.pageSize === 'LETTER' ? 'LETTER' : 'A4',
    typography,
    targetJobDescription: body.targetJobDescription || '',
  };
}

// ── Deterministic ATS analysis on arbitrary structured resume data ──────────

/** POST /api/resume/ats/analyze — { data, jobDescription?, targetRole? } */
router.post('/ats/analyze', authenticateToken, requireCandidate,
  [body('data').isObject().notEmpty()],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return badRequest(res, errors.array()) as any;
    const data = requireResumeData(req.body.data);
    if (!data) return badRequest(res, 'Resume data required') as any;

    const ats = computeAtsScore(data, {
      jobDescription: req.body.jobDescription,
      targetRole: req.body.targetRole,
    });
    let jdMatch = null;
    if (req.body.jobDescription && String(req.body.jobDescription).trim()) {
      jdMatch = matchJobDescription(data, String(req.body.jobDescription));
    }
    res.json({ success: true, data: { ats, jdMatch } });
    return;
  })
);

/** POST /api/resume/ats/explain — AI narration of a computed ATS result (graceful). */
router.post('/ats/explain', authenticateToken, requireCandidate,
  [body('data').isObject().notEmpty()],
  asyncHandler(async (req: Request, res: Response) => {
    // AI credit quota (spec §48): the deterministic explanation always works —
    // credits gate only the AI narration path below.
    try {
      await assertAiCredits(String(req.user!.userId), 'ats.aiExplanation', (req.user as any).plan);
    } catch (err: any) {
      if (err?.code === 'AI_CREDITS_EXHAUSTED') {
        return res.status(402).json({ success: false, error: 'UPGRADE_REQUIRED', message: err.message, feature: 'resume.aiWriting' }) as any;
      }
      throw err;
    }
    const data = requireResumeData(req.body.data);
    if (!data) return badRequest(res, 'Resume data required') as any;
    const ats = computeAtsScore(data, {
      jobDescription: req.body.jobDescription,
      targetRole: req.body.targetRole,
    });

    // Deterministic explanation always present (spec §73 fallbacks).
    const weakest = [...ats.categories].sort((a, b) => (a.score / a.weight) - (b.score / b.weight)).slice(0, 3);
    const deterministic = {
      explanation: `ATS score ${ats.totalScore}/100 (${ats.grade}). Strongest area: ${[...ats.categories].sort((a, b) => b.score - a.score)[0].label}. Priority fixes: ${weakest.map(w => w.label).join(', ')}.`,
      improvementSuggestions: weakest.flatMap(w => w.findings.slice(0, 2)),
    };

    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const key = process.env.GEMINI_API_KEY;
      if (key) {
        const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-3.6-flash' });
        const prompt = `You are an ATS coach. Here is a DETERMINISTIC ATS analysis of a resume:
${JSON.stringify({ totalScore: ats.totalScore, grade: ats.grade, categories: ats.categories.map(c => ({ label: c.label, score: c.score, weight: c.weight, findings: c.findings })), bulletFindings: ats.bulletFindings.slice(0, 5) })}

Explain in 3-4 sentences why the score is what it is, then give at most 3 concrete improvement actions.
RULES: Never invent numbers or skills the candidate may not have. Say explicitly that missing keywords should only be added if the candidate genuinely has the skill. Do not change any scores.
Return ONLY JSON: {"explanation":"...","improvementSuggestions":["..."]}`;
        const result = await model.generateContent(prompt, { timeout: 20000 });
        const text = result.response.text();
        const m = text && text.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]);
          if (parsed?.explanation) {
            // Bill the AI credit only on a successful narration.
            await consumeUsage(String(req.user!.userId), 'aiCredits', 1, 'ats.aiExplanation');
            return res.json({ success: true, data: { ats, aiExplanation: parsed, deterministic } });
          }
        }
      }
    } catch (err: any) {
      logger.warn('ATS AI explanation unavailable:', err?.message);
    }
    res.json({ success: true, data: { ats, aiExplanation: null, deterministic } });
    return;
  })
);

// ── Resume versions (builder) ────────────────────────────────────────────────

/** GET /api/resume/versions — list this user's resume versions. */
router.get('/versions', authenticateToken, requireCandidate, asyncHandler(async (req: Request, res: Response) => {
  const versions = await ResumeVersion.listByUser(req.user!.userId);
  res.json({ success: true, data: { versions } });
  return;
}));

/** GET /api/resume/versions/:id */
router.get('/versions/:id', authenticateToken, requireCandidate, asyncHandler(async (req: Request, res: Response) => {
  const v = await ResumeVersion.findOne({ _id: req.params.id, userId: req.user!.userId });
  if (!v) { res.status(404).json({ success: false, error: 'Resume version not found' }); return; }
  res.json({ success: true, data: { version: v } });
  return;
}));

/** POST /api/resume/versions — create a version (with server-side ATS snapshot). */
router.post('/versions', authenticateToken, requireCandidate,
  [body('data').isObject().notEmpty()],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return badRequest(res, errors.array()) as any;
    const data = requireResumeData(req.body.data);
    if (!data) return badRequest(res, 'Resume data required') as any;

    // Entitlement: Free = 1 active resume version. Downgrade rule (§63):
    // existing versions stay viewable; only NEW creation is limited.
    const plan = await getCurrentPlan(String(req.user!.userId), (req.user as any).plan);
    if (plan.limits.resumeVersions !== null) {
      const existing = await ResumeVersion.countDocuments({ userId: req.user!.userId });
      if (existing >= (plan.limits.resumeVersions as number)) {
        return res.status(402).json({
          success: false,
          error: 'UPGRADE_REQUIRED',
          message: `The ${plan.planId} plan allows ${plan.limits.resumeVersions} active resume version(s). Upgrade to AETHER Pro for unlimited versions — your existing resumes are safe.`,
          feature: 'resume.unlimitedVersions',
        }) as any;
      }
    }

    // Premium templates are Pro-only; Free silently keeps ATS Classic.
    let template: ATS_TEMPLATE = normalizeTemplate(req.body.template);
    if (!plan.entitlements.includes('resume.allTemplates')) {
      template = 'ats-classic';
    }
    const ats = computeAtsScore(data, { targetRole: req.body.targetRoleSlug });

    // The first version a candidate creates becomes their default (spec §26).
    const isFirst = (await ResumeVersion.countDocuments({ userId: req.user!.userId })) === 0;

    const version = await ResumeVersion.create({
      userId: req.user!.userId,
      name: String(req.body.name || 'My Resume').slice(0, 80),
      targetRoleSlug: String(req.body.targetRoleSlug || ''),
      template,
      isDefault: req.body.isDefault === true || isFirst,
      data,
      atsScore: ats.totalScore,
      atsSnapshot: { score: ats.totalScore, grade: ats.grade, computedAt: new Date() },
    });
    await consumeUsage(String(req.user!.userId), 'resumeVersions', 1, 'resume.version.create', { versionId: String(version._id) });
    res.status(201).json({ success: true, data: { version } });
    return;
  })
);

/** PUT /api/resume/versions/:id — update (autosave target; ATS recomputed). */
router.put('/versions/:id', authenticateToken, requireCandidate,
  [body('data').isObject().notEmpty()],
  asyncHandler(async (req: Request, res: Response) => {
    const version = await ResumeVersion.findOne({ _id: req.params.id, userId: req.user!.userId });
    if (!version) { res.status(404).json({ success: false, error: 'Resume version not found' }); return; }
    const data = requireResumeData(req.body.data);
    if (!data) return badRequest(res, 'Resume data required') as any;

    version.data = data;
    if (typeof req.body.name === 'string' && req.body.name.trim()) version.name = req.body.name.trim().slice(0, 80);
    if (typeof req.body.template === 'string' && (ATS_TEMPLATES as readonly string[]).includes(req.body.template)) {
      version.template = req.body.template as ATS_TEMPLATE;
    }
    if (typeof req.body.targetRoleSlug === 'string') version.targetRoleSlug = req.body.targetRoleSlug;
    if (req.body.isDefault === true) version.isDefault = true;

    const ats = computeAtsScore(data, { targetRole: version.targetRoleSlug });
    version.atsScore = ats.totalScore;
    version.atsSnapshot = { score: ats.totalScore, grade: ats.grade, computedAt: new Date() };
    await version.save();
    if (version.isDefault) {
      await ResumeVersion.updateMany(
        { userId: req.user!.userId, _id: { $ne: version._id } },
        { $set: { isDefault: false } },
      );
    }
    res.json({ success: true, data: { version, ats } });

    // AETHER activity (spec §16/§83). The deterministic ATS score travels with
    // the event so the resume chart on the dashboard reads stored evidence.
    await recordActivity({
      userId: req.user!.userId,
      eventType: 'RESUME_UPDATED',
      entityType: 'RESUME_VERSION',
      entityId: String(version._id),
      entityLabel: version.name,
      roleId: version.targetRoleSlug || undefined,
      metadata: { atsScore: ats.totalScore, grade: ats.grade, targetRoleSlug: version.targetRoleSlug || null },
    });
    return;
  })
);

/**
 * POST /api/resume/versions/:id/default — make this the version the builder opens.
 * Existing versions are never deleted; only which one is the default changes.
 */
router.post('/versions/:id/default', authenticateToken, requireCandidate, asyncHandler(async (req: Request, res: Response) => {
  const version = await ResumeVersion.findOne({ _id: req.params.id, userId: req.user!.userId });
  if (!version) { res.status(404).json({ success: false, error: 'Resume version not found' }); return; }
  await ResumeVersion.updateMany({ userId: req.user!.userId }, { $set: { isDefault: false } });
  version.isDefault = true;
  await version.save();
  res.json({ success: true, data: { versionId: String(version._id), isDefault: true } });
  return;
}));

/** DELETE /api/resume/versions/:id */
router.delete('/versions/:id', authenticateToken, requireCandidate, asyncHandler(async (req: Request, res: Response) => {
  const result = await ResumeVersion.deleteOne({ _id: req.params.id, userId: req.user!.userId });
  if (result.deletedCount === 0) { res.status(404).json({ success: false, error: 'Resume version not found' }); return; }
  // If the default was deleted, promote the most recently updated survivor so
  // the builder always has something to open.
  const remainingDefault = await ResumeVersion.findOne({ userId: req.user!.userId, isDefault: true });
  if (!remainingDefault) {
    const next = await ResumeVersion.findOne({ userId: req.user!.userId }).sort({ updatedAt: -1 });
    if (next) { next.isDefault = true; await next.save(); }
  }
  res.json({ success: true });
  return;
}));

/**
 * POST /api/resume/versions/:id/from-uploaded — seed a builder version from the
 * last parsed upload (spec §64: resume versions feed interviews, too).
 */
router.post('/versions/from-uploaded', authenticateToken, requireCandidate, asyncHandler(async (req: Request, res: Response) => {
  const resume = await Resume.getLatestByUser(new (require('mongoose').Types.ObjectId)(req.user!.userId));
  if (!resume) { res.status(404).json({ success: false, error: 'No uploaded resume found' }); return; }
  const p = resume.metadata?.parsedData || {};
  const data: IResumeData = {
    name: resume.analysis?.summary ? '' : (req.body?.name || ''),
    email: p.email || '',
    phone: p.phone || '',
    location: p.location || '',
    links: [],
    summary: resume.analysis?.summary || '',
    education: resume.analysis?.education || [],
    experience: Array.isArray(p.experience) ? p.experience : [],
    projects: Array.isArray(p.projects) ? p.projects : [],
    skills: resume.analysis?.skills || [],
    certifications: resume.analysis?.certifications || [],
    achievements: resume.analysis?.achievements || [],
  };
  const ats = computeAtsScore(data, { targetRole: req.body?.targetRoleSlug });
  const version = await ResumeVersion.create({
    userId: req.user!.userId,
    name: String(req.body?.name || 'From uploaded resume').slice(0, 80),
    targetRoleSlug: String(req.body?.targetRoleSlug || ''),
    template: 'ats-classic',
    data,
    atsScore: ats.totalScore,
    atsSnapshot: { score: ats.totalScore, grade: ats.grade, computedAt: new Date() },
  });
  res.status(201).json({ success: true, data: { version } });
  return;
}));

export default router;
