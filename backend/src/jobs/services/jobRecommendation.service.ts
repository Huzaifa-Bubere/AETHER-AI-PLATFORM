import { type IJobPosting } from '../models/JobPosting';
import { getSkillProfileSnapshot } from '../../career/services/skillEvidence.service';
import { ResumeVersion } from '../../models/ResumeVersion';
import { UserCareerGoal } from '../../career/models/UserCareerGoal';
import { JobSearchPreference } from '../models/JobSearchPreference';
import type { ExperienceLevel, JobType, WorkMode } from '../models/JobPosting';

/**
 * JobRecommendationService (spec §B, §B1–§B5).
 *
 * WHAT THIS IS: a ranking function. It answers "which postings should AETHER
 * show this candidate first?"
 *
 * WHAT THIS IS NOT: it is NOT AETHER's JOB REQUIREMENT MATCH. That score lives
 * in jobFit.service.ts and answers "how well does my evidence align with this
 * one job description?" The two are deliberately separate services with
 * separate weights, separate bands and separate UI labels:
 *
 *   Search ranking      → "84 relevance"          (this file)
 *   Job requirement fit → "76 / 100 Requirement Match"  (jobFit.service.ts)
 *
 * Nothing here is a hiring probability, and no component is produced by an LLM.
 * Every number is computed from stored data by the deterministic rules below.
 */

export const RECOMMENDATION_CALCULATION_VERSION = '1.0';

/**
 * Documented ranking formula (spec §B2). Sums to 100.
 *
 * A component whose input is genuinely unavailable is earned = null and is
 * EXCLUDED from both numerator and denominator, then the remaining components
 * are renormalised. Scoring an unavailable signal as 0 would actively
 * penalise a candidate for AETHER's missing data, which is the opposite of
 * honest.
 */
export const RECOMMENDATION_WEIGHTS = {
  TARGET_ROLE_MATCH: 30,
  SKILL_OVERLAP: 25,
  FRESHNESS: 10,
  LOCATION_WORK_MODE: 10,
  EXPERIENCE_ALIGNMENT: 10,
  JOB_TYPE: 5,
  PROFILE_EVIDENCE: 5,
  RESUME_PREVIEW: 5,
} as const;

export const TOTAL_RECOMMENDATION_WEIGHT = Object.values(RECOMMENDATION_WEIGHTS).reduce((s, w) => s + w, 0);

export type RecommendationComponentKey = keyof typeof RECOMMENDATION_WEIGHTS;

export interface IRecommendationComponent {
  key: RecommendationComponentKey;
  label: string;
  weight: number;
  /** 0–weight, or null when this signal could not be evaluated. */
  earned: number | null;
  /** Plain-language justification, shown verbatim in the UI. */
  basis: string;
}

/** Relevance bands. Deliberately worded as relevance, never as a chance of hire. */
export const RECOMMENDATION_BANDS: Array<{ min: number; label: string }> = [
  { min: 80, label: 'Highly Relevant' },
  { min: 60, label: 'Relevant' },
  { min: 40, label: 'Somewhat Relevant' },
  { min: 0, label: 'Low Relevance' },
];

export function recommendationLabelFor(score: number): string {
  return (RECOMMENDATION_BANDS.find(b => score >= b.min) ?? RECOMMENDATION_BANDS[RECOMMENDATION_BANDS.length - 1]).label;
}

/** Everything the ranker needs, resolved once per request rather than per job. */
export interface RankingContext {
  /** Slugs of roles the candidate is targeting (any goal, not just primary). */
  targetRoleSlugs: string[];
  /** Null when the candidate has no primary role set. */
  primaryRoleSlug: string | null;
  /** Canonical skill slugs with stored evidence. */
  evidencedSkillSlugs: Set<string>;
  /** Lowercased skill slugs appearing in the default resume, when one exists. */
  resumeSkillSlugs: Set<string> | null;
  locationPreferences: string[];
  workModePreferences: WorkMode[];
  jobTypePreferences: JobType[];
  /** The candidate's own declared experience level, if stored. */
  preferredExperienceLevel: ExperienceLevel | null;
  /** Injected so freshness is deterministic under test. */
  now: Date;
}

