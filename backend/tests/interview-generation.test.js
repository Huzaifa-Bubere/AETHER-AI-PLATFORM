const provider = require('../dist/services/ai/provider');
const service = require('../dist/services/gemini').default;
afterEach(() => jest.restoreAllMocks());
const params = { role: 'Engineer', experienceLevel: 'mid', interviewType: 'technical', difficulty: 'hard', count: 1 };

test.each(['technical', 'behavioral', 'coding', 'system-design', 'skill-based'])('%s uses its own prompt and validates the returned type', async interviewType => {
  const question = { text: 'Explain the requested scenario and its tradeoffs.', type: interviewType, difficulty: 'hard',
    description: 'Implement a solution to the specified problem with explicit input and output.', testCases: [{ input: '1', expectedOutput: '2' }, { input: '2', expectedOutput: '3' }], constraints: ['0 < n < 100'], examples: [{ input: '1', output: '2' }] };
  const generate = jest.spyOn(provider, 'generateJson').mockResolvedValue([question]);
  expect(await service.generateInterviewQuestions({ ...params, interviewType })).toEqual([question]);
  expect(generate.mock.calls[0][0].toLowerCase()).toContain(interviewType === 'system-design' ? 'system design' : interviewType);
  generate.mockResolvedValue([{ ...question, type: 'unrelated' }]);
  await expect(service.generateInterviewQuestions({ ...params, interviewType })).rejects.toMatchObject({ statusCode: 503 });
});

test('a provider outage never substitutes behavioral prompts or a repeated Two Sum problem', async () => {
  jest.spyOn(provider, 'generateJson').mockRejectedValue(new provider.AIUnavailableError());
  for (const interviewType of ['coding', 'technical', 'behavioral']) {
    await expect(service.generateInterviewQuestions({ ...params, interviewType })).rejects.toMatchObject({ statusCode: 503 });
  }
});

test('incorrect difficulty, duplicate stems and coding problems without tests are rejected', async () => {
  const generate = jest.spyOn(provider, 'generateJson');
  const q = { text: 'Explain this question in detail.', type: 'technical', difficulty: 'easy' };
  generate.mockResolvedValue([q]);
  await expect(service.generateInterviewQuestions(params)).rejects.toMatchObject({ statusCode: 503 });
  generate.mockResolvedValue([{ ...q, difficulty: 'hard' }, { ...q, difficulty: 'hard' }]);
  await expect(service.generateInterviewQuestions({ ...params, count: 2 })).rejects.toMatchObject({ statusCode: 503 });
  generate.mockResolvedValue([{ ...q, difficulty: 'hard', type: 'coding' }]);
  await expect(service.generateInterviewQuestions({ ...params, interviewType: 'coding' })).rejects.toMatchObject({ statusCode: 503 });
});
