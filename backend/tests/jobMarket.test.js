/**
 * Market intelligence tests (spec §I, §Q).
 *
 * Aggregations are computed from stored postings only. These tests mock the
 * posting collection with a fixed fixture so the arithmetic is exact and
 * reproducible — no network, no generated data, no database.
 */

jest.mock('../dist/jobs/models/JobPosting', () => ({
  JobPosting: { find: jest.fn() },
}));

const { JobPosting } = require('../dist/jobs/models/JobPosting');
const { computeMarketReport, MARKET_CALCULATION_VERSION } = require('../dist/jobs/services/jobMarketAnalytics.service');
const { compareMarketTrend } = require('../dist/jobs/services/jobMarketAnalytics.service');
const { RoleMarketSnapshot } = require('../dist/jobs/models/RoleMarketSnapshot');

const NOW = new Date('2026-10-01T00:00:00.000Z');

/** Stub JobPosting.find(...).select(...).limit(...).lean() with a fixture. */
function stubPostings(rows) {
  const chain = { sort: () => chain, limit: () => chain, select: () => chain, lean: async () => rows };
  JobPosting.find.mockReturnValue(chain);
}

const posting = (overrides = {}) => ({
  extractedSkills: [],
  workMode: 'ONSITE',
  jobType: 'FULL_TIME',
  experienceLevel: 'MID',
  location: 'Mumbai, India',
  country: 'India',
  provider: 'remoteok',
  ...overrides,
});

afterEach(() => {
  JobPosting.find.mockReset();
});

describe('skill percentages (spec §I3)', () => {
  test('skillPercentage = jobs mentioning skill / total jobs in sample * 100', async () => {
    // 4 postings; 3 mention node.js, 2 mention mongodb, 1 mentions docker.
    stubPostings([
      posting({ extractedSkills: ['node.js', 'mongodb', 'docker'] }),
      posting({ extractedSkills: ['node.js', 'mongodb'] }),
      posting({ extractedSkills: ['node.js'] }),
      posting({ extractedSkills: [] }),
    ]);

    const report = await computeMarketReport({ roleSlug: 'backend-developer', now: NOW });
    expect(report.sampleSize).toBe(4);
    const node = report.topSkills.find(s => s.skillSlug === 'node.js');
    const mongo = report.topSkills.find(s => s.skillSlug === 'mongodb');
    const docker = report.topSkills.find(s => s.skillSlug === 'docker');

    expect(node.mentionCount).toBe(3);
    expect(node.percentage).toBe(75); // 3/4
    expect(mongo.percentage).toBe(50); // 2/4
    expect(docker.percentage).toBe(25); // 1/4
  });

  test('a skill is counted once per posting, however many times it is listed', async () => {
    stubPostings([posting({ extractedSkills: ['node.js', 'node.js', 'node.js'] })]);
    const report = await computeMarketReport({ roleSlug: 'backend-developer', now: NOW });
    expect(report.topSkills.find(s => s.skillSlug === 'node.js').mentionCount).toBe(1);
    expect(report.topSkills.find(s => s.skillSlug === 'node.js').percentage).toBe(100);
  });

  test('topSkills are ordered by mention count, then alphabetically', async () => {
    stubPostings([
      posting({ extractedSkills: ['alpha', 'beta'] }),
      posting({ extractedSkills: ['alpha', 'beta'] }),
      posting({ extractedSkills: ['gamma'] }),
    ]);
    const report = await computeMarketReport({ roleSlug: 'backend-developer', now: NOW });
    expect(report.topSkills.map(s => s.skillSlug)).toEqual(['alpha', 'beta', 'gamma']);
  });
});

describe('response metadata (spec §I4)', () => {
  test('every response carries sample, period, region, providers and version', async () => {
    stubPostings([
      posting({ provider: 'remoteok' }),
      posting({ provider: 'adzuna' }),
      posting({ provider: 'remoteok' }),
    ]);
    const report = await computeMarketReport({ roleSlug: 'backend-developer', region: 'India', now: NOW });

    expect(report.sampleSize).toBe(3);
    expect(report.region).toBe('india');
    expect(report.roleSlug).toBe('backend-developer');
    expect(report.periodStart).toBe(new Date(NOW.getTime() - 30 * 86_400_000).toISOString());
    expect(report.periodEnd).toBe(NOW.toISOString());
    expect(report.generatedAt).toBe(NOW.toISOString());
    expect(report.calculationVersion).toBe(MARKET_CALCULATION_VERSION);
    expect(report.providers).toEqual(['adzuna', 'remoteok']);
  });

  test('distributions are computed from the same sample', async () => {
    stubPostings([
      posting({ workMode: 'REMOTE' }),
      posting({ workMode: 'REMOTE' }),
      posting({ workMode: 'ONSITE' }),
      posting({ workMode: 'UNSPECIFIED' }),
    ]);
    const report = await computeMarketReport({ roleSlug: 'backend-developer', now: NOW });
    const byKey = Object.fromEntries(report.workModeDistribution.map(d => [d.key, d.count]));
    expect(byKey.REMOTE).toBe(2);
    expect(byKey.ONSITE).toBe(1);
    expect(byKey.UNSPECIFIED).toBe(1);
  });
});

