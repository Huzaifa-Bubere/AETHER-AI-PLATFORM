const { Types } = require('mongoose');
const { normalizeQuestion, fingerprintQuestion, similarQuestions, uniqueQuestions } = require('../dist/services/questions/identity');
const { validateDifficultyEvidence } = require('../dist/services/questions/difficulty');
const Question = require('../dist/models/AptitudeQuestion').default;
const Attempt = require('../dist/models/AptitudeAttempt').default;
const { buildQuestionSet } = require('../dist/services/questionSelector.service');

const q = questionText => ({ _id: new Types.ObjectId(), questionText });
const testData = { roundType: 'technical', categories: ['technical-quiz'], difficultyPlan: { easy: { count: 2 }, medium: { count: 0 }, hard: { count: 0 } } };
function bank(pool, attempts = []) {
  jest.spyOn(Attempt, 'find').mockReturnValue({ select: () => ({ lean: async () => attempts }) });
  jest.spyOn(Question, 'find').mockReturnValue({ select: () => ({ lean: async () => pool }) });
}
afterEach(() => jest.restoreAllMocks());

test('normalization deduplicates formatting, preserving numbers and operators', () => {
  expect(normalizeQuestion('  WHAT\n is  SQL?  ')).toBe('what is sql?');
  expect(fingerprintQuestion(q(' What is SQL? '))).toBe(fingerprintQuestion(q('what is sql?')));
  expect(fingerprintQuestion(q('x <= 10'))).not.toBe(fingerprintQuestion(q('x < 10')));
  expect(fingerprintQuestion(q('x < 10'))).not.toBe(fingerprintQuestion(q('x < 100')));
});

test('copied stems are deduplicated despite different IDs and options', () => {
  expect(uniqueQuestions([q('What is SQL?'), q('WHAT is SQL?'), q('What is TCP?')])).toHaveLength(2);
});

test('near-duplicate guard preserves negation and numerical differences', () => {
  const stem = 'Which of the following database operations will complete successfully when the transaction uses isolation level serializable';
  expect(similarQuestions(q(stem), q(stem + ' now'))).toBe(true);
  expect(similarQuestions(q(stem), q(stem.replace('will complete', 'will not complete')))).toBe(false);
  expect(similarQuestions(q(stem + ' 10'), q(stem + ' 100'))).toBe(false);
});

test('recent snapshot excludes a copied question after the source question is deleted', async () => {
  const old = q('What is SQL?'), copied = q('  WHAT IS SQL?'), fresh = [q('What is TCP?'), q('What is an index?')];
  bank([copied, ...fresh], [{ questions: [old._id], questionSnapshots: [{ questionId: old._id, questionText: old.questionText }], startedAt: new Date() }]);
  const ids = await buildQuestionSet(testData, new Types.ObjectId());
  expect(ids.map(String).sort()).toEqual(fresh.map(x => String(x._id)).sort());
});

test('recent exhaustion rejects rather than repeating or changing difficulty', async () => {
  const pool = [q('What is SQL?'), q('What is TCP?')];
  bank(pool, [{ questions: pool.map(x => x._id), questionSnapshots: [], startedAt: new Date() }]);
  await expect(buildQuestionSet(testData, new Types.ObjectId())).rejects.toThrow('distinct questions outside your 30-day recent history');
});

test('older questions may be reused after the cooldown', async () => {
  const pool = [q('What is SQL?'), q('What is TCP?')];
  bank(pool, [{ questions: pool.map(x => x._id), questionSnapshots: [], startedAt: new Date(Date.now() - 31 * 86400000) }]);
  expect(await buildQuestionSet(testData, new Types.ObjectId())).toHaveLength(2);
});

test('a copied bank cannot satisfy a quota for two distinct questions', async () => {
  bank([q('What is SQL?'), q('What is SQL?')]);
  await expect(buildQuestionSet(testData, new Types.ObjectId())).rejects.toThrow('need 2, found 1');
});

test('duplicate MCQ options fail schema validation and fingerprints persist', async () => {
  const doc = new Question({ category: 'technical-quiz', difficulty: 'easy', questionText: 'Which protocol?', correctOption: 'A', options: { A: 'HTTP', B: ' http ', C: 'TCP', D: 'UDP' } });
  await expect(doc.validate()).rejects.toThrow('distinct');
  doc.options.B = 'FTP';
  await doc.validate();
  expect(doc.fingerprint).toMatch(/^[a-f0-9]{64}$/);
});

test('difficulty needs meaningful distinct steps, concepts and hard edge cases', () => {
  const fundamental = { reasoningSteps: ['Recall the definition of a primary key.'], concepts: ['primary keys'] };
  expect(validateDifficultyEvidence('easy', fundamental)).toEqual([]);
  expect(validateDifficultyEvidence('hard', fundamental).length).toBeGreaterThan(0);
  expect(validateDifficultyEvidence('hard', { reasoningSteps: ['Identify the relevant transaction isolation level.', 'Trace the conflicting writes across both transactions.', 'Determine the outcome after concurrency validation.'], concepts: ['isolation', 'concurrency'], edgeCase: 'Two transactions update the same key concurrently.' })).toEqual([]);
});
