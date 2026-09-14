const User = require('../dist/models/User').default;
const Interview = require('../dist/models/Interview').default;
const { generateTokens } = require('../dist/utils/auth');
const { setupSocketHandlers } = require('../dist/services/socket');
const id = '507f1f77bcf86cd799439011';
const interviewId = '507f1f77bcf86cd799439012';
process.env.JWT_ACCESS_SECRET = 'audit-socket-access';
process.env.JWT_REFRESH_SECRET = 'audit-socket-refresh';
afterEach(() => jest.restoreAllMocks());

test('socket packets enforce ownership for rooms and WebRTC signaling', async () => {
  const connections = [];
  let authenticate;
  const io = { use: fn => { authenticate = fn; }, on: (_event, fn) => connections.push(fn) };
  setupSocketHandlers(io);
  const socket = { id: 'audit', handshake: { auth: { token: generateTokens(id).accessToken } }, on: jest.fn(), emit: jest.fn(), use: fn => { socket.guard = fn; } };
  jest.spyOn(User, 'findById').mockResolvedValue({ auth: { tokenVersion: 0 }, isAccountLocked: () => false });
  const exists = jest.spyOn(Interview, 'exists').mockResolvedValue(null);
  const connected = jest.fn();
  await authenticate(socket, connected);
  expect(connected).toHaveBeenCalledWith();
  connections.forEach(fn => fn(socket));
  for (const packet of [['join-interview', interviewId], ['webrtc:offer', { interviewId, offer: {} }]]) {
    const next = jest.fn();
    await socket.guard(packet, next);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
  }
  expect(exists).toHaveBeenCalledWith({ _id: interviewId, userId: id });
  exists.mockResolvedValue({ _id: interviewId });
  const next = jest.fn();
  await socket.guard(['join-interview', interviewId], next);
  expect(next).toHaveBeenCalledWith();
});
