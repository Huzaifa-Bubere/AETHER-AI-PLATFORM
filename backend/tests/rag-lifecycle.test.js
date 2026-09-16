const { Types } = require('mongoose');
const Source = require('../dist/models/RagSource').default;
const Chunk = require('../dist/models/RagChunk').default;
const provider = require('../dist/services/ai/provider');
const { usableQuestions } = require('../dist/services/rag/cache');
const { claimIngestion, runIngestion } = require('../dist/services/rag/ingestion');
afterEach(() => jest.restoreAllMocks());

test('cached questions require unexpired citations to enabled current source revisions', async () => {
  const id = String(new Types.ObjectId());
  const bank = { questionText: 'Authored bank question' };
  const cached = { generation: { expiresAt: new Date(Date.now() + 60000), sources: [{ chunkId: id }] } };
  jest.spyOn(Chunk, 'find').mockReturnValue({ select: () => ({ lean: async () => [{ _id: id, sourceId: 'source', revision: 'old' }] }) });
  const sources = jest.spyOn(Source, 'find').mockReturnValue({ select: () => ({ lean: async () => [{ _id: 'source', revision: 'old' }] }) });
  expect(await usableQuestions([bank, cached])).toEqual([bank, cached]);
  sources.mockReturnValue({ select: () => ({ lean: async () => [{ _id: 'source', revision: 'new' }] }) });
  expect(await usableQuestions([bank, cached])).toEqual([bank]);
  sources.mockReturnValue({ select: () => ({ lean: async () => [] }) });
  expect(await usableQuestions([bank, cached])).toEqual([bank]);
});

test('generated questions with missing or expired provenance cannot masquerade as bank questions', async () => {
  jest.spyOn(Chunk, 'find').mockReturnValue({ select: () => ({ lean: async () => [] }) });
  jest.spyOn(Source, 'find').mockReturnValue({ select: () => ({ lean: async () => [] }) });
  expect(await usableQuestions([{ generation: {} }, { generation: { expiresAt: new Date(0), sources: [] } }])).toEqual([]);
});

test('ingestion cannot start without an atomic lease', async () => {
  jest.spyOn(Source, 'findOneAndUpdate').mockResolvedValue(null);
  await expect(claimIngestion(String(new Types.ObjectId()))).rejects.toMatchObject({ statusCode: 409 });
});

test('a stale worker cannot replace a newer revision and removes only its own unpublished chunks', async () => {
  const source = { _id: new Types.ObjectId(), topic: 'Test', url: 'https://docs.python.org/3/' };
  jest.spyOn(provider, 'embedText').mockResolvedValue([1, 0]);
  const create = jest.spyOn(Chunk, 'create').mockResolvedValue({});
  const clean = jest.spyOn(Chunk, 'deleteMany').mockResolvedValue({ deletedCount: 1 });
  const update = jest.spyOn(Source, 'updateOne').mockResolvedValue({ modifiedCount: 0 });
  await expect(runIngestion({ source, leaseOwner: 'old-worker' }, 'Original reference text for the import. '.repeat(10))).rejects.toMatchObject({ statusCode: 503 });
  expect(update.mock.calls.every(([filter]) => filter.leaseOwner === 'old-worker')).toBe(true);
  expect(clean).toHaveBeenCalledWith({ sourceId: source._id, revision: create.mock.calls[0][0].revision });
});
