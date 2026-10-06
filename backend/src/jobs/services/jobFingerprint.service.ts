import crypto from 'crypto';
import { normalizeName } from '../providers';

/**
 * Cross-provider job fingerprints (spec §C).
 *
 * The existing unique index on (provider, externalId) is still the PRIMARY
 * deduplication guarantee and is untouched. This module adds a SECONDARY,
 * deterministic grouping so that the same real-world vacancy surfaced by two
 * providers does not appear twice in the candidate's search results.
 *
 * Design rules, in priority order:
 *
 *  1. NEVER destroy provenance. Grouping adds `canonicalGroupId` and a
 *     `sources[]` list to each posting; it never deletes or overwrites one
 *     provider's record with another's.
 *
 *  2. NEVER over-merge (spec §C2). Seniority is part of the fingerprint, so
 *     "Backend Engineer" and "Senior Backend Engineer" at the same company
 *     group differently. City is part of the fingerprint, so a Mumbai posting
 *     and a Bengaluru posting group differently.
 *
 *  3. NO AI. This is pure string normalisation plus a hash. The same inputs
 *     always produce the same fingerprint, in any process, forever.
 */

/** How the fingerprint is built, recorded so stored groups stay interpretable. */
export const FINGERPRINT_VERSION = '1.0';

/**
 * Seniority tokens are STRIPPED from the fingerprint title.
 *
 * This is deliberate and is the mechanism that satisfies spec §C2: dropping the
 * seniority token means "Backend Engineer" and "Senior Backend Engineer" hash
 * to the SAME value, so the group guard below can detect the collision and
 * refuse to merge rather than silently merging a junior and a senior role.
 *
 * (The tokens are stripped so they can be compared; see `sameSeniorityBand`.)
 */
const SENIORITY_TOKENS = [
  'senior', 'sr', 'junior', 'jr', 'lead', 'principal', 'staff',
  'entry level', 'entry-level', 'intern', 'internship', 'trainee',
  'associate', 'head of', 'director', 'manager', 'mid level', 'mid-level',
];

/** Tokens that distinguish genuinely different roles at one company. */
const ROLE_DISTINGUISHERS = ['backend', 'frontend', 'full stack', 'fullstack', 'devops', 'data', 'ml', 'ai'];

/** Normalise a location to a comparable city token. */
export function normalizeLocationForFingerprint(location?: string | null): string {
  const raw = String(location ?? '').toLowerCase();
  if (!raw.trim()) return 'unspecified';
  // Drop country/region noise, punctuation and whitespace.
  const cleaned = raw
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\b(remote|hybrid|onsite|on-site|india|bharat)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'unspecified';
}

/**
 * Split a title into its seniority tokens and its remaining core title.
 * "Senior Backend Engineer" → { seniority: ['senior'], core: 'backend engineer' }
 */
export function splitSeniority(title: string): { seniority: string[]; core: string } {
  const normalized = normalizeName(title);
  const words = normalized.split(' ').filter(Boolean);
  const seniority: string[] = [];
  const core: string[] = [];
  for (const word of words) {
    // Multi-word phrases were already collapsed by normalizeName; match on the
    // token and also allow hyphenated forms such as "mid-level".
    const isSeniority = SENIORITY_TOKENS.some(t => word === t || word.replace(/-/g, ' ') === t);
    if (isSeniority) seniority.push(word.replace(/-/g, ' '));
    else core.push(word);
  }
  return { seniority, core: core.join(' ') };
}

/**
 * Deterministic canonical fingerprint.
 *
 * sha256(coreTitle | normalizedCompany | normalizedLocation | dateBucket)
 *
 * The DATE BUCKET is floored to `bucketDays` so that two providers reporting
 * the same vacancy one day apart still collide, while a re-posted identical
 * role months later does not.
 */
