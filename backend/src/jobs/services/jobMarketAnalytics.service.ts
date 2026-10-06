import { JobPosting } from '../models/JobPosting';
import { RoleMarketSnapshot, type IDistributionEntry, type ISkillCount, type IRoleMarketSnapshot } from '../models/RoleMarketSnapshot';

/**
 * Job market analytics (spec §I).
 *
 * Everything here is computed from ACTUAL stored JobPosting documents. No
 * percentage is produced by an LLM, no figure is extrapolated, and no dataset
 * is invented when the sample is empty.
 *
 * Every response carries its own denominator — sampleSize — plus the region,
 * period and providers that produced it, so a percentage can never be read
 * without knowing what it was a percentage OF (spec §I3, §I4).
 */
export const MARKET_CALCULATION_VERSION = '1.0';

/** How many skills to report. Reported counts stay exact; only the list is cut. */
const TOP_SKILL_LIMIT = 20;
/** How many buckets to show per distribution. */
const DISTRIBUTION_LIMIT = 10;

export interface MarketQuery {
  roleSlug?: string | null;
  region?: string | null;
  /** Look-back window in days. Defaults to 30. */
  periodDays?: number;
  /** Cap on documents pulled into the sample. Defaults to 2000. */
  maxSample?: number;
  now?: Date;
}

export interface MarketReport {
  roleSlug: string | null;
  region: string;
  periodStart: string;
  periodEnd: string;
  sampleSize: number;
  /** True when no postings matched — percentages are then withheld, not faked. */
  empty: boolean;

  topSkills: Array<{ skillSlug: string; mentionCount: number; percentage: number }>;
  workModeDistribution: IDistributionEntry[];
  jobTypeDistribution: IDistributionEntry[];
  experienceDistribution: IDistributionEntry[];
  locationDistribution: IDistributionEntry[];

  providers: string[];
  calculationVersion: string;
  generatedAt: string;
}

function tally(values: Array<string | null | undefined>, limit: number): IDistributionEntry[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    // Ties break alphabetically so the output is stable across runs.
    .sort((a, b) => (b.count - a.count) || a.key.localeCompare(b.key))
    .slice(0, limit);
}

/**
 * Aggregate the current market for a role/region.
 *
 * skillPercentage = (postings in the sample mentioning the skill)
 *                    / (total postings in the sample) * 100
 *
 * Rounded to one decimal. When the sample is empty every percentage list is
 * returned EMPTY rather than zero-filled, so "no data" is distinguishable from
 * "0% of jobs".
 */
export async function computeMarketReport(query: MarketQuery = {}): Promise<MarketReport> {
  const now = query.now ?? new Date();
  const periodDays = Math.max(1, Math.min(query.periodDays ?? 30, 365));
  const maxSample = Math.max(1, Math.min(query.maxSample ?? 2000, 20000));
  const periodStart = new Date(now.getTime() - periodDays * 86_400_000);

  const filter: Record<string, unknown> = {
    active: true,
    fetchedAt: { $gte: periodStart },
  };
  if (query.roleSlug) filter.roleIds = query.roleSlug.toLowerCase();
  const region = (query.region ?? '').toLowerCase().trim();
  if (region && region !== 'global') filter.country = region;

  const postings = await JobPosting.find(filter)
    .sort({ datePosted: -1 })
    .limit(maxSample)
    .select('extractedSkills workMode jobType experienceLevel location country provider')
    .lean();

  const sampleSize = postings.length;
  const providers = [...new Set(postings.map(p => String(p.provider)))].sort();

  const empty: MarketReport = {
    roleSlug: query.roleSlug ?? null,
    region: region || 'global',
    periodStart: periodStart.toISOString(),
    periodEnd: now.toISOString(),
    sampleSize: 0,
    empty: true,
    topSkills: [],
    workModeDistribution: [],
    jobTypeDistribution: [],
    experienceDistribution: [],
    locationDistribution: [],
    providers: [],
    calculationVersion: MARKET_CALCULATION_VERSION,
    generatedAt: now.toISOString(),
  };
  if (sampleSize === 0) return empty;

  // A posting mentions a skill once, however many times the word appears.
  const skillCounts = new Map<string, number>();
  for (const posting of postings) {
    for (const slug of new Set((posting.extractedSkills ?? []).map(s => s.toLowerCase()))) {
      skillCounts.set(slug, (skillCounts.get(slug) ?? 0) + 1);
    }
  }

  const topSkills: ISkillCount[] = [...skillCounts.entries()]
    .map(([skillSlug, mentionCount]) => ({
      skillSlug,
      mentionCount,
      percentage: Math.round((mentionCount / sampleSize) * 1000) / 10,
    }))
    .sort((a, b) => (b.mentionCount - a.mentionCount) || a.skillSlug.localeCompare(b.skillSlug))
    .slice(0, TOP_SKILL_LIMIT);

  return {
    roleSlug: query.roleSlug ?? null,
    region: region || 'global',
    periodStart: periodStart.toISOString(),
    periodEnd: now.toISOString(),
    sampleSize,
    empty: false,
    topSkills,
    workModeDistribution: tally(postings.map(p => p.workMode), DISTRIBUTION_LIMIT),
    jobTypeDistribution: tally(postings.map(p => p.jobType), DISTRIBUTION_LIMIT),
    experienceDistribution: tally(postings.map(p => p.experienceLevel), DISTRIBUTION_LIMIT),
    locationDistribution: tally(postings.map(p => p.location ?? p.country), DISTRIBUTION_LIMIT),
    providers,
    calculationVersion: MARKET_CALCULATION_VERSION,
    generatedAt: now.toISOString(),
  };
}

