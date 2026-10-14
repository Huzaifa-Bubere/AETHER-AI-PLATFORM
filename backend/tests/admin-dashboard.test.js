/**
 * Admin surface accuracy (spec §68).
 *
 * These tests exist because the admin dashboard was showing numbers that no query
 * produced: hardcoded deltas ('+23%'), an invented 24h system curve, four sample
 * error logs and AI rings reading fields the API never returned.
 *
 * What is pinned here:
 *  - GET /api/jobs/providers is an ADMIN route (it sat behind the candidate guard,
 *    so every admin request 403'd and the card read "Could not read provider health");
 *  - /api/admin/stats deltas are computed from real counts and are null — never
 *    invented — when there is no comparable prior period;
 *  - /api/admin/system-metrics reports measured values and a bounded history;
 *  - the dashboard source contains no fabricated metrics.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'admin-dashboard-test-access-only';
process.env.JWT_REFRESH_SECRET = 'admin-dashboard-test-refresh-only';

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const request = require('supertest');

const User = require('../dist/models/User').default;
const Interview = require('../dist/models/Interview').default;
const IntegrityEvent = require('../dist/models/IntegrityEvent').default;
const { MAX_INTEGRITY_WARNINGS } = require('../dist/models/IntegrityEvent');
const { generateTokens } = require('../dist/utils/auth');
const systemMetrics = require('../dist/services/systemMetrics.service');
const Resume = require('../dist/models/Resume').default;
const { ResumeVersion } = require('../dist/models/ResumeVersion');

const app = require('../dist/app').createApp();
const id = '507f1f77bcf86cd799439011';

afterEach(() => {
  jest.restoreAllMocks();
  systemMetrics.resetSystemMetrics();
});

/** Authenticate as a given database role, with the database "connected". */
function signInAs(role) {
  jest.replaceProperty(mongoose.connection, '_readyState', 1);
  jest.spyOn(User, 'findById').mockResolvedValue({
    _id: id,
    email: `${role}-admin-dashboard@example.test`,
    auth: { role, tokenVersion: 0 },
    subscription: { plan: 'free' },
    isAccountLocked: () => false,
  });
  return `Bearer ${generateTokens(id).accessToken}`;
}

describe('provider health is reachable by admins (and only admins)', () => {
  test('an admin reads the real provider table', async () => {
    const res = await request(app).get('/api/jobs/providers').set('Authorization', signInAs('admin'));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { providers, overall, scheduler } = res.body.data;
    expect(Array.isArray(providers)).toBe(true);
    expect(providers.length).toBeGreaterThan(0);
    for (const provider of providers) {
      expect(typeof provider.name).toBe('string');
      expect(typeof provider.hint).toBe('string');
      expect(['ACTIVE', 'DEGRADED', 'DISABLED', 'NOT_CONFIGURED']).toContain(provider.status);
      expect(typeof provider.configured).toBe('boolean');
    }
    expect(typeof overall.summary).toBe('string');
    expect(typeof scheduler.intervalMinutes).toBe('number');
  });

  test('credential values never travel to the browser, only the missing variable names', async () => {
    const savedAdzuna = process.env.ADZUNA_APP_KEY;
    const savedJooble = process.env.JOOBLE_API_KEY;
    process.env.ADZUNA_APP_KEY = 'do-not-leak-adzuna-key';
    process.env.JOOBLE_API_KEY = 'do-not-leak-jooble-key';
    try {
      const res = await request(app).get('/api/jobs/providers').set('Authorization', signInAs('admin'));
      const body = JSON.stringify(res.body);
      expect(body).not.toContain('do-not-leak-adzuna-key');
      expect(body).not.toContain('do-not-leak-jooble-key');
      expect(body).not.toContain('ADZUNA_APP_KEY=');
    } finally {
      if (savedAdzuna === undefined) delete process.env.ADZUNA_APP_KEY;
      else process.env.ADZUNA_APP_KEY = savedAdzuna;
      if (savedJooble === undefined) delete process.env.JOOBLE_API_KEY;
      else process.env.JOOBLE_API_KEY = savedJooble;
    }
  });

  test('a candidate account is refused', async () => {
    const res = await request(app).get('/api/jobs/providers').set('Authorization', signInAs('user'));
    expect(res.status).toBe(403);
  });

  test('an anonymous request is refused', async () => {
    const res = await request(app).get('/api/jobs/providers');
    expect(res.status).toBe(401);
  });
});

