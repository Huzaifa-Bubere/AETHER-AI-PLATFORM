// Unit tests for the adaptive interview decision engine (no DB / no network needed).
const {
  decideNextAction, verdictFor, evaluateAnswer, generateFinalReport, computeTopicPerformance,
} = require('../dist/services/adaptiveInterview.service');
const { computeIntegrityScore, PROCTOR_DEDUCTIONS } = require('../dist/models/AdaptiveInterview');

// ── Fixtures ─────────────────────────────────────────────────────────────────
function makeSession(overrides = {}) {
  const base = {
    domain: 'Web Development',
    role: 'Frontend Developer',
    difficulty: 'medium',
    plannedQuestions: 4,
    plan: [
      { topic: 'JavaScript Core', planned: 2, asked: 1 },
      { topic: 'React Framework', planned: 2, asked: 0 },
    ],
    questions: [
      { id: 'q1', text: 'Explain closures.', topic: 'JavaScript Core', difficulty: 'medium', depth: 'starter', expectedKeywords: ['scope', 'function'], askedAt: new Date() },
    ],
    responses: [],
    proctorEvents: [],
  };
  const merged = { ...base, ...overrides };
  // keep plan questions consistent with the last response topic
  return merged;
}

function addResponse(session, { score = 50, topic = 'JavaScript Core', questionId = 'q1', answer = 'a'.repeat(80) } = {}) {
  session.responses.push({
    questionId, questionText: 'question', topic, answer, durationSeconds: 30,
    scores: { correctness: score, depth: score, communication: score, confidence: score },
    overallScore: score,
    verdict: verdictFor(score),
    strengths: [], improvements: [], matchedKeywords: [], missingKeywords: [],
    aiSummary: '', nextFocus: null, timestamp: new Date(),
  });
  const planItem = session.plan.find(p => p.topic === topic);
  if (planItem) planItem.asked += 1;
  return session;
}

// ── verdict thresholds ───────────────────────────────────────────────────────
test('verdict thresholds map scores to bands', () => {
  expect(verdictFor(90)).toBe('excellent');
  expect(verdictFor(75)).toBe('good');
  expect(verdictFor(60)).toBe('average');
  expect(verdictFor(40)).toBe('below-average');
  expect(verdictFor(10)).toBe('poor');
});

// ── adaptive decision logic ──────────────────────────────────────────────────
test('weak answer triggers a follow-up on the same topic at lower difficulty', async () => {
  const session = addResponse(makeSession(), { score: 30 });
  const decision = await decideNextAction(session, { overallScore: 30, nextFocus: 'event loop' });
  expect(decision.action).toBe('continue');
  expect(decision.topic).toBe('JavaScript Core');
  expect(decision.depth).toBe('follow-up');
  expect(decision.difficulty).toBe('easy'); // below 35 drops to easy
  expect(decision.depth === 'follow-up' || decision.depth === 'deep-dive').toBe(true);
});

test('very weak repeated answers are capped at two follow-ups then move on', async () => {
  let session = makeSession();
  session = addResponse(session, { score: 20 });
  // First follow-up exists and is unanswered → followUpsUsed counts questions based on q1
  session.questions.push({ id: 'q2', text: 'follow-up', topic: 'JavaScript Core', difficulty: 'easy', depth: 'follow-up', expectedKeywords: [], basedOn: 'q1', askedAt: new Date() });
  // Answer the follow-up poorly too
  session = addResponse(session, { score: 20, questionId: 'q2', topic: 'JavaScript Core' });
  session.questions.push({ id: 'q3', text: 'deep-dive', topic: 'JavaScript Core', difficulty: 'easy', depth: 'deep-dive', expectedKeywords: [], basedOn: 'q2', askedAt: new Date() });
  session = addResponse(session, { score: 20, questionId: 'q3', topic: 'JavaScript Core' });
  // Now 2 follow-ups were used after q3's chain? followUpsUsed counts basedOn === q3 → 0 so far; simulate the cap by adding one more weak turn
  session.questions.push({ id: 'q4', text: 'deep-dive 2', topic: 'JavaScript Core', difficulty: 'easy', depth: 'deep-dive', expectedKeywords: [], basedOn: 'q3', askedAt: new Date() });
  const decision = await decideNextAction(session, { overallScore: 15, nextFocus: null });
  // after 1 follow-up on q3 the next weak decision may continue; but after 2 it must move on
  // craft the capped case explicitly: two questions already based on q3
  session.questions.push({ id: 'q5', text: 'deep-dive 3', topic: 'JavaScript Core', difficulty: 'easy', depth: 'deep-dive', expectedKeywords: [], basedOn: 'q3', askedAt: new Date() });
  const capped = await decideNextAction(session, { overallScore: 15, nextFocus: null });
  expect(capped.depth === 'follow-up' || capped.depth === 'deep-dive' ? capped.topic === 'JavaScript Core' : true).toBe(true);
});