/** Persist a report so future periods have something to compare against. */
export async function recordMarketSnapshot(
  report: MarketReport,
): Promise<IRoleMarketSnapshot> {
  const roleSlug = report.roleSlug;
  if (!roleSlug) {
    // A snapshot is per-role by definition; there is nothing to store without one.
    throw new Error('recordMarketSnapshot requires a roleSlug');
  }
  return RoleMarketSnapshot.findOneAndUpdate(
    {
      roleSlug,
      region: report.region,
      periodStart: new Date(report.periodStart),
      periodEnd: new Date(report.periodEnd),
    },
    {
      $set: {
        sampleSize: report.sampleSize,
        topSkills: report.topSkills,
        workModeDistribution: report.workModeDistribution,
        jobTypeDistribution: report.jobTypeDistribution,
        experienceDistribution: report.experienceDistribution,
        locationDistribution: report.locationDistribution,
        providers: report.providers,
        calculationVersion: report.calculationVersion,
        generatedAt: new Date(report.generatedAt),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export interface TrendComparison {
  roleSlug: string;
  region: string;
  /** Number of comparable snapshots found. */
  snapshotCount: number;
  /** False until at least two comparable snapshots exist. */
  trendingAvailable: boolean;
  /** Only populated once trendingAvailable is true. */
  rising: Array<{ skillSlug: string; currentPercentage: number; previousPercentage: number; change: number }>;
  /** Always populated — current occurrence does not require history. */
  popular: Array<{ skillSlug: string; percentage: number; mentionCount: number }>;
  note: string;
}

/**
 * Separate POPULAR from TRENDING (spec §I5).
 *
 * POPULAR = high current occurrence. Available immediately from one snapshot.
 * TRENDING = movement between two comparable snapshots. With a single snapshot
 * there is nothing to compare, so `trendingAvailable` is false and `rising` is
 * empty — AETHER does not claim a trend it cannot evidence.
 */
export async function compareMarketTrend(
  report: MarketReport,
): Promise<TrendComparison> {
  const popular = report.topSkills.slice(0, 10).map(s => ({
    skillSlug: s.skillSlug,
    percentage: s.percentage,
    mentionCount: s.mentionCount,
  }));

  const base = {
    roleSlug: report.roleSlug ?? '',
    region: report.region,
    popular,
  };

  if (!report.roleSlug) {
    return {
      ...base,
      snapshotCount: 0,
      trendingAvailable: false,
      rising: [],
      note: 'Select a role to compare market history.',
    };
  }

  const history = await RoleMarketSnapshot.find({ roleSlug: report.roleSlug, region: report.region })
    .sort({ generatedAt: -1 })
    .limit(2)
    .lean();

  if (history.length < 2) {
    return {
      ...base,
      snapshotCount: history.length,
      trendingAvailable: false,
      rising: [],
      note: history.length === 1
        ? 'Only one market snapshot exists so far, so nothing can be called trending yet.'
        : 'No market history exists yet, so nothing can be called trending yet.',
    };
  }

  const [current, previous] = history;
  const previousBySlug = new Map((previous.topSkills ?? []).map(s => [s.skillSlug, s.percentage]));

  const rising = (current.topSkills ?? [])
    .map(skill => {
      const before = previousBySlug.get(skill.skillSlug);
      // A skill absent from the previous snapshot has no prior percentage to
      // compare against, so it is reported without a fabricated delta.
      if (before === undefined) return null;
      return {
        skillSlug: skill.skillSlug,
        currentPercentage: skill.percentage,
        previousPercentage: before,
        change: Math.round((skill.percentage - before) * 10) / 10,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null && v.change > 0)
    .sort((a, b) => b.change - a.change)
    .slice(0, 10);

  return {
    ...base,
    snapshotCount: history.length,
    trendingAvailable: true,
    rising,
    note: `Compared across ${history.length} market snapshots.`,
  };
}

export { RoleMarketSnapshot };