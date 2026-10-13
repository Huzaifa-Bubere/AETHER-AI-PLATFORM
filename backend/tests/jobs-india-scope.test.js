/**
 * India location scope (spec §54).
 *
 * The Jobs page DEFAULTS to India. The only provider that works without
 * credentials is RemoteOK — a global remote board with no country field — so an
 * unscoped list reads as a wall of foreign listings.
 *
 * These tests pin the two things that could make the default dishonest:
 *   1. what counts as India (and, importantly, what must NOT: 'Remote' and
 *      'Worldwide' are not Indian locations)
 *   2. which providers can actually be asked for India, so the page can explain
 *      an empty list instead of implying no Indian jobs exist
 *
 * The predicate and the Mongo filter are checked together: if they ever drift,
 * the UI and the database would disagree about the same posting.
 */

const {
  INDIA_COUNTRY_CODE,
  INDIA_LOCATION_TERMS,
  INDIA_LOCATION_PATTERN,
  isIndiaPosting,
  indiaScopeFilter,
  isIndiaScope,
} = require('../dist/jobs/services/jobRegion.service');

const { describeProviders } = require('../dist/jobs/providers');

describe('what counts as India (spec §54)', () => {
  test('the country itself, in any stored field', () => {
    expect(isIndiaPosting({ country: 'India' })).toBe(true);
    expect(isIndiaPosting({ location: 'India' })).toBe(true);
    expect(isIndiaPosting({ city: 'India' })).toBe(true);
    expect(isIndiaPosting({ region: 'India' })).toBe(true);
  });

  test('Indian cities are recognised in the free-text location', () => {
    expect(isIndiaPosting({ location: 'Bengaluru, Karnataka' })).toBe(true);
    expect(isIndiaPosting({ location: 'Pune, Maharashtra' })).toBe(true);
    expect(isIndiaPosting({ location: 'New Delhi' })).toBe(true);
    expect(isIndiaPosting({ city: 'Mumbai' })).toBe(true);
    expect(isIndiaPosting({ city: 'Navi Mumbai' })).toBe(true);
    expect(isIndiaPosting({ location: 'Hyderabad, Telangana' })).toBe(true);
  });

  test('an Adzuna-shaped record (city from location.area) is matched', () => {
    // The Adzuna adapter stores `city` from location.area, which collapses to
    // the country name for Indian postings.
    expect(isIndiaPosting({ city: 'india', location: 'pune' })).toBe(true);
    expect(isIndiaPosting({ city: 'germany', location: 'berlin' })).toBe(false);
  });

  test('REMOTE and WORLDWIDE are NOT India', () => {
    // Treating these as India would pad the India list with foreign listings —
    // the exact problem this scope exists to fix.
    expect(isIndiaPosting({ location: 'Remote' })).toBe(false);
    expect(isIndiaPosting({ location: 'Worldwide' })).toBe(false);
    expect(isIndiaPosting({ location: 'Remote - Worldwide' })).toBe(false);
    expect(INDIA_LOCATION_TERMS).not.toContain('remote');
    expect(INDIA_LOCATION_TERMS).not.toContain('worldwide');
  });

  test('lookalike names are not matched', () => {
    expect(isIndiaPosting({ location: 'Indiana, USA' })).toBe(false);
    expect(isIndiaPosting({ location: 'Indianapolis' })).toBe(false);
    expect(isIndiaPosting({ location: 'New York' })).toBe(false);
    expect(isIndiaPosting({ location: 'Berlin' })).toBe(false);
    // 'delhi' must still match 'New Delhi' (word boundary, not prefix).
    expect(INDIA_LOCATION_PATTERN.test('New Delhi')).toBe(true);
  });

  test('a posting with no location at all is not claimed as Indian', () => {
    expect(isIndiaPosting({})).toBe(false);
    expect(isIndiaPosting({ location: null, city: null, country: null, region: null })).toBe(false);
    expect(isIndiaPosting(null)).toBe(false);
    expect(isIndiaPosting(undefined)).toBe(false);
  });
});

describe('the Mongo filter matches the predicate', () => {
  test('it constrains all four location fields with $or', () => {
    const filter = indiaScopeFilter();
    expect(Object.keys(filter)).toEqual(['$or']);
    const fields = filter.$or.map(clause => Object.keys(clause)[0]);
    expect(fields).toEqual(['country', 'city', 'region', 'location']);
    for (const clause of filter.$or) {
      expect(clause[Object.keys(clause)[0]]).toBeInstanceOf(RegExp);
    }
  });

  test('the filter and the predicate agree for representative postings', () => {
    const postings = [
      { country: 'India' },
      { location: 'Bengaluru, Karnataka' },
      { location: 'Remote' },
      { location: 'Berlin' },
      { location: 'Worldwide' },
      {},
    ];
    for (const posting of postings) {
      const filterSays = indiaScopeFilter().$or.some(clause => {
        const field = Object.keys(clause)[0];
        const value = posting[field];
        return typeof value === 'string' && clause[field].test(value);
      });
      expect(filterSays).toBe(isIndiaPosting(posting));
    }
  });
});

describe('scope parsing', () => {
  test("only the India country code applies the scope", () => {
    expect(isIndiaScope('in')).toBe(true);
    expect(isIndiaScope('IN')).toBe(true);
    expect(isIndiaScope(' in ')).toBe(true);
  });

  test('anything else means no scope, so the API stays backward compatible', () => {
    expect(isIndiaScope('all')).toBe(false);
    expect(isIndiaScope('')).toBe(false);
    expect(isIndiaScope(undefined)).toBe(false);
    expect(isIndiaScope(null)).toBe(false);
    // 'india' is not the ISO code; a stray value must not accidentally scope.
    expect(isIndiaScope('india')).toBe(false);
    expect(INDIA_COUNTRY_CODE).toBe('in');
  });
});

describe('provider country capability (spec §54)', () => {
  test('every adapter declares whether it can be country-scoped', () => {
    for (const provider of describeProviders()) {
      expect(typeof provider.supportsCountry).toBe('boolean');
    }
  });

  test('Adzuna can be scoped to India; RemoteOK cannot', () => {
    const byName = Object.fromEntries(describeProviders().map(p => [p.name, p]));
    expect(byName.adzuna.supportsCountry).toBe(true);
    expect(byName.remoteok.supportsCountry).toBe(false);
  });
});
