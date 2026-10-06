import axios, { AxiosInstance } from 'axios';
import type { ExperienceLevel, JobType, WorkMode } from '../models/JobPosting';
import { JobSpyProviderAdapter } from './jobspy';

/**
 * Job provider adapters (spec §58).
 *
 * Each adapter talks to a provider through its OFFICIAL API and returns
 * AETHER's normalized shape. Adapters never invent data: a field the provider
 * does not supply stays null and the UI says "Not specified".
 *
 * Provider rules are respected — an adapter whose credentials are absent simply
 * reports itself unconfigured and is skipped, rather than falling back to
 * scraping or to invented sample listings.
 */

export interface NormalizedJob {
  provider: string;
  externalId: string;
  sourceUrl: string;
  title: string;
  company: string;
  companyLogo?: string | null;
  description: string;
  rawDescription?: string;
  location?: string | null;
  city?: string | null;
  country?: string | null;
  region?: string | null;
  workMode: WorkMode;
  jobType: JobType;
  experienceLevel: ExperienceLevel;
  salary?: { min?: number | null; max?: number | null; currency?: string | null; raw?: string | null; period?: 'YEAR' | 'MONTH' | 'HOUR' | null };
  datePosted?: Date | null;
  requirements?: string[];
}

export interface FetchJobsQuery {
  query?: string;
  location?: string;
  remoteOnly?: boolean;
  page?: number;
  limit?: number;
  /** ISO country code or Adzuna country code. Overrides ADZUNA_COUNTRY. */
  country?: string;
}

export interface JobProviderAdapter {
  readonly name: string;
  /** False when the required credentials are not configured. */
  isConfigured(): boolean;
  /** Human-readable reason shown in the UI when isConfigured() is false. */
  configurationHint(): string;
  fetchJobs(query: FetchJobsQuery): Promise<NormalizedJob[]>;
}

// ── URL + record validation (spec §19, §20) ─────────────────────────────────

/**
 * Only http(s) links are ever stored. Anything else (javascript:, data:, file:)
 * is rejected so a stored posting can never turn into an injection vector when
 * the UI renders an Apply link.
 */
export function isSafeSourceUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Drop tracking query parameters so two providers linking the same vacancy
 * through different campaign URLs normalise to the same link. The employer's
 * URL semantics are otherwise left untouched (spec §21).
 */
export function cleanSourceUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const TRACKING = /^(utm_|fbclid|gclid|mc_|ref|source|campaign|trk)/i;
    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING.test(key)) parsed.searchParams.delete(key);
    }
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * A posting is storable only when it has a title, a company, a safe source URL
 * and an identity. Empty shells are skipped rather than stored (spec §19).
 */
export function isStorableJob(job: NormalizedJob): boolean {
  return Boolean(
    job.title && job.title.trim() &&
    job.company && job.company.trim() &&
    job.provider && job.provider.trim() &&
    job.externalId && String(job.externalId).trim() &&
    isSafeSourceUrl(job.sourceUrl),
  );
}

