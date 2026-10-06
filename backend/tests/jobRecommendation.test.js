/**
 * Job recommendation ranking + cross-provider deduplication tests
 * (spec §B, §C, §Q).
 *
 * These lock the properties the Jobs page depends on:
 *  - ranking is deterministic and separable from the job-fit score
 *  - an unavailable signal is null, never a faked zero
 *  - a role match actually lifts a posting's rank
 *  - cross-provider duplicates group, but distinct seniority / city / role do NOT
 *
 * No database is involved: the ranker and the fingerprinter are pure functions.
 */

const {
  RECOMMENDATION_WEIGHTS,
  TOTAL_RECOMMENDATION_WEIGHT,
  RECOMMENDATION_BANDS,
  recommendationLabelFor,
  scoreJobForCandidate,
  rankAndSort,
} = require('../dist/jobs/services/jobRecommendation.service');

const {
  jobFingerprint,
  isSameCanonicalJob,
  splitSeniority,
  normalizeLocationForFingerprint,
  groupCanonicalJobs,
} = require('../dist/jobs/services/jobFingerprint.service');

const NOW = new Date('2026-10-01T00:00:00.000Z');
const daysAgo = n => new Date(NOW.getTime() - n * 86_400_000);

/** A fully-specified context; override only what a given test cares about. */
function ctx(overrides = {}) {
  return {
    targetRoleSlugs: ['backend-developer'],
    primaryRoleSlug: 'backend-developer',
    evidencedSkillSlugs: new Set(['node.js', 'mongodb', 'docker']),
    resumeSkillSlugs: new Set(['node.js', 'mongodb']),
    locationPreferences: ['mumbai'],
    workModePreferences: ['HYBRID'],
    jobTypePreferences: ['FULL_TIME'],
    preferredExperienceLevel: 'MID',
    now: NOW,
    ...overrides,
  };
}

function job(overrides = {}) {
  return {
    title: 'Backend Engineer',
    company: 'Acme',
    location: 'Mumbai, India',
    workMode: 'HYBRID',
    jobType: 'FULL_TIME',
    experienceLevel: 'MID',
    datePosted: daysAgo(2),
    roleIds: ['backend-developer'],
    extractedSkills: ['node.js', 'mongodb', 'docker'],
    ...overrides,
  };
}

const componentOf = (result, key) => result.components.find(c => c.key === key);

describe('recommendation formula (spec §B2)', () => {
  test('the documented weights sum to 100', () => {
    expect(RECOMMENDATION_WEIGHTS.TARGET_ROLE_MATCH).toBe(30);
    expect(RECOMMENDATION_WEIGHTS.SKILL_OVERLAP).toBe(25);
    expect(RECOMMENDATION_WEIGHTS.FRESHNESS).toBe(10);
    expect(RECOMMENDATION_WEIGHTS.LOCATION_WORK_MODE).toBe(10);
    expect(RECOMMENDATION_WEIGHTS.EXPERIENCE_ALIGNMENT).toBe(10);
    expect(RECOMMENDATION_WEIGHTS.JOB_TYPE).toBe(5);
    expect(RECOMMENDATION_WEIGHTS.PROFILE_EVIDENCE).toBe(5);
    expect(RECOMMENDATION_WEIGHTS.RESUME_PREVIEW).toBe(5);
    expect(TOTAL_RECOMMENDATION_WEIGHT).toBe(100);
  });

  test('every band is worded as relevance, never as a chance of being hired', () => {
    const forbidden = /chance|probability|hiring|offer likelihood/i;
    for (const band of RECOMMENDATION_BANDS) {
      expect(band.label).not.toMatch(forbidden);
    }
    expect(recommendationLabelFor(95)).toBe('Highly Relevant');
    expect(recommendationLabelFor(5)).toBe('Low Relevance');
  });
});

describe('ranking components (spec §B3)', () => {
  test('a posting matching a target role earns the full role component', () => {
    const result = scoreJobForCandidate(job(), ctx());
    const role = componentOf(result, 'TARGET_ROLE_MATCH');
    expect(role.earned).toBe(30);
    expect(role.basis).toMatch(/target role/i);
    // The basis is a sentence, not a number.
    expect(typeof role.basis).toBe('string');
    expect(role.basis.length).toBeGreaterThan(10);
  });

  test('skill overlap is proportional to the posting’s own skill list', () => {
    const all = scoreJobForCandidate(job({ extractedSkills: ['node.js', 'mongodb'] }), ctx());
    expect(componentOf(all, 'SKILL_OVERLAP').earned).toBe(25);

    const half = scoreJobForCandidate(job({ extractedSkills: ['node.js', 'react'] }), ctx());
    expect(componentOf(half, 'SKILL_OVERLAP').earned).toBe(12.5);
  });

  test('a newer posting outranks an older otherwise-identical posting', () => {
    const fresh = scoreJobForCandidate(job({ datePosted: daysAgo(1) }), ctx());
    const stale = scoreJobForCandidate(job({ datePosted: daysAgo(25) }), ctx());
    expect(componentOf(fresh, 'FRESHNESS').earned).toBeGreaterThan(componentOf(stale, 'FRESHNESS').earned);
    expect(fresh.recommendationScore).toBeGreaterThan(stale.recommendationScore);
  });

  test('role match lifts a posting above an otherwise identical one without it', () => {
    const onTarget = scoreJobForCandidate(job(), ctx());
    const offTarget = scoreJobForCandidate(job({ roleIds: ['data-analyst'] }), ctx());
    expect(onTarget.recommendationScore).toBeGreaterThan(offTarget.recommendationScore);
  });
});

