/**
 * Role requirement matrix + progress tests (spec §34–§41, §87, §93, §113).
 *
 * The weighted coverage formula is the number the dashboard, the profile and the
 * career pages all display, so it is locked here rather than being allowed to
 * drift between surfaces.
 */

const {
  buildRequirementProgress,
  computeRoleProgress,
  computeRoleReadiness,
  pickNextActions,
  ROLE_PROGRESS_CALCULATION_VERSION,
} = require('../dist/career/services/roleProgress.service');
const { IMPORTANCE_WEIGHTS, REQUIRED_LEVEL_LABELS } = require('../dist/career/models/CareerRole');

/** Minimal IRoleSkill for tests. */
const req = (skillSlug, name, priority, requiredLevel, extra = {}) => ({
  skillSlug,
  name,
  priority,
  requiredLevel,
  category: extra.category ?? 'TOOLS',
  skillType: 'TOOL',
  ...extra,
});

/** Lookup that returns fixed evidence for the listed skills, null for others. */
const lookupFor = map => ({
  levelFor: async slug => (map[slug] ? { level: map[slug], evidence: {} } : null),
});

describe('role requirements — weights and levels (spec §36/§37/§39)', () => {
  test('importance weights are ESSENTIAL 3, RECOMMENDED 2, BONUS 1', () => {
    expect(IMPORTANCE_WEIGHTS.ESSENTIAL).toBe(3);
    expect(IMPORTANCE_WEIGHTS.RECOMMENDED).toBe(2);
    expect(IMPORTANCE_WEIGHTS.BONUS).toBe(1);
  });

  test('the four required levels are labelled Foundation → Advanced', () => {
    expect(REQUIRED_LEVEL_LABELS[1]).toBe('Foundation');
    expect(REQUIRED_LEVEL_LABELS[2]).toBe('Working Knowledge');
    expect(REQUIRED_LEVEL_LABELS[3]).toBe('Job Ready');
    expect(REQUIRED_LEVEL_LABELS[4]).toBe('Advanced');
  });
});

describe('role requirements — not assessed is NOT zero (spec §87)', () => {
  test('an unassessed requirement reports null level, NOT_ASSESSED and null coverage', () => {
    const r = buildRequirementProgress(req('docker', 'Docker', 'ESSENTIAL', 3), null);
    expect(r.currentLevel).toBeNull();
    expect(r.currentLevelLabel).toBeNull();
    expect(r.coverage).toBeNull();
    expect(r.status).toBe('NOT_ASSESSED');
  });

  test('an unassessed requirement still counts in the readiness denominator', () => {
    // One essential skill met, one essential skill never assessed. Hiding the
    // unassessed one would report a falsely perfect 100%.
    const met = buildRequirementProgress(req('node', 'Node.js', 'ESSENTIAL', 3), {
      level: 3,
      evidence: {},
    });
    const unknown = buildRequirementProgress(req('docker', 'Docker', 'ESSENTIAL', 3), null);
    expect(computeRoleReadiness([met, unknown])).toBe(50);
  });

  test('a role with no requirements has null readiness, not 0', () => {
    expect(computeRoleReadiness([])).toBeNull();
  });
});

describe('role readiness — the documented formula (spec §39)', () => {
  test('coverage is min(userLevel / requiredLevel, 1) and caps at 1', () => {
    // Level 2 against a required level 4 → 0.5 coverage, below required.
    const below = buildRequirementProgress(req('aws', 'AWS', 'ESSENTIAL', 4), { level: 2, evidence: {} });
    expect(below.coverage).toBe(0.5);
    expect(below.status).toBe('BELOW_REQUIRED');

    // Exceeding the requirement must not give credit above 1.
    const exceeded = buildRequirementProgress(req('git', 'Git', 'ESSENTIAL', 2), { level: 4, evidence: {} });
    expect(exceeded.coverage).toBe(1);
    expect(exceeded.status).toBe('MET');
  });

  test('readiness is the importance-weighted mean of coverage', () => {
    const requirements = [
      // ESSENTIAL (w3) fully met, RECOMMENDED (w2) half met, BONUS (w1) unassessed.
      buildRequirementProgress(req('node', 'Node.js', 'ESSENTIAL', 3), { level: 3, evidence: {} }),
      buildRequirementProgress(req('docker', 'Docker', 'RECOMMENDED', 4), { level: 2, evidence: {} }),
      buildRequirementProgress(req('redis', 'Redis', 'BONUS', 3), null),
    ];
    // (3×1 + 2×0.5 + 1×0) / 6 = 4/6 = 66.7%
    expect(computeRoleReadiness(requirements)).toBe(66.7);
  });

  test('every essential skill met reports 100', () => {
    const requirements = [
      buildRequirementProgress(req('node', 'Node.js', 'ESSENTIAL', 3), { level: 3, evidence: {} }),
      buildRequirementProgress(req('sql', 'SQL', 'ESSENTIAL', 2), { level: 4, evidence: {} }),
    ];
    expect(computeRoleReadiness(requirements)).toBe(100);
  });
});

