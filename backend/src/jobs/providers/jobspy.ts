import axios from 'axios';
import crypto from 'crypto';
import {
  cleanSourceUrl,
  cleanText,
  detectExperienceLevel,
  detectJobType,
  detectWorkMode,
  extractRequirements,
  htmlToText,
  isStorableJob,
  normalizeIndianLocation,
  normalizeName,
  providerTimeoutMs,
  withResilience,
  type FetchJobsQuery,
  type JobProviderAdapter,
  type NormalizedJob,
} from './index';

/**
 * JobSpy provider adapter (spec §6, §7, §15).
 *
 * JobSpy is an OPTIONAL third source. It does not replace RemoteOK or Adzuna,
 * does not become a second database, and is never called from the browser — the
 * React app has no knowledge this file exists.
 *
 * Data flow:
 *   ingestion.service → JobSpyProviderAdapter → job-provider-service (Python)
 *                     → python-jobspy → raw records → NormalizedJob → MongoDB
 *
 * COMPLIANCE (spec §12): this adapter issues plain HTTP requests to the Python
 * service. There is no CAPTCHA bypass, no stealth browser, no fingerprint
 * spoofing, no credential automation and no rate-limit evasion here. Sources are
 * opt-in via JOBSPY_SOURCES and nothing is enabled by default.
 */

/** The four states AETHER distinguishes for a provider (spec §68). */
export type ProviderStatus = 'ACTIVE' | 'DISABLED' | 'NOT_CONFIGURED' | 'DEGRADED';

/** Which JobSpy sources are opted in. Empty means nothing runs (spec §11, §13). */
export function enabledJobspySources(): string[] {
  return String(process.env.JOBSPY_SOURCES ?? '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

export function jobspyServiceUrl(): string {
  // Inside Docker this must be the service name, not localhost (spec §66, §67).
  return String(process.env.JOBSPY_SERVICE_URL ?? 'http://localhost:8010').replace(/\/+$/, '');
}

function jobspyResultsPerSource(): number {
  const raw = Number.parseInt(String(process.env.JOBSPY_RESULTS_PER_SOURCE ?? ''), 10);
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 50) : 25;
}

/** AETHER's own enable flag, kept separate from the service's copy. */
export function jobspyAdapterEnabled(): boolean {
  return String(process.env.JOBSPY_ENABLED ?? 'false').toLowerCase() === 'true';
}

/**
 * JobSpy mirrors Adzuna's field names loosely; this pulls the first present
 * value across a set of aliases so a source returning `job_title` and one
 * returning `title` both work.
 */
function pick(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value);
  }
  return null;
}

/**
 * Convert ONE raw JobSpy record into AETHER's NormalizedJob.
 *
 * Exported so it can be unit-tested against fixtures without any network call
 * (spec §70, §71).
 */
export function normalizeJobspyRecord(record: Record<string, unknown>, source: string): NormalizedJob | null {
  const title = cleanText(pick(record, 'title', 'job_title', 'position', 'jobTitle'));
  const company = cleanText(pick(record, 'company', 'company_name', 'employer', 'companyName'));
  const rawUrl = pick(record, 'job_url', 'job_url_direct', 'url', 'jobUrl', 'apply_url');

  // No usable source URL → no Apply button later, so the record is unusable.
  if (!rawUrl) return null;

  const descriptionHtml = pick(record, 'description', 'job_description', 'jobDescription') ?? '';
  const description = htmlToText(descriptionHtml);
  const locationRaw = pick(record, 'location', 'job_location', 'job_city', 'city', 'jobCity');
  const externalId =
    pick(record, 'job_id', 'id', 'jobId', 'requisition_id') ??
    crypto.createHash('sha1').update(`${source}|${company}|${normalizeName(title)}|${locationRaw ?? ''}`).digest('hex');

  const salaryMin = Number(pick(record, 'min_amount', 'salary_min', 'minSalary'));
  const salaryMax = Number(pick(record, 'max_amount', 'salary_max', 'maxSalary'));
  const hasSalary = Number.isFinite(salaryMin) || Number.isFinite(salaryMax);
  const interval = (pick(record, 'interval', 'salary_interval') ?? '').toLowerCase();
  const dateRaw = pick(record, 'date_posted', 'datePosted', 'posted_at', 'created_at');

  const job: NormalizedJob = {
    provider: 'jobspy',
    externalId: `${source}:${externalId}`,
    sourceUrl: cleanSourceUrl(rawUrl),
    title: title || 'Untitled role',
    company: company || 'Unknown company',
    companyLogo: pick(record, 'company_logo', 'companyLogo', 'logo'),
    description,
    rawDescription: descriptionHtml,
    location: normalizeIndianLocation(locationRaw),
    city: normalizeIndianLocation(pick(record, 'job_city', 'city', 'jobCity') ?? locationRaw),
    country: pick(record, 'country', 'job_country', 'country_code'),
    region: pick(record, 'state', 'region', 'job_state'),
    workMode: detectWorkMode(pick(record, 'is_remote', 'remote', 'work_mode'), locationRaw, description.slice(0, 400)),
    jobType: detectJobType(pick(record, 'job_type', 'jobType', 'employment_type'), title, description.slice(0, 400)),
    experienceLevel: detectExperienceLevel(title, description),
    salary: {
      // A missing band stays null: the UI says "Salary not listed" rather than
      // inventing ₹0 (spec §59).
      min: Number.isFinite(salaryMin) && salaryMin > 0 ? salaryMin : null,
      max: Number.isFinite(salaryMax) && salaryMax > 0 ? salaryMax : null,
      currency: pick(record, 'currency', 'salary_currency'),
      raw: pick(record, 'salary', 'salary_text'),
      period: interval.includes('hour') ? 'HOUR' : interval.includes('month') ? 'MONTH' : 'YEAR',
    },
    datePosted: dateRaw ? new Date(dateRaw) : null,
    requirements: extractRequirements(description),
  };

  return isStorableJob(job) ? job : null;
}

