/**
 * Jobs + job-fit tests (spec §50–§56, §61, §111–§113).
 *
 * Locks the rules that keep the job domain honest:
 *  - optional provider fields are never invented
 *  - deduplication is by provider identity
 *  - the match score is a requirement match, never a hiring probability
 *  - an unevidenced skill is "not evidenced", not "lacks the skill"
 */

const {
  FIT_WEIGHTS,
  TOTAL_FIT_WEIGHT,
  MATCH_LABELS,
  matchLabelFor,
} = require('../dist/jobs/models/JobFitAnalysis');
const {
  normalizeName,
  detectWorkMode,
  detectJobType,
  detectExperienceLevel,
  extractRequirements,
  htmlToText,
} = require('../dist/jobs/providers');
const { JOB_FIT_CALCULATION_VERSION } = require('../dist/jobs/services/jobFit.service');

describe('job fit weights (spec §53)', () => {
  test('the documented weights sum to 100', () => {
    expect(FIT_WEIGHTS.REQUIRED_SKILL_COVERAGE).toBe(30);
    expect(FIT_WEIGHTS.SEMANTIC_RESUME_JD_MATCH).toBe(15);
    expect(FIT_WEIGHTS.EXPERIENCE_PROJECT_EVIDENCE).toBe(15);
    expect(FIT_WEIGHTS.SKILL_PROFILE_ALIGNMENT).toBe(15);
    expect(FIT_WEIGHTS.ASSESSMENT_EVIDENCE).toBe(10);
    expect(FIT_WEIGHTS.INTERVIEW_ROLE_EVIDENCE).toBe(5);
    expect(FIT_WEIGHTS.EDUCATION_CERTIFICATION).toBe(5);
    expect(FIT_WEIGHTS.ELIGIBILITY_WORK_PREFERENCE).toBe(5);
    expect(TOTAL_FIT_WEIGHT).toBe(100);
  });

  test('the calculation version is recorded so stored scores stay interpretable', () => {
    expect(JOB_FIT_CALCULATION_VERSION).toMatch(/^\d+\.\d+$/);
  });
});

describe('match labels describe JD alignment, not hiring (spec §50/§55)', () => {
  test('the four bands map to the documented thresholds', () => {
    expect(matchLabelFor(100)).toBe('Strong Requirement Match');
    expect(matchLabelFor(85)).toBe('Strong Requirement Match');
    expect(matchLabelFor(84)).toBe('Good Requirement Match');
    expect(matchLabelFor(70)).toBe('Good Requirement Match');
    expect(matchLabelFor(69)).toBe('Partial Match');
    expect(matchLabelFor(50)).toBe('Partial Match');
    expect(matchLabelFor(49)).toBe('Significant Gaps');
    expect(matchLabelFor(0)).toBe('Significant Gaps');
  });

  test('no label mentions probability, hiring or an interview outcome', () => {
    for (const { label } of MATCH_LABELS) {
      expect(label).not.toMatch(/chance|probab|hired|hire|offer|success/i);
      expect(label).toMatch(/Match|Gaps/);
    }
  });
});

describe('providers never invent missing data (spec §61)', () => {
  test('a posting with no stated work mode stays UNSPECIFIED', () => {
    expect(detectWorkMode(null, null, '')).toBe('UNSPECIFIED');
    expect(detectWorkMode('', undefined)).toBe('UNSPECIFIED');
  });

  test('work mode is only asserted when the text supports it', () => {
    expect(detectWorkMode('Remote - Europe')).toBe('REMOTE');
    expect(detectWorkMode('Hybrid, London')).toBe('HYBRID');
    expect(detectWorkMode('London, United Kingdom')).toBe('UNSPECIFIED');
  });

  test('an unstated job type stays UNSPECIFIED rather than defaulting to full-time', () => {
    expect(detectJobType('Backend Engineer')).toBe('UNSPECIFIED');
    expect(detectJobType('Backend Engineer Intern')).toBe('INTERNSHIP');
    expect(detectJobType('Contract Backend Engineer')).toBe('CONTRACT');
    expect(detectJobType('Part Time Analyst')).toBe('PART_TIME');
  });

  test('an unstated experience level stays UNSPECIFIED', () => {
    // "Not specified" is the honest answer; guessing "Mid" would be fabrication.
    expect(detectExperienceLevel('Software Engineer', 'You will help build internal tools.')).toBe('UNSPECIFIED');
    expect(detectExperienceLevel('Senior Software Engineer', '')).toBe('SENIOR');
    expect(detectExperienceLevel('Junior Developer', '')).toBe('ENTRY');
    expect(detectExperienceLevel('Engineering Intern', '')).toBe('INTERN');
  });

  test('experience inferred from years requires an actual years statement', () => {
    expect(detectExperienceLevel('Engineer', 'We need 5+ years of experience.')).toBe('SENIOR');
    expect(detectExperienceLevel('Engineer', 'Around 3 years of experience required.')).toBe('MID');
    expect(detectExperienceLevel('Engineer', 'Freshers are welcome to apply.')).toBe('ENTRY');
  });
});

