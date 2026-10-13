/**
 * The India location scope (spec §54).
 *
 * AETHER's primary market is India, but the only provider whose postings arrive
 * without configuration is RemoteOK — a global remote board that supplies no
 * country data at all. Left unfiltered, the Jobs page therefore reads as a wall
 * of international listings, which is why the page now DEFAULTS to this scope.
 *
 * Everything here is a plain predicate over fields the adapters already store
 * (country / city / region / location). Nothing is guessed and nothing is
 * re-tagged: a posting either demonstrably names India (or an Indian city) or it
 * does not. `isIndiaPosting` and `indiaScopeFilter` are kept in lockstep so the
 * database filter and the in-process check can never disagree.
 */

/** ISO alpha-2 code for India — the same code Adzuna's API expects. */
export const INDIA_COUNTRY_CODE = 'in';

/**
 * Terms that identify an India-relevant posting in free text.
 *
 * Deliberately EXCLUDES 'remote': a remote job is not an Indian job, and
 * treating them as the same would quietly pad the India list with foreign
 * listings — the exact problem this scope exists to fix. 'Worldwide' is likewise
 * not India.
 *
 * Both spellings of the renamed cities are listed so an older provider record
 * is matched too (Bangalore/Bengaluru, Gurgaon/Gurugram, New Delhi/Delhi).
 */
export const INDIA_LOCATION_TERMS = [
  // Country-level
  'india', 'bharat',
  // Metros and major hiring cities
  'bengaluru', 'bangalore', 'mumbai', 'navi mumbai', 'thane',
  'pune', 'hyderabad', 'chennai', 'kolkata', 'ahmedabad',
  'delhi', 'new delhi', 'delhi ncr', 'ncr',
  'gurugram', 'gurgaon', 'noida', 'ghaziabad', 'faridabad',
  // Other cities that appear in real Indian postings
  'coimbatore', 'indore', 'jaipur', 'kochi', 'cochin',
  'chandigarh', 'nagpur', 'surat', 'lucknow',
  'mysuru', 'mysore', 'bhubaneswar', 'trivandrum', 'thiruvananthapuram',
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Word-boundary alternation, so 'india' does not match 'Indiana' / 'Indianapolis'
 * and 'delhi' still matches 'New Delhi'.
 */
export const INDIA_LOCATION_PATTERN = new RegExp(
  `\\b(${INDIA_LOCATION_TERMS.map(escapeRegExp).join('|')})\\b`,
  'i',
);

/** The four stored fields a location can live in. */
const LOCATION_FIELDS = ['country', 'city', 'region', 'location'] as const;

/**
 * True when a stored posting is demonstrably India-relevant.
 * Pure, so it is usable outside Mongo (tests, ranking, exports).
 */
export function isIndiaPosting(posting: {
  country?: string | null;
  city?: string | null;
  region?: string | null;
  location?: string | null;
} | null | undefined): boolean {
  if (!posting) return false;
  return LOCATION_FIELDS.some(field => {
    const value = posting[field];
    return typeof value === 'string' && INDIA_LOCATION_PATTERN.test(value);
  });
}

/**
 * Mongo filter equivalent of `isIndiaPosting`, shaped to AND with the existing
 * role/type/mode/keyword filters on GET /api/jobs.
 */
export function indiaScopeFilter(): Record<string, unknown> {
  return {
    $or: LOCATION_FIELDS.map(field => ({ [field]: INDIA_LOCATION_PATTERN })),
  };
}

/**
 * Whether a requested scope value means "restrict to India".
 * 'in' → yes. 'all'/'' /anything else → no scope (the caller decides defaults).
 */
export function isIndiaScope(value: unknown): boolean {
  return String(value ?? '').trim().toLowerCase() === INDIA_COUNTRY_CODE;
}
