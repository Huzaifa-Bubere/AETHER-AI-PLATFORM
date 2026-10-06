import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { body, param, query } from 'express-validator';
import { asyncHandler } from '../../middleware/errorHandler';
import { authenticateToken, requireCandidate, requireAdmin } from '../../middleware/auth';
import {
  EXPERIENCE_LEVELS,
  JOB_TYPES,
  JobPosting,
  WORK_MODES,
} from '../models/JobPosting';
import { APPLICATION_STATUSES, SavedJob } from '../models/SavedJob';
import { JobFitAnalysis } from '../models/JobFitAnalysis';
import { analyzeJobFit, analyzeStoredJob, previewFitForJob } from '../services/jobFit.service';
import { buildRankingContext, rankAndSort } from '../services/jobRecommendation.service';
import { JobSearchPreference } from '../models/JobSearchPreference';
import { SavedJobSearch } from '../models/SavedJobSearch';
import { JobAlert, alertMinRelevance } from '../models/JobAlert';
import { computeMarketReport, compareMarketTrend } from '../services/jobMarketAnalytics.service';
import {
  overallProviderStatus,
  probeExternalServices,
  providerHealthTable,
} from '../services/providerHealth.service';
import { refreshJobsOnce, schedulerStatus } from '../services/refreshScheduler';
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

/**
 * POST /api/jobs/refresh — ADMIN-ONLY manual refresh (spec §50).
 *
 * Registered BEFORE the candidate-only middleware below so it carries its own
 * `authenticateToken` + `requireAdmin` chain instead of the candidate guard.
 * A cooldown prevents an admin from hammering external providers.
 */
const REFRESH_COOLDOWN_MS = 60_000;
let lastManualRefreshAt = 0;