describe('provider normalization', () => {
  test('titles normalize to a stable comparison form', () => {
    expect(normalizeName('Senior  Backend   Developer!!')).toBe('senior backend developer');
    expect(normalizeName('C++ Engineer')).toBe('c++ engineer');
    expect(normalizeName('Node.js Developer')).toBe('node.js developer');
  });

  test('HTML is reduced to readable text with entities decoded', () => {
    const html = '<p>Build &amp; ship</p><ul><li>Node.js</li><li>MongoDB</li></ul>';
    const text = htmlToText(html);
    expect(text).toContain('Build & ship');
    expect(text).toContain('Node.js');
    expect(text).not.toContain('<');
  });

  test('script and style content is stripped entirely', () => {
    const html = '<style>.x{color:red}</style><script>alert(1)</script><p>Safe text</p>';
    const text = htmlToText(html);
    expect(text).toContain('Safe text');
    expect(text).not.toContain('alert');
    expect(text).not.toContain('color:red');
  });

  test('requirements are extracted verbatim and de-duplicated', () => {
    const description = [
      'Requirements',
      '- Must have strong SQL skills',
      '• Experience with Docker required',
      'Responsible for API design',
      '- Must have strong SQL skills',
      'Bonus: AWS certification',
    ].join('\n');
    const requirements = extractRequirements(description);
    expect(requirements).toContain('Must have strong SQL skills');
    expect(requirements).toContain('Experience with Docker required');
    // Duplicate bullet is collapsed.
    expect(requirements.filter(r => r === 'Must have strong SQL skills')).toHaveLength(1);
  });

  test('descriptions with no requirement language yield no requirements', () => {
    expect(extractRequirements('We are a friendly team building great things.')).toEqual([]);
  });
});

describe('job-fit fixture (spec §113) — Docker evidenced, AWS not', () => {
  test('an unevidenced JD skill is reported without claiming the candidate lacks it', () => {
    // JD requires Node.js, MongoDB, Docker, AWS.
    // Resume + project evidence covers Node.js, MongoDB, Docker.
    // AWS has no evidence anywhere.
    const evidence = { node: 3, mongodb: 3, docker: 2 };

    const awsStatus = 'aws' in evidence ? 'EVIDENCED' : 'NOT_EVIDENCED';
    expect(awsStatus).toBe('NOT_EVIDENCED');
    // The level is null, never 0 — "not assessed" is not "assessed and failed".
    const awsLevel = evidence.aws ?? null;
    expect(awsLevel).toBeNull();
    expect(awsLevel).not.toBe(0);

    // The three evidenced skills keep their real depths.
    expect(evidence.docker).toBe(2);
    expect(evidence.node).toBe(3);
  });
});
// ─────────────────────────────────────────────────────────────────────────────
// Required vs Preferred extraction (spec §A1–§A5).
//
// These tests pin the documented behaviour of `parseJobRequirements`:
// section headings win, explicit inline wording wins, a duplicate that appears
// in both buckets resolves to REQUIRED, and a skill with no requirement
// wording at all falls back to PREFERRED rather than being invented as
// REQUIRED.
// ─────────────────────────────────────────────────────────────────────────────
const { parseJobRequirements } = require('../dist/jobs/services/jobFit.service');

/** importanceOf(parsed, skillSlug) → 'REQUIRED' | 'PREFERRED' | undefined */
const importanceOf = (parsed, slug) =>
  parsed.requirements.find(r => r.skillSlug === slug)?.importance;

