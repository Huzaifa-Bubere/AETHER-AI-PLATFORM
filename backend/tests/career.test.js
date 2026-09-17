/**
 * AETHER Career module — deterministic engine tests.
 * Convention: plain JS importing compiled output from ../dist (matches existing tests).
 * Covers: skill normalization, extraction (context guards + negative cases),
 * role mapping, CSV parsing, trend/readiness/gap/plan engines, seeder data integrity.
 */
const { extractSkills, normalizeSkillName, mapRoleToSlug, SKILL_DICTIONARY } = require('../dist/career/services/skillExtraction');
const { computeReadiness, buildWeeklyPlan, GAP_THRESHOLD } = require('../dist/career/services/readiness.service');
const { parseCsv } = require('../dist/career/services/marketIntelligence.service');
const { SKILL_TAXONOMY, ROLES, buildRoleDoc } = require('../dist/career/seed/careerData');

describe('skill normalization', () => {
  test('resolves JS / Javascript / Java Script to JavaScript', () => {
    expect(normalizeSkillName('JS').canonical).toBe('javascript');
    expect(normalizeSkillName('Javascript').canonical).toBe('javascript');
    expect(normalizeSkillName('Java Script').canonical).toBe('javascript');
  });

  test('resolves Node / NodeJS / Node.js variants', () => {
    expect(normalizeSkillName('NodeJS').canonical).toBe('node.js');
    expect(normalizeSkillName('node').canonical).toBe('node.js');
    expect(normalizeSkillName('Node.js').name).toBe('Node.js');
  });

  test('resolves Postgres to PostgreSQL', () => {
    expect(normalizeSkillName('Postgres').canonical).toBe('postgresql');
  });

  test('returns null for unknown skills', () => {
    expect(normalizeSkillName('quantum-leap-framework')).toBeNull();
  });
});