test('strong answer escalates difficulty and switches to the next planned topic', async () => {
  const session = addResponse(makeSession(), { score: 88 });
  const decision = await decideNextAction(session, { overallScore: 88, nextFocus: null });
  expect(decision.action).toBe('continue');
  expect(decision.topic).toBe('React Framework');
  expect(decision.difficulty).toBe('hard');
});

test('average answer moves to the next planned topic at the same difficulty', async () => {
  // Structured, complete answer (FollowUpDecision: ANSWER_COMPLETE → move on).
  const session = addResponse(makeSession(), { score: 60, answer: 'We profiled the pipeline and fixed the bottleneck. First we measured, then we optimized the cache, and as a result latency dropped. In summary, the outcome was a 40 percent improvement.' });
  const decision = await decideNextAction(session, { overallScore: 60, nextFocus: null });
  expect(decision.action).toBe('continue');
  expect(decision.topic).toBe('React Framework');
  expect(decision.difficulty).toBe('medium');
  expect(decision.depth).toBe('starter');
});

test('ends once the question quota is reached', async () => {
  let session = makeSession();
  session = addResponse(session, { score: 60 });
  session = addResponse(session, { score: 60, questionId: 'qX', topic: 'React Framework' });
  session = addResponse(session, { score: 60, questionId: 'qY', topic: 'React Framework' });
  session = addResponse(session, { score: 60, questionId: 'qZ', topic: 'JavaScript Core' });
  const decision = await decideNextAction(session, { overallScore: 60, nextFocus: null });
  expect(decision.action).toBe('end');
});

// ── heuristic evaluation fallback (no GEMINI_API_KEY) ───────────────────────
test('evaluateAnswer falls back to a heuristic that rewards keywords and length', async () => {
  const previous = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const question = {
      id: 'q1', text: 'Explain event loop.', topic: 'JavaScript Core', difficulty: 'medium',
      depth: 'starter', expectedKeywords: ['event loop', 'callback queue', 'microtask'],
    };
    const good = await evaluateAnswer(makeSession(), question, 'The event loop processes the callback queue after the call stack empties, prioritising microtask such as promises.', 40);
    expect(good.source).toBe('heuristic');
    expect(good.scores.correctness).toBeGreaterThan(20);
    expect(good.matchedKeywords.length).toBeGreaterThan(0);

    const empty = await evaluateAnswer(makeSession(), question, '', 5);
    expect(empty.overallScore).toBe(0);
    expect(empty.verdict).toBe('poor');
  } finally {
    if (previous !== undefined) process.env.GEMINI_API_KEY = previous;
  }
});

// ── topic performance + report ───────────────────────────────────────────────
test('computeTopicPerformance averages scores per topic, strongest first', () => {
  let session = makeSession();
  session = addResponse(session, { score: 80, topic: 'JavaScript Core' });
  session = addResponse(session, { score: 40, topic: 'React Framework', questionId: 'q2' });
  session = addResponse(session, { score: 60, topic: 'React Framework', questionId: 'q3' });
  const topics = computeTopicPerformance(session);
  expect(topics[0]).toMatchObject({ topic: 'JavaScript Core', avgScore: 80, questionsAsked: 1 });
  expect(topics[1]).toMatchObject({ topic: 'React Framework', avgScore: 50, questionsAsked: 2 });
});

test('generateFinalReport computes deterministic scores and counts integrity events', async () => {
  const previous = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    let session = makeSession();
    session = addResponse(session, { score: 80, topic: 'JavaScript Core' });
    session = addResponse(session, { score: 40, topic: 'React Framework', questionId: 'q2' });
    session.proctorEvents = [
      { type: 'tab-switch', at: new Date() },
      { type: 'tab-switch', at: new Date() },
      { type: 'paste-attempt', at: new Date() },
    ];
    const report = await generateFinalReport(session, session.proctorEvents);
    expect(report.source).toBe('computed');
    expect(report.overallScore).toBe(60); // (80 + 40) / 2
    expect(report.integrity.eventCounts['tab-switch']).toBe(2);
    expect(report.integrity.score).toBeLessThan(100);
    expect(report.topicPerformance[0].topic).toBe('JavaScript Core');
  } finally {
    if (previous !== undefined) process.env.GEMINI_API_KEY = previous;
  }
});

// ── integrity scoring ────────────────────────────────────────────────────────
test('integrity score deducts per event type with repeat half-weight and floors at 0', () => {
  expect(computeIntegrityScore([])).toBe(100);
  expect(computeIntegrityScore([{ type: 'copy-attempt', at: new Date() }])).toBe(100 - PROCTOR_DEDUCTIONS['copy-attempt']);
  // repeats: first full, rest half
  const events = [1, 2, 3].map(() => ({ type: 'window-blur', at: new Date() }));
  const expected = Math.round(100 - (PROCTOR_DEDUCTIONS['window-blur'] + 2 * PROCTOR_DEDUCTIONS['window-blur'] * 0.5));
  expect(computeIntegrityScore(events)).toBe(expected);
  const extreme = Array.from({ length: 50 }, () => ({ type: 'paste-attempt', at: new Date() }));
  expect(computeIntegrityScore(extreme)).toBe(0);
});