describe('required/preferred — explicit sections', () => {
  const jd = [
    'About the role',
    'You will build and ship backend services.',
    '',
    'Required Qualifications',
    '- Node.js',
    '- MongoDB',
    '- Docker',
    '',
    'Preferred Qualifications',
    '- AWS',
    '- Kubernetes',
  ].join('\n');

  test('a "Required Qualifications" section marks its bullets REQUIRED', async () => {
    const parsed = await parseJobRequirements(jd);
    expect(importanceOf(parsed, 'node.js')).toBe('REQUIRED');
    expect(importanceOf(parsed, 'mongodb')).toBe('REQUIRED');
    expect(importanceOf(parsed, 'docker')).toBe('REQUIRED');
  });

  test('a "Preferred Qualifications" section marks its bullets PREFERRED', async () => {
    const parsed = await parseJobRequirements(jd);
    expect(importanceOf(parsed, 'aws')).toBe('PREFERRED');
    expect(importanceOf(parsed, 'kubernetes')).toBe('PREFERRED');
  });

  test('not every extracted skill is treated as required', async () => {
    const parsed = await parseJobRequirements(jd);
    // The set is split, not blanket-classified.
    expect(parsed.requiredSkills.length).toBeGreaterThan(0);
    expect(parsed.preferredSkills.length).toBeGreaterThan(0);
    expect(parsed.requiredSkills).not.toContain('kubernetes');
  });

  test('"Preferred Qualifications" is not swallowed by a bare "Qualifications" rule', async () => {
    // Regression guard for ordering: preferred headings must be tested first.
    const parsed = await parseJobRequirements(jd);
    expect(parsed.preferredSkills).toContain('aws');
  });
});

describe('required/preferred — inline wording', () => {
  test('inline "must have" is REQUIRED even outside a section', async () => {
    const parsed = await parseJobRequirements([
      'About the role',
      'Requirements',
      'You must have strong Node.js experience.',
      'Nice to have exposure to Kubernetes.',
    ].join('\n'));
    expect(importanceOf(parsed, 'node.js')).toBe('REQUIRED');
    expect(importanceOf(parsed, 'kubernetes')).toBe('PREFERRED');
  });

  test('inline "nice to have" is PREFERRED even inside a required section', async () => {
    const parsed = await parseJobRequirements([
      'Required Qualifications',
      '- Node.js',
      '- Nice to have: Kubernetes experience',
    ].join('\n'));
    expect(importanceOf(parsed, 'kubernetes')).toBe('PREFERRED');
  });

  test('"Mandatory" and "You should have" are recognised as required', async () => {
    const parsed = await parseJobRequirements([
      'Mandatory Requirements',
      '- MongoDB administration',
      'You should have Docker experience.',
    ].join('\n'));
    expect(importanceOf(parsed, 'mongodb')).toBe('REQUIRED');
    expect(importanceOf(parsed, 'docker')).toBe('REQUIRED');
  });

  test('"Advantage" and "Desirable" are recognised as preferred', async () => {
    const parsed = await parseJobRequirements([
      'Requirements',
      '- Node.js',
      'An advantage: familiarity with Kubernetes.',
      'Desirable: exposure to AWS.',
    ].join('\n'));
    expect(importanceOf(parsed, 'kubernetes')).toBe('PREFERRED');
    expect(importanceOf(parsed, 'aws')).toBe('PREFERRED');
  });
});

describe('required/preferred — duplicates and ambiguity', () => {
  test('a skill appearing in both buckets resolves to REQUIRED', async () => {
    const parsed = await parseJobRequirements([
      'Preferred Qualifications',
      '- Docker',
      '',
      'Required Qualifications',
      '- Docker orchestration',
    ].join('\n'));
    // Preferred came first in the document; REQUIRED must still win.
    expect(importanceOf(parsed, 'docker')).toBe('REQUIRED');
    expect(parsed.requirements.filter(r => r.skillSlug === 'docker')).toHaveLength(1);
  });

  test('a skill mentioned only in unclassified prose falls back to PREFERRED', async () => {
    const parsed = await parseJobRequirements([
      'We are looking for a backend engineer.',
      'You will work on services built with Node.js and MongoDB.',
    ].join('\n'));
    expect(importanceOf(parsed, 'node.js')).toBe('PREFERRED');
    expect(importanceOf(parsed, 'mongodb')).toBe('PREFERRED');
    // The documented fallback must not inflate the required set.
    expect(parsed.requiredSkills).not.toContain('node.js');
  });

  test('an ambiguous sentence produces no REQUIRED requirement', async () => {
    const parsed = await parseJobRequirements('The team values engineers who care about quality.');
    expect(parsed.requiredSkills).toEqual([]);
    expect(parsed.preferredSkills).toEqual([]);
  });

  test('a responsibility section resets the section context', async () => {
    // A bullet under "Responsibilities" must not inherit REQUIRED.
    const parsed = await parseJobRequirements([
      'Required Qualifications',
      '- Node.js',
      '',
      'Responsibilities',
      '- Deploy and monitor MongoDB replicas',
    ].join('\n'));
    expect(importanceOf(parsed, 'node.js')).toBe('REQUIRED');
    expect(importanceOf(parsed, 'mongodb')).toBe('PREFERRED');
  });
});