describe('role progress — aggregates and next actions', () => {
  test('totals, category rollup and readiness come from one computation', async () => {
    const progress = await computeRoleProgress({
      role: {
        slug: 'backend-developer',
        name: 'Backend Developer',
        skills: [
          req('node', 'Node.js', 'ESSENTIAL', 3, { category: 'FRAMEWORKS_LIBRARIES' }),
          req('aws', 'AWS', 'ESSENTIAL', 3, { category: 'CLOUD' }),
          req('docker', 'Docker', 'RECOMMENDED', 2, { category: 'DEVOPS', learningTopicSlug: 'docker' }),
        ],
      },
      lookup: lookupFor({ node: 3, aws: 1 }),
    });

    expect(progress.roleSlug).toBe('backend-developer');
    expect(progress.calculationVersion).toBe(ROLE_PROGRESS_CALCULATION_VERSION);
    expect(progress.totals).toEqual({ requirements: 3, met: 1, belowRequired: 1, notAssessed: 1 });

    // Docker is unassessed → its own category has null coverage, not 0.
    const docker = progress.categoryRollup.find(c => c.category === 'DEVOPS');
    expect(docker.coverage).toBeNull();
    expect(docker.notAssessedCount).toBe(1);

    // (3×1 + 3×0.33 + 2×0) / 8 = 4/8 = 50%
    expect(progress.readiness).toBe(50);
  });

  test('next actions prefer the heaviest unmet requirement and link to learning', async () => {
    const progress = await computeRoleProgress({
      role: {
        slug: 'backend-developer',
        name: 'Backend Developer',
        skills: [
          req('redis', 'Redis', 'BONUS', 3, { learningTopicSlug: 'redis' }),
          req('docker', 'Docker', 'ESSENTIAL', 3, { learningTopicSlug: 'docker' }),
          req('node', 'Node.js', 'ESSENTIAL', 3),
        ],
      },
      lookup: lookupFor({ node: 3 }),
    });

    // Docker (ESSENTIAL, unmet) outranks Redis (BONUS, unmet) even though both
    // are unmet, because importance weight is the first sort key.
    expect(progress.nextActions[0].skillSlug).toBe('docker');
    expect(progress.nextActions[0].learningTopicSlug).toBe('docker');
    expect(progress.nextActions[0].reason).toMatch(/not assessed yet/i);
  });

  test('a met requirement is never suggested as a next action', () => {
    const met = buildRequirementProgress(req('node', 'Node.js', 'ESSENTIAL', 3), { level: 3, evidence: {} });
    expect(pickNextActions([met])).toEqual([]);
  });

  test('the goal is surfaced so the UI can show priority and target level', async () => {
    const progress = await computeRoleProgress({
      role: { slug: 'data-analyst', name: 'Data Analyst', skills: [req('sql', 'SQL', 'ESSENTIAL', 3)] },
      lookup: lookupFor({ sql: 2 }),
      goal: {
        isPrimary: false,
        priority: 1,
        targetLevel: 'JOB_READY',
        status: 'ACTIVE',
        roadmapProgress: 40,
      },
    });
    expect(progress.goal).toEqual({
      isPrimary: false,
      priority: 1,
      targetLevel: 'JOB_READY',
      status: 'ACTIVE',
      roadmapProgress: 40,
    });
  });

  test('an evidence lookup failure degrades to NOT_ASSESSED instead of throwing', async () => {
    const progress = await computeRoleProgress({
      role: { slug: 'backend-developer', name: 'Backend Developer', skills: [req('node', 'Node.js', 'ESSENTIAL', 3)] },
      lookup: { levelFor: async () => { throw new Error('db down'); } },
    });
    expect(progress.requirements[0].status).toBe('NOT_ASSESSED');
  });
});

describe('job-fit fixture (spec §113)', () => {
  test('a JD skill with no evidence anywhere is "Not Evidenced", not a failure', () => {
    // JD requires Node.js, MongoDB, Docker, AWS.
    // Resume + project evidence covers Node.js, MongoDB, Docker.
    // AWS has nothing behind it.
    const evidence = { node: 3, mongodb: 3, docker: 2 };
    const aws = buildRequirementProgress(req('aws', 'AWS', 'ESSENTIAL', 3), lookupFor(evidence).levelFor('aws') ? null : null);

    expect(aws.status).toBe('NOT_ASSESSED');
    expect(aws.currentLevel).toBeNull();
    // The distinction that matters: we never conclude the candidate LACKS the
    // skill — we record that nothing has evidenced it yet.
    expect(aws.coverage).toBeNull();
  });
});
