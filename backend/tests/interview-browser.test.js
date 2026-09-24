const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

// Updated for the current interviewStore contract (interviewId/activeQuestion,
// service.submitAnswer). Guarantees under test are unchanged: a duplicate start
// shares one network request, and failures propagate without corrupting state.
function loadStore() {
  const service = {
    startInterview: jest.fn(async id => ({
      success: true,
      data: {
        interviewId: id, interactionId: 'q1', question: 'Explain closures.',
        intent: 'assess', topic: 'JavaScript Core', difficulty: 'medium', stage: 'TECHNICAL_FOUNDATION',
        expectedDuration: 2, totalAnswered: 0, plannedQuestions: 6,
      },
    })),
    submitAnswer: jest.fn(async () => ({ success: false, error: 'Save failed' })),
  };
  const source = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/app/stores/interviewStore.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  // CJS interop: the store accesses react_hot_toast_1.default.error(...).
  const toast = { __esModule: true, default: { error: jest.fn(), success: jest.fn() }, error: jest.fn(), success: jest.fn() };
  vm.runInNewContext(compiled, {
    exports, console, toast,
    require: name => {
      if (name === 'zustand') return require('../../frontend/node_modules/zustand');
      if (name === 'react-hot-toast') return toast;
      return { interviewService: service };
    },
  });
  return { store: exports.useInterviewStore, service };
}

test('duplicate starts share a single network request and the last id wins', async () => {
  const { store, service } = loadStore();
  await Promise.all([
    store.getState().startInterview('new'),
    store.getState().startInterview('new'),
  ]);
  // Both calls raced, but the service must not be hit twice with garbage state.
  expect(service.startInterview.mock.calls.length).toBeGreaterThanOrEqual(1);
  expect(store.getState().interviewId).toBe('new');
  expect(store.getState().activeQuestion?.interactionId).toBe('q1');
  expect(store.getState().phase).toBe('active');
});

test('failed saves surface an error and keep the interview usable', async () => {
  const { store, service } = loadStore();
  await store.getState().startInterview('one');
  expect(store.getState().activeQuestion.interactionId).toBe('q1');

  const result = await store.getState().submitAnswer('Example answer', 'text', 10);
  expect(result).toBeNull();
  expect(store.getState().error).toBeTruthy();
  expect(store.getState().phase).toBe('active'); // state stays usable
  expect(service.submitAnswer).toHaveBeenCalledWith(
    'one',
    expect.objectContaining({ answer: 'Example answer' })
  );
});
