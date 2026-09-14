const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const axios = require('axios');

function browserClient() {
  const entries = new Map([['accessToken', 'expired'], ['refreshToken', 'old-refresh']]);
  const localStorage = { getItem: key => entries.get(key), setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
  const window = { dispatchEvent: jest.fn() };
  const source = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/app/services/http.ts'), 'utf8')
    .replace('import.meta.env.VITE_API_BASE_URL', "'/api'");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { require, exports, localStorage, window, Event: class { constructor(type) { this.type = type; } } });
  const make = () => exports.attachAuthentication(axios.create({ adapter: async config => {
    if (config.headers.Authorization !== 'Bearer fresh') throw { config, response: { status: 401 } };
    return { status: 200, data: 'ok', config };
  } }));
  return { make, entries, window };
}
afterEach(() => jest.restoreAllMocks());
test('main and aptitude requests share one refresh and retain both replacement tokens', async () => {
  const refresh = jest.spyOn(axios, 'post').mockImplementation(async () => {
    await new Promise(resolve => setTimeout(resolve, 5));
    return { data: { success: true, data: { accessToken: 'fresh', refreshToken: 'new-refresh' } } };
  });
  const { make, entries } = browserClient();
  const results = await Promise.all([make().get('/user/profile'), make().get('/api/aptitude/tests')]);
  expect(results.map(result => result.status)).toEqual([200, 200]);
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(entries.get('refreshToken')).toBe('new-refresh');
});
test('rejected refresh stops once and expires the browser session', async () => {
  const refresh = jest.spyOn(axios, 'post').mockRejectedValue({ response: { status: 401 } });
  const { make, entries, window } = browserClient();
  await expect(make().get('/user/profile')).rejects.toBeDefined();
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(entries.has('accessToken')).toBe(false);
  expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
});
