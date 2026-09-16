// Opt-in: real MongoDB, real Gemini embeddings/generation, disposable records only.
const mongoose = require('mongoose');
const crypto = require('crypto');
const request = require('supertest');
const live = process.env.ATHER_LIVE_INTEGRATION === '1' ? describe : describe.skip;

live('ATHER live retrieval-grounded assessment workflow', () => {
  const databaseName = `ather_verify_${crypto.randomBytes(10).toString('hex')}`;
  let app, User, Source, Chunk, Question, Attempt, candidate, adminToken, candidateToken, candidateRefresh;
  let sourceId, testId, attemptId, key;
  const password = 'Disposable-Test-93!';
  const api = (method, url, token = adminToken) => request(app)[method](url).set('Authorization', `Bearer ${token}`);
  beforeAll(async () => {
    require('../dist/config/environment').loadEnvironment();
    key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('Live verification requires a configured Gemini provider.');
    process.env.NODE_ENV = 'test';
    process.env.RAG_VECTOR_MODE = 'exact';
    for (const name of ['EMAIL_USER', 'EMAIL_PASSWORD', 'STRIPE_SECRET_KEY']) delete process.env[name];
    process.env.JWT_ACCESS_SECRET = crypto.randomBytes(32).toString('hex');
    process.env.JWT_REFRESH_SECRET = crypto.randomBytes(32).toString('hex');
    try { await mongoose.connect(process.env.MONGODB_URI, { dbName: databaseName, serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 }); }
    catch { throw new Error('Live test database unavailable; connection details omitted.'); }
    if (mongoose.connection.name !== databaseName) throw new Error('Unsafe test database.');
    User = require('../dist/models/User').default;
    Source = require('../dist/models/RagSource').default;
    Chunk = require('../dist/models/RagChunk').default;
    Question = require('../dist/models/AptitudeQuestion').default;
    Attempt = require('../dist/models/AptitudeAttempt').default;
    await Promise.all([User.init(), Source.init(), Chunk.init(), Question.init(), Attempt.init()]);
    app = require('../dist/app').createApp();
  }, 90000);

  afterAll(async () => {
    try {
      if (mongoose.connection.readyState === 1) {
        if (mongoose.connection.name !== databaseName || !/^ather_verify_[a-f0-9]{20}$/.test(databaseName)) throw new Error('Refusing unsafe cleanup.');
        await mongoose.connection.dropDatabase();
      }
    } finally { await mongoose.disconnect(); }
  }, 30000);

  test('candidate signup/login, admin login and protected route boundaries', async () => {
    const signup = await request(app).post('/api/auth/register').send({ email: 'candidate@example.test', password, profile: { firstName: 'Test', lastName: 'Candidate' } }).expect(201);
    candidate = signup.body.data.user;
    const login = await request(app).post('/api/auth/login').send({ email: 'candidate@example.test', password }).expect(200);
    candidateToken = login.body.data.tokens.accessToken;
    candidateRefresh = login.body.data.tokens.refreshToken;
    await User.create({ email: 'admin@example.test', password, profile: { firstName: 'Test', lastName: 'Admin' }, auth: { role: 'admin' } });
    const admin = await request(app).post('/api/auth/login').send({ email: 'admin@example.test', password }).expect(200);
    adminToken = admin.body.data.tokens.accessToken;
    await request(app).get('/api/admin/rag/sources').expect(401);
    await api('get', '/api/admin/rag/sources', candidateToken).expect(403);
    await api('get', '/api/aptitude/tests', adminToken).expect(403);
  }, 30000);

  test('source configuration, permitted import, chunk persistence and live embedding retrieval', async () => {
    const created = await api('post', '/api/admin/rag/sources').send({ title: 'Python collection verification reference', url: 'https://docs.python.org/3/tutorial/datastructures.html', topic: 'Python collections', license: 'Original test reference explaining public Python language semantics; no copied question bank.' }).expect(201);
    sourceId = created.body.data._id;
    // Original reference text is deliberately unique; retrieval must return THIS persisted material.
    const text = 'Python lists preserve element order and support duplicate values. The append method adds one item at the end, while extend iterates over another iterable and appends each of its elements. List mutation methods such as append and sort return None. A shallow list copy creates a new outer list but preserves references to nested mutable objects. Therefore mutating a shared inner list is visible through both outer lists, while appending to just one outer list does not change the other outer list. Tuples are immutable sequences but may contain mutable objects. Dictionary keys must be hashable and unique; assigning a second value to an existing key replaces its value without adding a second entry. Dictionary iteration follows insertion order. Python sets contain distinct hashable objects and do not provide positional indexing. Set intersection returns elements present in both sets; set union returns all distinct elements. Membership in a dictionary checks keys rather than values. A list comprehension creates a new list from an iterable and can filter elements with a condition. When a comprehension contains multiple for clauses, their order matches the corresponding nested loops. Iterating over a copy of a list can avoid skipping elements while removing items from the original list.';
    await api('post', `/api/admin/rag/sources/${sourceId}/ingest`).send({ text }).expect(202);
    // The route must persist its claim before acknowledging work.
    expect(['ingesting', 'ready']).toContain((await Source.findById(sourceId)).status);
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline && (await Source.findById(sourceId)).status === 'ingesting') {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    const stored = await Source.findById(sourceId);
    expect(stored.status).toBe('ready');
    const chunks = await Chunk.find({ sourceId, revision: stored.revision }).select('+embedding').lean();
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every(c => c.embedding.length === 768)).toBe(true);
    const context = await require('../dist/services/rag/retrieval').retrieveContext('Python collections', 'Python list shallow copies and dictionaries');
    expect(context.some(c => c.text.includes('preserves references to nested mutable objects'))).toBe(true);
    expect(context.every(c => c.sourceId === sourceId)).toBe(true);
    // Hold an actual database lease to test a concurrent claim deterministically.
    const claim = await require('../dist/services/rag/ingestion').claimIngestion(sourceId);
    await api('post', `/api/admin/rag/sources/${sourceId}/ingest`).send({ text }).expect(409);
    await Source.updateOne({ _id: sourceId, leaseOwner: claim.leaseOwner }, { $set: { status: 'ready' }, $unset: { leaseUntil: 1, leaseOwner: 1 } });
  }, 90000);

  test('published template delivers genuinely retrieved easy, medium and hard questions', async () => {
    const created = await api('post', '/api/admin/aptitude/tests').send({ title: 'Live grounded Python test', roundType: 'technical', categories: ['technical-quiz'], ragTopic: 'Python collections', durationMinutes: 10,
      difficultyPlan: { easy: { count: 1, marksPerQuestion: 1 }, medium: { count: 1, marksPerQuestion: 2 }, hard: { count: 1, marksPerQuestion: 3 } } }).expect(201);
    testId = created.body.test._id;
    await api('patch', `/api/admin/aptitude/tests/${testId}/publish`).send({ isPublished: true }).expect(200);
    const start = await api('post', `/api/aptitude/tests/${testId}/start`, candidateToken).send({});
    if (start.status !== 201) throw new Error(`Assessment start failed (${start.status}): ${start.body.message || start.body.error}`);
    attemptId = start.body.attemptId;
    const paper = await api('get', `/api/aptitude/attempts/${attemptId}`, candidateToken).expect(200);
    expect(paper.body.questions.map(q => q.difficulty).sort()).toEqual(['easy', 'hard', 'medium']);
    expect(paper.body.questions.every(q => q.correctOption === undefined && q.generation === undefined)).toBe(true);
    const questions = await Question.find({ _id: { $in: paper.body.questions.map(q => q._id) } }).lean();
    for (const q of questions) {
      expect(q.generation.sources.length).toBeGreaterThan(0);
      expect(await Chunk.exists({ _id: q.generation.sources[0].chunkId, sourceId })).toBeTruthy();
      expect(require('../dist/services/questions/difficulty').validateDifficultyEvidence(q.difficulty, q.generation.evidence)).toEqual([]);
      console.log(JSON.stringify({ difficulty: q.difficulty, question: q.questionText, reasoningSteps: q.generation.evidence.reasoningSteps.length }));
    }
  }, 300000);

  test('grading, history and topic/difficulty analytics use saved answers; recent questions are excluded', async () => {
    if (!attemptId) throw new Error('Blocked by failed live generation in the preceding test.');
    const attempt = await Attempt.findById(attemptId);
    // Measured analysis must work even when optional commentary is unavailable.
    delete process.env.GEMINI_API_KEY;
    await api('post', `/api/aptitude/attempts/${attemptId}/submit`, candidateToken).send({ responses: attempt.questionSnapshots.map(q => ({ questionId: String(q.questionId), selectedOption: q.correctOption, markedForReview: false, timeSpentSeconds: 20 })) }).expect(200);
    const result = await api('get', `/api/aptitude/attempts/${attemptId}/result`, candidateToken).expect(200);
    expect(result.body).toMatchObject({ score: 6, totalMarks: 6, correctCount: 3, accuracyPercent: 100 });
    expect(result.body.aiAnalysis.difficultyPerformance).toHaveLength(3);
    expect((await api('get', '/api/aptitude/attempts', candidateToken).expect(200)).body.attempts[0].attemptId).toBe(attemptId);
    const Test = require('../dist/models/AptitudeTest').default;
    const template = await Test.findById(testId);
    await expect(require('../dist/services/questionSelector.service').buildQuestionSet(template, attempt.user)).rejects.toThrow('recent history');
    const fail = await api('post', `/api/aptitude/tests/${testId}/start`, candidateToken).send({});
    expect(fail.status).toBe(503);
    expect(await Attempt.countDocuments({ user: attempt.user })).toBe(1);
    process.env.GEMINI_API_KEY = key;
  }, 30000);

  test('disabled or refreshed sources invalidate cached delivery, while saved results remain available', async () => {
    if (!attemptId) throw new Error('Blocked by failed live generation in the preceding test.');
    const usable = require('../dist/services/rag/cache').usableQuestions;
    const questions = await Question.find({ 'generation.topic': 'Python collections' }).lean();
    expect(await usable(questions)).toHaveLength(3);
    await api('patch', `/api/admin/rag/sources/${sourceId}`).send({ enabled: false }).expect(200);
    expect(await usable(questions)).toHaveLength(0);
    await api('get', `/api/aptitude/attempts/${attemptId}/result`, candidateToken).expect(200);
    await api('patch', `/api/admin/rag/sources/${sourceId}`).send({ enabled: true }).expect(200);
    await Source.updateOne({ _id: sourceId }, { $set: { revision: 'replacement-revision' } });
    expect(await usable(questions)).toHaveLength(0);
  }, 15000);

  test('refresh and logout invalidate the prior session', async () => {
    const refresh = await request(app).post('/api/auth/refresh').send({ refreshToken: candidateRefresh }).expect(200);
    candidateToken = refresh.body.data.accessToken;
    await api('post', '/api/auth/logout', candidateToken).send({}).expect(200);
    await api('get', '/api/user/profile', candidateToken).expect(401);
    await request(app).post('/api/auth/refresh').send({ refreshToken: refresh.body.data.refreshToken }).expect(401);
  }, 15000);
});
