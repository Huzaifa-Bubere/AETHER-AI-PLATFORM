import { JobPosting, type IJobPosting } from '../models/JobPosting';
import { configuredProviders, normalizeName, type FetchJobsQuery, type JobProviderAdapter, type NormalizedJob } from '../providers';
import { extractSkills } from '../../career/services/skillExtraction';
import { CareerRole } from '../../career/models/CareerRole';
import logger from '../../utils/logger';
import { recordProviderRun } from './providerHealth.service';

/**
 * JobIngestionService (spec §59, §62, §63).
 *
 *   External sources → provider adapter → normalization → deduplication
 *   → MongoDB → skill extraction → role classification → AETHER Jobs API
 *
 * Deduplication is enforced by a unique index on (provider, externalId), so
 * re-running ingestion updates postings instead of showing the same job twice.
 */

export interface IngestionReport {
  provider: string;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  /** True when the adapter had no credentials and was therefore not called. */
  skipped_provider?: boolean;
}

/** Map a posting onto career roles using its title and extracted skills. */
export async function classifyRoles(job: { title: string; extractedSkills: string[] }): Promise<string[]> {
  const roles = await CareerRole.find({ isActive: { $ne: false } })
    .select('slug name marketAliases skills.skillSlug')
    .lean();

  if (roles.length === 0) return [];

  const titleHaystack = normalizeName(job.title);
  const skillSet = new Set(job.extractedSkills);

  return roles
    .map(role => {
      // A title or alias hit is a strong signal.
      const aliases = [role.slug, role.name, ...(role.marketAliases ?? [])].map(normalizeName);
      const titleMatch = aliases.some(alias => alias && titleHaystack.includes(alias));

      // Otherwise fall back to skill overlap with the role's requirement matrix.
      const roleSkills = (role.skills ?? []).map(s => s.skillSlug);
      const overlap = roleSkills.filter(slug => skillSet.has(slug)).length;
      const skillMatch = roleSkills.length > 0 && overlap / roleSkills.length >= 0.3;

      if (titleMatch) return { slug: role.slug, strength: 2 };
      if (skillMatch) return { slug: role.slug, strength: overlap };
      return null;
    })
    .filter((v): v is { slug: string; strength: number } => v !== null)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 5)
    .map(v => v.slug);
}

/** Convert a provider payload into the stored document shape. */
export async function normalizeForStorage(job: NormalizedJob): Promise<Partial<IJobPosting>> {
  const description = job.description ?? '';
  const skills = extractSkills(`${job.title}\n${job.rawDescription ?? description}`).skills;
  const roleIds = await classifyRoles({ title: job.title, extractedSkills: skills });

  return {
    provider: job.provider,
    externalId: job.externalId,
    sourceUrl: job.sourceUrl,
    title: job.title,
    company: job.company,
    companyLogo: job.companyLogo ?? null,
    normalizedTitle: normalizeName(job.title),
    normalizedCompany: normalizeName(job.company),
    description: description.slice(0, 20000),
    rawDescription: (job.rawDescription ?? description).slice(0, 60000),
    location: job.location ?? null,
    city: job.city ?? null,
    country: job.country ?? null,
    region: job.region ?? null,
    workMode: job.workMode,
    jobType: job.jobType,
    experienceLevel: job.experienceLevel,
    salary: job.salary ?? { min: null, max: null, currency: null, raw: null, period: null },
    roleIds,
    extractedSkills: skills,
    datePosted: job.datePosted ?? null,
    active: true,
    requirements: job.requirements ?? [],
  };
}

/** Fetch from one adapter and upsert everything it returned. */
export async function ingestFromProvider(
  provider: JobProviderAdapter,
  query: FetchJobsQuery,
): Promise<IngestionReport> {
  const report: IngestionReport = { provider: provider.name, fetched: 0, created: 0, updated: 0, skipped: 0, errors: [] };

  if (!provider.isConfigured()) {
    report.skipped_provider = true;
    return report;
  }

  let jobs: NormalizedJob[];
  try {
    jobs = await provider.fetchJobs(query);
  } catch (error) {
    report.errors.push(`fetch failed: ${(error as Error).message}`);
    logger.warn(`[jobs] provider ${provider.name} fetch failed`, { err: (error as Error).message });
    return report;
  }

  report.fetched = jobs.length;

  for (const job of jobs) {
    try {
      const doc = await normalizeForStorage(job);
      const { posting, created } = await JobPosting.upsertFromProvider(job.provider, job.externalId, doc);
      if (created) {
        report.created += 1;
        // Keep the lean shape the alert service needs, without re-querying.
        lastCreatedPostings.push({
          _id: posting._id,
          title: posting.title,
          company: posting.company,
          location: posting.location ?? null,
          workMode: posting.workMode,
          jobType: posting.jobType,
          experienceLevel: posting.experienceLevel,
          datePosted: posting.datePosted ?? null,
          roleIds: posting.roleIds ?? [],
          extractedSkills: posting.extractedSkills ?? [],
        });
      } else {
        report.updated += 1;
      }
    } catch (error) {
      report.skipped += 1;
      report.errors.push(`${job.provider}:${job.externalId}: ${(error as Error).message}`);
    }
  }

  logger.info(`[jobs] ${provider.name}: ${report.created} new, ${report.updated} updated, ${report.skipped} skipped`);
  return report;
}

