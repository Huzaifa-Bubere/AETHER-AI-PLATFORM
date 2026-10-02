import axios, { AxiosInstance } from 'axios';
import type { ExperienceLevel, JobType, WorkMode } from '../models/JobPosting';

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
}

export interface JobProviderAdapter {
  readonly name: string;
  /** False when the required credentials are not configured. */
  isConfigured(): boolean;
  /** Human-readable reason shown in the UI when isConfigured() is false. */
  configurationHint(): string;
  fetchJobs(query: FetchJobsQuery): Promise<NormalizedJob[]>;
}

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
  if (haystack.includes('full time') || haystack.includes('full-time')) return 'FULL_TIME';
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
  if (/\b(freshers?|0\s*-\s*1|entry[- ]level|no experience)\b/.test(body)) return 'ENTRY';
  return 'UNSPECIFIED';
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
    return true;
  }

  configurationHint(): string {
    return 'No credentials required.';
  }

  async fetchJobs(query: FetchJobsQuery): Promise<NormalizedJob[]> {
    const limit = Math.min(query.limit ?? 50, 100);
    const client: AxiosInstance = axios.create({
      timeout: 20000,
      // RemoteOK's API terms require a descriptive User-Agent.
      headers: { 'User-Agent': 'AETHER-Career-Platform/1.0 (job matching)' },
    });

    const response = await client.get('https://remoteok.com/api');
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
        return {
          provider: this.name,
          // RemoteOK ids are stable; fall back to a hash of the URL when absent.
          externalId: String(job.id ?? job.url ?? `${job.company}:${job.position}`),
          sourceUrl: job.url ?? job.apply_url ?? '',
          title: String(job.position ?? 'Untitled role').trim(),
          company: String(job.company ?? 'Unknown company').trim(),
          companyLogo: job.company_logo ?? job.logo ?? null,
          description,
          rawDescription: job.description ?? '',
          location: job.location ?? null,
          city: job.location ?? null,
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
      .filter(job => job.sourceUrl.length > 0);
  }
}

// ── Adzuna adapter ───────────────────────────────────────────────────────────

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
    return 'Set ADZUNA_APP_ID and ADZUNA_APP_KEY to enable live Adzuna results.';
  }

  async fetchJobs(query: FetchJobsQuery): Promise<NormalizedJob[]> {
    if (!this.isConfigured()) return [];

    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const params: Record<string, string | number> = {
      app_id: process.env.ADZUNA_APP_ID!,
      app_key: process.env.ADZUNA_APP_KEY!,
      results_per_page: perPage,
      what: query.query || 'software developer',
      content_type: 'application/json',
    };
    if (query.location) params.where = query.location;

    const response = await axios.get('https://api.adzuna.com/v1/api/jobs/insearch/1', { params, timeout: 25000 });
    const results = response.data?.results ?? [];
    if (!Array.isArray(results)) return [];

    return results.map((job: any) => {
      const description = htmlToText(job.description ?? '');
      // Adzuna sends a structured salary band; keep the verbatim string too.
      const salary = job.salary ?? {};
      const salaryMin = typeof salary.min === 'number' ? salary.min : null;
      const salaryMax = typeof salary.max === 'number' ? salary.max : null;
      return {
        provider: this.name,
        externalId: String(job.id),
        sourceUrl: job.redirect_url ?? '',
        title: String(job.title ?? 'Untitled role').trim(),
        company: String(job.company?.display_name ?? 'Unknown company').trim(),
        companyLogo: job.company?.logo?.url ?? null,
        description,
        rawDescription: job.description ?? '',
        location: [job.location?.display_name, job.location?.area].filter(Boolean).join(', ') || null,
        city: job.location?.area ?? null,
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
    }).filter(job => job.sourceUrl.length > 0);
  }
}

export const jobProviders: JobProviderAdapter[] = [new RemoteOkAdapter(), new AdzunaAdapter()];

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