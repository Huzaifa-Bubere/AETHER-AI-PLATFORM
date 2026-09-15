const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const User = require('../dist/models/User').default;
const { generateTokens } = require('../dist/utils/auth');
const { authenticateToken, optionalAuth, requireCandidate, requireAdmin, requireRole } = require('../dist/middleware/auth');

process.env.JWT_ACCESS_SECRET = 'authorization-test-access-only';
process.env.JWT_REFRESH_SECRET = 'authorization-test-refresh-only';
const id = '507f1f77bcf86cd799439011';
const app = require('../dist/app').createApp();
afterEach(() => jest.restoreAllMocks());

function account(role, plan) {
  jest.replaceProperty(mongoose.connection, '_readyState', 1);
  jest.spyOn(User, 'findById').mockResolvedValue({
    _id: id, email: 'role-test@example.test', auth: { role, tokenVersion: 0 },
    subscription: { plan }, isAccountLocked: () => false,
  });
  return `Bearer ${generateTokens(id).accessToken}`;
}

test.each(['free', 'pro', 'enterprise'])('candidate %s plan never grants admin role', async plan => {
  const header = account('user', plan);
  const api = express();
  api.get('/candidate', authenticateToken, requireCandidate, (req, res) => res.json(req.user));
  api.get('/admin', authenticateToken, requireAdmin, (_req, res) => res.sendStatus(204));
  const candidate = await request(api).get('/candidate').set('Authorization', header);
  expect(candidate.status).toBe(200);
  expect(candidate.body).toMatchObject({ role: 'user', subscriptionPlan: plan });
  expect((await request(api).get('/admin').set('Authorization', header)).status).toBe(403);
});

test('optional authentication uses the database role independently of the subscription', async () => {
  const api = express();
  const header = account('admin', 'free');
  api.get('/', optionalAuth, requireRole('admin'), (req, res) => res.json(req.user));
  expect((await request(api).get('/').set('Authorization', header)).body).toMatchObject({ role: 'admin', subscriptionPlan: 'free' });
});

test.each([
  ['/api/interview/create', 'post'], ['/api/adaptive-interview/create', 'post'],
  ['/api/aptitude/tests', 'get'], ['/api/code/execute', 'post'],
  ['/api/practice/create', 'post'], ['/api/scheduling/schedule', 'post'],
])('admin cannot use candidate endpoint %s', async (url, method) => {
  const header = account('admin', 'enterprise');
  expect((await request(app)[method](url).set('Authorization', header).send({})).status).toBe(403);
});

test('role guards reject missing authentication and unknown roles', () => {
  for (const [user, status] of [[undefined, 401], [{ role: 'enterprise' }, 403], [{}, 403]]) {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    requireCandidate({ user }, res, next);
    expect(res.status).toHaveBeenCalledWith(status);
    expect(next).not.toHaveBeenCalled();
  }
});