/**
 * Ingest from every configured provider.
 *
 * Failure isolation (spec §A47): one provider failing never aborts the others,
 * because each provider is awaited inside its own try and its report is still
 * returned.
 */
export async function runIngestion(query: FetchJobsQuery = {}): Promise<IngestionReport[]> {
  const providers = configuredProviders();
  const reports: IngestionReport[] = [];

  // Providers run SEQUENTIALLY on purpose: a sequential loop makes the
  // "one provider fails, the rest still complete" guarantee obvious, and a slow
  // optional source cannot starve the official APIs of their turn.
  for (const provider of providers) {
    reports.push(await runOne(provider, query));
  }
  if (providers.length === 0) {
    // No provider is configured. Say so plainly instead of serving nothing
    // silently — the UI surfaces this as "no live provider configured".
    logger.info('[jobs] ingestion skipped: no provider configured');
  }
  return reports;
}

/**
 * The postings created by the most recent ingestion, for alert generation.
 *
 * Held in memory by the refresh cycle. Keeping it here means alerts are raised
 * only for genuinely NEW postings and never for postings that already existed
 * and merely got refreshed (spec §G1).
 */
let lastCreatedPostings: Array<Record<string, unknown>> = [];

/**
 * One provider's turn, wrapped so a failure is RECORDED rather than thrown, and
 * so the remaining providers still run (spec §25, §74).
 *
 * Logging is structured and carries no credentials: the provider name, counts
 * and duration only.
 */
async function runOne(provider: JobProviderAdapter, query: FetchJobsQuery): Promise<IngestionReport> {
  const startedAt = Date.now();
  try {
    const report = await ingestFromProvider(provider, query);
    recordProviderRun({
      name: provider.name,
      configured: true,
      enabled: true,
      hint: provider.configurationHint(),
      // A skipped/unconfigured provider is not a failure.
      ok: !report.skipped_provider,
      error: report.errors[0] ?? null,
      fetched: report.fetched,
      created: report.created,
      updated: report.updated,
      skipped: report.skipped,
      durationMs: Date.now() - startedAt,
    });
    return report;
  } catch (error) {
    const message = (error as Error).message;
    logger.warn('jobs.provider_run_failed', { provider: provider.name, err: message });
    recordProviderRun({
      name: provider.name,
      configured: true,
      enabled: true,
      hint: provider.configurationHint(),
      ok: false,
      error: message,
      durationMs: Date.now() - startedAt,
    });
    return { provider: provider.name, fetched: 0, created: 0, updated: 0, skipped: 0, errors: [message] };
  }
}

export function takeNewlyCreatedPostings(): Array<Record<string, unknown>> {
  const created = lastCreatedPostings;
  lastCreatedPostings = [];
  return created;
}

/**
 * Mark postings stale once they age out. A posting older than the retention
 * window without a fresh fetch is no longer "current", so the Jobs page stops
 * presenting it as live.
 */
export async function sweepExpiredPostings(retentionDays = 30): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  const result = await JobPosting.updateMany(
    { active: true, datePosted: { $ne: null, $lt: cutoff } },
    { $set: { active: false } },
  );
  if (result.modifiedCount > 0) logger.info(`[jobs] deactivated ${result.modifiedCount} aged posting(s)`);
  return result.modifiedCount ?? 0;
}

/** Newest fetch across all providers — the freshness stamp the UI shows. */
export async function getFreshness(): Promise<{ lastFetchedAt: string | null; totalActive: number }> {
  const [freshest] = await JobPosting.find({ active: true })
    .sort({ fetchedAt: -1 })
    .limit(1)
    .select('fetchedAt')
    .lean();
  const totalActive = await JobPosting.countDocuments({ active: true });
  return { lastFetchedAt: freshest?.fetchedAt ? new Date(freshest.fetchedAt).toISOString() : null, totalActive };
}