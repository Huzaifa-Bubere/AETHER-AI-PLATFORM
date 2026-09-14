const { Types } = require('mongoose');
const Attempt = require('../dist/models/AptitudeAttempt').default;
const Question = require('../dist/models/AptitudeQuestion').default;
const controller = require('../dist/controllers/studentAptitude.controller');
const user = new Types.ObjectId();
const q1 = new Types.ObjectId(), q2 = new Types.ObjectId();
delete process.env.GEMINI_API_KEY;
const makeAttempt = () => new Attempt({
  user, test: new Types.ObjectId(), roundType: 'aptitude', durationMinutes: 45, __v: 0,
  questions: [q1, q2], responses: [{ question: q1, selectedOption: 'A' }, { question: q2, selectedOption: null }],
  questionSnapshots: [q1, q2].map((id, index) => ({ questionId: id, questionText: `Question ${index}`, options: { A: 'Alpha', B: 'Beta' },
    category: 'quantitative', difficulty: index ? 'hard' : 'easy', correctOption: 'A', marks: index ? 3 : 1, explanation: 'Private explanation' })),
});
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
const request = attempt => ({ user: { userId: String(user) }, params: { attemptId: String(attempt._id) }, body: {} });
afterEach(() => jest.restoreAllMocks());

test('active attempt serves frozen text/options/weights and never correct answers', async () => {
  const attempt = makeAttempt();
  jest.spyOn(Attempt, 'findOne').mockResolvedValue(attempt);
  const queryBank = jest.spyOn(Question, 'find');
  const res = response();
  await controller.getAttempt(request(attempt), res);
  const data = res.json.mock.calls[0][0];
  expect(data.questions[1]).toMatchObject({ questionText: 'Question 1', options: { A: 'Alpha' }, marks: 3 });
  expect(data.questions.every(q => q.correctOption === undefined && q.explanation === undefined)).toBe(true);
  expect(queryBank).not.toHaveBeenCalled();
});
test('submission includes pending answers, grades snapshot weights, and is idempotent', async () => {
  const attempt = makeAttempt();
  jest.spyOn(Attempt, 'findOne').mockResolvedValue(attempt);
  const update = jest.spyOn(Attempt, 'findOneAndUpdate').mockImplementation(async (_filter, change) =>
    new Attempt({ ...attempt.toObject(), ...change.$set, __v: 1 }));
  const req = request(attempt);
  req.body.responses = [{ questionId: String(q2), selectedOption: 'A', markedForReview: false, timeSpentSeconds: 2 }];
  await controller.submitAttempt(req, response());
  expect(attempt.score).toBe(4);
  expect(attempt.totalMarks).toBe(4);
  expect(attempt.scorePercent).toBe(100);
  await controller.submitAttempt(req, response());
  expect(update).toHaveBeenCalledTimes(1);
});
test('expired submission ignores late client answers and finalizes saved answers', async () => {
  const attempt = makeAttempt();
  attempt.startedAt = new Date(Date.now() - 46 * 60000);
  jest.spyOn(Attempt, 'findOne').mockResolvedValue(attempt);
  jest.spyOn(Attempt, 'findOneAndUpdate').mockImplementation(async (_filter, change) => new Attempt({ ...attempt.toObject(), ...change.$set }));
  const req = request(attempt);
  req.body.responses = [{ questionId: String(q2), selectedOption: 'A', markedForReview: false, timeSpentSeconds: 2 }];
  await controller.submitAttempt(req, response());
  expect(attempt.score).toBe(1);
  expect(attempt.unansweredCount).toBe(1);
  expect(attempt.autoSubmitted).toBe(true);
});
test('concurrent saves force grading to reload instead of overwriting new answers', async () => {
  const attempt = makeAttempt();
  jest.spyOn(Attempt, 'findOne').mockResolvedValue(attempt);
  const latest = new Attempt({ ...attempt.toObject(), __v: 1 });
  latest.responses[1].selectedOption = 'A';
  jest.spyOn(Attempt, 'findById').mockResolvedValue(latest);
  const update = jest.spyOn(Attempt, 'findOneAndUpdate').mockResolvedValueOnce(null)
    .mockImplementation(async (_filter, change) => new Attempt({ ...latest.toObject(), ...change.$set }));
  await controller.submitAttempt(request(attempt), response());
  expect(update).toHaveBeenCalledTimes(2);
  expect(attempt.score).toBe(4);
});
