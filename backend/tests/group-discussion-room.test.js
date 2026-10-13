/**
 * Group Discussion room behaviour.
 *
 * Two real defects are locked here, both of which made the feature look broken:
 *
 * 1. TURN DEADLOCK. The room only showed the composer when the last turn was an
 *    AI turn. When the AI service returned nothing (no key, quota, outage) the
 *    discussion could not continue at all — with zero turns the candidate could
 *    never type a first point. The server must keep the turn usable and report
 *    `aiReplied: false` so the UI can explain itself instead of looking stuck.
 *
 * 2. FABRICATED EVIDENCE. Ending a room in which the candidate never spoke
 *    stored `overallScore: 0` + a `GROUP_DISCUSSION_COMPLETED` activity event.
 *    The dashboard counted that as "1 completed discussion, latest score 0/100".
 *    A discussion with no candidate turn is now abandoned, not scored.
 *
 * The session document, the local storage boundary and the AI helpers are
 * mocked, so this is a routing/behaviour test with no database and no network.
 */

process.env.JWT_ACCESS_SECRET = 'gd-room-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'gd-room-test-refresh-secret';

const os = require('os');
const mongoose = require('mongoose');
const request = require('supertest');
const User = require('../dist/models/User').default;
const { generateTokens } = require('../dist/utils/auth');
const gdService = require('../dist/groupDiscussion/services/groupDiscussion.service');
const activityService = require('../dist/services/activity.service');
const localStorageService = require('../dist/services/localStorage').default;
const cloudinaryService = require('../dist/services/cloudinary').default;
const { GroupDiscussionSession } = require('../dist/groupDiscussion/models/GroupDiscussionSession');
const app = require('../dist/app').createApp();

const ME = '507f1f77bcf86cd799439011';
const SESSION_ID = '507f1f77bcf86cd799439012';

function auth() {
  jest.replaceProperty(mongoose.connection, '_readyState', 1);
  jest.spyOn(User, 'findById').mockResolvedValue({
    _id: ME,
    email: 'gd@example.test',
    auth: { role: 'user', tokenVersion: 0 },
    subscription: { plan: 'free' },
    isAccountLocked: () => false,
  });
  return `Bearer ${generateTokens(ME).accessToken}`;
}

function fakeSession(overrides = {}) {
  return {
    _id: SESSION_ID,
    userId: ME,
    topicSnapshot: {
      title: 'Scaling a monolith',
      description: 'How would you scale a monolith?',
      keywords: ['cache', 'database'],
      category: 'TECHNOLOGY',
      difficulty: 'INTERMEDIATE',
    },
    roleSlug: 'backend-developer',
    difficulty: 'INTERMEDIATE',
    durationMinutes: 10,
    participants: [{ id: 'aarav', name: 'Aarav', style: 'analytical' }],
    turns: [],
    status: 'IN_PROGRESS',
    startedAt: new Date(),
    recordingConsent: false,
    candidateMetrics: {},
    scoreBreakdown: {},
    overallScore: undefined,
    feedback: null,
    markModified: jest.fn(),
    save: jest.fn(async function save() { return this; }),
    ...overrides,
  };
}

const own = (session) => jest.spyOn(GroupDiscussionSession, 'findOne').mockResolvedValue(session);

afterEach(() => jest.restoreAllMocks());

