import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { body, param, query } from 'express-validator';
import { asyncHandler } from '../../middleware/errorHandler';
import { authenticateToken, requireCandidate } from '../../middleware/auth';
import {
  EXPERIENCE_LEVELS,
  JOB_TYPES,
  JobPosting,
  WORK_MODES,
} from '../models/JobPosting';
import { APPLICATION_STATUSES, SavedJob } from '../models/SavedJob';
import { analyzeJobFit, analyzeStoredJob, previewFitForJob } from '../services/jobFit.service';
import { getFreshness } from '../services/ingestion.service';
import { describeProviders } from '../providers';
import { isValidRoleSlug } from '../../career/services/roleProgress.service';
import logger from '../../utils/logger';

/**
 * AETHER Jobs (spec §57–§70) and Job Fit (spec §49–§56).
 *
 * Read and write surface for real, provider-sourced postings. Nothing here
 * fabricates a listing: when no provider is configured the response says so
 * explicitly rather than returning invented jobs.
 */
const router = Router();

router.use(authenticateToken, requireCandidate);

const userId = (req: Request): string => (req as any).user.userId;

/** Only accept filter values that are actually in the enum. */
function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  const v = String(value ?? '') as T;
  return allowed.includes(v) ? v : undefined;
}

/** Relative freshness label, e.g. "2 hours ago" (spec §63). */
function relativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return 'just now';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/**
 * GET /api/jobs
 * Role-aware search with filters. Query:
 *   ?role=&q=&location=&workMode=&jobType=&experience=&postedWithinDays=
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit ?? '20'), 10) || 20, 1), 50);

    const filter: Record<string, unknown> = { active: true };

    const role = String(req.query.role ?? '').toLowerCase().trim();
    if (isValidRoleSlug(role)) filter.roleIds = role;

    const workMode = oneOf(req.query.workMode, WORK_MODES);
    if (workMode && workMode !== 'UNSPECIFIED') filter.workMode = workMode;

    const jobType = oneOf(req.query.jobType, JOB_TYPES);
    if (jobType && jobType !== 'UNSPECIFIED') filter.jobType = jobType;

    const experience = oneOf(req.query.experience, EXPERIENCE_LEVELS);
    if (experience && experience !== 'UNSPECIFIED') filter.experienceLevel = experience;

    const location = String(req.query.location ?? '').trim();
    if (location) filter.location = { $regex: location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

    const q = String(req.query.q ?? '').trim();
    if (q) filter.$text = { $search: q };

    const postedWithinDays = Number.parseInt(String(req.query.postedWithinDays ?? ''), 10);
    if (Number.isFinite(postedWithinDays) && postedWithinDays > 0) {
      filter.datePosted = { $gte: new Date(Date.now() - postedWithinDays * 86_400_000) };
    }

    const [postings, total, freshness] = await Promise.all([
      JobPosting.find(filter)
        .sort({ datePosted: -1, fetchedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      JobPosting.countDocuments(filter),
      getFreshness(),
    ]);

    // Optional per-job match badge, only where an analysis already exists.
    const jobs = await Promise.all(
      postings.map(async posting => ({
        id: String(posting._id),
        title: posting.title,
        company: posting.company,
        companyLogo: posting.companyLogo ?? null,
        location: posting.location ?? null,
        workMode: posting.workMode,
        jobType: posting.jobType,
        experienceLevel: posting.experienceLevel,
        // Null means the posting stated none — the UI shows "Salary not listed"
        // and NEVER a made-up range (spec §61).
        salary: posting.salary ?? { min: null, max: null, currency: null, raw: null, period: null },
        skills: posting.extractedSkills ?? [],
        roleIds: posting.roleIds ?? [],
        source: posting.provider,
        sourceUrl: posting.sourceUrl,
        datePosted: posting.datePosted ? new Date(posting.datePosted).toISOString() : null,
        fetchedAt: new Date(posting.fetchedAt).toISOString(),
        fit: await previewFitForJob(userId(req), String(posting._id)),
      })),
    );

    const providers = describeProviders();
    res.json({
      success: true,
      data: {
        jobs,
        page,
        pages: Math.max(1, Math.ceil(total / limit)),
        total,
        // Stated plainly so the UI can explain an empty list honestly.
        freshness: {
          lastFetchedAt: freshness.lastFetchedAt,
          lastFetchedRelative: relativeTime(freshness.lastFetchedAt),
          totalActive: freshness.totalActive,
        },
        providers,
        noProviderConfigured: providers.every(p => !p.configured),
      },
    });
  }),
);

/**
 * GET /api/jobs/saved — the application tracker.
 *
 * Declared BEFORE `/ :id` on purpose: Express matches in registration order,
 * so a later `/saved` handler would be captured by `/:id` and 404.
 */
router.get(
  '/saved',
  asyncHandler(async (req: Request, res: Response) => {
    const saved = await SavedJob.find({ userId: new mongoose.Types.ObjectId(userId(req)) })
      .sort({ updatedAt: -1 })
      .populate('jobId')
      .lean();

    // Counts per status power the dashboard's job pipeline chart.
    const counts: Record<string, number> = {};
    for (const status of APPLICATION_STATUSES) counts[status] = 0;
    for (const entry of saved) counts[entry.status] = (counts[entry.status] ?? 0) + 1;

    res.json({
      success: true,
      data: {
        items: saved.map(entry => ({
          id: String(entry._id),
          status: entry.status,
          savedAt: entry.savedAt,
          appliedAt: entry.appliedAt ?? null,
          notes: entry.notes ?? '',
          resumeVersionId: entry.resumeVersionId ? String(entry.resumeVersionId) : null,
          job: entry.jobId ? {
            id: String((entry.jobId as any)._id),
            title: (entry.jobId as any).title,
            company: (entry.jobId as any).company,
            location: (entry.jobId as any).location ?? null,
            source: (entry.jobId as any).provider,
            sourceUrl: (entry.jobId as any).sourceUrl,
            workMode: (entry.jobId as any).workMode,
            // A posting that has aged out stays in the tracker but is flagged.
            active: (entry.jobId as any).active,
          } : null,
        })),
        counts,
      },
    });
  }),
);