/** Wire the models to a fixed, inspectable dataset. */
function mockDatabase({
  totalUsers = 500,
  newThisMonth = 110,
  newLastMonth = 100,
  last30Interviews = 150,
  prev30Interviews = 100,
  staleInProgress = 3,
  allTimeAverage = 70,
  allTimeSample = 10,
  last30Average = 80,
  prev30Average = 75,
  flaggedSessions = 2,
} = {}) {
  jest.spyOn(User, 'countDocuments').mockImplementation(async (query = {}) => {
    if (query['auth.lastLogin']) return 40;
    if (query.createdAt && query.createdAt.$lt) return newLastMonth;
    if (query.createdAt) return newThisMonth;
    return totalUsers;
  });

  jest.spyOn(Interview, 'countDocuments').mockImplementation(async (query = {}) => {
    if (query.status === 'completed') return 60;
    if (query.status === 'in-progress' && query.createdAt) return staleInProgress;
    if (query.status === 'in-progress') return 5;
    if (query.createdAt && query.createdAt.$lt) return prev30Interviews;
    if (query.createdAt) return last30Interviews;
    return 90;
  });

  jest.spyOn(Interview, 'aggregate').mockImplementation(async (pipeline = []) => {
    const groupId = pipeline[0] && pipeline[0].$group && pipeline[0].$group._id;
    if (groupId === '$type') return [{ _id: 'technical', count: 12 }];
    const createdAt = pipeline[0] && pipeline[0].$match && pipeline[0].$match.createdAt;
    if (!createdAt) return [{ average: allTimeAverage, sample: allTimeSample }];
    if (createdAt.$lt) return [{ average: prev30Average, sample: prev30Average === null ? 0 : 6 }];
    return [{ average: last30Average, sample: last30Average === null ? 0 : 4 }];
  });

  jest.spyOn(User, 'aggregate').mockImplementation(async (pipeline = []) => {
    const groupId = pipeline[0] && pipeline[0].$group && pipeline[0].$group._id;
    if (groupId === '$subscription.plan') return [{ _id: 'free', count: 400 }];
    return [{ _id: { year: 2026, month: 9 }, count: 12 }];
  });

  jest.spyOn(IntegrityEvent, 'aggregate').mockResolvedValue([{ count: flaggedSessions }]);
}

describe('/api/admin/stats reports measured values only', () => {
  test('deltas are computed from real counts', async () => {
    mockDatabase();
    const res = await request(app).get('/api/admin/stats').set('Authorization', signInAs('admin'));

    expect(res.status).toBe(200);
    const data = res.body.data;

    expect(data.users.total).toBe(500);
    expect(data.users.newThisMonth).toBe(110);
    expect(data.users.newLastMonth).toBe(100);
    expect(data.deltas.usersPercent).toBe(10);          // 110 vs 100
    expect(data.deltas.interviewsPercent).toBe(50);     // 150 vs 100
    expect(data.deltas.successRatePoints).toBe(5);      // 80 vs 75
    expect(data.interviews.avgSuccessRate).toBe(70);
    expect(data.interviews.avgSuccessRateSample).toBe(10);
    expect(data.interviews.byType).toEqual([{ _id: 'technical', count: 12 }]);
    expect(data.needsReview).toEqual({
      total: 2 + 3,
      integritySessions: 2,
      staleInProgress: 3,
      warningLimit: MAX_INTEGRITY_WARNINGS,
    });
  });

  test('no comparable prior period means null, not an invented percentage', async () => {
    mockDatabase({ newLastMonth: 0, prev30Interviews: 0, prev30Average: null });
    const res = await request(app).get('/api/admin/stats').set('Authorization', signInAs('admin'));

    expect(res.status).toBe(200);
    expect(res.body.data.deltas.usersPercent).toBeNull();
    expect(res.body.data.deltas.interviewsPercent).toBeNull();
    expect(res.body.data.deltas.successRatePoints).toBeNull();
  });

  test('a change in the underlying counts changes the reported delta', async () => {
    mockDatabase({ newThisMonth: 40, newLastMonth: 100 });
    const res = await request(app).get('/api/admin/stats').set('Authorization', signInAs('admin'));
    expect(res.body.data.deltas.usersPercent).toBe(-60);
  });

  test('the payload carries every field the dashboard renders', async () => {
    mockDatabase();
    const res = await request(app).get('/api/admin/stats').set('Authorization', signInAs('admin'));

    // These are exactly the paths the stat cards and charts read. A rename on
    // either side would otherwise surface as a blank or NaN tile at runtime.
    const paths = [
      'users.total', 'users.newThisMonth', 'users.newLastMonth', 'users.growth',
      'interviews.total', 'interviews.last30Days', 'interviews.avgSuccessRate',
      'interviews.avgSuccessRateSample', 'interviews.byType',
      'needsReview.total', 'needsReview.integritySessions', 'needsReview.staleInProgress', 'needsReview.warningLimit',
      'deltas.usersPercent', 'deltas.interviewsPercent', 'deltas.successRatePoints',
    ];
    for (const path of paths) {
      const value = path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), res.body.data);
      expect(value).not.toBeUndefined();
    }
  });
});

