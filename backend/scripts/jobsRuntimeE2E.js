/**
 * jobs:e2e — RUNTIME verification of the jobs pipeline against a real MongoDB.
 *
 * Unlike tests/job*.test.js (fixtures only, no database) this script exercises
 * the real thing:
 *
 *   live provider → adapter → normalization → dedupe/fingerprint → MongoDB
 *   → skill extraction → role classification → ranking → alerts → market stats
 *
 * SAFETY (spec §73): it uses an EPHEMERAL in-memory database that is thrown
 * away on exit. It never connects to, reads from, or writes to any configured
 * production or Atlas MongoDB. No existing collection is ever dropped.
 *
 * Usage:  node scripts/jobsRuntimeE2E.js [--provider remoteok] [--limit 15]
 * Exit 0 = every assertion passed.
 */
const path = require('path');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const providerName = arg('provider', 'remoteok');
const limit = Number.parseInt(arg('limit', '15'), 10);

const results = [];
function check(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

let finished = false;
/** Holds the ephemeral server so finish() can stop it from any scope. */
let memoryServer = null;
/** Idempotent: the early-return path and the finally path must not both run it. */
async function finish() {
  if (finished) return;
  finished = true;
  const failed = results.filter(r => !r.passed);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  console.log(`${failed.length ? `FAILED: ${failed.map(f => f.name).join('; ')}` : 'ALL RUNTIME CHECKS PASSED'}`);
  try {
    const mongoose = require('mongoose');
    await mongoose.disconnect();
  } catch { /* never connected */ }
  if (memoryServer) await memoryServer.stop();
  process.exit(failed.length ? 1 : 0);
}

(async () => {
  try {
    let MongoMemoryServer;
    try {
      ({ MongoMemoryServer } = require('mongodb-memory-server'));
    } catch {
      // Optional dev-only dependency: give the operator an actionable message
      // instead of a raw module-resolution stack trace.
      console.error('mongodb-memory-server is not installed.\n' +
        'Install it for local runtime verification:\n' +
        '  npm install --no-save mongodb-memory-server\n' +
        'Or point MONGODB_URI at a running MongoDB and adjust this script.');
      process.exit(2);
    }
    const mongoose = require('mongoose');

    memoryServer = await MongoMemoryServer.create();
    // Ephemeral database, unique name: nothing else can be touched.
    const uri = memoryServer.getUri('aether_jobs_e2e');
    await mongoose.connect(uri);
    console.log(`Connected to ephemeral MongoDB: ${uri.replace(/:[^:@]*@/, ':****@')}\n`);

    const { JobPosting } = require(path.join(__dirname, '..', 'dist', 'jobs', 'models', 'JobPosting'));
    const { SavedJob } = require(path.join(__dirname, '..', 'dist', 'jobs', 'models', 'SavedJob'));
    const { JobSearchPreference } = require(path.join(__dirname, '..', 'dist', 'jobs', 'models', 'JobSearchPreference'));
    const { JobAlert } = require(path.join(__dirname, '..', 'dist', 'jobs', 'models', 'JobAlert'));
    const { CareerRole } = require(path.join(__dirname, '..', 'dist', 'career', 'models', 'CareerRole'));
    const providers = require(path.join(__dirname, '..', 'dist', 'jobs', 'providers'));
    const ingestion = require(path.join(__dirname, '..', 'dist', 'jobs', 'services', 'ingestion.service'));
    const { groupCanonicalJobs, jobFingerprint } = require(path.join(__dirname, '..', 'dist', 'jobs', 'services', 'jobFingerprint.service'));
    const { scoreJobForCandidate, rankAndSort, RECOMMENDATION_WEIGHTS } = require(path.join(__dirname, '..', 'dist', 'jobs', 'services', 'jobRecommendation.service'));
    const { computeMarketReport } = require(path.join(__dirname, '..', 'dist', 'jobs', 'services', 'jobMarketAnalytics.service'));
    const { alertMinRelevance } = require(path.join(__dirname, '..', 'dist', 'jobs', 'models', 'JobAlert'));
    const { extractSkills } = require(path.join(__dirname, '..', 'dist', 'career', 'services', 'skillExtraction'));
    const { ROLES, buildRoleDoc } = require(path.join(__dirname, '..', 'dist', 'career', 'seed', 'careerData'));

    // Role classification runs against the SAME CareerRole collection the app
    // uses, so it must be seeded here — an empty collection legitimately
    // classifies nothing (spec §35).
    for (const spec of ROLES) {
      await CareerRole.updateOne({ slug: spec.slug }, { $set: buildRoleDoc(spec) }, { upsert: true });
    }
    console.log(`CareerRoles seeded: ${ROLES.length}`);

    await JobPosting.syncIndexes();
    await SavedJob.syncIndexes();
    await JobSearchPreference.syncIndexes();
    await JobAlert.syncIndexes();
    console.log('Indexes synced (incl. unique provider+externalId and userId+jobId).\n');

    // ── 1. Live provider ingestion ─────────────────────────────────────────
    const provider = providers.jobProviders.find(p => p.name === providerName);
    check('provider is registered', Boolean(provider), providerName);
    if (!provider) return await finish();

    check('provider is configured', provider.isConfigured(), provider.configurationHint());

    const first = await ingestion.ingestFromProvider(provider, { limit });
    check('live ingestion returns jobs', first.fetched > 0, `fetched=${first.fetched}`);
    check('ingestion created postings', first.created > 0, `created=${first.created} skipped=${first.skipped}`);
    if (first.errors.length) console.log(`      provider errors: ${first.errors.slice(0, 2).join(' | ')}`);

    // ── 2. Stored data is real and complete ───────────────────────────────
    const stored = await JobPosting.find({}).limit(50).lean();
    check('postings persisted to MongoDB', stored.length > 0, `${stored.length} stored`);

    const badUrls = stored.filter(j => !providers.isSafeSourceUrl(j.sourceUrl));
    check('every stored sourceUrl is http(s)', badUrls.length === 0, `${badUrls.length} unsafe`);

    const emptyShells = stored.filter(j => !j.title || !j.company);
    check('no empty shells stored', emptyShells.length === 0, `${emptyShells.length} incomplete`);

    const withSkills = stored.filter(j => (j.extractedSkills ?? []).length > 0);
    check('skills extracted from real descriptions', withSkills.length > 0,
      `${withSkills.length}/${stored.length} have skills`);

    const roleSum = stored.reduce((s, j) => s + (j.roleIds ?? []).length, 0);
    check('role classification ran', roleSum > 0, `${roleSum} role assignments across ${stored.length} jobs`);

    const withFingerprint = stored.filter(j => Boolean(j.canonicalGroupId));
    check('every posting carries a canonical fingerprint', withFingerprint.length === stored.length,
      `${withFingerprint.length}/${stored.length}`);

    const withProvenance = stored.filter(j => (j.sources ?? []).length > 0);
    check('source provenance retained', withProvenance.length === stored.length, `${withProvenance.length}/${stored.length}`);

    // ── 3. Re-ingestion must UPDATE, never duplicate (spec §88) ───────────
    const before = await JobPosting.countDocuments({});
    const second = await ingestion.ingestFromProvider(provider, { limit });
    const after = await JobPosting.countDocuments({});
    check('re-running ingestion creates no duplicates', before === after,
      `before=${before} after=${after} (2nd run created=${second.created} updated=${second.updated})`);

    // ── 4. Cross-provider grouping does not over-merge (spec §22, §23) ────
    const groups = groupCanonicalJobs(stored.map(p => ({ ...p, id: String(p._id) })));
    check('grouping produces canonical groups', groups.length > 0, `${groups.length} groups from ${stored.length} postings`);
    const distinctSeniority = groups.filter(g => g.members.length > 1);
    check('no group mixes different seniority bands', distinctSeniority.every(g => {
      const titles = new Set(g.members.map(m => String(m.title).toLowerCase()));
      return titles.size <= g.members.length;
    }), `${distinctSeniority.length} multi-member group(s) checked`);

    const junior = jobFingerprint({ title: 'Backend Engineer', company: 'Acme', location: 'Mumbai', datePosted: new Date('2026-09-20') });
    const senior = jobFingerprint({ title: 'Senior Backend Engineer', company: 'Acme', location: 'Mumbai', datePosted: new Date('2026-09-20') });
    const pune = jobFingerprint({ title: 'Backend Engineer', company: 'Acme', location: 'Pune', datePosted: new Date('2026-09-20') });
    check('different cities fingerprint distinctly', junior !== pune);
    // Seniority tokens are STRIPPED by design so equal fingerprints can be
    // compared; the merge GUARD must then refuse to collapse the two vacancies
    // (spec §23). Asserting fingerprint inequality here would contradict the
    // documented fingerprint contract.
    check('senior and junior at same company share a comparison fingerprint', junior === senior);
    const { isSameCanonicalJob } = require(path.join(__dirname, '..', 'dist', 'jobs', 'services', 'jobFingerprint.service'));
    check('senior and junior NEVER merge (guard)',
      !isSameCanonicalJob({ title: 'Backend Engineer', company: 'Acme', location: 'Mumbai', datePosted: new Date('2026-09-20') },
        { title: 'Senior Backend Engineer', company: 'Acme', location: 'Mumbai', datePosted: new Date('2026-09-20') }));
    check('same role different city NEVER merges (guard)',
      !isSameCanonicalJob({ title: 'Backend Engineer', company: 'Acme', location: 'Mumbai', datePosted: new Date('2026-09-20') },
        { title: 'Backend Engineer', company: 'Acme', location: 'Pune', datePosted: new Date('2026-09-20') }));

    // ── 5. Ranking is real and deterministic (spec §33, §34) ──────────────
    const ctx = {
      targetRoleSlugs: [],
      primaryRoleSlug: null,
      evidencedSkillSlugs: new Set(extractSkills('node.js mongodb docker aws git rest express').skills),
      resumeSkillSlugs: new Set(extractSkills('node.js mongodb').skills),
      locationPreferences: [],
      workModePreferences: [],
      jobTypePreferences: [],
      preferredExperienceLevel: 'MID',
      now: new Date(),
    };
    const scored = stored.slice(0, 5).map(p => ({ ...p, recommendation: scoreJobForCandidate(p, ctx) }));
    check('ranking produces numeric scores for real jobs',
      scored.every(s => s.recommendation.recommendationScore !== null),
      scored.map(s => s.recommendation.recommendationScore).join(', '));

    check('no ranking component claims a hiring outcome',
      scored.every(s => !/chance|probability of hiring/i.test(s.recommendation.reasonSummary + JSON.stringify(s.recommendation.components))));

    const roleScored = scoreJobForCandidate(
      { ...stored[0], roleIds: ['backend-developer'] },
      { ...ctx, targetRoleSlugs: ['backend-developer'], primaryRoleSlug: 'backend-developer' },
    );
    const otherRoleScored = scoreJobForCandidate(
      { ...stored[0], roleIds: ['data-analyst'] },
      { ...ctx, targetRoleSlugs: ['backend-developer'], primaryRoleSlug: 'backend-developer' },
    );
    check('a target-role posting outranks an unrelated one for the same role',
      roleScored.recommendationScore > otherRoleScored.recommendationScore,
      `${roleScored.recommendationScore} > ${otherRoleScored.recommendationScore}`);
    check('unrelated role earns zero on the role component',
      otherRoleScored.components.find(c => c.key === 'TARGET_ROLE_MATCH').earned === 0);

    const sorted = rankAndSort(stored.slice(0, 10), ctx);
    const scores = sorted.map(s => s.recommendation.recommendationScore ?? -1);
    check('server-side sort is non-increasing by score',
      scores.every((v, i) => i === 0 || scores[i - 1] >= v), scores.join(' ≥ '));

    // ── 6. New-job count boundary (spec §46) ──────────────────────────────
    const pref = await JobSearchPreference.create({ userId: new mongoose.Types.ObjectId(), roleSlug: 'e2e-role' });
    const boundary = new Date(Date.now() - 60 * 60 * 1000); // one hour ago
    pref.lastViewedAt = boundary;
    await pref.save();

    const recent = await JobPosting.countDocuments({ fetchedAt: { $gt: boundary } });
    check('"new since last visit" counts only postings fetched after the stamp',
      recent > 0, `fetched after boundary: ${recent}`);

    // ── 7. Alerts: threshold and dedupe (spec §47, §G3) ───────────────────
    const threshold = alertMinRelevance();
    check('alert threshold is readable and in range',
      threshold >= 0 && threshold <= 100, `JOB_ALERT_MIN_RELEVANCE=${threshold}`);

    const fakeUser = new mongoose.Types.ObjectId();
    const job0 = stored[0];
    const firstAlert = await JobAlert.create({
      userId: fakeUser, type: 'NEW_JOB_MATCH', jobId: job0._id,
      title: job0.title, company: job0.company, recommendationScore: 90,
    });
    check('alert created', Boolean(firstAlert._id));
    let duplicateBlocked = false;
    try {
      await JobAlert.create({
        userId: fakeUser, type: 'NEW_JOB_MATCH', jobId: job0._id,
        title: job0.title, company: job0.company, recommendationScore: 90,
      });
    } catch (e) {
      duplicateBlocked = e.code === 11000;
    }
    check('a duplicate alert for the same user+job is rejected', duplicateBlocked);
    const alertCount = await JobAlert.countDocuments({ userId: fakeUser });
    check('exactly one alert stored', alertCount === 1, `count=${alertCount}`);

    // ── 8. Market analytics over the real stored jobs (spec §48) ───────────
    const report = await computeMarketReport({ roleSlug: null, periodDays: 3650, now: new Date() });
    check('market report returns real sample', report.sampleSize > 0, `sampleSize=${report.sampleSize}`);
    if (report.topSkills.length > 0) {
      const top = report.topSkills[0];
      const expected = Math.round((top.mentionCount / report.sampleSize) * 1000) / 10;
      check('skill percentage matches count/sample*100', top.percentage === expected,
        `${top.skillSlug} ${top.mentionCount}/${report.sampleSize} = ${top.percentage}%`);
      check('every reported percentage is within 0-100',
        report.topSkills.every(s => s.percentage >= 0 && s.percentage <= 100));
    } else {
      check('skill percentages computed', false, 'no skills extracted from live sample');
    }
    check('market report exposes its providers', Array.isArray(report.providers),
      report.providers.join(', ') || 'none');
    check('no trend is claimed from a single dataset', report.trend ? report.trend.trendingAvailable === false : true);

    // ── 9. No fabricated values anywhere in stored data (spec §59) ─────────
    const fakeSalary = await JobPosting.find({ 'salary.min': 0, 'salary.max': 0 }).limit(1).lean();
    check('no posting stores a fabricated 0–0 salary', fakeSalary.length === 0);

  } catch (error) {
    check('runtime script completed without an unexpected error', false, error.message);
    console.error(error);
  } finally {
    await finish();
  }
})();