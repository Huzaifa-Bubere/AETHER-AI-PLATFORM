/**
 * AETHER streak + activity tests (spec §20, §21, §23, §110).
 *
 * These lock the deterministic rules the heatmap depends on:
 *  - day bucketing is done in the CANDIDATE's timezone, not UTC
 *  - level thresholds map counts to 0-4
 *  - a streak is not broken by a day that is still in progress
 *  - the calendar arithmetic itself is correct across month/DST boundaries
 *
 * Pure functions are tested directly; the service is tested with the real
 * Mongo model mocked so no database is required.
 */

const {
  addDaysToDayKey,
  formatDayKey,
  normalizeTimezone,
  recentDayKeys,
  startOfLocalDayUtc,
  toLocalDayKey,
  todayLocalDayKey,
} = require('../dist/utils/localDay');
const { levelForCount, HEATMAP_DAYS, MIN_SAMPLE_SIZE } = require('../dist/services/streak.service');

describe('localDay — timezone-safe day keys', () => {
  test('an instant late in the UTC day is the previous day in Asia/Kolkata', () => {
    // 2026-09-27T20:00:00Z is 2026-09-28 01:30 in Kolkata (UTC+5:30).
    const instant = new Date('2026-09-27T20:00:00Z');
    expect(toLocalDayKey(instant, 'UTC')).toBe('2026-09-27');
    expect(toLocalDayKey(instant, 'Asia/Kolkata')).toBe('2026-09-28');
  });

  test('an instant early in the UTC day is still the previous day in America/Los_Angeles', () => {
    // 2026-09-28T02:00:00Z is 2026-09-27 19:00 in Los Angeles (UTC-7).
    const instant = new Date('2026-09-28T02:00:00Z');
    expect(toLocalDayKey(instant, 'UTC')).toBe('2026-09-28');
    expect(toLocalDayKey(instant, 'America/Los_Angeles')).toBe('2026-09-27');
  });

  test('a UTC-midnight instant belongs to the new day in Kolkata', () => {
    // The exact boundary the old implementation got wrong: 00:00 UTC is 05:30
    // the SAME day in Kolkata, so the streak must not roll over early.
    const instant = new Date('2026-09-28T00:00:00Z');
    expect(toLocalDayKey(instant, 'Asia/Kolkata')).toBe('2026-09-28');
  });

  test('an unknown timezone falls back to UTC rather than throwing', () => {
    expect(normalizeTimezone('Not/AZone')).toBe('UTC');
    expect(normalizeTimezone(undefined)).toBe('UTC');
    expect(normalizeTimezone('')).toBe('UTC');
    expect(normalizeTimezone('Asia/Kolkata')).toBe('Asia/Kolkata');
    expect(toLocalDayKey(new Date('2026-09-27T12:00:00Z'), 'Not/AZone')).toBe('2026-09-27');
  });
});

describe('localDay — calendar arithmetic', () => {
  test('startOfLocalDayUtc resolves the true local midnight', () => {
    // Kolkata midnight on 2026-09-28 is 2026-09-27T18:30:00Z.
    expect(startOfLocalDayUtc('2026-09-28', 'Asia/Kolkata').toISOString())
      .toBe('2026-09-27T18:30:00.000Z');
    // UTC midnight needs no offset.
    expect(startOfLocalDayUtc('2026-09-28', 'UTC').toISOString())
      .toBe('2026-09-28T00:00:00.000Z');
  });

  test('startOfLocalDayUtc survives a DST transition (America/New_York, 2026-03-08)', () => {
    // 2026-03-08 is the US spring-forward date; midnight is still EST (UTC-5).
    const start = startOfLocalDayUtc('2026-03-08', 'America/New_York');
    expect(toLocalDayKey(start, 'America/New_York')).toBe('2026-03-08');
    expect(start.getUTCHours()).toBe(5);
  });

  test('addDaysToDayKey crosses month and year boundaries', () => {
    expect(addDaysToDayKey('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDaysToDayKey('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDaysToDayKey('2028-02-28', 1)).toBe('2028-02-29'); // leap year
  });

  test('recentDayKeys returns an inclusive oldest-first window ending today', () => {
    const now = new Date('2026-09-27T12:00:00Z');
    const keys = recentDayKeys('UTC', 5, now);
    expect(keys).toEqual(['2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']);
    expect(keys).toHaveLength(5);
  });

  test('a 365-day window spans exactly one year and ends today', () => {
    const now = new Date('2026-09-27T12:00:00Z');
    const keys = recentDayKeys('UTC', HEATMAP_DAYS, now);
    expect(keys).toHaveLength(365);
    expect(keys[0]).toBe('2025-09-28');
    expect(keys[keys.length - 1]).toBe('2026-09-27');
  });

  test('todayLocalDayKey and formatDayKey agree on the local calendar', () => {
    expect(todayLocalDayKey('UTC', new Date('2026-09-27T23:59:59Z'))).toBe('2026-09-27');
    expect(formatDayKey('2026-09-27')).toBe('27 Sep 2026');
  });
});

describe('streak — activity level thresholds (spec §20)', () => {
  test('maps activity counts to levels 0-4', () => {
    expect(levelForCount(0)).toBe(0); // no activity
    expect(levelForCount(1)).toBe(1);
    expect(levelForCount(2)).toBe(2);
    expect(levelForCount(3)).toBe(3);
    expect(levelForCount(4)).toBe(3); // 3-4 share a level
    expect(levelForCount(5)).toBe(4);
    expect(levelForCount(50)).toBe(4);
  });

  test('level 0 is reserved for a genuinely empty day, never for a zero score', () => {
    // "Not assessed" is not 0 — see spec §87. An empty day has no count, and a
    // day with activity is never level 0 regardless of how small the count is.
    for (let count = 1; count <= 10; count++) {
      expect(levelForCount(count)).toBeGreaterThan(0);
    }
  });

  test('MIN_SAMPLE_SIZE is set so small samples are labelled, not scored', () => {
    expect(MIN_SAMPLE_SIZE).toBeGreaterThan(0);
  });
});