describe('GD room — the candidate can always speak', () => {
  test('a turn is stored and the discussion stays usable when the AI cannot reply', async () => {
    const session = fakeSession();
    own(session);
    jest.spyOn(gdService, 'nextAiTurn').mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/group-discussion/sessions/${SESSION_ID}/turns`)
      .set('Authorization', auth())
      .send({ text: 'I would start by caching the hot read path.', source: 'VOICE', durationSeconds: 12 });

    expect(res.status).toBe(200);
    // The UI needs to know the participants are silent, not that the app broke.
    expect(res.body.aiReplied).toBe(false);
    expect(session.turns).toHaveLength(1);
    expect(session.turns[0]).toMatchObject({
      speakerType: 'CANDIDATE',
      speakerName: 'You',
      text: 'I would start by caching the hot read path.',
      source: 'VOICE',
      durationSeconds: 12,
      sequence: 1,
    });
    expect(session.save).toHaveBeenCalled();
  });

  test('the first point of a brand-new discussion is accepted with no AI opening', async () => {
    // Previously this returned a session with zero turns and no way to speak.
    const session = fakeSession({ turns: [] });
    own(session);
    jest.spyOn(gdService, 'nextAiTurn').mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/group-discussion/sessions/${SESSION_ID}/turns`)
      .set('Authorization', auth())
      .send({ text: 'Let me open the discussion.', source: 'TEXT' });

    expect(res.status).toBe(200);
    expect(session.turns).toHaveLength(1);
  });

  test('an AI participant that does reply is appended and reported', async () => {
    const session = fakeSession();
    own(session);
    jest.spyOn(gdService, 'nextAiTurn').mockResolvedValue('Caching helps, but invalidation is the hard part.');

    const res = await request(app)
      .post(`/api/group-discussion/sessions/${SESSION_ID}/turns`)
      .set('Authorization', auth())
      .send({ text: 'I would cache the hot read path.', source: 'TEXT' });

    expect(res.status).toBe(200);
    expect(res.body.aiReplied).toBe(true);
    expect(session.turns).toHaveLength(2);
    expect(session.turns[1]).toMatchObject({
      speakerType: 'AI',
      speakerName: 'Aarav',
      source: 'VOICE',
      text: 'Caching helps, but invalidation is the hard part.',
      sequence: 2,
    });
  });

  test('a turn in an inactive discussion is refused', async () => {
    own(fakeSession({ status: 'COMPLETED' }));
    const res = await request(app)
      .post(`/api/group-discussion/sessions/${SESSION_ID}/turns`)
      .set('Authorization', auth())
      .send({ text: 'One more point.' });
    expect(res.status).toBe(409);
  });

  test('a turn after the time limit is refused with a clear reason', async () => {
    own(fakeSession({ startedAt: new Date(Date.now() - 11 * 60 * 1000) }));
    const res = await request(app)
      .post(`/api/group-discussion/sessions/${SESSION_ID}/turns`)
      .set('Authorization', auth())
      .send({ text: 'One more point.' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/time has expired/i);
  });
});

describe('GD room — ending a discussion only records real evidence', () => {
  test('a discussion the candidate never spoke in is abandoned, not scored', async () => {
    const session = fakeSession({ turns: [] });
    own(session);
    const record = jest.spyOn(activityService, 'recordActivity').mockResolvedValue(undefined);

    const res = await request(app)
      .post(`/api/group-discussion/sessions/${SESSION_ID}/end`)
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.recordedEvidence).toBe(false);
    expect(session.status).toBe('ABANDONED');
    expect(session.overallScore).toBeUndefined();
    expect(session.scoreBreakdown).toEqual({});
    expect(session.candidateMetrics.candidateTurns).toBe(0);
    expect(record).not.toHaveBeenCalled();
  });

  test('a discussion with a candidate contribution is scored and recorded', async () => {
    const session = fakeSession({
      turns: [
        {
          speakerType: 'CANDIDATE',
          speakerName: 'You',
          text: 'We should cache the hot database path and measure the hit rate before scaling out.',
          durationSeconds: 22,
          sequence: 1,
        },
      ],
    });
    own(session);
    const record = jest.spyOn(activityService, 'recordActivity').mockResolvedValue(undefined);
    jest.spyOn(gdService, 'qualitativeFeedback').mockResolvedValue({
      strengths: ['Concrete example'],
      improvements: [],
      recommendations: [],
      summary: 'Clear opening.',
    });

    const res = await request(app)
      .post(`/api/group-discussion/sessions/${SESSION_ID}/end`)
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.recordedEvidence).toBe(true);
    expect(session.status).toBe('COMPLETED');
    expect(typeof session.overallScore).toBe('number');
    expect(session.candidateMetrics.candidateTurns).toBe(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'GROUP_DISCUSSION_COMPLETED', entityId: SESSION_ID }),
    );
  });

  test('ending twice does not score or record a second time', async () => {
    const session = fakeSession({ status: 'COMPLETED', overallScore: 61, turns: [] });
    own(session);
    const record = jest.spyOn(activityService, 'recordActivity').mockResolvedValue(undefined);

    const res = await request(app)
      .post(`/api/group-discussion/sessions/${SESSION_ID}/end`)
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(session.overallScore).toBe(61);
    expect(record).not.toHaveBeenCalled();
  });
});

