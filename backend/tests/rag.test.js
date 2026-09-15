const { cleanDocument, chunkDocument, validateSourceUrl, robotsDisallows, isPublicIPv4 } = require('../dist/services/rag/documents');
const { cosineSimilarity, diversify, retrieveContext } = require('../dist/services/rag/retrieval');
const { validateGeneratedMCQ } = require('../dist/services/rag/validation');
const provider = require('../dist/services/ai/provider');
const Source = require('../dist/models/RagSource').default;
const Chunk = require('../dist/models/RagChunk').default;
const axios = require('axios');
const context = [{ id: 'chunk-1', sourceId: 'source-1', title: 'Reference', url: 'https://docs.python.org/3/', text: 'A dictionary maps unique keys to values and permits retrieval by key.', topic: 'Python', score: 1, retrievedAt: new Date() }];
const valid = () => ({ questionText: 'Which Python collection maps unique keys to values?', options: { A: 'dict', B: 'list', C: 'tuple', D: 'set' }, correctOption: 'A', explanation: 'A dictionary associates each unique key with a value, allowing retrieval by that key.', category: 'technical-quiz', difficulty: 'easy', evidence: { reasoningSteps: ['Recall that a dictionary stores key-value pairs.'], concepts: ['dictionaries'] }, citations: [{ chunkId: 'chunk-1', quote: 'A dictionary maps unique keys to values' }] });
afterEach(() => { jest.restoreAllMocks(); delete process.env.RAG_VECTOR_MODE; });

test('source allowlist rejects redirects, credentials and unexpected hosts at input', () => {
  for (const url of ['http://docs.python.org/3/', 'https://127.0.0.1/private', 'https://docs.python.org.evil.example/', 'https://user:secret@docs.python.org/3/', 'https://docs.python.org:444/3/']) expect(() => validateSourceUrl(url)).toThrow();
  expect(validateSourceUrl('https://docs.python.org/3/#section').toString()).toBe('https://docs.python.org/3/');
});
test('robots policy is conservative and honors wildcard exclusions', () => {
  expect(robotsDisallows('User-agent: *\nDisallow: /private/*\n', '/private/chapter')).toBe(true);
  expect(robotsDisallows('Disallow: /private/\n', '/public/')).toBe(false);
  expect(robotsDisallows('Disallow: /private$\n', '/private')).toBe(true);
  expect(robotsDisallows('Disallow: /private$\n', '/private-more')).toBe(false);
});
test('ingestion rejects private, loopback, link-local and reserved resolved addresses', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.2', '192.168.1.1', '169.254.169.254', '100.64.0.1', '198.18.0.1', '::1', '224.0.0.1']) expect(isPublicIPv4(ip)).toBe(false);
  expect(isPublicIPv4('8.8.8.8')).toBe(true);
});
test('document processing removes executable/navigation content and chunks with overlap', () => {
  expect(cleanDocument('<nav>Menu</nav><script>steal()</script><p>Useful &amp; clear</p>')).toBe('Useful & clear');
  const text = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ');
  const chunks = chunkDocument(text, 300, 30);
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.every(c => c.length <= 300)).toBe(true);
  expect(chunks[chunks.length - 1]).toContain('word199');
  expect(() => chunkDocument(text, 300, 300)).toThrow();
});
test('vector ranking reflects geometry and source diversity', () => {
  expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
  expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  expect(cosineSimilarity([0, 0], [1, 0])).toBe(0);
  const rows = [{ sourceId: 'a', score: 1 }, { sourceId: 'a', score: .9 }, { sourceId: 'a', score: .8 }, { sourceId: 'b', score: .7 }];
  expect(diversify(rows, 3).map(r => r.sourceId)).toEqual(['a', 'a', 'b']);
});
test('grounded MCQ validation rejects duplicate options, missing citations, unsupported quotes and difficulty relabeling', () => {
  const expected = { difficulty: 'easy', category: 'technical-quiz' };
  expect(validateGeneratedMCQ(valid(), expected, context).correctOption).toBe('A');
  for (const change of [{ options: { A: 'dict', B: 'DICT', C: 'tuple', D: 'set' } }, { correctOption: ['A', 'B'] }, { citations: [] }, { citations: [{ chunkId: 'chunk-1', quote: 'An invented quotation not present in the source' }] }, { difficulty: 'hard' }, { explanation: '' }]) {
    expect(() => validateGeneratedMCQ({ ...valid(), ...change }, expected, context)).toThrow();
  }
});
test('retrieval with no sources fails before generating embeddings', async () => {
  jest.spyOn(Source, 'find').mockReturnValue({ lean: async () => [] });
  const embed = jest.spyOn(provider, 'embedText');
  await expect(retrieveContext('Missing topic', 'query')).rejects.toMatchObject({ statusCode: 503 });
  expect(embed).not.toHaveBeenCalled();
});
test('exact retrieval ranks actual stored vectors and returns source provenance', async () => {
  process.env.RAG_VECTOR_MODE = 'exact';
  jest.spyOn(Source, 'find').mockReturnValue({ lean: async () => [{ _id: 'source-1', revision: 'r1', title: 'Reference', url: context[0].url }] });
  jest.spyOn(provider, 'embedText').mockResolvedValue([1, 0]);
  jest.spyOn(Chunk, 'find').mockReturnValue({ select: () => ({ limit: () => ({ lean: async () => [{ _id: 'chunk-1', sourceId: 'source-1', text: context[0].text, embedding: [1, 0], retrievedAt: new Date() }] }) }) });
  expect(await retrieveContext('Python', 'dictionary')).toEqual([expect.objectContaining({ id: 'chunk-1', url: context[0].url, score: 1 })]);
});
test('provider failures expose a safe service error, never Axios credentials', async () => {
  const previous = process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY = 'test-key-only';
  try {
    jest.spyOn(axios, 'post').mockRejectedValue({ response: { status: 429 }, config: { headers: { 'x-goog-api-key': 'test-key-only' } } });
    await expect(provider.generateJson('test prompt')).rejects.toMatchObject({ statusCode: 503, message: 'AI service is unavailable. Please retry later.' });
  } finally { if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; }
});
