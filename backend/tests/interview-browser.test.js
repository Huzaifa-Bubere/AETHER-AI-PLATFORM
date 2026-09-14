const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

function loadStore() {
  const service = { startInterview: jest.fn(async id => ({ success: true, data: { interviewId: id } })),
    getInterview: jest.fn(async id => ({ success: true, data: { id, questions: [{ id: 'q1' }] } })),
    getNextQuestion: jest.fn(async () => ({ success: true, data: { id: 'q1' } })),
    submitResponse: jest.fn(async () => ({ success: false, error: 'Save failed' })) };
  const source = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/app/stores/interviewStore.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, console, require: name => name === 'zustand'
    ? require('../../frontend/node_modules/zustand') : { interviewService: service } });
  return { store: exports.useInterviewStore, service };
}
test('starting another interview replaces stale questions and duplicate starts share one request', async () => {
  const { store, service } = loadStore();
  store.setState({ currentInterview: { id: 'old', questions: [] }, currentQuestion: { id: 'old-question' } });
  await Promise.all([store.getState().startInterview('new'), store.getState().startInterview('new')]);
  expect(service.startInterview).toHaveBeenCalledTimes(1);
  expect(store.getState().currentInterview.id).toBe('new');
  expect(store.getState().currentQuestion.id).toBe('q1');
});
test('failed saves reject and next-question failures preserve the current question', async () => {
  const { store, service } = loadStore();
  await store.getState().startInterview('one');
  await expect(store.getState().submitResponse({ answer: 'Example' })).rejects.toThrow('Save failed');
  service.getNextQuestion.mockResolvedValue({ success: false, error: 'Network error' });
  await expect(store.getState().getNextQuestion()).rejects.toThrow('Network error');
  expect(store.getState().currentQuestion.id).toBe('q1');
});
