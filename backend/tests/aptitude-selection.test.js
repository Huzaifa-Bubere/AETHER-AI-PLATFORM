const { Types } = require('mongoose');
const Question = require('../dist/models/AptitudeQuestion').default;
const Attempt = require('../dist/models/AptitudeAttempt').default;
const Test = require('../dist/models/AptitudeTest').default;
const { buildQuestionSet } = require('../dist/services/questionSelector.service');
const plan = { easy: { count: 15, marksPerQuestion: 1 }, medium: { count: 15, marksPerQuestion: 2 }, hard: { count: 15, marksPerQuestion: 3 } };
const testData = () => ({ _id: new Types.ObjectId(), title: 'Audit', roundType: 'aptitude', categories: ['quantitative'], difficultyPlan: plan, createdBy: new Types.ObjectId() });
afterEach(() => jest.restoreAllMocks());

test('selects 15 questions in each difficulty, without duplicates', async () => {
  const pools = Object.fromEntries(['easy','medium','hard'].map(d => [d, Array.from({ length: 20 }, () => ({ _id: new Types.ObjectId() }))]));
  jest.spyOn(Attempt, 'find').mockReturnValue({ select: () => ({ lean: async () => [] }) });
  const find = jest.spyOn(Question, 'find').mockImplementation(filter => ({ select: () => ({ lean: async () => pools[filter.difficulty] }) }));
  jest.spyOn(Question, 'updateMany').mockResolvedValue({});
  const ids = await buildQuestionSet(testData(), new Types.ObjectId());
  expect(ids).toHaveLength(45);
  expect(new Set(ids.map(String)).size).toBe(45);
  for (const difficulty of Object.keys(pools)) {
    expect(ids.filter(id => pools[difficulty].some(q => String(q._id) === String(id)))).toHaveLength(15);
  }
  expect(find).toHaveBeenCalledTimes(3);
});
test('insufficient bank rejects the test instead of borrowing unrelated questions', async () => {
  jest.spyOn(Attempt, 'find').mockReturnValue({ select: () => ({ lean: async () => [] }) });
  const find = jest.spyOn(Question, 'find').mockReturnValue({ select: () => ({ lean: async () => [] }) });
  await expect(buildQuestionSet(testData(), new Types.ObjectId())).rejects.toThrow('Insufficient easy');
  expect(find).toHaveBeenCalledTimes(1);
});
test('validation calculates weights and recalculates them after edits', async () => {
  const test = new Test(testData());
  await test.validate();
  expect(test.totalMarks).toBe(90);
  test.difficultyPlan.hard.marksPerQuestion = 4;
  await test.validate();
  expect(test.totalMarks).toBe(105);
});
test('incomplete and fractional plans and invalid durations are rejected', async () => {
  const incomplete = new Test({ ...testData(), difficultyPlan: { easy: plan.easy } });
  await expect(incomplete.validate()).rejects.toThrow();
  const fractional = new Test(testData());
  fractional.difficultyPlan.easy.count = 1.5;
  await expect(fractional.validate()).rejects.toThrow();
  const invalid = new Test({ ...testData(), durationMinutes: 0 });
  await expect(invalid.validate()).rejects.toThrow();
});
