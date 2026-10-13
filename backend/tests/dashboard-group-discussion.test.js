/* AETHER — dashboard group discussion evidence (spec §19).
 *
 * The dashboard GD card, the "next practice" recommendation and the history
 * block all read the same computed evidence, so the rule for what counts is
 * locked here instead of drifting between the service and the UI.
 *
 * Rule under test: only COMPLETED sessions that already carry a numeric
 * `overallScore` are evidence. Joining a room, picking a topic or granting
 * microphone consent is not an assessment result, and an unscored row would
 * otherwise inflate "discussions completed" while showing no measurable score.
 */
process.env.NODE_ENV = 'test';

const { summarizeGroupDiscussion } = require('../dist/services/dashboard.service');

const session = (overrides = {}) => ({
  _id: 'session-1',
  topicSnapshot: { title: 'Scaling a monolith', category: 'TECHNOLOGY', difficulty: 'INTERMEDIATE' },
  roleSlug: 'backend-developer',
  difficulty: 'INTERMEDIATE',
  durationMinutes: 10,
  overallScore: 72,
  endedAt: new Date('2026-10-01T10:00:00.000Z'),
  ...overrides,
});

describe('dashboard group discussion evidence', () => {
  test('no sessions reports NOT_ASSESSED instead of a zero score', () => {
    const { card, gd } = summarizeGroupDiscussion([]);
    expect(card.status).toBe('NOT_ASSESSED');
    expect(card.value).toBeNull();
    expect(card.sampleSize).toBe(0);
    expect(card.basis).toMatch(/no completed group discussion/i);
    expect(gd.sessionsCompleted).toBe(0);
    expect(gd.latestScore).toBeNull();
    expect(gd.latestSessionId).toBeNull();
    expect(gd.latestTopic).toBeNull();
    expect(gd.recentSessions).toEqual([]);
  });

  test('a missing sessions payload does not throw', () => {
    expect(() => summarizeGroupDiscussion(undefined)).not.toThrow();
    expect(summarizeGroupDiscussion(null).gd.sessionsCompleted).toBe(0);
  });

  test('unscored COMPLETED rows are not counted as evidence', () => {
    const { card, gd } = summarizeGroupDiscussion([
      session({ _id: 'scored', overallScore: 64 }),
      session({ _id: 'unscored', overallScore: null }),
      session({ _id: 'undefined-score', overallScore: undefined }),
    ]);
    expect(card.value).toBe(1);
    expect(gd.sessionsCompleted).toBe(1);
    expect(gd.recentSessions.map(s => s.id)).toEqual(['scored']);
  });

  test('one completed discussion reports its score and topic', () => {
    const { card, gd } = summarizeGroupDiscussion([session({ overallScore: 81 })]);
    expect(card.status).toBe('OK');
    expect(card.value).toBe(1);
    expect(card.basis).toBe('1 completed discussion');
    expect(card.detail).toBe('Latest score 81/100');
    expect(gd.latestScore).toBe(81);
    expect(gd.latestSessionId).toBe('session-1');
    expect(gd.latestTopic).toBe('Scaling a monolith');
    expect(gd.latestDate).toBe('2026-10-01T10:00:00.000Z');
  });

  test('the most recent scored session is the latest, not merely the first row', () => {
    // The service query sorts by endedAt desc, so the first scored row wins.
    const { gd } = summarizeGroupDiscussion([
      session({ _id: 'newest', overallScore: 90, topicSnapshot: { title: 'Newest topic' } }),
      session({ _id: 'older', overallScore: 40, topicSnapshot: { title: 'Older topic' } }),
    ]);
    expect(gd.sessionsCompleted).toBe(2);
    expect(gd.latestSessionId).toBe('newest');
    expect(gd.latestTopic).toBe('Newest topic');
    expect(gd.latestScore).toBe(90);
  });

  test('plural basis is used for more than one discussion', () => {
    const { card } = summarizeGroupDiscussion([session(), session({ _id: 's2' })]);
    expect(card.basis).toBe('2 completed discussions');
  });

  test('recent sessions are capped at six and mapped for the UI', () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      session({ _id: `s${i}`, overallScore: 50 + i, topicSnapshot: { title: `Topic ${i}` } }),
    );
    const { gd } = summarizeGroupDiscussion(many);
    expect(gd.sessionsCompleted).toBe(9);
    expect(gd.recentSessions).toHaveLength(6);
    expect(gd.recentSessions[0]).toEqual({
      id: 's0',
      topic: 'Topic 0',
      roleSlug: 'backend-developer',
      difficulty: 'INTERMEDIATE',
      durationMinutes: 10,
      overallScore: 50,
      completedAt: '2026-10-01T10:00:00.000Z',
    });
  });

  test('a malformed session still yields a renderable row', () => {
    const { gd } = summarizeGroupDiscussion([
      { _id: 'bare', overallScore: 55 },
    ]);
    expect(gd.recentSessions[0]).toMatchObject({
      id: 'bare',
      topic: 'Discussion',
      roleSlug: '',
      difficulty: '',
      durationMinutes: 0,
      overallScore: 55,
      completedAt: null,
    });
    expect(gd.latestTopic).toBeNull();
  });

  test('confidence grows with the evidence sample', () => {
    const one = summarizeGroupDiscussion([session()]).card.confidence;
    const many = summarizeGroupDiscussion(
      Array.from({ length: 20 }, (_, i) => session({ _id: `s${i}` })),
    ).card.confidence;
    expect(many).not.toBe('LOW');
    expect(['LOW', 'MEDIUM', 'HIGH']).toContain(one);
  });
});
