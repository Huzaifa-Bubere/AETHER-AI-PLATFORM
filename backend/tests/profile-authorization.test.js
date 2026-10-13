/**
 * Profile read authorization regression test.
 *
 * `/api/profile/me` returns the CALLER'S OWN profile (`req.user.userId`) and
 * never another account's, so it is not a candidate-only action like taking an
 * assessment. It used to be guarded by `requireCandidate`, which meant an admin
 * — the one role the frontend explicitly opens `/profile` to, via
 * `ProtectedRoute allowAdmin` — got a 403 and the page could only say
 * "Could not load your profile".
 *
 * The profile service is mocked so this stays a pure authorization test: no
 * database, no aggregation work.
 */

const mongoose = require('mongoose');
const request = require('supertest');
const User = require('../dist/models/User').default;
const { generateTokens } = require('../dist/utils/auth');

process.env.JWT_ACCESS_SECRET = 'profile-auth-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'profile-auth-test-refresh-secret';

jest.mock('../dist/services/profile.service', () => ({
  getProfessionalProfile: jest.fn(async (userId) => ({ user: { email: 'caller@example.test' }, userId })),
}));

const { getProfessionalProfile } = require('../dist/services/profile.service');
const app = require('../dist/app').createApp();

const id = '507f1f77bcf86cd799439011';
afterEach(() => jest.clearAllMocks());

function bearer(role) {
  jest.replaceProperty(mongoose.connection, '_readyState', 1);
  jest.spyOn(User, 'findById').mockResolvedValue({
    _id: id,
    email: 'role-test@example.test',
    auth: { role, tokenVersion: 0 },
    subscription: { plan: 'free' },
    isAccountLocked: () => false,
  });
  return `Bearer ${generateTokens(id).accessToken}`;
}

test.each(['user', 'admin'])('an authenticated %s can read their own profile', async (role) => {
  const res = await request(app).get('/api/profile/me').set('Authorization', bearer(role));
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  // The profile is always assembled for the caller's own id, never a supplied one.
  expect(getProfessionalProfile).toHaveBeenCalledWith(id);
});

test('the profile endpoint is not readable without a token', async () => {
  expect((await request(app).get('/api/profile/me')).status).toBe(401);
  expect(getProfessionalProfile).not.toHaveBeenCalled();
});