export interface RankableJob {
  title?: string | null;
  company?: string | null;
  location?: string | null;
  workMode?: WorkMode | null;
  jobType?: JobType | null;
  experienceLevel?: ExperienceLevel | null;
  datePosted?: Date | null;
  fetchedAt?: Date | null;
  roleIds?: string[] | null;
  extractedSkills?: string[] | null;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

const SENIORITY_ORDER: Record<string, number> = { INTERN: 1, ENTRY: 2, MID: 3, SENIOR: 4, LEAD: 5 };

/**
 * Score a single posting against an already-resolved context.
 *
 * Pure and synchronous by design: the whole ranking formula can therefore be
 * unit-tested without a database, and the same function is used whether the
 * caller is the search endpoint, the recommendation service or a test.
 */
export function scoreJobForCandidate(job: RankableJob, ctx: RankingContext): {
  recommendationScore: number | null;
  recommendationLabel: string | null;
  components: IRecommendationComponent[];
  reasonSummary: string;
} {
  const roleIds = (job.roleIds ?? []).map(r => r.toLowerCase());
  const skills = (job.extractedSkills ?? []).map(s => s.toLowerCase());

  // ── 1. Target role match (30) ─────────────────────────────────────────────
  let roleEarned: number | null = null;
  let roleBasis: string;
  const roleHit = ctx.targetRoleSlugs.find(slug => roleIds.includes(slug.toLowerCase()));
  if (roleHit) {
    roleEarned = RECOMMENDATION_WEIGHTS.TARGET_ROLE_MATCH;
    roleBasis = `Posting is classified as your target role ${roleHit} (stored role classification).`;
  } else if (roleIds.length === 0) {
    roleEarned = null;
    roleBasis = 'This posting could not be classified against any role.';
  } else {
    roleEarned = 0;
    roleBasis = `Posting is classified as ${roleIds.join(', ')}, which is not one of your target roles.`;
  }

  // ── 2. Skill overlap (25) ─────────────────────────────────────────────────
  let skillEarned: number | null = null;
  let skillBasis: string;
  if (skills.length === 0) {
    skillEarned = null;
    skillBasis = 'No skills were extracted from this posting.';
  } else {
    const overlap = skills.filter(s => ctx.evidencedSkillSlugs.has(s));
    skillEarned = (overlap.length / skills.length) * RECOMMENDATION_WEIGHTS.SKILL_OVERLAP;
    skillBasis = `${overlap.length} of ${skills.length} listed skill(s) already have evidence on your profile.`;
  }

  // ── 3. Freshness (10) ─────────────────────────────────────────────────────
  let freshEarned: number | null = null;
  let freshBasis: string;
  const postedAt = job.datePosted ?? job.fetchedAt ?? null;
  if (!postedAt) {
    freshEarned = null;
    freshBasis = 'This posting carries no date, so its freshness is unknown.';
  } else {
    const ageDays = (ctx.now.getTime() - new Date(postedAt).getTime()) / 86_400_000;
    // 0 days → full marks, 30+ days → zero, linear in between.
    freshEarned = clamp01(1 - ageDays / 30) * RECOMMENDATION_WEIGHTS.FRESHNESS;
    freshBasis = ageDays < 1
      ? 'Posted within the last day.'
      : `Posted about ${Math.round(ageDays)} day(s) ago.`;
  }

  // ── 4. Location / work mode (10) ──────────────────────────────────────────
  let prefEarned: number | null = null;
  let prefBasis: string;
  const location = (job.location ?? '').toLowerCase();
  const locationMatch = ctx.locationPreferences.some(
    pref => pref && location.includes(pref.toLowerCase()),
  );
  const workModeMatch = job.workMode
    ? ctx.workModePreferences.includes(job.workMode)
    : false;
  if (ctx.locationPreferences.length === 0 && ctx.workModePreferences.length === 0) {
    prefEarned = null;
    prefBasis = 'You have not set a location or work-mode preference, so this was not scored.';
  } else {
    const checks = [
      ctx.locationPreferences.length > 0 ? (locationMatch ? 1 : 0) : null,
      ctx.workModePreferences.length > 0 ? (workModeMatch ? 1 : 0) : null,
    ].filter((v): v is number => v !== null);
    prefEarned = (checks.reduce((a, b) => a + b, 0) / checks.length) * RECOMMENDATION_WEIGHTS.LOCATION_WORK_MODE;
    prefBasis = [
      ctx.locationPreferences.length ? (locationMatch ? 'Location matches your preference' : 'Location is outside your preference') : null,
      ctx.workModePreferences.length ? (workModeMatch ? `${job.workMode} matches your work-mode preference` : `${job.workMode ?? 'Unspecified mode'} is not one of your preferred work modes`) : null,
    ].filter(Boolean).join('; ') || 'No preference applies.';
  }

  // ── 5. Experience alignment (10) ──────────────────────────────────────────
  let expEarned: number | null = null;
  let expBasis: string;
  if (!job.experienceLevel || job.experienceLevel === 'UNSPECIFIED') {
    expEarned = null;
    expBasis = 'This posting does not state an experience level.';
  } else if (!ctx.preferredExperienceLevel || ctx.preferredExperienceLevel === 'UNSPECIFIED') {
    expEarned = null;
    expBasis = 'You have not set a preferred experience level, so this was not scored.';
  } else {
    const gap = Math.abs(
      (SENIORITY_ORDER[job.experienceLevel] ?? 0) - (SENIORITY_ORDER[ctx.preferredExperienceLevel] ?? 0),
    );
    // Same level → full marks, three levels apart → zero.
    expEarned = clamp01(1 - gap / 3) * RECOMMENDATION_WEIGHTS.EXPERIENCE_ALIGNMENT;
    expBasis = gap === 0
      ? `Both you and this posting are at ${job.experienceLevel} level.`
      : `Posting is ${job.experienceLevel}, your preference is ${ctx.preferredExperienceLevel}.`;
  }

  // ── 6. Job type (5) ───────────────────────────────────────────────────────
  let jobTypeEarned: number | null = null;
  let jobTypeBasis: string;
  if (ctx.jobTypePreferences.length === 0) {
    jobTypeEarned = null;
    jobTypeBasis = 'You have not set a job-type preference, so this was not scored.';
  } else if (!job.jobType || job.jobType === 'UNSPECIFIED') {
    jobTypeEarned = null;
    jobTypeBasis = 'This posting does not state a job type.';
  } else {
    jobTypeEarned = ctx.jobTypePreferences.includes(job.jobType)
      ? RECOMMENDATION_WEIGHTS.JOB_TYPE
      : 0;
    jobTypeBasis = ctx.jobTypePreferences.includes(job.jobType)
      ? `${job.jobType} is one of your preferred job types.`
      : `${job.jobType} is not one of your preferred job types.`;
  }

  // ── 7. Profile evidence (5) ───────────────────────────────────────────────
  const profileEarned: number | null = ctx.evidencedSkillSlugs.size === 0
    ? null
    : (RECOMMENDATION_WEIGHTS.PROFILE_EVIDENCE * clamp01(ctx.evidencedSkillSlugs.size / 20));
  const profileBasis = ctx.evidencedSkillSlugs.size === 0
    ? 'Your skill profile has no evidence yet, so this was not scored.'
    : `You have evidence on ${ctx.evidencedSkillSlugs.size} skill(s); a fuller profile ranks more postings.`;

  // ── 8. Resume preview (5) ─────────────────────────────────────────────────
  const resumeEarned: number | null = ctx.resumeSkillSlugs === null
    ? null
    : skills.length === 0
      ? null
      : (skills.filter(s => ctx.resumeSkillSlugs!.has(s)).length / skills.length) * RECOMMENDATION_WEIGHTS.RESUME_PREVIEW;
  const resumeBasis = ctx.resumeSkillSlugs === null
    ? 'No resume version is saved, so this was not scored.'
    : skills.length === 0
      ? 'This posting lists no skills to compare against your resume.'
      : `${skills.filter(s => ctx.resumeSkillSlugs!.has(s)).length} of ${skills.length} listed skill(s) appear on your resume.`;

  const components: IRecommendationComponent[] = [
    { key: 'TARGET_ROLE_MATCH', label: 'Target role match', weight: RECOMMENDATION_WEIGHTS.TARGET_ROLE_MATCH, earned: roleEarned, basis: roleBasis },
    { key: 'SKILL_OVERLAP', label: 'Skill overlap', weight: RECOMMENDATION_WEIGHTS.SKILL_OVERLAP, earned: skillEarned, basis: skillBasis },
    { key: 'FRESHNESS', label: 'Freshness', weight: RECOMMENDATION_WEIGHTS.FRESHNESS, earned: freshEarned, basis: freshBasis },
    { key: 'LOCATION_WORK_MODE', label: 'Location & work mode', weight: RECOMMENDATION_WEIGHTS.LOCATION_WORK_MODE, earned: prefEarned, basis: prefBasis },
    { key: 'EXPERIENCE_ALIGNMENT', label: 'Experience alignment', weight: RECOMMENDATION_WEIGHTS.EXPERIENCE_ALIGNMENT, earned: expEarned, basis: expBasis },
    { key: 'JOB_TYPE', label: 'Job type', weight: RECOMMENDATION_WEIGHTS.JOB_TYPE, earned: jobTypeEarned, basis: jobTypeBasis },
    { key: 'PROFILE_EVIDENCE', label: 'Profile evidence', weight: RECOMMENDATION_WEIGHTS.PROFILE_EVIDENCE, earned: profileEarned, basis: profileBasis },
    { key: 'RESUME_PREVIEW', label: 'Resume preview', weight: RECOMMENDATION_WEIGHTS.RESUME_PREVIEW, earned: resumeEarned, basis: resumeBasis },
  ];

  // Renormalise over the components that could actually be evaluated.
  const evaluable = components.filter(c => c.earned !== null);
  const earnedTotal = evaluable.reduce((sum, c) => sum + (c.earned as number), 0);
  const weightTotal = evaluable.reduce((sum, c) => sum + c.weight, 0);
  const recommendationScore = weightTotal > 0
    ? Math.max(0, Math.min(100, Math.round((earnedTotal / weightTotal) * TOTAL_RECOMMENDATION_WEIGHT)))
    : null;

  // The strongest positive signal, in words. Never phrased as a chance of hire.
  const reasonSummary = components
    .filter(c => c.earned !== null && (c.earned as number) >= c.weight * 0.8)
    .sort((a, b) => (b.earned as number) / b.weight - (a.earned as number) / a.weight)
    .slice(0, 3)
    .map(c => c.label.toLowerCase())
    .join(', ');

  return {
    recommendationScore,
    recommendationLabel: recommendationScore === null ? null : recommendationLabelFor(recommendationScore),
    components,
    reasonSummary: reasonSummary
      ? `Strong on ${reasonSummary}.`
      : 'No strong signal for this posting against your current data.',
  };
}

/**
 * Resolve the candidate's ranking context once. Each lookup degrades to an
 * empty result on failure so a missing collection cannot break the Jobs page.
 */
export async function buildRankingContext(userId: string, now = new Date()): Promise<RankingContext> {
  const [snapshot, resume, goals, prefs] = await Promise.all([
    getSkillProfileSnapshot(userId).catch(() => null),
    ResumeVersion.findOne({ userId, isDefault: true }).catch(() => null)
      ?? ResumeVersion.findOne({ userId }).sort({ updatedAt: -1 }).catch(() => null),
    // Active goals only — a PAUSED or ARCHIVED role must not pull postings into
    // the candidate's recommendations.
    UserCareerGoal.findActiveByUser(userId).catch(() => []),
    JobSearchPreference.find({ userId }).catch(() => []),
  ]);

  const evidencedSlugs = new Set<string>((snapshot?.skills ?? []).map(s => s.skillSlug));

  // Union of every stored search preference: a candidate targeting two roles
  // should see postings for either, not only the active filter.
  const locations = new Set<string>();
  const workModes = new Set<WorkMode>();
  const jobTypes = new Set<JobType>();
  for (const pref of prefs as any[]) {
    for (const l of pref.locations ?? []) if (l) locations.add(String(l).toLowerCase());
    for (const w of pref.workModes ?? []) if (w && w !== 'UNSPECIFIED') workModes.add(w);
    for (const t of pref.jobTypes ?? []) if (t && t !== 'UNSPECIFIED') jobTypes.add(t);
  }

  const targetRoleSlugs = ((goals as any[]) ?? []).map(g => String(g.roleSlug).toLowerCase());
  const primary = (goals as any[]).find(g => g.isPrimary);

  return {
    targetRoleSlugs,
    primaryRoleSlug: primary ? String(primary.roleSlug).toLowerCase() : null,
    evidencedSkillSlugs: evidencedSlugs,
    resumeSkillSlugs: resume ? await skillsFromResume(String(resume._id)) : null,
    locationPreferences: [...locations],
    workModePreferences: [...workModes],
    jobTypePreferences: [...jobTypes],
    preferredExperienceLevel: (prefs as any[])[0]?.experienceLevels?.[0] ?? null,
    now,
  };
}

/** Skill slugs already stored on a resume, resolved through the same dictionary. */
async function skillsFromResume(resumeVersionId: string): Promise<Set<string>> {
  const { extractSkills } = await import('../../career/services/skillExtraction');
  const version = await ResumeVersion.findById(resumeVersionId).select('data').lean().catch(() => null);
  if (!version) return new Set();
  const data = (version as any).data ?? {};
  const text = JSON.stringify(data);
  return new Set(extractSkills(text).skills);
}

/**
 * Attach a recommendation to each posting and re-sort by it.
 *
 * Ordering (spec §B5): recommendation DESC, then datePosted DESC. When the
 * candidate typed an explicit keyword query, relevance of the query is blended
 * in ahead of the date so the search still feels like a search.
 *
 * Sorting happens here, on the server. The client never reorders results.
 */
export function rankAndSort<T extends RankableJob>(
  jobs: T[],
  ctx: RankingContext,
  query = '',
): Array<T & { recommendation: ReturnType<typeof scoreJobForCandidate> }> {
  const scored = jobs.map(job => ({ ...job, recommendation: scoreJobForCandidate(job, ctx) }));
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  const textScore = (job: T): number => {
    if (terms.length === 0) return 0;
    const haystack = `${job.title ?? ''} ${job.company ?? ''} ${job.location ?? ''} ${(job.extractedSkills ?? []).join(' ')}`.toLowerCase();
    return terms.filter(t => haystack.includes(t)).length / terms.length;
  };

  return scored.sort((a, b) => {
    // Explicit keyword search blends text relevance with recommendation.
    if (terms.length > 0) {
      const textDiff = textScore(b) - textScore(a);
      if (Math.abs(textDiff) > 1e-9) return textDiff;
    }
    const scoreDiff = (b.recommendation.recommendationScore ?? -1) - (a.recommendation.recommendationScore ?? -1);
    if (scoreDiff !== 0) return scoreDiff;
    const aDate = (a.datePosted ?? a.fetchedAt)?.getTime() ?? 0;
    const bDate = (b.datePosted ?? b.fetchedAt)?.getTime() ?? 0;
    return bDate - aDate;
  });
}

/** Convenience wrapper for callers holding a lean posting document. */
export function recommendPosting(
  posting: Partial<IJobPosting>,
  ctx: RankingContext,
): ReturnType<typeof scoreJobForCandidate> {
  return scoreJobForCandidate(posting as RankableJob, ctx);
}