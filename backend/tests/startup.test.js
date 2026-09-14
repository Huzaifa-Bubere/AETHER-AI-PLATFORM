const { validateEnvironment } = require('../dist/config/environment');

describe('startup configuration', () => {
  const valid = { MONGODB_URI: 'mongodb://localhost/audit', JWT_ACCESS_SECRET: 'test-access', JWT_REFRESH_SECRET: 'test-refresh' };
  test('reports missing configuration without exposing values', () => {
    expect(() => validateEnvironment({})).toThrow('Missing required configuration: MONGODB_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET');
  });
  test('rejects invalid ports and reused signing secrets', () => {
    expect(() => validateEnvironment({ ...valid, PORT: '5001bad' })).toThrow('PORT');
    expect(() => validateEnvironment({ ...valid, JWT_REFRESH_SECRET: 'test-access' })).toThrow('must be different');
    expect(() => validateEnvironment(valid)).not.toThrow();
    expect(() => validateEnvironment({ ...valid, DNS_SERVERS: 'invalid.example' })).toThrow('DNS_SERVERS');
    expect(() => validateEnvironment({ ...valid, DNS_SERVERS: '1.1.1.1,8.8.8.8' })).not.toThrow();
  });
});

describe('code execution containment', () => {
  const executor = require('../dist/services/codeExecution').default;
  const oldEnv = { ...process.env };
  afterEach(() => { process.env = { ...oldEnv }; jest.restoreAllMocks(); });
  test.each(['production', 'development'])('%s never falls back to host execution by default', async (mode) => {
    process.env.NODE_ENV = mode;
    delete process.env.ALLOW_UNSAFE_LOCAL_CODE_EXECUTION;
    const local = jest.spyOn(executor, 'executeLocally');
    jest.spyOn(executor, 'executeWithPiston').mockRejectedValue(new Error('unavailable'));
    const result = await executor.execute({ language: 'python', code: 'print(1)' });
    expect(result.success).toBe(false);
    expect(local).not.toHaveBeenCalled();
  });
  test('production ignores an unsafe local opt-in', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_UNSAFE_LOCAL_CODE_EXECUTION = 'true';
    const result = await executor.executeLocally({ language: 'python', code: 'print(1)' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('disabled');
  });
});