describe('unavailable signals are null, not zero (spec §B2)', () => {
  test('a posting with no date has a null freshness component', () => {
    const result = scoreJobForCandidate(job({ datePosted: null, fetchedAt: null }), ctx());
    expect(componentOf(result, 'FRESHNESS').earned).toBeNull();
    expect(componentOf(result, 'FRESHNESS').basis).toMatch(/no date/i);
  });

  test('a posting with no extracted skills has a null skill component', () => {
    const result = scoreJobForCandidate(job({ extractedSkills: [] }), ctx());
    expect(componentOf(result, 'SKILL_OVERLAP').earned).toBeNull();
  });

  test('an unset candidate preference yields null, not a zero penalty', () => {
    const result = scoreJobForCandidate(job(), ctx({
      locationPreferences: [],
      workModePreferences: [],
      jobTypePreferences: [],
      preferredExperienceLevel: null,
    }));
    for (const key of ['LOCATION_WORK_MODE', 'JOB_TYPE', 'EXPERIENCE_ALIGNMENT']) {
      expect(componentOf(result, key).earned).toBeNull();
    }
    // ...and the score is renormalised rather than dragged down by those weights.
    expect(result.recommendationScore).toBeGreaterThan(0);
  });

  test('a candidate with no evidence and no resume still gets a reasoned score', () => {
    const result = scoreJobForCandidate(job(), ctx({
      evidencedSkillSlugs: new Set(),
      resumeSkillSlugs: null,
    }));
    expect(componentOf(result, 'PROFILE_EVIDENCE').earned).toBeNull();
    expect(componentOf(result, 'RESUME_PREVIEW').earned).toBeNull();
    expect(typeof result.recommendationScore).toBe('number');
    expect(result.recommendationScore).toBeGreaterThanOrEqual(0);
    expect(result.recommendationScore).toBeLessThanOrEqual(100);
  });

  test('no component ever describes a hiring outcome', () => {
    const result = scoreJobForCandidate(job({ roleIds: [] }), ctx());
    for (const c of result.components) {
      expect(`${c.label} ${c.basis}`).not.toMatch(/chance|probability of|will be hired|hiring probability/i);
    }
    expect(result.reasonSummary).not.toMatch(/chance|probability/i);
  });
});

describe('sorting (spec §B5)', () => {
  const posting = (id, overrides) => ({ ...job(overrides), id });

  test('recommendation DESC, then datePosted DESC', () => {
    const onTargetFresh = posting('a', { roleIds: ['backend-developer'], datePosted: daysAgo(1) });
    const onTargetOld = posting('b', { roleIds: ['backend-developer'], datePosted: daysAgo(20) });
    const offTarget = posting('c', { roleIds: ['data-analyst'], datePosted: daysAgo(0) });

    const ranked = rankAndSort([offTarget, onTargetOld, onTargetFresh], ctx());
    expect(ranked.map(r => r.id)).toEqual(['a', 'b', 'c']);
  });

  test('a keyword search puts the text match first even if it ranks lower overall', () => {
    const exact = posting('a', { title: 'Kubernetes Platform Engineer', roleIds: ['devops-engineer'] });
    const broad = posting('b', { title: 'Backend Engineer', roleIds: ['backend-developer'] });
    const ranked = rankAndSort([broad, exact], ctx(), 'kubernetes');
    expect(ranked[0].id).toBe('a');
  });

  test('multi-role isolation: a role outside the candidate’s targets scores zero on role match', () => {
    const result = scoreJobForCandidate(job({ roleIds: ['devops-engineer'] }), ctx({
      targetRoleSlugs: ['backend-developer', 'data-analyst'],
      primaryRoleSlug: 'data-analyst',
    }));
    expect(componentOf(result, 'TARGET_ROLE_MATCH').earned).toBe(0);
  });
});