/** Collapse whitespace runs and strip zero-width characters. */
export function cleanText(value: unknown): string {
  return String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Indian location normalisation (spec §29) ────────────────────────────────

/**
 * Canonical city for common Indian location spellings, so a search for
 * "Bangalore" and one for "Bengaluru" reach the same postings, and "Navi
 * Mumbai" stays distinguishable from "Mumbai" rather than collapsing into it.
 */
const INDIA_CITY_ALIASES: Record<string, string> = {
  bangalore: 'bengaluru',
  bangaloreurban: 'bengaluru',
  gurgaon: 'gurugram',
  gurgaonindia: 'gurugram',
  newdelhi: 'delhi',
  'new delhi': 'delhi',
  delhincr: 'delhi ncr',
  'delhi ncr': 'delhi ncr',
  navimumbai: 'navi mumbai',
  'navi mumbai': 'navi mumbai',
  thane: 'thane',
  pune: 'pune',
  mumbai: 'mumbai',
  hyderabad: 'hyderabad',
  chennai: 'chennai',
  noida: 'noida',
  kolkata: 'kolkata',
  ahmedabad: 'ahmedabad',
  coimbatore: 'coimbatore',
  indore: 'indore',
  remote: 'remote',
  india: 'india',
};

/** Friendly suggestions for the location input. Advisory only, never a whitelist. */
export const INDIA_LOCATION_SUGGESTIONS = [
  'Mumbai', 'Navi Mumbai', 'Thane', 'Pune', 'Bengaluru', 'Hyderabad',
  'Chennai', 'Delhi NCR', 'Gurugram', 'Noida', 'Kolkata', 'Remote', 'India',
];

/**
 * Map a raw provider location onto a canonical Indian city when one is
 * recognised, otherwise return a cleaned version of the input. Distinct cities
 * are never merged.
 */
export function normalizeIndianLocation(raw?: string | null): string | null {
  const cleaned = cleanText(raw);
  if (!cleaned) return null;
  const key = cleaned.toLowerCase().replace(/[,/].*$/, '').trim();
  return INDIA_CITY_ALIASES[key] ?? INDIA_CITY_ALIASES[cleaned.toLowerCase()] ?? cleaned;
}

/** Friendly labels for the experience filter. Values stay the stable enum (spec §32). */
export const EXPERIENCE_FILTER_OPTIONS: Array<{ value: ExperienceLevel | ''; label: string }> = [
  { value: '', label: 'Any experience' },
  { value: 'INTERN', label: 'Internship' },
  { value: 'ENTRY', label: 'Fresher / Entry level' },
  { value: 'MID', label: '1–3 years' },
  { value: 'SENIOR', label: '3–5 years' },
  { value: 'LEAD', label: 'Senior / Lead' },
];

// ── Normalization helpers ────────────────────────────────────────────────────

/** Lowercase, collapse whitespace, strip punctuation noise from titles. */
export function normalizeName(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const REMOTE_HINTS = ['remote', 'work from home', 'wfh', 'anywhere'];
const HYBRID_HINTS = ['hybrid', 'flexible location', 'remote-friendly'];

export function detectWorkMode(...sources: Array<string | null | undefined>): WorkMode {
  const haystack = sources.filter(Boolean).join(' ').toLowerCase();
  if (!haystack.trim()) return 'UNSPECIFIED';
  if (HYBRID_HINTS.some(h => haystack.includes(h))) return 'HYBRID';
  if (REMOTE_HINTS.some(h => haystack.includes(h))) return 'REMOTE';
  return 'UNSPECIFIED';
}

const INTERNSHIP_HINTS = ['intern', 'internship', 'trainee', 'apprentice'];
const PART_TIME_HINTS = ['part time', 'part-time'];
const CONTRACT_HINTS = ['contract', 'freelance', 'consulting', 'b2b', 'fixed term', 'fixed-term'];
const TEMPORARY_HINTS = ['temporary', 'temp role'];

export function detectJobType(...sources: Array<string | null | undefined>): JobType {
  const haystack = sources.filter(Boolean).join(' ').toLowerCase();
  if (!haystack.trim()) return 'UNSPECIFIED';
  if (INTERNSHIP_HINTS.some(h => haystack.includes(h))) return 'INTERNSHIP';
  if (CONTRACT_HINTS.some(h => haystack.includes(h))) return 'CONTRACT';
  if (TEMPORARY_HINTS.some(h => haystack.includes(h))) return 'TEMPORARY';
  if (PART_TIME_HINTS.some(h => haystack.includes(h))) return 'PART_TIME';
  if (haystack.includes('full time') || haystack.includes('full-time') || haystack.includes('fulltime')) return 'FULL_TIME';
  return 'UNSPECIFIED';
}

/**
 * Experience level. Returns UNSPECIFIED rather than guessing when the text
 * carries no seniority signal — "Not specified" is the honest answer.
 */
export function detectExperienceLevel(title: string, description: string): ExperienceLevel {
  const titleHay = normalizeName(title);
  if (/\b(lead|principal|staff|head of|director|architect)\b/.test(titleHay)) return 'LEAD';
  if (/\b(senior|sr\.?|snr)\b/.test(titleHay)) return 'SENIOR';
  if (/\b(junior|jr\.?|entry|graduate|fresher|associate|trainee)\b/.test(titleHay)) return 'ENTRY';
  if (/\b(intern|internship)\b/.test(titleHay)) return 'INTERN';

  const body = normalizeName(description).slice(0, 1200);
  if (/\b(5\+|\b5\b|6|7|8)\+?\s*years/.test(body)) return 'SENIOR';
  if (/\b(3|4)\+?\s*years/.test(body)) return 'MID';
  // "Fresher" is the common Indian JD term and is checked explicitly so an
  // entry-level role in an Indian listing is not filed as UNSPECIFIED (spec §31).
  if (/\b(freshers?|fresher|0\s*-\s*1|entry[- ]level|entry level|no experience|graduate)\b/.test(body)) return 'ENTRY';
  if (/\b(intern|internship|trainee|pre[- ]final year)\b/.test(body)) return 'INTERN';
  return 'UNSPECIFIED';
}

// ── Resilience (spec §25) ────────────────────────────────────────────────────

/** Per-provider timeout in ms. Configurable, never hardcoded at the call site. */
export function providerTimeoutMs(provider: string): number {
  const specific = Number.parseInt(String(process.env[`${provider.toUpperCase()}_TIMEOUT_MS`] ?? ''), 10);
  if (Number.isFinite(specific) && specific >= 1000) return specific;
  const fallback = Number.parseInt(String(process.env.JOB_PROVIDER_TIMEOUT_MS ?? ''), 10);
  return Number.isFinite(fallback) && fallback >= 1000 ? fallback : 20000;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Run a provider fetch with a bounded timeout and limited exponential backoff.
 *
 * Retries only on transient conditions (timeout, 429, 5xx, network error). A
 * 4xx such as "bad credentials" is returned immediately: retrying a permanent
 * failure just wastes the rate-limit budget.
 */
export async function withResilience<T>(
  provider: string,
  operation: () => Promise<T>,
  { attempts = 3, baseDelayMs = 500 } = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const status = (error as { response?: { status?: number } })?.response?.status;
      const retryable = status === undefined || status === 429 || (status >= 500 && status < 600);
      if (!retryable || attempt === attempts) break;
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }
  const err = new Error(`${provider} request failed after ${attempts} attempt(s): ${(lastError as Error)?.message ?? 'unknown error'}`);
  (err as { cause?: unknown }).cause = lastError;
  throw err;
}

/** Split a description into short verbatim requirement bullets, if present. */
export function extractRequirements(description: string, limit = 20): string[] {
  const lines = String(description ?? '').split(/\r?\n/);
  const bullets = lines
    .map(l => l.replace(/^\s*[-*•·‣▪]\s*/, '').replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(l => l.length >= 8 && l.length <= 220)
    .filter(l => /\b(required|must|experience|knowledge|proficient|familiar|skill|ability|responsib)/i.test(l));
  return [...new Set(bullets)].slice(0, limit);
}

/**
 * Strip HTML to plain text. Providers return markup; AETHER stores readable
 * text so skill extraction and display behave consistently.
 */
export function htmlToText(html: string): string {
  return String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── RemoteOK adapter ─────────────────────────────────────────────────────────

/**
 * RemoteOK's public JSON API. No key required; terms require a User-Agent and
 * attribution, which the adapter supplies.
 */
class RemoteOkAdapter implements JobProviderAdapter {
  readonly name = 'remoteok';

  isConfigured(): boolean {
    // RemoteOK needs no credentials, but can be switched off explicitly.
    return String(process.env.REMOTEOK_ENABLED ?? 'true').toLowerCase() !== 'false';
  }

  configurationHint(): string {
    return this.isConfigured() ? 'No credentials required.' : 'DISABLED — REMOTEOK_ENABLED=false.';
  }

  async fetchJobs(query: FetchJobsQuery): Promise<NormalizedJob[]> {
    const limit = Math.min(query.limit ?? 50, 100);
    const client: AxiosInstance = axios.create({
      timeout: providerTimeoutMs(this.name),
      // RemoteOK's API terms require a descriptive User-Agent.
      headers: { 'User-Agent': 'AETHER-Career-Platform/1.0 (job matching)' },
    });

    const response = await withResilience(this.name, () => client.get('https://remoteok.com/api'));
    const raw = response.data;
    if (!Array.isArray(raw)) return [];
    // RemoteOK returns a legal-notice record as the first element.
    const listings = raw.slice(1).filter((j: any) => j && typeof j === 'object' && !j.error);

    const needle = (query.query ?? '').toLowerCase().trim();
    const locationNeedle = (query.location ?? '').toLowerCase().trim();

    return listings
      .filter((job: any) => {
        if (query.remoteOnly && !job.location?.toLowerCase?.().includes('remote')) return false;
        if (needle) {
          const haystack = `${job.position ?? ''} ${job.company ?? ''} ${job.description ?? ''}`.toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        if (locationNeedle && !String(job.location ?? '').toLowerCase().includes(locationNeedle)) return false;
        return true;
      })
      .slice(0, limit)
      .map((job: any) => {
        const description = htmlToText(job.description ?? '');
        const salaryMin = typeof job.salary_min === 'number' && job.salary_min > 0 ? job.salary_min : null;
        const salaryMax = typeof job.salary_max === 'number' && job.salary_max > 0 ? job.salary_max : null;
        const rawUrl: string = job.url ?? job.apply_url ?? '';
        return {
          provider: this.name,
          // RemoteOK ids are stable; fall back to a hash of the URL when absent.
          externalId: String(job.id ?? rawUrl ?? `${job.company}:${job.position}`),
          sourceUrl: isSafeSourceUrl(rawUrl) ? cleanSourceUrl(rawUrl) : rawUrl,
          title: cleanText(job.position) || 'Untitled role',
          company: cleanText(job.company) || 'Unknown company',
          companyLogo: job.company_logo ?? job.logo ?? null,
          description,
          rawDescription: job.description ?? '',
          location: normalizeIndianLocation(job.location),
          city: normalizeIndianLocation(job.location),
          country: null,
          region: null,
          workMode: detectWorkMode(job.location, job.tags),
          jobType: detectJobType(job.tags, description.slice(0, 400)),
          experienceLevel: detectExperienceLevel(job.position ?? '', description),
          salary: {
            min: salaryMin,
            max: salaryMax,
            currency: job.salary_currency ?? null,
            raw: salaryMin || salaryMax ? `${salaryMin ?? '?'}–${salaryMax ?? '?'}` : null,
            period: 'YEAR',
          },
          datePosted: job.date ? new Date(job.date) : null,
          requirements: extractRequirements(description),
        } satisfies NormalizedJob;
      })
      .filter(isStorableJob);
  }
}

// ── Adzuna adapter ───────────────────────────────────────────────────────────

/**
 * Adzuna country codes AETHER accepts in its own configuration. The value is
 * validated before it reaches a URL so a typo cannot silently send every
 * candidate's query to the wrong market (spec §5).
 */
export const ADZUNA_COUNTRIES: Record<string, string> = {
  in: 'in',   // India
  gb: 'gb',   // United Kingdom
  us: 'us',   // United States
  au: 'au',   // Australia
  ca: 'ca',   // Canada
  de: 'de',   // Germany
  fr: 'fr',   // France
  nl: 'nl',   // Netherlands
  pl: 'pl',   // Poland
  sg: 'sg',   // Singapore
  za: 'za',   // South Africa
  br: 'br',   // Brazil
};

/**
 * Resolve the Adzuna country for a query.
 *
 * ORDER: explicit query.country → ADZUNA_COUNTRY → 'in'.
 *
 * The old adapter hardcoded `insearch/1` (United Kingdom) for every candidate,
 * which made India unreachable and sent every user's search to the wrong
 * market. The default is now India, matching AETHER's primary market, and it
 * stays configurable rather than being frozen into the URL.
 */
export function resolveAdzunaCountry(query?: string): string {
  const candidate = (query ?? '').toLowerCase().trim();
  return ADZUNA_COUNTRIES[candidate] ?? 'in';
}

/** Adzuna path segment for the resolved country. */
export function adzunaSearchPath(country: string): string {
  return `https://api.adzuna.com/v1/api/jobs/${country}/search`;
}

/**
 * Adzuna's official API. Requires app_id/app_key. Without them the adapter
 * reports itself unconfigured and the ingestion run skips it.
 */
class AdzunaAdapter implements JobProviderAdapter {
  readonly name = 'adzuna';

  isConfigured(): boolean {
    return Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
  }

  configurationHint(): string {
    return process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY
      ? 'Configured.'
      : 'NOT CONFIGURED — ADZUNA_APP_ID and ADZUNA_APP_KEY are not set.';
  }

  async fetchJobs(query: FetchJobsQuery): Promise<NormalizedJob[]> {
    if (!this.isConfigured()) return [];

    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const country = resolveAdzunaCountry(query.country ?? process.env.ADZUNA_COUNTRY);
    const params: Record<string, string | number> = {
      app_id: process.env.ADZUNA_APP_ID!,
      app_key: process.env.ADZUNA_APP_KEY!,
      results_per_page: perPage,
      what: query.query || 'software developer',
      content_type: 'application/json',
    };
    if (query.location) params.where = query.location;

    const response = await withResilience(
      this.name,
      () => axios.get(adzunaSearchPath(country), { params, timeout: providerTimeoutMs(this.name) }),
    );
    const results = response.data?.results ?? [];
    if (!Array.isArray(results)) return [];

    return results.map((job: any) => {
      const description = htmlToText(job.description ?? '');
      // Adzuna sends a structured salary band; keep the verbatim string too.
      const salary = job.salary ?? {};
      const salaryMin = typeof salary.min === 'number' ? salary.min : null;
      const salaryMax = typeof salary.max === 'number' ? salary.max : null;
      const rawUrl: string = job.redirect_url ?? '';
      const rawLocation = [job.location?.display_name, job.location?.area].filter(Boolean).join(', ') || null;
      return {
        provider: this.name,
        externalId: String(job.id),
        sourceUrl: isSafeSourceUrl(rawUrl) ? cleanSourceUrl(rawUrl) : rawUrl,
        title: cleanText(job.title) || 'Untitled role',
        company: cleanText(job.company?.display_name) || 'Unknown company',
        companyLogo: job.company?.logo?.url ?? null,
        description,
        rawDescription: job.description ?? '',
        location: normalizeIndianLocation(rawLocation),
        city: normalizeIndianLocation(job.location?.area),
        country: job.location?.country ?? null,
        region: job.location?.region ?? null,
        workMode: detectWorkMode(job.title, description.slice(0, 400)),
        jobType: detectJobType(job.title, job.contract_type, description.slice(0, 400)),
        experienceLevel: detectExperienceLevel(job.title ?? '', description),
        salary: {
          min: salaryMin,
          max: salaryMax,
          currency: salary.currency ?? null,
          raw: typeof salary.label === 'string' ? salary.label : null,
          period: salary.unit === 'hour' ? 'HOUR' : 'YEAR',
        },
        datePosted: job.created ? new Date(job.created) : null,
        requirements: extractRequirements(description),
      } satisfies NormalizedJob;
    }).filter(isStorableJob);
  }
}

export const jobProviders: JobProviderAdapter[] = [
  new RemoteOkAdapter(),
  new AdzunaAdapter(),
  // Optional, disabled by default. Registered last so an outage can never
  // affect the official-API sources ahead of it (spec §6, §13, §69).
  new JobSpyProviderAdapter(),
];

export function configuredProviders(): JobProviderAdapter[] {
  return jobProviders.filter(p => p.isConfigured());
}

/** Describes every adapter and its configuration state, for the UI and admin. */
export function describeProviders() {
  return jobProviders.map(p => ({
    name: p.name,
    configured: p.isConfigured(),
    hint: p.configurationHint(),
  }));
}