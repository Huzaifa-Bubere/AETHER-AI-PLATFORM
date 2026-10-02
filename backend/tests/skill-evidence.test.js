/**
 * Skill evidence engine tests (spec §38, §90–§92, §113).
 *
 * Locks the confidence → level mapping, the per-source evidence buckets that
 * let the profile show WHY a skill sits at a level, and the rule that a
 * self-declared skill can never be presented as Job Ready.
 */

const {
  LEVEL_CONFIDENCE_BOUNDS,
  SELF_DECLARED_MAX_LEVEL,
  levelFromConfidence,
  summariseEvidence,
} = require('../dist/career/services/skillEvidence.service');

const ev = (kind, score, source) => ({ kind, score, source, at: new Date() });

describe('confidence → level mapping (spec §37)', () => {
  test('the four confidence bands map onto levels 4 → 1', () => {
    expect(levelFromConfidence(100, 'ASSESSMENT_EVIDENCE')).toBe(4);
    expect(levelFromConfidence(85, 'ASSESSMENT_EVIDENCE')).toBe(4);
    expect(levelFromConfidence(84, 'ASSESSMENT_EVIDENCE')).toBe(3);
    expect(levelFromConfidence(65, 'ASSESSMENT_EVIDENCE')).toBe(3);
    expect(levelFromConfidence(64, 'ASSESSMENT_EVIDENCE')).toBe(2);
    expect(levelFromConfidence(40, 'ASSESSMENT_EVIDENCE')).toBe(2);
    expect(levelFromConfidence(39, 'ASSESSMENT_EVIDENCE')).toBe(1);
    expect(levelFromConfidence(0, 'ASSESSMENT_EVIDENCE')).toBe(1);
  });

  test('the bands are contiguous and strictly descending', () => {
    const levels = LEVEL_CONFIDENCE_BOUNDS.map(b => b.level);
    expect(levels).toEqual([4, 3, 2, 1]);
    for (let i = 1; i < LEVEL_CONFIDENCE_BOUNDS.length; i++) {
      expect(LEVEL_CONFIDENCE_BOUNDS[i].min).toBeLessThan(LEVEL_CONFIDENCE_BOUNDS[i - 1].min);
    }
  });

  test('out-of-range confidence is clamped rather than throwing', () => {
    expect(levelFromConfidence(-50, 'ASSESSMENT_EVIDENCE')).toBe(1);
    expect(levelFromConfidence(500, 'ASSESSMENT_EVIDENCE')).toBe(4);
  });
});

describe('self-declaration is labelled, never trusted (spec §92)', () => {
  test('a self-declared skill is capped at Foundation even with a perfect score', () => {
    expect(SELF_DECLARED_MAX_LEVEL).toBe(1);
    expect(levelFromConfidence(100, 'SELF_DECLARED')).toBe(1);
    expect(levelFromConfidence(100, 'SELF_DECLARED')).not.toBe(3);
  });

  test('the cap only applies when self-declaration is the BEST evidence', () => {
    // A candidate who both declared and demonstrated Docker gets the real level.
    expect(levelFromConfidence(90, 'PROJECT_EVIDENCE')).toBe(4);
  });
});

describe('per-source evidence breakdown (spec §90/§91)', () => {
  test('evidence is split across the named source buckets', () => {
    const summary = summariseEvidence([
      ev('RESUME_EVIDENCE', 65, 'resume'),
      ev('ASSESSMENT_EVIDENCE', 55, 'technical-mcq'),
      ev('PROJECT_EVIDENCE', 75, 'coding:two-sum'),
      ev('ASSESSMENT_EVIDENCE', 72, 'adaptive-interview:Backend Developer'),
      ev('COMPLETED_LEARNING', undefined, 'topic:docker'),
      ev('ASSESSMENT_EVIDENCE', 80, 'topic-quiz:docker'),
      ev('SELF_DECLARED', undefined, 'self'),
    ]);

    expect(summary.resume).toEqual({ score: 65, note: 'resume' });
    expect(summary.technical).toEqual({ score: 55, note: 'technical-mcq' });
    expect(summary.project).toEqual({ score: 75, note: 'coding:two-sum' });
    expect(summary.interview).toEqual({ score: 72, note: 'adaptive-interview:Backend Developer' });
    // Lesson completion and the lesson quiz are both "learning", and the quiz
    // score is kept because it is the more informative of the two.
    expect(summary.learning).toEqual({ score: 80, note: 'topic-quiz:docker' });
    expect(summary.selfDeclared).toEqual({ score: null, note: 'self' });
  });

  test('a skill with no evidence in a source leaves that source null, not zero', () => {
    const summary = summariseEvidence([ev('RESUME_EVIDENCE', 65, 'resume')]);
    expect(summary.resume).not.toBeNull();
    for (const key of ['technical', 'coding', 'interview', 'learning', 'project', 'selfDeclared']) {
      expect(summary[key]).toBeNull();
    }
  });

  test('the BEST score per source is kept, not an average', () => {
    const summary = summariseEvidence([
      ev('ASSESSMENT_EVIDENCE', 30, 'technical-mcq'),
      ev('ASSESSMENT_EVIDENCE', 88, 'technical-mcq'),
      ev('ASSESSMENT_EVIDENCE', 55, 'technical-mcq'),
    ]);
    expect(summary.technical.score).toBe(88);
  });

  test('a later lower score does not overwrite a stronger earlier one', () => {
    const summary = summariseEvidence([
      ev('ASSESSMENT_EVIDENCE', 90, 'technical-mcq'),
      ev('ASSESSMENT_EVIDENCE', 20, 'technical-mcq'),
    ]);
    expect(summary.technical.score).toBe(90);
  });

  test('an empty evidence list produces an all-null summary', () => {
    const summary = summariseEvidence([]);
    expect(Object.values(summary).every(v => v === null)).toBe(true);
  });
});

describe('job-fit fixture (spec §113) — Docker evidenced, AWS not', () => {
  test('Docker shows project + learning evidence; AWS has no evidence at all', () => {
    // JD requires Node.js, MongoDB, Docker, AWS.
    // The candidate has a project demonstrating Docker and completed a Docker
    // lesson, but nothing anywhere evidences AWS.
    const docker = summariseEvidence([
      ev('PROJECT_EVIDENCE', 75, 'coding:docker-compose'),
      ev('COMPLETED_LEARNING', undefined, 'topic:docker'),
    ]);
    expect(docker.project).not.toBeNull();
    expect(docker.learning).not.toBeNull();

    const aws = summariseEvidence([]);
    expect(Object.values(aws).every(v => v === null)).toBe(true);
    // Nothing here supports a claim that the candidate LACKS AWS — only that
    // it has never been evidenced. The matrix renders this as NOT_ASSESSED.
    expect(aws.project).toBeNull();
    expect(aws.interview).toBeNull();
  });
});