describe('cross-provider fingerprints (spec §C)', () => {
  const a = {
    title: 'Backend Engineer',
    company: 'Acme Corp',
    location: 'Mumbai, India',
    datePosted: new Date('2026-09-20T10:00:00Z'),
  };

  test('the same vacancy from two providers fingerprints identically', () => {
    const b = { ...a, title: 'Backend Engineer' };
    expect(jobFingerprint(a)).toBe(jobFingerprint(b));
    expect(isSameCanonicalJob(a, b)).toBe(true);
  });

  test('fingerprints are deterministic across calls', () => {
    expect(jobFingerprint(a)).toBe(jobFingerprint(a));
    expect(jobFingerprint(a)).toHaveLength(32);
  });

  test('a posting outside the date bucket does not group with one inside it', () => {
    const muchLater = { ...a, datePosted: new Date('2026-09-20T10:00:00Z'), };
    const later = { ...a, datePosted: new Date('2026-06-01T10:00:00Z') };
    expect(jobFingerprint(muchLater)).not.toBe(jobFingerprint(later));
  });

  test('different seniority at the same company is NOT grouped (spec §C2)', () => {
    const junior = { ...a, title: 'Backend Engineer' };
    const senior = { ...a, title: 'Senior Backend Engineer' };
    expect(isSameCanonicalJob(junior, senior)).toBe(false);
  });

  test('different cities are NOT grouped (spec §C2)', () => {
    const mumbai = { ...a, location: 'Mumbai, India' };
    const bengaluru = { ...a, location: 'Bengaluru, India' };
    expect(isSameCanonicalJob(mumbai, bengaluru)).toBe(false);
  });

  test('different role families at the same company are NOT grouped', () => {
    const backend = { ...a, title: 'Backend Engineer' };
    const data = { ...a, title: 'Data Analyst' };
    expect(isSameCanonicalJob(backend, data)).toBe(false);
  });

  test('seniority tokens are separated from the core title', () => {
    expect(splitSeniority('Senior Backend Engineer')).toEqual({ seniority: ['senior'], core: 'backend engineer' });
    expect(splitSeniority('Backend Engineer')).toEqual({ seniority: [], core: 'backend engineer' });
  });

  test('location normalisation ignores work-mode noise', () => {
    expect(normalizeLocationForFingerprint('Mumbai (Hybrid)')).toBe(normalizeLocationForFingerprint('mumbai, india'));
    expect(normalizeLocationForFingerprint(null)).toBe('unspecified');
  });
});

describe('canonical grouping preserves provenance (spec §C3, §C4)', () => {
  const listing = (provider, externalId, overrides = {}) => ({
    id: `${provider}-${externalId}`,
    provider,
    externalId,
    sourceUrl: `https://example.test/${externalId}`,
    title: 'Backend Engineer',
    company: 'Acme Corp',
    location: 'Mumbai, India',
    datePosted: new Date('2026-09-20T10:00:00Z'),
    salary: null,
    companyLogo: null,
    ...overrides,
  });

  test('the same vacancy from two providers becomes one group with two sources', () => {
    const groups = groupCanonicalJobs([
      listing('adzuna', '1'),
      listing('remoteok', 'abc'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].group.multipleSources).toBe(true);
    expect(groups[0].group.sources.map(s => s.provider).sort()).toEqual(['adzuna', 'remoteok']);
    // Both records are retained — nothing is deleted.
    expect(groups[0].members).toHaveLength(2);
  });

  test('the preferred member is the most complete record, deterministically', () => {
    const bare = listing('remoteok', 'abc');
    const complete = listing('adzuna', '1', { salary: { min: 1000000, max: 2000000 }, companyLogo: 'https://logo.test/x.png' });
    const forward = groupCanonicalJobs([bare, complete]);
    const reverse = groupCanonicalJobs([complete, bare]);
    expect(forward[0].group.preferredJobId).toBe('adzuna-1');
    expect(reverse[0].group.preferredJobId).toBe('adzuna-1');
  });

  test('a senior and a junior posting at one company stay in separate groups', () => {
    const groups = groupCanonicalJobs([
      listing('adzuna', '1', { title: 'Backend Engineer' }),
      listing('remoteok', 'abc', { title: 'Senior Backend Engineer' }),
    ]);
    expect(groups).toHaveLength(2);
  });

  test('the same vacancy in two cities stays in separate groups', () => {
    const groups = groupCanonicalJobs([
      listing('adzuna', '1', { location: 'Mumbai, India' }),
      listing('remoteok', 'abc', { location: 'Bengaluru, India' }),
    ]);
    expect(groups).toHaveLength(2);
  });

  test('a group exposes every source URL so Apply can open a real posting', () => {
    const groups = groupCanonicalJobs([listing('adzuna', '1'), listing('remoteok', 'abc')]);
    for (const source of groups[0].group.sources) {
      expect(source.sourceUrl).toMatch(/^https:\/\//);
    }
  });
});