import RagSource from '../../models/RagSource';
import RagChunk from '../../models/RagChunk';
import { AIUnavailableError, embedText, embeddingModel } from '../ai/provider';
import logger from '../../utils/logger';

export interface RetrievedChunk {
  id: string; sourceId: string; title: string; url: string; text: string;
  topic: string; retrievedAt: Date; score: number;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length || !a.every(Number.isFinite) || !b.every(Number.isFinite)) return 0;
  const denominator = Math.hypot(...a) * Math.hypot(...b);
  return denominator ? a.reduce((sum, v, i) => sum + v * b[i], 0) / denominator : 0;
}

export function diversify<T extends { sourceId: unknown; score: number }>(rows: T[], limit: number): T[] {
  const counts = new Map<string, number>();
  return rows.sort((a, b) => b.score - a.score).filter(row => {
    const id = String(row.sourceId), count = counts.get(id) || 0;
    if (count >= 2) return false;
    counts.set(id, count + 1); return true;
  }).slice(0, limit);
}

export async function retrieveContext(topic: string, query: string, limit = 6): Promise<RetrievedChunk[]> {
  const model = embeddingModel();
  const sources = await RagSource.find({ topic, enabled: true, revision: { $exists: true }, embeddingModel: model }).lean();
  if (!sources.length) throw new AIUnavailableError('No ingested knowledge is available for this topic.');
  const vector = await embedText(query, 'RETRIEVAL_QUERY');
  const revisions = sources.map(s => s.revision);
  let rows: any[];
  const mode = process.env.RAG_VECTOR_MODE || 'exact';
  if (mode === 'atlas') {
    try {
      rows = await RagChunk.aggregate([{ $vectorSearch: { index: process.env.RAG_VECTOR_INDEX || 'ather_knowledge', path: 'embedding',
        queryVector: vector, numCandidates: 120, limit: 24, filter: { topic, embeddingModel: model, revision: { $in: revisions } } } },
      { $project: { text: 1, sourceId: 1, topic: 1, retrievedAt: 1, score: { $meta: 'vectorSearchScore' } } }]).option({ maxTimeMS: 10000 });
    } catch {
      logger.warn('rag.retrieval.index_unavailable');
      throw new AIUnavailableError('Knowledge vector index is unavailable.');
    }
  } else if (mode === 'exact') {
    // Real embedding similarity; bounded to small local corpora and never a text-match fallback.
    const chunks = await RagChunk.find({ topic, embeddingModel: model, revision: { $in: revisions } }).select('+embedding').limit(1001).lean();
    if (chunks.length > 1000) throw new AIUnavailableError('Knowledge corpus requires Atlas vector retrieval.');
    rows = chunks.map(c => ({ ...c, score: (1 + cosineSimilarity(vector, c.embedding)) / 2 }));
  } else throw new AIUnavailableError('Invalid vector retrieval configuration.');
  const threshold = Number(process.env.RAG_MIN_SIMILARITY || 0.65);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new AIUnavailableError('Invalid retrieval threshold.');
  const byId = new Map(sources.map(s => [String(s._id), s]));
  const selected = diversify(rows.filter(row => row.score >= threshold && byId.has(String(row.sourceId))), limit);
  if (!selected.length) throw new AIUnavailableError('No relevant source context was found.');
  logger.info('rag.retrieval.complete', { topic, mode, chunks: selected.length });
  return selected.map(row => ({ id: String(row._id), sourceId: String(row.sourceId), title: byId.get(String(row.sourceId))!.title,
    url: byId.get(String(row.sourceId))!.url, text: row.text, topic, retrievedAt: row.retrievedAt, score: row.score }));
}