describe('GD room — recording is consent-gated and stores real audio', () => {
  test('uploading a recording without consent is refused', async () => {
    own(fakeSession({ recordingConsent: false }));
    const res = await request(app)
      .post(`/api/group-discussion/sessions/${SESSION_ID}/recording`)
      .set('Authorization', auth())
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('not-really-audio'));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/not consented/i);
  });

  test('consent without a captured file stores nothing', async () => {
    const session = fakeSession({ recordingConsent: true });
    own(session);
    const res = await request(app)
      .post(`/api/group-discussion/sessions/${SESSION_ID}/recording`)
      .set('Authorization', auth())
      .field('durationSeconds', '9');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/recorded audio file is required/i);
    expect(session.recording).toBeUndefined();
  });

  test('a real audio upload is stored under a server-issued key, never a client-supplied one', async () => {
    const session = fakeSession({ recordingConsent: true });
    own(session);
    jest.spyOn(localStorageService, 'ensureRecordingDir').mockResolvedValue(os.tmpdir());
    jest
      .spyOn(localStorageService, 'adoptRecordingFile')
      .mockResolvedValue({ publicId: 'videos/recording_gd_1.webm', filePath: os.tmpdir() });
    jest.spyOn(cloudinaryService, 'isHealthy').mockReturnValue(false);

    const res = await request(app)
      .post(`/api/group-discussion/sessions/${SESSION_ID}/recording`)
      .set('Authorization', auth())
      // A malicious client tries to claim its own storage key and size.
      .field('storageKey', 'client-invented-key')
      .field('sizeBytes', '999999999')
      .field('durationSeconds', '14')
      .attach('recording', Buffer.from('real-audio-bytes'), {
        filename: 'group-discussion.webm',
        contentType: 'audio/webm',
      });

    expect(res.status).toBe(201);
    expect(localStorageService.adoptRecordingFile).toHaveBeenCalled();
    expect(session.recording.storageKey).toBe('videos/recording_gd_1.webm');
    expect(session.recording.durationSeconds).toBe(14);
    expect(session.recording.contentType).toBe('audio/webm');
    // Size comes from the actual file, not the request body.
    expect(session.recording.sizeBytes).toBe(Buffer.from('real-audio-bytes').length);
    expect(res.body.data.storageKey).toBe('videos/recording_gd_1.webm');
  });

  test('recording cannot be attached after the discussion is completed', async () => {
    own(fakeSession({ recordingConsent: true, status: 'COMPLETED' }));
    const res = await request(app)
      .post(`/api/group-discussion/sessions/${SESSION_ID}/recording`)
      .set('Authorization', auth())
      .attach('recording', Buffer.from('real-audio-bytes'), {
        filename: 'late.webm',
        contentType: 'audio/webm',
      });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/completed/i);
  });
});

describe('GD room — access control', () => {
  test('every room action requires a token', async () => {
    const paths = [
      ['post', `/api/group-discussion/sessions/${SESSION_ID}/turns`],
      ['post', `/api/group-discussion/sessions/${SESSION_ID}/end`],
      ['post', `/api/group-discussion/sessions/${SESSION_ID}/recording/consent`],
      ['get', `/api/group-discussion/sessions/${SESSION_ID}`],
    ];
    for (const [method, url] of paths) {
      const res = await request(app)[method](url);
      expect(res.status).toBe(401);
    }
  });

  test('a session that does not belong to the caller is reported as not found', async () => {
    jest.replaceProperty(mongoose.connection, '_readyState', 1);
    jest.spyOn(User, 'findById').mockResolvedValue({
      _id: ME,
      email: 'gd@example.test',
      auth: { role: 'user', tokenVersion: 0 },
      subscription: { plan: 'free' },
      isAccountLocked: () => false,
    });
    const find = jest.spyOn(GroupDiscussionSession, 'findOne').mockResolvedValue(null);
    const res = await request(app)
      .post(`/api/group-discussion/sessions/${SESSION_ID}/end`)
      .set('Authorization', `Bearer ${generateTokens(ME).accessToken}`);
    expect(res.status).toBe(404);
    // Ownership is always part of the lookup — never a bare id.
    expect(find.mock.calls[0][0]).toMatchObject({ userId: ME });
  });
});
