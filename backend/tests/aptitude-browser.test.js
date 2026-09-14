const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function loadStore() {
  const api = { get: jest.fn(async url => ({ data: { attemptId: url.split('/').pop(), deadline: new Date(Date.now() + 60000), status: 'in-progress',
    questions: [{ _id: 'q1' }, { _id: 'q2' }], responses: ['q1','q2'].map(question => ({ question, selectedOption: null, status: 'not-visited', timeSpentSeconds: 0 })) } })),
    post: jest.fn(async () => ({ data: { saved: true } })) };
  const source = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/store/aptitudeStore.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, Date, require: name => name === 'zustand'
    ? require('../../frontend/node_modules/zustand') : api });
  return { store: exports.useAptitudeStore, api };
}
test('selecting an answer and immediately submitting preserves the answer', async () => {
  const { store, api } = loadStore();
  await store.getState().loadAttempt('attempt1');
  store.getState().selectOption('B');
  await store.getState().submit();
  const [, submitted] = api.post.mock.calls.find(([url]) => url.endsWith('/submit'));
  expect(submitted.responses[0].selectedOption).toBe('B');
  expect(store.getState().submitted).toBe(true);
});
test('a failed save prevents palette navigation and preserves the answer for retry', async () => {
  const { store, api } = loadStore();
  await store.getState().loadAttempt('attempt1');
  api.post.mockRejectedValue(new Error('offline'));
  store.getState().selectOption('A');
  await store.getState().goTo(1);
  expect(store.getState().currentIndex).toBe(0);
  expect(store.getState().responses.q1.selectedOption).toBe('A');
  expect(store.getState().error).toContain('retry');
});
test('loading another attempt clears submitted state', async () => {
  const { store } = loadStore();
  await store.getState().loadAttempt('attempt1');
  await store.getState().submit();
  await store.getState().loadAttempt('attempt2');
  expect(store.getState().submitted).toBe(false);
  expect(store.getState().attemptId).toBe('attempt2');
});


test('an old palette save cannot navigate a newly loaded attempt', async () => {
  const { store, api } = loadStore();
  await store.getState().loadAttempt('old');
  let release;
  api.post.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const navigation = store.getState().goTo(1);
  await Promise.resolve();
  await store.getState().loadAttempt('new');
  release({ data: { saved: true } });
  await navigation;
  expect(store.getState().attemptId).toBe('new');
  expect(store.getState().currentIndex).toBe(0);
  expect(store.getState().saving).toBe(false);
});

test('first question is visited and simultaneous palette clicks cannot skip questions', async () => {
  const { store } = loadStore();
  await store.getState().loadAttempt('attempt');
  expect(store.getState().responses.q1.status).toBe('not-answered');
  await Promise.all([store.getState().goTo(1), store.getState().goTo(0)]);
  expect(store.getState().currentIndex).toBe(1);
});

test('submission does not overwrite other questions with stale local answers', async () => {
  const { store, api } = loadStore();
  await store.getState().loadAttempt('attempt');
  store.getState().selectOption('B');
  await store.getState().goTo(1);
  await store.getState().submit();
  const [, submitted] = api.post.mock.calls.find(([url]) => url.endsWith('/submit'));
  expect(submitted.responses.map(r => r.questionId)).toEqual(['q2']);
});
