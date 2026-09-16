import { randomUUID } from 'crypto';
import RagSource from '../../models/RagSource';
import RagChunk from '../../models/RagChunk';
import { embedText, embeddingModel } from '../ai/provider';
import { chunkDocument, cleanDocument, contentHash, fetchDocument } from './documents';
import logger from '../../utils/logger';

export async function claimIngestion(sourceId: string) {
  const leaseOwner = randomUUID();
  const source = await RagSource.findOneAndUpdate({ _id: sourceId, enabled: true,
    $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lt: new Date() } }] },
  { $set: { status: 'ingesting', leaseOwner, leaseUntil: new Date(Date.now() + 10 * 60000) } }, { new: true });
  if (!source) throw Object.assign(new Error('Source unavailable or ingestion already in progress.'), { statusCode: 409 });
  return { source, leaseOwner };
}

export async function ingestSource(sourceId: string, suppliedText?: string) {
  return runIngestion(await claimIngestion(sourceId), suppliedText);
}

export async function runIngestion(claim: Awaited<ReturnType<typeof claimIngestion>>, suppliedText?: string) {
  const { source, leaseOwner } = claim;
  const sourceId = String(source._id), revision = randomUUID();
  const owned = { _id: source._id, leaseOwner };
  try {
    const raw = suppliedText ?? await fetchDocument(source.url);
    if (Buffer.byteLength(raw) > 1024 * 1024) throw new Error('Source exceeds the 1 MB ingestion limit.');
    const clean = cleanDocument(raw);
    if (clean.length < 200) throw new Error('Source contains too little readable content.');
    const chunks = chunkDocument(clean);
    if (chunks.length > 24) throw new Error('Import a focused section with at most 24 chunks.');
    const retrievedAt = new Date();
    // Keep the previous revision active until every new embedding is stored.
    for (let ordinal = 0; ordinal < chunks.length; ordinal++) {
      const embedding = await embedText(chunks[ordinal], 'RETRIEVAL_DOCUMENT');
      await RagChunk.create({ sourceId: source._id, revision, ordinal, topic: source.topic,
        text: chunks[ordinal], hash: contentHash(chunks[ordinal]), embedding, embeddingModel: embeddingModel(), retrievedAt });
    }
    const activated = await RagSource.updateOne({ ...owned, enabled: true }, { $set: { revision, status: 'ready', chunkCount: chunks.length,
      refreshedAt: retrievedAt, embeddingModel: embeddingModel() }, $unset: { lastError: 1, leaseUntil: 1, leaseOwner: 1 } });
    if (!activated.modifiedCount) throw new Error('Ingestion lease was replaced or source disabled.');
    logger.info('rag.ingestion.complete', { sourceId, chunks: chunks.length });
    return { sourceId, status: 'ready', chunkCount: chunks.length };
  } catch (error: any) {
    await RagChunk.deleteMany({ sourceId: source._id, revision });
    await RagSource.updateOne(owned, { $set: { status: 'failed', lastError: 'Ingestion failed; verify source access, size and embedding provider.' }, $unset: { leaseUntil: 1, leaseOwner: 1 } });
    logger.warn('rag.ingestion.failed', { sourceId, errorType: error.name });
    throw Object.assign(new Error('Ingestion failed. Check source access, content size and embedding configuration.'), { statusCode: 503 });
  }
}