describe('skill extraction (deterministic)', () => {
  test('extracts skills from a job description', () => {
    const text = 'We need a Backend Developer with Node.js, PostgreSQL and Docker experience. JWT auth knowledge required.';
    const { skills } = extractSkills(text);
    expect(skills).toContain('node.js');
    expect(skills).toContain('postgresql');
    expect(skills).toContain('docker');
    expect(skills).toContain('authentication-security');
  });

  test('does NOT match "go" inside "google" (word boundaries)', () => {
    const { skills } = extractSkills('Work on cutting-edge google cloud projects.');
    expect(skills).not.toContain('go');
    expect(skills).toContain('gcp');
  });

  test('does not treat a bare "go" as the Go language without context', () => {
    const { skills } = extractSkills('Let us go through the requirements.');
    expect(skills).not.toContain('go');
  });

  test('matches golang as Go', () => {
    const { skills } = extractSkills('Experience with golang and microservices.');
    expect(skills).toContain('go');
    expect(skills).toContain('microservices');
  });

  test('prefers longest match: "react native" not double-counted as react', () => {
    const { skills } = extractSkills('Build mobile apps with React Native.');
    expect(skills).toContain('react-native');
    expect(skills).not.toContain('react');
  });

  test('is deterministic: same input -> same output', () => {
    const text = 'Python, Django, Redis, Kubernetes, system design';
    expect(extractSkills(text)).toEqual(extractSkills(text));
  });

  test('handles empty and non-string inputs', () => {
    expect(extractSkills('').skills).toEqual([]);
    expect(extractSkills(undefined).skills).toEqual([]);
  });

  test('dictionary has no duplicate canonical slugs', () => {
    const slugs = SKILL_DICTIONARY.map(d => d.canonical);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('role mapping', () => {
  const roles = [
    { slug: 'backend-developer', aliases: ['backend developer', 'backend engineer', 'node developer'] },
    { slug: 'frontend-developer', aliases: ['frontend developer', 'react developer'] },
  ];

  test('maps job titles to role slugs', () => {
    expect(mapRoleToSlug('Senior Backend Developer', roles)).toBe('backend-developer');
    expect(mapRoleToSlug('React Developer', roles)).toBe('frontend-developer');
  });

  test('returns null when nothing matches', () => {
    expect(mapRoleToSlug('Marketing Manager', roles)).toBeNull();
  });
});

describe('CSV parsing', () => {
  test('parses quoted fields with commas and escaped quotes', () => {
    const parsed = parseCsv('job_title,description\n"Backend Dev","Builds APIs, uses ""REST"" daily"\n"QA","Tests things"');
    expect(parsed.headers).toEqual(['job_title', 'description']);
    expect(parsed.rows[0][0]).toBe('Backend Dev');
    expect(parsed.rows[0][1]).toBe('Builds APIs, uses "REST" daily');
    expect(parsed.rows.length).toBe(2);
  });

  test('handles CRLF line endings', () => {
    const parsed = parseCsv('a,b\r\n1,2\r\n3,4\r\n');
    expect(parsed.rows).toEqual([['1', '2'], ['3', '4']]);
  });
});

// ── Readiness / gaps / recommendations ───────────────────────────────────────

function makeRole(overrides = {}) {
  return {
    slug: 'backend-developer',
    name: 'Backend Developer',
    description: 'Backend role',
    category: 'Software Development',
    responsibilities: [],
    skills: [
      { skillSlug: 'javascript', name: 'JavaScript', priority: 'ESSENTIAL', skillType: 'LANGUAGE' },
      { skillSlug: 'node.js', name: 'Node.js', priority: 'ESSENTIAL', skillType: 'FRAMEWORK' },
      { skillSlug: 'sql', name: 'SQL', priority: 'ESSENTIAL', skillType: 'LANGUAGE' },
      { skillSlug: 'docker', name: 'Docker', priority: 'RECOMMENDED', skillType: 'CLOUD' },
      { skillSlug: 'kubernetes', name: 'Kubernetes', priority: 'OPTIONAL', skillType: 'CLOUD' },
    ],
    tools: [], frameworks: [], databases: [], cloudTechnologies: [], softSkills: [],
    roadmapStages: [],
    roadmapNodes: [
      { id: 'n-sql', title: 'SQL', whatYouWillLearn: [], keyConcepts: [], skillSlugs: ['sql'], prerequisites: [], resourceIds: [], interviewQuestions: [] },
      { id: 'n-docker', title: 'Docker', whatYouWillLearn: [], keyConcepts: [], skillSlugs: ['docker'], prerequisites: ['n-sql'], resourceIds: [], interviewQuestions: [] },
      { id: 'n-k8s', title: 'Kubernetes', whatYouWillLearn: [], keyConcepts: [], skillSlugs: ['kubernetes'], prerequisites: ['n-docker'], resourceIds: [], interviewQuestions: [] },
    ],
    resources: [], projects: [], marketAliases: [], isActive: true,
    ...overrides,
  };
}

describe('readiness formula', () => {
  test('computes readiness as weighted coverage of confidence', () => {
    const role = makeRole();
    // weights: js=3, node=3, sql=3, docker=2, k8s=1 -> total 12
    // conf: js=100 (earns 3), node=50 (earns 1.5) -> 4.5/12 = 37.5 -> 38
    const conf = new Map([['javascript', 100], ['node.js', 50]]);
    const result = computeReadiness(role, conf);
    expect(result.readiness).toBe(38);
    expect(result.skillsMatched).toBe(2); // js (100) and node.js (>= threshold 50)
    expect(result.skillsTotal).toBe(5);
  });

  test('counts a skill as matched at exactly GAP_THRESHOLD', () => {
    const result = computeReadiness(makeRole(), new Map([['javascript', GAP_THRESHOLD]]));
    expect(result.skillsMatched).toBe(1);
  });

  test('produces zero readiness for empty confidence', () => {
    const result = computeReadiness(makeRole(), new Map());
    expect(result.readiness).toBe(0);
    expect(result.gaps.length).toBe(5);
  });
});

describe('gap analysis + recommendation ranking', () => {
  test('ranks gaps by priority score (market demand + trend boost)', () => {
    const role = makeRole();
    const conf = new Map([['javascript', 90], ['node.js', 80]]);
    const demand = new Map([
      ['docker', { frequency: 60, trend: 'TRENDING_UP' }],
      ['kubernetes', { frequency: 30, trend: 'STABLE' }],
    ]);
    const result = computeReadiness(role, conf, demand);
    // docker: base 2 + market 0.9 + trend 0.75 = 3.65 (prereq sql unready -> x0.4 = 1.46)
    // sql: base 3, no demand -> 3
    expect(result.gaps[0].skillSlug).toBe('sql');
    expect(result.gaps.map(g => g.skillSlug)).toContain('docker');
    const docker = result.gaps.find(g => g.skillSlug === 'docker');
    const reasons = docker.reasons.join(' ');
    expect(reasons).toMatch(/roadmap/i);
    expect(reasons).toMatch(/no verified evidence|weak/i);
    expect(reasons).toMatch(/60%/);
    expect(reasons).toMatch(/increasing/i);
  });

  test('trend boost requires TRENDING_UP', () => {
    const role = makeRole();
    const conf = new Map([['javascript', 100], ['node.js', 100]]);
    const stable = computeReadiness(role, conf, new Map([['sql', { frequency: 80, trend: 'STABLE' }]]));
    const up = computeReadiness(role, conf, new Map([['sql', { frequency: 80, trend: 'TRENDING_UP' }]]));
    const gapStable = stable.gaps.find(g => g.skillSlug === 'sql');
    const gapUp = up.gaps.find(g => g.skillSlug === 'sql');
    expect(gapUp.priorityScore).toBeGreaterThan(gapStable.priorityScore);
  });

  test('unready prerequisites dampen priority score', () => {
    const role = makeRole();
    const conf = new Map();
    const withDemand = new Map([['kubernetes', { frequency: 90, trend: 'TRENDING_UP' }]]);
    const result = computeReadiness(role, conf, withDemand);
    const k8s = result.gaps.find(g => g.skillSlug === 'kubernetes');
    // k8s prereq chain unmet -> x0.4; raw would be 1 + 0.9*1.5 + 0.75 = 3.1
    expect(k8s.priorityScore).toBeCloseTo(3.1 * 0.4, 1);
    expect(k8s.priorityScore).toBeLessThan(3.1);
  });
});

describe('weekly plan (prerequisite-respecting)', () => {
  test('orders nodes topologically and skips learned skills', () => {
    const role = makeRole();
    const conf = new Map([['sql', 90]]); // sql learned -> n-sql skipped
    const plan = buildWeeklyPlan(role, conf, 10);
    const nodeIds = plan.flatMap(p => p.nodeIds);
    expect(nodeIds).not.toContain('n-sql');
    const dockerIdx = nodeIds.indexOf('n-docker');
    const k8sIdx = nodeIds.indexOf('n-k8s');
    expect(dockerIdx).toBeGreaterThanOrEqual(0);
    expect(k8sIdx).toBeGreaterThan(dockerIdx);
  });

  test('buckets by hoursPerWeek and always produces a plan', () => {
    const plan = buildWeeklyPlan(makeRole(), new Map(), 8);
    expect(plan.length).toBeGreaterThan(0);
    for (const week of plan) {
      expect(week.estimatedHours).toBeLessThanOrEqual(16); // a single long node may exceed budget
    }
  });
});

describe('seed data integrity', () => {
  test('has at least 20 roles with unique slugs', () => {
    expect(ROLES.length).toBeGreaterThanOrEqual(20);
    const slugs = ROLES.map(r => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test('seed roles cover the required starter set', () => {
    const slugs = new Set(ROLES.map(r => r.slug));
    for (const required of ['software-engineer', 'frontend-developer', 'backend-developer', 'fullstack-developer',
      'devops-engineer', 'cloud-engineer', 'ai-engineer', 'machine-learning-engineer', 'data-analyst',
      'data-scientist', 'cybersecurity-analyst', 'qa-engineer']) {
      expect(slugs.has(required)).toBe(true);
    }
  });

  test('taxonomy aliases cover key normalization examples', () => {
    const js = SKILL_TAXONOMY.find(s => s.canonical === 'javascript');
    expect(js.aliases).toContain('js');
    const node = SKILL_TAXONOMY.find(s => s.canonical === 'node.js');
    expect(node.aliases).toContain('nodejs');
  });

  test('every roadmap node is valid: hours >= 0, quiz answers in range, refs resolve', () => {
    for (const spec of ROLES) {
      const doc = buildRoleDoc(spec);
      for (const node of doc.roadmapNodes) {
        expect(node.estimatedHours || 0).toBeGreaterThanOrEqual(0);
        for (const q of node.quiz || []) {
          expect(q.correctIndex).toBeGreaterThanOrEqual(0);
          expect(q.correctIndex).toBeLessThan(q.options.length);
        }
      }
      const nodeIds = new Set(doc.roadmapNodes.map(n => n.id));
      for (const stage of doc.roadmapStages) {
        for (const id of stage.nodeIds) expect(nodeIds.has(id)).toBe(true);
      }
      for (const node of doc.roadmapNodes) {
        for (const p of node.prerequisites) expect(nodeIds.has(p)).toBe(true);
      }
    }
  });

  test('role skills carry valid priorities', () => {
    for (const spec of ROLES) {
      for (const s of buildRoleDoc(spec).skills) {
        expect(['ESSENTIAL', 'RECOMMENDED', 'OPTIONAL']).toContain(s.priority);
      }
    }
  });
});