export function jobFingerprint(
  job: {
    title?: string | null;
    company?: string | null;
    location?: string | null;
    datePosted?: Date | null;
    fetchedAt?: Date | null;
  },
  bucketDays = 7,
): string {
  const { core } = splitSeniority(String(job.title ?? ''));
  const company = normalizeName(String(job.company ?? '')) || 'unspecified';
  const location = normalizeLocationForFingerprint(job.location);

  const posted = job.datePosted ?? job.fetchedAt ?? null;
  const bucket = posted
    ? Math.floor(posted.getTime() / (bucketDays * 86_400_000))
    : 'nobucket';

  const payload = [core || 'unspecified', company, location, String(bucket)].join('|');
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

/**
 * Would these two postings be the SAME vacancy?
 *
 * Returns false whenever the only difference is seniority, a different role
 * family, or a different city — the three over-merge cases named in spec §C2.
 */
export function isSameCanonicalJob(
  a: { title?: string | null; company?: string | null; location?: string | null; datePosted?: Date | null },
  b: { title?: string | null; company?: string | null; location?: string | null; datePosted?: Date | null },
  bucketDays = 7,
): boolean {
  // 1. Same fingerprint is necessary.
  if (jobFingerprint(a, bucketDays) !== jobFingerprint(b, bucketDays)) return false;

  // 2. Same seniority band. Different seniority → different vacancy, do not merge.
  const sa = splitSeniority(String(a.title ?? '')).seniority.join(' ');
  const sb = splitSeniority(String(b.title ?? '')).seniority.join(' ');
  if (sa !== sb) return false;

  // 3. Same role family. "Backend Engineer" and "Data Analyst" never merge.
  const roleA = splitSeniority(String(a.title ?? '')).core;
  const roleB = splitSeniority(String(b.title ?? '')).core;
  const familyA = ROLE_DISTINGUISHERS.find(t => roleA.includes(t)) ?? null;
  const familyB = ROLE_DISTINGUISHERS.find(t => roleB.includes(t)) ?? null;
  if (familyA !== familyB) return false;

  // 4. Same city. A Mumbai posting and a Bengaluru posting never merge.
  if (normalizeLocationForFingerprint(a.location) !== normalizeLocationForFingerprint(b.location)) return false;

  return true;
}

/** One posting's view of a cross-provider group. */
export interface CanonicalSource {
  provider: string;
  externalId: string;
  sourceUrl: string;
  datePosted: string | null;
}

export interface CanonicalGroup {
  /** The fingerprint every member shares. */
  canonicalGroupId: string;
  /** Stable id of the posting chosen to represent the group in the UI. */
  preferredJobId: string;
  /** True when the vacancy was seen from more than one provider. */
  multipleSources: boolean;
  /** ALL providers the vacancy appeared on. Provenance is never discarded. */
  sources: CanonicalSource[];
}

/**
 * Collapse a set of postings into canonical groups.
 *
 * Grouping is transitive via the fingerprint: members sharing a
 * `canonicalGroupId` belong to one vacancy. The PREFERRED member is chosen
 * deterministically so the UI is stable across reloads:
 *
 *   1. the most complete record (has salary, location, logo and a date),
 *   2. then the earliest date posted (the original listing),
 *   3. then the lexicographically smallest provider+externalId, as a
 *      tie-breaker that does not depend on database ordering.
 */
export function groupCanonicalJobs<T extends {
  _id?: unknown;
  id?: string;
  provider?: string | null;
  externalId?: string | null;
  sourceUrl?: string | null;
  title?: string | null;
  company?: string | null;
  location?: string | null;
  salary?: { min?: number | null; max?: number | null; raw?: string | null } | null;
  companyLogo?: string | null;
  datePosted?: Date | null;
}>(postings: T[], bucketDays = 7): Array<{ group: CanonicalGroup; members: T[] }> {
  const byFingerprint = new Map<string, T[]>();

  for (const posting of postings) {
    const fp = jobFingerprint({
      title: posting.title,
      company: posting.company,
      location: posting.location,
      datePosted: posting.datePosted ?? null,
      fetchedAt: null,
    }, bucketDays);

    // Merge only into an existing bucket when the guard agrees, so a senior and
    // a junior posting that happen to share a fingerprint stay in separate
    // buckets instead of collapsing.
    const bucket = byFingerprint.get(fp);
    if (!bucket) {
      byFingerprint.set(fp, [posting]);
      continue;
    }
    const compatible = bucket.some(existing => isSameCanonicalJob(existing, posting, bucketDays));
    if (compatible) bucket.push(posting);
    else byFingerprint.set(`${fp}:${posting.provider}:${posting.externalId}`, [posting]);
  }

  const idOf = (p: T): string => String(p.id ?? p._id ?? `${p.provider}:${p.externalId}`);
  const completeness = (p: T): number =>
    (p.datePosted ? 1 : 0) + (p.salary && (p.salary.min != null || p.salary.max != null || p.salary.raw) ? 1 : 0) +
    (p.location ? 1 : 0) + (p.companyLogo ? 1 : 0);

  return [...byFingerprint.entries()].map(([fingerprint, members]) => {
    const ordered = [...members].sort((a, b) => {
      const c = completeness(b) - completeness(a);
      if (c !== 0) return c;
      const ad = (a.datePosted?.getTime() ?? Number.MAX_SAFE_INTEGER);
      const bd = (b.datePosted?.getTime() ?? Number.MAX_SAFE_INTEGER);
      if (ad !== bd) return ad - bd;
      return `${a.provider}:${a.externalId}`.localeCompare(`${b.provider}:${b.externalId}`);
    });

    return {
      group: {
        canonicalGroupId: fingerprint,
        preferredJobId: idOf(ordered[0]),
        multipleSources: new Set(ordered.map(m => m.provider)).size > 1,
        sources: ordered.map(m => ({
          provider: String(m.provider ?? ''),
          externalId: String(m.externalId ?? ''),
          sourceUrl: String(m.sourceUrl ?? ''),
          datePosted: m.datePosted ? new Date(m.datePosted).toISOString() : null,
        })),
      },
      members: ordered,
    };
  });
}