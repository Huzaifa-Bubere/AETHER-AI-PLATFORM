const express = require('express');
const request = require('supertest');
const { Types } = require('mongoose');
const Interview = require('../dist/models/Interview').default;
const gemini = require('../dist/services/gemini').default;
const routes = require('../dist/routes/interview').default;
const userId = new Types.ObjectId();
const app = express();
app.use(express.json(), (req, _res, next) => { req.user = { userId: String(userId) }; next(); });
app.use('/interview', routes);
const makeInterview = () => new Interview({ userId, type: 'system-design', status: 'scheduled',
  settings: { role: 'Engineer', difficulty: 'medium', duration: 30, domain: 'Distributed systems' }, questions: [], responses: [] });
afterEach(() => jest.restoreAllMocks());

test('a scheduled interview generates schema-valid questions on start', async () => {
  const interview = makeInterview();
  jest.spyOn(Interview, 'findOne').mockResolvedValue(interview);
  jest.spyOn(interview, 'save').mockImplementation(async () => { await interview.validate(); return interview; });
  const generate = jest.spyOn(gemini, 'generateInterviewQuestions').mockResolvedValue([{ text: 'Design a queue', type: 'system-design' }]);
  const result = await request(app).post(`/interview/${interview._id}/start`).send({});
  expect(result.status).toBe(200);
  expect(interview.questions).toHaveLength(1);
  expect(interview.questions[0].id).toBeTruthy();
  expect(interview.status).toBe('in-progress');
  expect(generate.mock.calls[0][0].domain).toBe('Distributed systems');
});
test('repeated end keeps the original end time', async () => {
  const interview = makeInterview();
  interview.status = 'completed';
  interview.session.endTime = new Date('2026-01-01T00:00:00Z');
  jest.spyOn(Interview, 'findOne').mockResolvedValue(interview);
  const save = jest.spyOn(interview, 'save');
  const result = await request(app).post(`/interview/${interview._id}/end`).send({});
  expect(result.status).toBe(200);
  expect(interview.session.endTime.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  expect(save).not.toHaveBeenCalled();
});
test('duplicate identical answer is idempotent and conflicting answer is rejected', async () => {
  const interview = makeInterview();
  interview.status = 'in-progress';
  interview.questions.push({ id: 'q1', text: 'Describe queues', type: 'technical', difficulty: 'easy', expectedDuration: 5 });
  interview.responses.push({ questionId: 'q1', answer: 'Existing answer', duration: 2, timestamp: new Date() });
  jest.spyOn(Interview, 'findOne').mockResolvedValue(interview);
  const update = jest.spyOn(Interview, 'findOneAndUpdate');
  expect((await request(app).post(`/interview/${interview._id}/response`).send({ questionId: 'q1', answer: 'Existing answer', duration: 2 })).status).toBe(200);
  expect((await request(app).post(`/interview/${interview._id}/response`).send({ questionId: 'q1', answer: 'Changed answer', duration: 2 })).status).toBe(409);
  expect(update).not.toHaveBeenCalled();
});
test('negative answer duration is rejected before loading an interview', async () => {
  const find = jest.spyOn(Interview, 'findOne');
  const result = await request(app).post(`/interview/${new Types.ObjectId()}/response`).send({ questionId: 'q1', answer: 'text', duration: -1 });
  expect(result.status).toBe(400);
  expect(find).not.toHaveBeenCalled();
});