describe('an empty sample reports no percentages (spec §I3, data honesty)', () => {
  test('zero postings yields empty lists, not zero-filled percentages', async () => {
    stubPostings([]);
    const report = await computeMarketReport({ roleSlug: 'backend-developer', now: NOW });

    expect(report.sampleSize).toBe(0);
    expect(report.empty).toBe(true);
    expect(report.topSkills).toEqual([]);
    expect(report.workModeDistribution).toEqual([]);
    expect(report.locationDistribution).toEqual([]);
    expect(report.providers).toEqual([]);
  });
});

describe('popular vs trending (spec §I5)', () => {
  const reportFor = skills => ({
    roleSlug: 'backend-developer',
    region: 'global',
    sampleSize: 10,
    empty: false,
    topSkills: skills,
    workModeDistribution: [],
    jobTypeDistribution: [],
    experienceDistribution: [],
    locationDistribution: [],
    providers: ['remoteok'],
    calculationVersion: MARKET_CALCULATION_VERSION,
    generatedAt: NOW.toISOString(),
    periodStart: NOW.toISOString(),
    periodEnd: NOW.toISOString(),
  });

  test('popular is available from a single snapshot', async () => {
    RoleMarketSnapshot.find = () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) });
    const trend = await compareMarketTrend(reportFor([
      { skillSlug: 'node.js', mentionCount: 8, percentage: 80 },
    ]));
    expect(trend.popular).toHaveLength(1);
    expect(trend.popular[0].skillSlug).toBe('node.js');
  });

  test('no trend is claimed while only one snapshot exists', async () => {
    RoleMarketSnapshot.find = () => ({ sort: () => ({ limit: () => ({ lean: async () => [{ topSkills: [] }] }) }) });
    const trend = await compareMarketTrend(reportFor([]));
    expect(trend.trendingAvailable).toBe(false);
    expect(trend.rising).toEqual([]);
    expect(trend.note).toMatch(/one market snapshot/i);
    // The note explains that no trend is claimed, rather than asserting one.
    expect(trend.note).toMatch(/nothing can be called trending/i);
  });

  test('no trend is claimed when no snapshot exists at all', async () => {
    RoleMarketSnapshot.find = () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) });
    const trend = await compareMarketTrend(reportFor([]));
    expect(trend.snapshotCount).toBe(0);
    expect(trend.trendingAvailable).toBe(false);
    expect(trend.rising).toEqual([]);
  });

  test('with two snapshots, rising skills are reported as real changes', async () => {
    RoleMarketSnapshot.find = () => ({
      sort: () => ({
        limit: () => ({ lean: async () => [
          { topSkills: [{ skillSlug: 'node.js', mentionCount: 7, percentage: 70 }, { skillSlug: 'aws', mentionCount: 4, percentage: 40 }] },
          { topSkills: [{ skillSlug: 'node.js', mentionCount: 3, percentage: 30 }, { skillSlug: 'aws', mentionCount: 5, percentage: 50 }] },
        ] }),
      }),
    });
    const trend = await compareMarketTrend(reportFor([
      { skillSlug: 'node.js', mentionCount: 7, percentage: 70 },
      { skillSlug: 'aws', mentionCount: 4, percentage: 40 },
    ]));

    expect(trend.trendingAvailable).toBe(true);
    expect(trend.rising).toHaveLength(1);
    expect(trend.rising[0]).toEqual({
      skillSlug: 'node.js',
      currentPercentage: 70,
      previousPercentage: 30,
      change: 40,
    });
    // AWS fell, so it must not appear in the rising list.
    expect(trend.rising.find(r => r.skillSlug === 'aws')).toBeUndefined();
  });
});