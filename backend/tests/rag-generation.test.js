const provider = require('../dist/services/ai/provider');
const retrieval = require('../dist/services/rag/retrieval');
const Question = require('../dist/models/AptitudeQuestion').default;
const Attempt = require('../dist/models/AptitudeAttempt').default;
const { generateGroundedQuestions } = require('../dist/services/rag/generation');
const params = { topic: 'Python', category: 'technical-quiz', roundType: 'technical', difficulty: 'easy', count: 1, userId: 'test' };
const valid = { questionText: 'Which Python type maps unique keys to values?', options: { A: 'dict', B: 'list', C: 'set', D: 'tuple' }, correctOption: 'A', explanation: 'A dictionary maps unique keys to their associated values.', category: 'technical-quiz', difficulty: 'easy', evidence: { reasoningSteps: ['Recall the mapping behavior of a dictionary.'], concepts: ['dictionaries'] }, citations: [{ chunkId: 'chunk', quote: 'Dictionaries map unique keys to values.' }] };
let create;
beforeEach(() => {
  jest.spyOn(retrieval, 'retrieveContext').mockResolvedValue([{ id: 'chunk', sourceId: 'source', revision: 'r1', title: 'Python', url: 'https://docs.python.org/3/', retrievedAt: new Date(), text: valid.citations[0].quote }]);
  const query = { sort: () => ({ limit: () => ({ select: () => ({ lean: async () => [] }) }) }) };
  jest.spyOn(Question, 'find').mockReturnValue(query);
  jest.spyOn(Attempt, 'find').mockReturnValue(query);
  jest.spyOn(Question, 'init').mockResolvedValue();
  create = jest.spyOn(Question, 'create').mockImplementation(async doc => doc);
});
afterEach(() => jest.restoreAllMocks());

test('one repair of invalid evidence still requires independent review and retains exact provenance', async () => {
  const generate = jest.spyOn(provider, 'generateJson')
    .mockResolvedValueOnce([{ ...valid, evidence: { ...valid.evidence, reasoningSteps: ['First unnecessarily separate step.', 'Second unnecessarily separate step.'] } }])
    .mockResolvedValueOnce([valid])
    .mockResolvedValueOnce({ verdicts: [{ index: 0, correct: true, grounded: true, difficultyMatches: true, topicMatches: true }] });
  const saved = await generateGroundedQuestions(params);
  expect(generate).toHaveBeenCalledTimes(3);
  expect(saved[0].generation.sources[0]).toMatchObject({ sourceId: 'source', revision: 'r1', quote: valid.citations[0].quote });
  expect(create).toHaveBeenCalledTimes(1);
});

test('two invalid batches save nothing and stop regenerating', async () => {
  const generate = jest.spyOn(provider, 'generateJson').mockResolvedValue([{ ...valid, citations: [] }]);
  await expect(generateGroundedQuestions(params)).rejects.toMatchObject({ statusCode: 503 });
  expect(generate).toHaveBeenCalledTimes(2);
  expect(create).not.toHaveBeenCalled();
});

test('exhausted preparation deadline never starts another generation call', async () => {
  const generate = jest.spyOn(provider, 'generateJson');
  await expect(generateGroundedQuestions({ ...params, deadline: Date.now() - 1 })).rejects.toThrow('timed out');
  expect(generate).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
});