/** GET /api/jobs/:id — full posting detail. */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(400).json({ success: false, error: 'Invalid job id' });
      return;
    }
    const posting = await JobPosting.findById(req.params.id).lean();
    if (!posting) {
      res.status(404).json({ success: false, error: 'This job posting is no longer available' });
      return;
    }
    const [fit, saved] = await Promise.all([
      previewFitForJob(userId(req), req.params.id),
      SavedJob.findForUser(userId(req), req.params.id),
    ]);
    res.json({
      success: true,
      data: {
        id: String(posting._id),
        title: posting.title,
        company: posting.company,
        companyLogo: posting.companyLogo ?? null,
        description: posting.description,
        requirements: posting.requirements ?? [],
        location: posting.location ?? null,
        workMode: posting.workMode,
        jobType: posting.jobType,
        experienceLevel: posting.experienceLevel,
        salary: posting.salary,
        skills: posting.extractedSkills ?? [],
        roleIds: posting.roleIds ?? [],
        source: posting.provider,
        sourceUrl: posting.sourceUrl,
        datePosted: posting.datePosted ? new Date(posting.datePosted).toISOString() : null,
        fetchedAt: new Date(posting.fetchedAt).toISOString(),
        active: posting.active,
        fit,
        savedStatus: saved ? saved.status : null,
      },
    });
  }),
);

// ── Save / apply tracker (spec §67, §68) ────────────────────────────────────

/** POST /api/jobs/:id/save — save, or update the tracker status. */
router.post(
  '/:id/save',
  [param('id').isMongoId(), body('status').optional().isIn(APPLICATION_STATUSES as unknown as string[])],
  asyncHandler(async (req: Request, res: Response) => {
    const status = (req.body?.status ?? 'SAVED') as (typeof APPLICATION_STATUSES)[number];
    const saved = await SavedJob.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId(req)), jobId: new mongoose.Types.ObjectId(req.params.id) },
      {
        $set: {
          status,
          // Only stamp appliedAt the first time the status becomes APPLIED.
          ...(status === 'APPLIED' ? { appliedAt: new Date() } : {}),
        },
        $setOnInsert: { savedAt: new Date() },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    res.json({ success: true, data: saved });
  }),
);

/** DELETE /api/jobs/:id/save — remove from the tracker. */
router.delete(
  '/:id/save',
  [param('id').isMongoId()],
  asyncHandler(async (req: Request, res: Response) => {
    await SavedJob.deleteOne({
      userId: new mongoose.Types.ObjectId(userId(req)),
      jobId: new mongoose.Types.ObjectId(req.params.id),
    });
    res.json({ success: true });
  }),
);

/** PATCH /api/jobs/saved/:id — move a saved job through the tracker. */
router.patch(
  '/saved/:id',
  [param('id').isMongoId(), body('status').isIn(APPLICATION_STATUSES as unknown as string[])],
  asyncHandler(async (req: Request, res: Response) => {
    const status = req.body.status as (typeof APPLICATION_STATUSES)[number];
    const updated = await SavedJob.findOneAndUpdate(
      { _id: req.params.id, userId: new mongoose.Types.ObjectId(userId(req)) },
      { $set: { status, ...(status === 'APPLIED' ? { appliedAt: new Date() } : {}) } },
      { new: true },
    ).lean();
    if (!updated) {
      res.status(404).json({ success: false, error: 'Saved job not found' });
      return;
    }
    res.json({ success: true, data: updated });
  }),
);

/** GET /api/jobs/saved/:id — single tracker entry. */

// ── Job fit (spec §49–§56) ──────────────────────────────────────────────────

/**
 * POST /api/jobs/fit/analyze
 * Analyse a pasted job description or a stored posting.
 * Body: { jobDescription?: string, jobId?: string, roleSlug?: string, resumeVersionId?: string }
 */
router.post(
  '/fit/analyze',
  [
    body('jobDescription').optional().isString().trim().isLength({ min: 40, max: 20000 }),
    body('jobId').optional({ nullable: true }).isMongoId(),
    body('roleSlug').optional({ nullable: true }).isString(),
    body('resumeVersionId').optional({ nullable: true }).isMongoId(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const { jobDescription, jobId, roleSlug, resumeVersionId } = req.body ?? {};

    try {
      const analysis = jobId && !jobDescription
        ? await analyzeStoredJob(userId(req), jobId, roleSlug ?? null)
        : jobDescription
          ? await analyzeJobFit({
              userId: userId(req),
              jobDescriptionText: jobDescription,
              jobId: jobId ?? null,
              roleSlug: roleSlug ?? null,
              resumeVersionId: resumeVersionId ?? null,
            })
          : null;

      if (!analysis) {
        res.status(404).json({ success: false, error: 'Job posting not found' });
        return;
      }
      res.json({ success: true, data: analysis });
    } catch (error) {
      logger.error('[jobs] fit analysis failed', error);
      res.status(500).json({ success: false, error: 'Could not analyse this job description' });
    }
  }),
);

export default router;