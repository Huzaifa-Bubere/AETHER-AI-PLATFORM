// Explicit opt-in: uses a unique temporary database, never the application's database.
const mongoose = require('mongoose');
const crypto = require('crypto');
const request = require('supertest');
const express = require('express');
const sharp = require('sharp');
const describeIntegration = process.env.APTITUDE_INTEGRATION === '1' ? describe : describe.skip;

describeIntegration('aptitude HTTP and MongoDB workflow', () => {
  const databaseName = `aptitude_verify_${crypto.randomBytes(10).toString('hex')}`;
  let app, admin, student, other, adminToken, studentToken, otherToken, User, Question, Test, Attempt, tokens;
  let testId, attemptId, imagePublicId, imageUrl;
  const images = require('../dist/utils/aptitudeImageUpload');
  const question = { roundType: 'aptitude', category: 'logical-reasoning', difficulty: 'easy', questionText: '2 + 2?',
    options: { A: '3', B: '4', C: '5', D: '6' }, correctOption: 'B', explanation: 'Two pairs total four.', marks: 1 };
  const testData = { title: 'Integration aptitude', roundType: 'aptitude', categories: ['logical-reasoning'], durationMinutes: 5,
    difficultyPlan: { easy: { count: 2, marksPerQuestion: 2 }, medium: { count: 0, marksPerQuestion: 3 }, hard: { count: 0, marksPerQuestion: 4 } } };
  const as = (method, url, token = adminToken) => request(app)[method](url).set('Authorization', `Bearer ${token}`);
  const adminBase = '/api/admin/aptitude', studentBase = '/api/aptitude';

  beforeAll(async () => {
    require('../dist/config/environment').loadEnvironment();
    delete process.env.GEMINI_API_KEY;
    delete process.env.CLOUDINARY_CLOUD_NAME;
    process.env.JWT_ACCESS_SECRET = crypto.randomBytes(32).toString('hex');
    process.env.JWT_REFRESH_SECRET = crypto.randomBytes(32).toString('hex');
    const uri = process.env.APTITUDE_TEST_MONGODB_URI || process.env.MONGODB_URI;
    try { await mongoose.connect(uri, { dbName: databaseName, serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 }); }
    catch (error) { throw new Error(`Test database connection failed (${error.name}); credentials are omitted.`); }
    if (mongoose.connection.name !== databaseName) throw new Error('Refusing to test against a non-test database.');
    User = require('../dist/models/User').default;
    Question = require('../dist/models/AptitudeQuestion').default;
    Test = require('../dist/models/AptitudeTest').default;
    Attempt = require('../dist/models/AptitudeAttempt').default;
    tokens = require('../dist/utils/auth').generateTokens;
    await Promise.all([User.init(), Question.init(), Test.init(), Attempt.init()]);
    const makeUser = (name, role) => User.create({ email: `${name}@example.test`, password: 'Test-only-934!pass', profile: { firstName: name, lastName: 'Test' }, auth: { role } });
    admin = await makeUser('admin', 'admin'); student = await makeUser('student', 'user'); other = await makeUser('other', 'user');
    adminToken = tokens(String(admin._id)).accessToken;
    studentToken = tokens(String(student._id)).accessToken;
    otherToken = tokens(String(other._id)).accessToken;
    app = express(); app.use(express.json());
    app.use(adminBase, require('../dist/routes/aptitudeAdmin.routes').default);
    app.use(studentBase, require('../dist/routes/aptitudeStudent.routes').default);
    app.use((error, _req, res, _next) => res.status(500).json({ message: error.message }));
  }, 60000);

  afterAll(async () => {
    try {
    if (imagePublicId) await images.deleteQuestionImage(imagePublicId);
    if (mongoose.connection.readyState === 1) {
      if (mongoose.connection.name !== databaseName || !/^aptitude_verify_[a-f0-9]{20}$/.test(databaseName)) throw new Error('Refusing unsafe database cleanup.');
      await mongoose.connection.dropDatabase();
    }
    } finally { await mongoose.disconnect(); }
  }, 30000);

  test('admin routes enforce identity and validate IDs and malformed input', async () => {
    await request(app).get(`${adminBase}/tests`).expect(401);
    await as('post', `${adminBase}/questions`, studentToken).send(question).expect(403);
    await as('put', `${adminBase}/questions/invalid`).send(question).expect(400);
    await as('post', `${adminBase}/questions`).send({ ...question, options: { A: '3' } }).expect(400);
    await as('post', `${adminBase}/questions`).send({ ...question, options: '{invalid' }).expect(400);
    await as('post', `${adminBase}/questions/bulk`).send({ meta: '{}' }).expect(400);
  });

  test('draft, bank shortage, bulk creation, search, edit and publish work through HTTP', async () => {
    const draft = await as('post', `${adminBase}/tests`).send(testData).expect(201);
    testId = draft.body.test._id; expect(draft.body.test.isPublished).toBe(false);
    expect((await as('get', `${studentBase}/tests`, studentToken)).body.tests).toHaveLength(0);
    await as('patch', `${adminBase}/tests/${testId}/publish`).send({ isPublished: true }).expect(422);
    const bulk = await as('post', `${adminBase}/questions/bulk`).send({ questions: [question, { ...question, questionText: 'Which value equals 2+2?' }, {}] }).expect(207);
    expect(bulk.body).toMatchObject({ createdCount: 2, failedCount: 1 });
    const id = bulk.body.created[0]._id;
    await as('put', `${adminBase}/questions/${id}`).send({ explanation: 'Updated explanation.' }).expect(200);
    const literal = await as('get', `${adminBase}/questions?search=${encodeURIComponent('[')}&page=NaN`).expect(200);
    expect(literal.body.total).toBe(0);
    await as('patch', `${adminBase}/questions/${id}/status`).send({ status: 'bad' }).expect(400);
    await as('patch', `${adminBase}/tests/${testId}/publish`).send({ isPublished: true }).expect(200);
    expect((await as('get', `${studentBase}/tests`, studentToken)).body.tests[0].availability.ready).toBe(true);
  });

  test('multipart images render without Cloudinary and invalid uploads fail', async () => {
    await as('post', `${adminBase}/questions`).field('category', 'logical-reasoning').field('correctOption', 'A')
      .attach('image', Buffer.from('not a picture'), 'fake.png').expect(400);
    const jpeg = await sharp({ create: { width: 30, height: 20, channels: 3, background: 'white' } }).jpeg().toBuffer();
    const saved = await as('post', `${adminBase}/questions`).field('category', 'technical-quiz').field('roundType', 'technical')
      .field('difficulty', 'hard').field('correctOption', 'A').attach('image', jpeg, 'question.jpg').expect(201);
    imagePublicId = saved.body.question.imagePublicId; imageUrl = saved.body.question.imageUrl;
    const asset = await request(app).get(imageUrl).expect(200);
    expect(asset.headers['content-type']).toContain('image/webp');
    expect(asset.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  test('concurrent starts produce one attempt, whose active answers stay private', async () => {
    const starts = await Promise.all(Array.from({ length: 5 }, () => as('post', `${studentBase}/tests/${testId}/start`, studentToken)));
    starts.forEach(result => expect([200, 201]).toContain(result.status));
    expect(new Set(starts.map(result => result.body.attemptId)).size).toBe(1);
    attemptId = starts[0].body.attemptId;
    expect(await Attempt.countDocuments({ user: student._id })).toBe(1);
    expect((await Question.find({ roundType: 'aptitude' })).every(q => q.timesUsed === 1)).toBe(true);
    const paper = await as('get', `${studentBase}/attempts/${attemptId}`, studentToken).expect(200);
    expect(paper.body.questions).toHaveLength(2);
    expect(paper.body.questions.every(q => !('correctOption' in q) && !('explanation' in q) && q.marks === 2)).toBe(true);
    await as('get', `${studentBase}/attempts/${attemptId}`, otherToken).expect(404);
    await as('get', `${studentBase}/attempts/${attemptId}/result`, studentToken).expect(409);
    await as('post', `${studentBase}/attempts/${attemptId}/submit`, otherToken).send({}).expect(404);
  });

  test('save, resume, review flags and weighted submission persist; test edits do not change a running exam', async () => {
    const paper = (await as('get', `${studentBase}/attempts/${attemptId}`, studentToken)).body;
    const [first, second] = paper.questions;
    await as('put', `${adminBase}/questions/${first._id}`).send({ correctOption: 'D' }).expect(409);
    await as('delete', `${adminBase}/questions/${first._id}`).expect(409);
    await as('post', `${studentBase}/attempts/${attemptId}/response`, studentToken).send({ questionId: first._id, selectedOption: 'B', markedForReview: true, timeSpentSeconds: 3 }).expect(200);
    const changedPlan = { ...testData.difficultyPlan, easy: { count: 2, marksPerQuestion: 5 } };
    await as('put', `${adminBase}/tests/${testId}`).send({ difficultyPlan: changedPlan, durationMinutes: 10 }).expect(200);
    await as('patch', `${adminBase}/tests/${testId}/publish`).send({ isPublished: false }).expect(200);
    expect((await as('post', `${studentBase}/tests/${testId}/start`, studentToken)).body.attemptId).toBe(attemptId);
    const resumed = (await as('get', `${studentBase}/attempts/${attemptId}`, studentToken)).body;
    expect(resumed.responses[0]).toMatchObject({ selectedOption: 'B', status: 'answered-marked-for-review' });
    expect(resumed.questions[0].marks).toBe(2);
    await as('post', `${studentBase}/attempts/${attemptId}/submit`, studentToken).send({ responses: [{ questionId: second._id, selectedOption: 'A', markedForReview: false, timeSpentSeconds: 4 }] }).expect(200);
    const result = (await as('get', `${studentBase}/attempts/${attemptId}/result`, studentToken).expect(200)).body;
    expect(result).toMatchObject({ score: 2, totalMarks: 4, correctCount: 1, incorrectCount: 1, accuracyPercent: 50, passStatus: 'pass' });
    expect(result.aiAnalysis.categoryPerformance[0].accuracy).toBe(50);
    expect(result.review[0].correctOption).toBe('B');
    const submittedAt = (await Attempt.findById(attemptId)).submittedAt.toISOString();
    await as('post', `${studentBase}/attempts/${attemptId}/submit`, studentToken).send({}).expect(200);
    expect((await Attempt.findById(attemptId)).submittedAt.toISOString()).toBe(submittedAt);
    await as('post', `${studentBase}/attempts/${attemptId}/response`, studentToken).send({ questionId: second._id, selectedOption: 'B', markedForReview: false, timeSpentSeconds: 4 }).expect(409);
  });

  test('history and admin statistics reflect the same scores and block controls protect admins', async () => {
    const history = (await as('get', `${studentBase}/attempts`, studentToken).expect(200)).body;
    expect(history.attempts[0]).toMatchObject({ attemptId, status: 'completed', score: 2 });
    expect((await as('get', `${studentBase}/attempts`, otherToken)).body.attempts).toHaveLength(0);
    const stats = (await as('get', `${adminBase}/dashboard`).expect(200)).body;
    expect(stats).toMatchObject({ totalStudents: 1, totalAttempts: 1, averageScorePercent: 50 });
    const students = (await as('get', `${adminBase}/students`).expect(200)).body.students;
    expect(students[0]).toMatchObject({ userId: String(student._id), avgScorePercent: 50, isBlocked: false });
    await as('patch', `${adminBase}/students/${admin._id}/block`).send({ isBlocked: true }).expect(404);
    const blocked = await as('patch', `${adminBase}/students/${student._id}/block`).send({ isBlocked: true }).expect(200);
    expect(Object.keys(blocked.body).sort()).toEqual(['isBlocked', 'userId']);
    await as('get', `${studentBase}/tests`, studentToken).expect(401);
    await as('patch', `${adminBase}/students/${student._id}/block`).send({ isBlocked: false }).expect(200);
    studentToken = tokens(String(student._id), 1).accessToken;
    await as('get', `${studentBase}/tests`, studentToken).expect(200);
  });

  test('expired attempts ignore late answers, release their active key, and allow a fresh retake', async () => {
    await as('patch', `${adminBase}/tests/${testId}/publish`).send({ isPublished: true }).expect(200);
    await as('post', `${studentBase}/tests/${testId}/start`, studentToken).expect(422);
    await as('post', `${adminBase}/questions/bulk`).send({ questions: [
      { ...question, questionText: 'What is 3 + 1?' }, { ...question, questionText: 'What is 8 divided by 2?' },
    ] }).expect(207);
    const started = await as('post', `${studentBase}/tests/${testId}/start`, studentToken).expect(201);
    const id = started.body.attemptId;
    expect(id).not.toBe(attemptId);
    const attempt = await Attempt.findById(id);
    await Attempt.updateOne({ _id: id }, { $set: { startedAt: new Date(Date.now() - 11 * 60000) } });
    await as('post', `${studentBase}/attempts/${id}/submit`, studentToken).send({ responses: [{ questionId: String(attempt.questions[0]), selectedOption: 'B', markedForReview: false, timeSpentSeconds: 1 }] }).expect(200);
    const result = (await as('get', `${studentBase}/attempts/${id}/result`, studentToken)).body;
    expect(result).toMatchObject({ score: 0, unansweredCount: 2, autoSubmitted: true });
    expect((await Attempt.findById(id)).activeKey).toBeUndefined();
    await as('post', `${studentBase}/tests/${testId}/start`, studentToken).expect(422);
    await as('post', `${adminBase}/questions/bulk`).send({ questions: [
      { ...question, questionText: 'What is 10 minus 6?' }, { ...question, questionText: 'What is 2 squared?' },
    ] }).expect(207);
    await as('post', `${studentBase}/tests/${testId}/start`, studentToken).expect(201);
  });
});
