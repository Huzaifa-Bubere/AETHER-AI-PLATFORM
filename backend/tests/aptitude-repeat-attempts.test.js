// Spec §2F/§15 — "5-medium test can start repeatedly".
//
// The reported runtime failure was:
//   "Insufficient medium questions for this test: need 5, found 3 distinct
//    questions outside your 30-day recent history."
// This test drives the REAL selector (buildQuestionSet) against the REAL seeded
// aptitude medium bank and proves a candidate can start the shipped
// 5-medium test repeatedly — without ever being served a repeat inside the
// cooldown — and that the only failure mode is a truthful shortfall message.
const { Types } = require('mongoose');
const Question = require('../dist/models/AptitudeQuestion').default;
const Attempt = require('../dist/models/AptitudeAttempt').default;
const { buildQuestionSet } = require('../dist/services/questionSelector.service');
const { SEED_QUESTIONS } = require('../dist/scripts/seedQuestionData');

// The published "AETHER Aptitude Assessment" seeder uses exactly these categories.
const APTITUDE_CATEGORIES = ['quantitative-aptitude', 'logical-reasoning', 'verbal-ability', 'puzzle-solving'];
const MEDIUM_BANK = SEED_QUESTIONS.filter(
  q => q.roundType === 'aptitude' && q.difficulty === 'medium' && APTITUDE_CATEGORIES.includes(q.category),
);

// Same shape the published default test uses (5 easy / 5 medium / 5 hard);
// the 0-count levels are skipped by the selector, isolating MEDIUM.
const testData = () => ({
  _id: new Types.ObjectId(),
  title: 'AETHER Aptitude Assessment',
  roundType: 'aptitude',
  categories: APTITUDE_CATEGORIES,
  difficultyPlan: {
    easy: { count: 0, marksPerQuestion: 1 },
    medium: { count: 5, marksPerQuestion: 2 },
    hard: { count: 0, marksPerQuestion: 3 },
  },
  createdBy: new Types.ObjectId(),
});

afterEach(() => jest.restoreAllMocks());

test('the shipped 5-medium aptitude test can be started 8 times with no repeated question', async () => {
  const pool = MEDIUM_BANK.map(q => ({
    _id: new Types.ObjectId(),
    questionText: q.statement,
    imageUrl: `https://cdn.example/${q.id}.png`,
  }));
  expect(pool.length).toBeGreaterThanOrEqual(40);

  // Every question the candidate has already seen is stored on their past
  // attempts; the selector excludes those by id AND by content snapshot.
  const seen = [];
  jest.spyOn(Attempt, 'find').mockImplementation(() => ({
    select: () => ({
      lean: async () => seen.map(q => ({ questions: [q._id], questionSnapshots: [{ _id: q._id, questionText: q.questionText }], startedAt: new Date() })),
    }),
  }));
  jest.spyOn(Question, 'find').mockImplementation(filter => ({
    select: () => ({ lean: async () => pool.filter(q => !filter.difficulty || filter.difficulty === 'medium') }),
  }));
  jest.spyOn(Question, 'updateMany').mockResolvedValue({});

  const served = new Set();
  const userId = new Types.ObjectId();
  for (let attempt = 1; attempt <= 8; attempt++) {
    const ids = await buildQuestionSet(testData(), userId);
    expect(ids).toHaveLength(5);
    for (const id of ids) {
      expect(served.has(String(id))).toBe(false); // no repeat inside the cooldown
      served.add(String(id));
    }
    ids.forEach(id => seen.push(pool.find(q => String(q._id) === String(id))));
  }
  expect(served.size).toBe(40); // the whole medium bank, across 8 starts

  // The 9th start must fail with the honest shortfall message rather than
  // silently reusing questions the candidate already saw.
  await expect(buildQuestionSet(testData(), userId)).rejects.toThrow(/Insufficient medium questions for this test: need 5, found 0/);
});

test('a bank that only has 3 usable medium questions still reports the exact shortfall', async () => {
  jest.spyOn(Attempt, 'find').mockReturnValue({ select: () => ({ lean: async () => [] }) });
  const tiny = MEDIUM_BANK.slice(0, 3).map((q, i) => ({ _id: new Types.ObjectId(), questionText: q.statement, imageUrl: `https://cdn.example/${i}.png` }));
  jest.spyOn(Question, 'find').mockReturnValue({ select: () => ({ lean: async () => tiny }) });
  jest.spyOn(Question, 'updateMany').mockResolvedValue({});

  await expect(buildQuestionSet(testData(), new Types.ObjectId()))
    .rejects.toThrow('Insufficient medium questions for this test: need 5, found 3 distinct questions outside your 30-day recent history');
});