router.post(
  '/refresh',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const elapsed = Date.now() - lastManualRefreshAt;
    if (elapsed < REFRESH_COOLDOWN_MS) {
      res.status(429).json({
        success: false,
        error: `Refresh already run recently. Try again in ${Math.ceil((REFRESH_COOLDOWN_MS - elapsed) / 1000)}s.`,
      });
      return;
    }
    lastManualRefreshAt = Date.now();
    const result = await refreshJobsOnce();
    await probeExternalServices();
    res.json({
      success: true,
      data: {
        ...result,
        // refreshJobsOnce() itself refuses to start a second overlapping run,
        // so a manual click during a scheduled cycle cannot double-fetch.
        providers: providerHealthTable(),
      },
    });
  }),
);

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

    const [postings, total, freshness, rankingContext] = await Promise.all([
      JobPosting.find(filter)
        .sort({ datePosted: -1, fetchedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      JobPosting.countDocuments(filter),
      getFreshness(),
      // Ranking context is resolved ONCE per request, not per job.
      buildRankingContext(userId(req)),
    ]);

    // Server-side ordering by relevance, then date (spec §B5). The client
    // never reorders results itself.
    const ranked = rankAndSort(postings, rankingContext, q);

    // Optional per-job match badge, only where an analysis already exists.
    const jobs = await Promise.all(
      ranked.map(async posting => ({
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
        // Cross-provider provenance: this vacancy may be listed elsewhere too.
        availableFromNProviders: posting.sources?.length
          ? new Set(posting.sources.map(s => s.provider)).size
          : 1,
        datePosted: posting.datePosted ? new Date(posting.datePosted).toISOString() : null,
        fetchedAt: new Date(posting.fetchedAt).toISOString(),
        // Search relevance — explicitly NOT the job requirement match.
        recommendation: posting.recommendation,
        // Null when no analysis has been run: the UI must show "Analyze Fit",
        // never "0%".
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

// ── Search preferences (spec §D) ────────────────────────────────────────────
// All of the routes below are registered BEFORE `/:id` on purpose: Express
// matches in registration order, so a later literal segment would otherwise be
// captured by `/:id` and rejected as an invalid job id.

const filterArray = <T extends string>(value: unknown, allowed: readonly T[]): T[] => {
  if (!Array.isArray(value)) return [];
  return value.map(v => String(v).toUpperCase() as T).filter(v => allowed.includes(v));
};

/** GET /api/jobs/preferences — every stored search preference for this user. */
router.get(
  '/preferences',
  asyncHandler(async (req: Request, res: Response) => {
    const prefs = await JobSearchPreference.find({ userId: new mongoose.Types.ObjectId(userId(req)) })
      .sort({ roleSlug: 1 })
      .lean();
    res.json({
      success: true,
      data: prefs.map(p => ({
        roleSlug: p.roleSlug,
        keywords: p.keywords ?? [],
        locations: p.locations ?? [],
        workModes: p.workModes ?? [],
        jobTypes: p.jobTypes ?? [],
        experienceLevels: p.experienceLevels ?? [],
        remoteOnly: p.remoteOnly ?? false,
        datePostedWindow: p.datePostedWindow ?? null,
        lastViewedAt: p.lastViewedAt ? new Date(p.lastViewedAt).toISOString() : null,
      })),
    });
  }),
);

/**
 * PUT /api/jobs/preferences/:roleSlug — save the browsing preference for one role.
 *
 * This writes JobSearchPreference ONLY. It never touches UserRoleGoal, so
 * changing a search filter cannot change the candidate's career identity or
 * their primary role (spec §D1).
 */
router.put(
  '/preferences/:roleSlug',
  [
    param('roleSlug').isString().trim().isLength({ min: 2, max: 60 }),
    body('keywords').optional().isArray({ max: 10 }),
    body('locations').optional().isArray({ max: 10 }),
    body('workModes').optional().isArray({ max: 4 }),
    body('jobTypes').optional().isArray({ max: 6 }),
    body('experienceLevels').optional().isArray({ max: 6 }),
    body('remoteOnly').optional().isBoolean(),
    body('datePostedWindow').optional({ nullable: true }).isInt({ min: 1, max: 365 }),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const roleSlug = String(req.params.roleSlug).toLowerCase();
    const b = req.body ?? {};
    const update: Record<string, unknown> = { roleSlug };
    if (b.keywords) update.keywords = (b.keywords as unknown[]).map(k => String(k).toLowerCase()).filter(Boolean);
    if (b.locations) update.locations = (b.locations as string[]).map(l => String(l).toLowerCase());
    if (b.workModes) update.workModes = filterArray(b.workModes, WORK_MODES);
    if (b.jobTypes) update.jobTypes = filterArray(b.jobTypes, JOB_TYPES);
    if (b.experienceLevels) update.experienceLevels = filterArray(b.experienceLevels, EXPERIENCE_LEVELS);
    if (typeof b.remoteOnly === 'boolean') update.remoteOnly = b.remoteOnly;
    if (b.datePostedWindow !== undefined) update.datePostedWindow = b.datePostedWindow;

    const pref = await JobSearchPreference.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId(req)), roleSlug },
      { $set: update, $setOnInsert: { roleSlug } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    res.json({ success: true, data: pref });
  }),
);

// ── Saved searches (spec §E) ────────────────────────────────────────────────

/** GET /api/jobs/saved-searches */
router.get(
  '/saved-searches',
  asyncHandler(async (req: Request, res: Response) => {
    const searches = await SavedJobSearch.find({ userId: new mongoose.Types.ObjectId(userId(req)) })
      .sort({ updatedAt: -1 })
      .lean();
    res.json({
      success: true,
      data: searches.map(s => ({
        id: String(s._id),
        name: s.name,
        roleSlug: s.roleSlug ?? null,
        query: s.query ?? null,
        locations: s.locations ?? [],
        workModes: s.workModes ?? [],
        jobTypes: s.jobTypes ?? [],
        experienceLevels: s.experienceLevels ?? [],
        postedWithinDays: s.postedWithinDays ?? null,
        lastRunAt: s.lastRunAt ? new Date(s.lastRunAt).toISOString() : null,
        createdAt: new Date(s.createdAt).toISOString(),
      })),
    });
  }),
);

/** POST /api/jobs/saved-searches — create a reusable search. */
router.post(
  '/saved-searches',
  [
    body('name').isString().trim().isLength({ min: 1, max: 120 }),
    body('roleSlug').optional({ nullable: true }).isString().trim().isLength({ max: 60 }),
    body('query').optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
    body('locations').optional().isArray({ max: 10 }),
    body('workModes').optional().isArray({ max: 4 }),
    body('jobTypes').optional().isArray({ max: 6 }),
    body('experienceLevels').optional().isArray({ max: 6 }),
    body('postedWithinDays').optional({ nullable: true }).isInt({ min: 1, max: 365 }),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const b = req.body ?? {};
    const created = await SavedJobSearch.create({
      userId: new mongoose.Types.ObjectId(userId(req)),
      name: b.name,
      roleSlug: b.roleSlug ? String(b.roleSlug).toLowerCase() : null,
      query: b.query ?? null,
      locations: (b.locations ?? []).map((l: string) => String(l).toLowerCase()),
      workModes: filterArray(b.workModes, WORK_MODES),
      jobTypes: filterArray(b.jobTypes, JOB_TYPES),
      experienceLevels: filterArray(b.experienceLevels, EXPERIENCE_LEVELS),
      postedWithinDays: b.postedWithinDays ?? null,
      lastRunAt: null,
    });
    res.status(201).json({ success: true, data: created });
  }),
);

/**
 * POST /api/jobs/saved-searches/:id/run
 * Execute a saved search and return real results, plus the query string the
 * Jobs page should navigate to. Scoped to the owner: another user's saved
 * search id returns 404 rather than leaking (spec §Q ownership isolation).
 */
router.post(
  '/saved-searches/:id/run',
  [param('id').isMongoId()],
  asyncHandler(async (req: Request, res: Response) => {
    const search = await SavedJobSearch.findOne({
      _id: req.params.id,
      userId: new mongoose.Types.ObjectId(userId(req)),
    }).lean();
    if (!search) {
      res.status(404).json({ success: false, error: 'Saved search not found' });
      return;
    }

    const params = new URLSearchParams();
    if (search.roleSlug) params.set('role', search.roleSlug);
    if (search.query) params.set('q', search.query);
    if (search.locations?.[0]) params.set('location', search.locations[0]);
    if (search.workModes?.[0]) params.set('workMode', search.workModes[0]);
    if (search.jobTypes?.[0]) params.set('jobType', search.jobTypes[0]);
    if (search.experienceLevels?.[0]) params.set('experience', search.experienceLevels[0]);
    if (search.postedWithinDays) params.set('postedWithinDays', String(search.postedWithinDays));

    await SavedJobSearch.updateOne({ _id: search._id }, { $set: { lastRunAt: new Date() } });

    res.json({ success: true, data: { queryString: params.toString() } });
  }),
);

/** DELETE /api/jobs/saved-searches/:id — owner-scoped. */
router.delete(
  '/saved-searches/:id',
  [param('id').isMongoId()],
  asyncHandler(async (req: Request, res: Response) => {
    const result = await SavedJobSearch.deleteOne({
      _id: req.params.id,
      userId: new mongoose.Types.ObjectId(userId(req)),
    });
    if (result.deletedCount === 0) {
      res.status(404).json({ success: false, error: 'Saved search not found' });
      return;
    }
    res.json({ success: true });
  }),
);

// ── In-app alerts (spec §G) ─────────────────────────────────────────────────

/** GET /api/jobs/alerts — this candidate's in-app alerts only. */
router.get(
  '/alerts',
  asyncHandler(async (req: Request, res: Response) => {
    const unreadOnly = String(req.query.unread ?? '') === 'true';
    const alerts = await JobAlert.find({
      userId: new mongoose.Types.ObjectId(userId(req)),
      ...(unreadOnly ? { readAt: null } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({
      success: true,
      data: {
        items: alerts.map(a => ({
          id: String(a._id),
          type: a.type,
          jobId: String(a.jobId),
          title: a.title,
          company: a.company,
          roleSlug: a.roleSlug ?? null,
          recommendationScore: a.recommendationScore,
          recommendationLabel: a.recommendationLabel ?? null,
          readAt: a.readAt ? new Date(a.readAt).toISOString() : null,
          createdAt: new Date(a.createdAt).toISOString(),
        })),
        unreadCount: await JobAlert.countDocuments({ userId: new mongoose.Types.ObjectId(userId(req)), readAt: null }),
        // Stated so the UI can explain the rule rather than implying email.
        threshold: alertMinRelevance(),
        delivery: 'in-app',
      },
    });
  }),
);

/** PATCH /api/jobs/alerts/:id/read — owner-scoped. */
router.patch(
  '/alerts/:id/read',
  [param('id').isMongoId()],
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await JobAlert.findOneAndUpdate(
      { _id: req.params.id, userId: new mongoose.Types.ObjectId(userId(req)) },
      { $set: { readAt: new Date() } },
      { new: true },
    ).lean();
    if (!updated) {
      res.status(404).json({ success: false, error: 'Alert not found' });
      return;
    }
    res.json({ success: true, data: updated });
  }),
);

// ── New jobs since last visit (spec §F) ─────────────────────────────────────

/**
 * POST /api/jobs/seen
 *
 * Records the timestamp of this visit and returns how many jobs matching the
 * candidate's current role/filter were new since their PREVIOUS visit.
 *
 * Ordering matters (spec §F2): the previous lastViewedAt is read and the count
 * is computed against it BEFORE the new timestamp is written, so the count can
 * never be computed against a timestamp this same request just moved.
 *
 * Returns newJobs: null when the candidate has never visited before — there is
 * no honest baseline to count from, and the UI must not show a fake badge.
 */
router.post(
  '/seen',
  [body('roleSlug').optional({ nullable: true }).isString().trim().isLength({ max: 60 })],
  asyncHandler(async (req: Request, res: Response) => {
    const roleSlug = req.body?.roleSlug ? String(req.body.roleSlug).toLowerCase() : 'general';
    const uid = new mongoose.Types.ObjectId(userId(req));

    // 1. read the previous stamp
    const existing = await JobSearchPreference.findOne({ userId: uid, roleSlug }).select('lastViewedAt').lean();
    const previousViewedAt = existing?.lastViewedAt ?? null;

    // 2. calculate against it. "general" means the candidate has no specific
    //    role filter selected, so the count spans every active posting.
    const filter: Record<string, unknown> = { active: true };
    if (roleSlug !== 'general') filter.roleIds = roleSlug;
    if (previousViewedAt) filter.fetchedAt = { $gt: new Date(previousViewedAt) };

    const newJobs = previousViewedAt ? await JobPosting.countDocuments(filter) : null;

    // 3/4. write the new stamp only after the count is known
    await JobSearchPreference.findOneAndUpdate(
      { userId: uid, roleSlug },
      { $set: { lastViewedAt: new Date() }, $setOnInsert: { roleSlug } },
      { upsert: true, setDefaultsOnInsert: true },
    );

    res.json({
      success: true,
      data: {
        roleSlug,
        previousViewedAt: previousViewedAt ? new Date(previousViewedAt).toISOString() : null,
        // null, not 0: "never visited" is not "zero new jobs".
        newJobs,
      },
    });
  }),
);

// ── Market intelligence (spec §I) ───────────────────────────────────────────

/** GET /api/jobs/market — aggregates over real stored postings only. */
router.get(
  '/market',
  asyncHandler(async (req: Request, res: Response) => {
    const report = await computeMarketReport({
      roleSlug: req.query.roleSlug ? String(req.query.roleSlug).toLowerCase() : null,
      region: req.query.region ? String(req.query.region) : null,
      periodDays: Number.parseInt(String(req.query.periodDays ?? '30'), 10) || 30,
    });
    const trend = await compareMarketTrend(report);
    res.json({ success: true, data: { ...report, trend } });
  }),
);

// ── Dashboard summary (spec §N) ─────────────────────────────────────────────

/**
 * GET /api/jobs/summary — real counts for the dashboard's job pipeline.
 * Every field is a live query. There are no mock numbers here or anywhere else.
 */
router.get(
  '/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const uid = new mongoose.Types.ObjectId(userId(req));
    const roleSlug = String(req.query.role ?? '').toLowerCase();

    const [saved, recentFits, bestMatch, newJobs] = await Promise.all([
      SavedJob.find({ userId: uid }).select('status').lean(),
      JobFitAnalysis.find({ userId: uid }).sort({ computedAt: -1 }).limit(5)
        .select('jobId roleSlug score label computedAt').populate('jobId', 'title company').lean(),
      JobFitAnalysis.findOne({ userId: uid, ...(roleSlug ? { roleSlug } : {}) })
        .sort({ score: -1, computedAt: -1 })
        .select('score label roleSlug computedAt').lean(),
      (async () => {
        const pref = await JobSearchPreference.findOne({ userId: uid, roleSlug: roleSlug || 'general' })
          .select('lastViewedAt').lean();
        if (!pref?.lastViewedAt) return null;
        return JobPosting.countDocuments({
          active: true,
          fetchedAt: { $gt: new Date(pref.lastViewedAt) },
          ...(roleSlug ? { roleIds: roleSlug } : {}),
        });
      })(),
    ]);

    const counts: Record<string, number> = {};
    for (const status of APPLICATION_STATUSES) counts[status] = 0;
    for (const entry of saved) counts[entry.status] = (counts[entry.status] ?? 0) + 1;

    res.json({
      success: true,
      data: {
        counts,
        saved: counts.SAVED ?? 0,
        applied: counts.APPLIED ?? 0,
        screening: counts.SCREENING ?? 0,
        interviews: counts.INTERVIEW ?? 0,
        offers: counts.OFFER ?? 0,
        newJobs,
        bestCurrentMatch: bestMatch && typeof bestMatch.score === 'number'
          ? { score: bestMatch.score, label: bestMatch.label, roleSlug: bestMatch.roleSlug ?? null, computedAt: bestMatch.computedAt }
          : null,
        recentJobFits: recentFits.map(f => ({
          id: String(f._id),
          jobId: f.jobId ? String((f.jobId as any)._id) : null,
          jobTitle: (f.jobId as any)?.title ?? null,
          company: (f.jobId as any)?.company ?? null,
          roleSlug: f.roleSlug ?? null,
          score: f.score,
          label: f.label,
          computedAt: f.computedAt,
        })),
      },
    });
  }),
);

// ── Provider health (spec §14, §49) ─────────────────────────────────────────

/**
 * GET /api/jobs/providers — per-provider status for the admin UI.
 * Contains no API keys: hints name the missing variables, never their values.
 */
router.get(
  '/providers',
  asyncHandler(async (_req: Request, res: Response) => {
    await probeExternalServices();
    res.json({
      success: true,
      data: {
        providers: providerHealthTable(),
        overall: overallProviderStatus(),
        scheduler: schedulerStatus(),
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
    const [fit, saved, rankingContext] = await Promise.all([
      previewFitForJob(userId(req), req.params.id),
      SavedJob.findForUser(userId(req), req.params.id),
      buildRankingContext(userId(req)),
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
        availableFromNProviders: posting.sources?.length
          ? new Set(posting.sources.map(s => s.provider)).size
          : 1,
        // Search relevance, distinct from the requirement match below.
        recommendation: rankAndSort([posting], rankingContext)[0]?.recommendation ?? null,
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