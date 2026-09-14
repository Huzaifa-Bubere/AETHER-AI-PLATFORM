const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const User = require('../dist/models/User').default;
const { generateTokens, verifyToken } = require('../dist/utils/auth');
const { validateInput } = require('../dist/middleware/sanitizer');
const { authenticateToken } = require('../dist/middleware/auth');

const id = '507f1f77bcf86cd799439011';
process.env.JWT_ACCESS_SECRET = 'audit-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'audit-test-refresh-secret';
const app = require('../dist/app').createApp();
afterEach(() => jest.restoreAllMocks());

test.each(['password-reset', 'email-verification', 'refresh', undefined])('access verification rejects %s tokens', (type) => {
  const token = jwt.sign({ userId: id, tokenVersion: 0, type }, process.env.JWT_ACCESS_SECRET);
  expect(() => verifyToken(token, process.env.JWT_ACCESS_SECRET)).toThrow();
});
test('access and refresh tokens preserve purpose and session version', () => {
  const tokens = generateTokens(id, 3);
  expect(verifyToken(tokens.accessToken, process.env.JWT_ACCESS_SECRET).tokenVersion).toBe(3);
  expect(verifyToken(tokens.refreshToken, process.env.JWT_REFRESH_SECRET, 'refresh').type).toBe('refresh');
});
test('sanitization preserves exact passwords/code and tolerates hasOwnProperty input', () => {
  const body = { password: ' Onclick=123 ', code: 'const money=1; const only=2;', hasOwnProperty: 'text' };
  const next = jest.fn();
  validateInput({ body, query: Object.create(null), params: {} }, {}, next);
  expect(next).toHaveBeenCalledTimes(1);
  expect(body.password).toBe(' Onclick=123 ');
  expect(body.code).toBe('const money=1; const only=2;');
});
test('query operators are rejected without rewriting an Express 5 query getter', () => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  validateInput({ body: { email: { $ne: null } }, get query() { return {}; } }, res, next);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(next).not.toHaveBeenCalled();
});
test('placeholder identity endpoints never report verification success or mutate users', async () => {
  const find = jest.spyOn(User, 'findOne');
  expect((await request(app).post('/api/auth/create-profile').send({ email: 'victim@example.com' })).status).toBe(410);
  const otp = await request(app).post('/api/auth/verify-otp').send({ email: 'victim@example.com', otp: '123456' });
  expect(otp.status).toBe(501);
  expect(otp.body.success).toBe(false);
  expect(find).not.toHaveBeenCalled();
});
test('locked accounts and revoked sessions cannot refresh', async () => {
  const tokens = generateTokens(id, 0);
  const user = { _id: id, auth: { tokenVersion: 0 }, isAccountLocked: () => true };
  jest.spyOn(User, 'findById').mockResolvedValue(user);
  expect((await request(app).post('/api/auth/refresh').send({ refreshToken: tokens.refreshToken })).status).toBe(401);
  user.isAccountLocked = () => false;
  user.auth.tokenVersion = 1;
  expect((await request(app).post('/api/auth/refresh').send({ refreshToken: tokens.refreshToken })).status).toBe(401);
});
test('revoked access token fails authentication against the account version', async () => {
  jest.replaceProperty(mongoose.connection, '_readyState', 1);
  jest.spyOn(User, 'findById').mockResolvedValue({ auth: { tokenVersion: 1 } });
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  await authenticateToken({ headers: { authorization: `Bearer ${generateTokens(id).accessToken}` }, query: {} }, res, next);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});
test('plus addressing and long TLDs validate in the model', () => {
  const user = new User({ email: 'audit+test@example.technology', password: 'example123', profile: { firstName: 'Audit', lastName: 'Test' } });
  expect(user.validateSync()).toBeUndefined();
});