/** Shape returned by the Python service, kept narrow on purpose. */
interface JobspyServiceResponse {
  status?: string;
  results?: Array<Record<string, unknown>>;
  sourcesResponded?: string[];
  sourcesUnavailable?: string[];
  errors?: string[];
}

export class JobSpyProviderAdapter implements JobProviderAdapter {
  readonly name = 'jobspy';

  isConfigured(): boolean {
    return jobspyAdapterEnabled() && enabledJobspySources().length > 0;
  }

  configurationHint(): string {
    if (!jobspyAdapterEnabled()) return 'DISABLED — set JOBSPY_ENABLED=true to opt in.';
    const sources = enabledJobspySources();
    if (sources.length === 0) return 'NOT CONFIGURED — JOBSPY_SOURCES is empty, so no source would be queried.';
    return `Sources: ${sources.join(', ')} via ${jobspyServiceUrl()}`;
  }

  async fetchJobs(query: FetchJobsQuery): Promise<NormalizedJob[]> {
    if (!this.isConfigured()) return [];

    const response = await withResilience(
      this.name,
      () =>
        axios.post<JobspyServiceResponse>(
          `${jobspyServiceUrl()}/jobs/search`,
          {
            sources: enabledJobspySources(),
            query: query.query ?? '',
            location: query.location ?? '',
            country: query.country ?? '',
            remote: Boolean(query.remoteOnly),
            resultsWanted: jobspyResultsPerSource(),
            hoursOld: 7 * 24,
          },
          { timeout: providerTimeoutMs('jobspy') },
        ),
      // A down JobSpy service must never take the whole ingestion run with it
      // (spec §69): the caller isolates providers, and this surfaces the outage
      // as an ordinary provider error rather than crashing the server.
    ).catch((error: Error) => {
      throw new Error(`job-provider-service unreachable at ${jobspyServiceUrl()}: ${error.message}`);
    });

    const records = Array.isArray(response.data?.results) ? response.data.results : [];
    const perSourceLimit = jobspyResultsPerSource();

    const seen = new Set<string>();
    const jobs: NormalizedJob[] = [];
    for (const record of records) {
      const source = String(record?._source ?? enabledJobspySources()[0] ?? 'unknown');
      const job = normalizeJobspyRecord(record, source);
      if (!job) continue;
      // The same row can arrive from more than one source attempt.
      if (seen.has(job.sourceUrl)) continue;
      seen.add(job.sourceUrl);
      jobs.push(job);
      if (jobs.length >= perSourceLimit * enabledJobspySources().length) break;
    }
    return jobs;
  }

  /** Distinct from the service's own health — this is the adapter's view. */
  async health(): Promise<{ status: ProviderStatus; detail: string }> {
    if (!this.isConfigured()) {
      return { status: jobspyAdapterEnabled() ? 'NOT_CONFIGURED' : 'DISABLED', detail: this.configurationHint() };
    }
    try {
      const response = await axios.get(`${jobspyServiceUrl()}/health`, { timeout: 5000 });
      const status = String(response.data?.status ?? 'DEGRADED') as ProviderStatus;
      return { status, detail: `Service reported ${status}.` };
    } catch (error) {
      return { status: 'DEGRADED', detail: `Service unreachable: ${(error as Error).message}` };
    }
  }
}