describe('/api/admin/ai-metrics only publishes metrics it can back with a sample', () => {
  test('each metric carries its own label, scale and sample size', async () => {
    jest.spyOn(Interview, 'aggregate').mockResolvedValue([{
      sampleSize: 7, overallScore: 71.4, relevance: 66.6, clarity: 80.2, structure: 59.5,
      relevanceSample: 7, claritySample: 7, structureSample: 0,
    }]);

    const res = await request(app).get('/api/admin/ai-metrics').set('Authorization', signInAs('admin'));
    expect(res.status).toBe(200);

    const data = res.body.data;
    expect(data.totalAnalyzed).toBe(7);
    expect(data.metrics).toHaveLength(4);
    for (const metric of data.metrics) {
      expect(typeof metric.key).toBe('string');
      expect(typeof metric.label).toBe('string');
      expect(metric.max).toBe(100);
      expect(typeof metric.sampleSize).toBe('number');
      // value and sampleSize must agree: no sample means no published number.
      expect(metric.sampleSize === 0 ? metric.value : typeof metric.value).toBe(metric.sampleSize === 0 ? null : 'number');
    }
    expect(data.metrics.find(m => m.key === 'relevance').value).toBe(67);   // 66.6
    expect(data.metrics.find(m => m.key === 'clarity').value).toBe(80);     // 80.2
    // structureScore had no sample in this dataset, so nothing is published.
    expect(data.metrics.find(m => m.key === 'structure')).toMatchObject({ value: null, sampleSize: 0 });
  });

  test('nothing analysed means every metric is null rather than 0', async () => {
    jest.spyOn(Interview, 'aggregate').mockResolvedValue([]);

    const res = await request(app).get('/api/admin/ai-metrics').set('Authorization', signInAs('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data.totalAnalyzed).toBe(0);
    for (const metric of res.body.data.metrics) {
      expect(metric.value).toBeNull();
      expect(metric.sampleSize).toBe(0);
    }
  });
});

describe('/api/admin/system-metrics reports measurements, not a curve', () => {
  test('every value is measured and the history is bounded', async () => {
    const res = await request(app).get('/api/admin/system-metrics').set('Authorization', signInAs('admin'));

    expect(res.status).toBe(200);
    const data = res.body.data;

    expect(data.memory).toBeGreaterThanOrEqual(0);
    expect(data.memory).toBeLessThanOrEqual(100);
    expect(data.cpuMeasured).toBe(data.cpu !== null);
    if (data.cpu !== null) {
      expect(data.cpu).toBeGreaterThanOrEqual(0);
      expect(data.cpu).toBeLessThanOrEqual(100);
    }
    expect(data.uptime).toBeGreaterThan(0);
    expect(data.samplingIntervalMs).toBeGreaterThan(0);
    expect(data.maxSamples).toBeGreaterThan(0);
    expect(Array.isArray(data.history)).toBe(true);
    expect(data.history.length).toBeLessThanOrEqual(data.maxSamples);
    // The request itself was counted by the real middleware.
    expect(data.requests.total).toBeGreaterThanOrEqual(1);
    expect(typeof data.nodeVersion).toBe('string');
    expect(typeof data.cores).toBe('number');
  });

  test('an unreadable database degrades the panel instead of failing it', async () => {
    const res = await request(app).get('/api/admin/system-metrics').set('Authorization', signInAs('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data.database === null || typeof res.body.data.database.size === 'number').toBe(true);
  });
});

describe('system metrics sampler', () => {
  test('CPU comes from real tick deltas (loadavg is permanently 0 on Windows)', () => {
    systemMetrics.resetSystemMetrics();
    expect(systemMetrics.cpuUsagePercent()).toBeNull();  // no window yet

    let measured = null;
    for (let attempt = 0; attempt < 20 && measured === null; attempt++) {
      const until = Date.now() + 60;
      while (Date.now() < until) { /* burn a CPU tick */ }
      measured = systemMetrics.cpuUsagePercent();
    }

    expect(measured).not.toBeNull();
    expect(measured).toBeGreaterThanOrEqual(0);
    expect(measured).toBeLessThanOrEqual(100);
  });

  test('history is a bounded ring buffer', () => {
    systemMetrics.resetSystemMetrics();
    for (let i = 0; i < systemMetrics.MAX_SAMPLES + 5; i++) systemMetrics.takeSample();
    expect(systemMetrics.systemHistory().length).toBe(systemMetrics.MAX_SAMPLES);
  });

  test('each sample carries a real request count and resets the window', () => {
    systemMetrics.resetSystemMetrics();
    systemMetrics.recordRequest();
    systemMetrics.recordRequest();
    const sample = systemMetrics.takeSample();
    expect(sample.requests).toBe(2);
    expect(systemMetrics.requestTotals()).toMatchObject({ total: 2, sinceLastSample: 0 });
  });

  test('starting the sampler is idempotent and stoppable', () => {
    systemMetrics.resetSystemMetrics();
    systemMetrics.startSystemMetricsSampler();
    expect(systemMetrics.systemHistory().length).toBe(1);

    systemMetrics.startSystemMetricsSampler();
    expect(systemMetrics.systemHistory().length).toBe(1);

    systemMetrics.stopSystemMetricsSampler();
  });
});

describe('/api/admin/error-logs merges rotated files and dates every entry', () => {
  test('the payload carries grouped entries plus the files that were scanned', async () => {
    const res = await request(app).get('/api/admin/error-logs?limit=5').set('Authorization', signInAs('admin'));

    expect(res.status).toBe(200);
    const { entries, meta } = res.body.data;
    expect(Array.isArray(entries)).toBe(true);
    expect(Array.isArray(meta.files)).toBe(true);
    expect(typeof meta.scanned).toBe('number');

    for (const entry of entries) {
      expect(typeof entry.level).toBe('string');
      expect(typeof entry.message).toBe('string');
      expect(typeof entry.count).toBe('number');
      expect(entry.count).toBeGreaterThanOrEqual(1);
      // Never an invented time: either a real ISO instant or null.
      if (entry.lastAt !== null) expect(Number.isNaN(Date.parse(entry.lastAt))).toBe(false);
      if (entry.firstAt !== null) expect(Number.isNaN(Date.parse(entry.firstAt))).toBe(false);
    }

    // Newest first.
    if (entries.length > 1 && entries[0].lastAt && entries[entries.length - 1].lastAt) {
      expect(Date.parse(entries[0].lastAt)).toBeGreaterThanOrEqual(Date.parse(entries[entries.length - 1].lastAt));
    }
  });

  test('every rotated error file on disk is read, and every entry is dated', async () => {
    const logDir = path.resolve(__dirname, '../logs');
    const rotated = fs.existsSync(logDir)
      ? fs.readdirSync(logDir).filter(name => /^error.*\.log$/i.test(name))
      : [];
    if (rotated.length === 0) return;   // nothing logged in this checkout

    const res = await request(app).get('/api/admin/error-logs?limit=50').set('Authorization', signInAs('admin'));
    expect(res.body.data.meta.files.sort()).toEqual([...rotated].sort());

    // The panel rendered "unknown" for every row while a rotated file (the live
    // one) was ignored and new Date() could not parse the stored timestamp.
    if (res.body.data.meta.hasUndatedEntries === false) {
      for (const entry of res.body.data.entries) expect(entry.lastAt).not.toBeNull();
    }
  });
});

describe('literal paths are not shadowed by a parameterised route', () => {
  test('GET /api/resume/versions reaches the version list, not Resume.findById("versions")', async () => {
    // The legacy resume router declares GET /:id. Mounted first, it swallowed
    // /versions and threw "Cast to ObjectId failed for value \"versions\"" on
    // every request — the exact error the admin panel was showing.
    jest.spyOn(Resume, 'findById').mockImplementation(() => {
      throw new Error('Resume.findById must not handle /version requests');
    });
    jest.spyOn(ResumeVersion, 'listByUser').mockResolvedValue([]);

    const res = await request(app).get('/api/resume/versions').set('Authorization', signInAs('user'));

    expect(res.status).toBe(200);
    expect(res.body.data.versions).toEqual([]);
    expect(Resume.findById).not.toHaveBeenCalled();
  });
});

describe('the dashboard itself', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../frontend/src/app/pages/AdminDashboardPage.tsx'),
    'utf8',
  );

  test('contains no fabricated percentages or sample series', () => {
    const fabricated = [
      "'+23%'", "'+18%'", "'+5%'", "'-12%'",
      "value: '23'",
      'cpu: 45', 'memory: 62', 'requests: 234', 'requests: 456',
      'High API response time detected',
      'Database connection timeout',
      'Scheduled backup completed',
      'Mock system metrics',
    ];
    for (const literal of fabricated) {
      expect(source).not.toContain(literal);
    }
  });

  test('reads only metric fields the API actually returns', () => {
    for (const missing of ['aiMetrics.responseTime', 'aiMetrics.questionQuality', 'aiMetrics.feedbackAccuracy']) {
      expect(source).not.toContain(missing);
    }
    expect(source).toContain('aiMetrics?.metrics');
  });

  test('the error panel renders the real occurrence count and reported times', () => {
    expect(source).toContain('log.count');
    expect(source).toContain('log.lastAt');
    expect(source).toContain('log.firstAt');
    expect(source).not.toContain('log.timestamp');       // the old unparseable field
    expect(source).toContain('errorLogMeta');            // says which files were read
  });
});
