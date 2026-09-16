import { Types } from 'mongoose';
import RagChunk from '../../models/RagChunk';
import RagSource from '../../models/RagSource';
import { embeddingModel } from '../ai/provider';

/** Retain bank questions and cached questions whose complete provenance is still active. */
export async function usableQuestions<T extends { generation?: { expiresAt?: Date; sources?: { chunkId?: string }[] } }>(questions: T[]): Promise<T[]> {
  const generated = questions.filter(q => q.generation);
  if (!generated.length) return questions;
  const ids = [...new Set(generated.flatMap(q => q.generation?.sources?.map(s => s.chunkId) || []))]
    .filter((id): id is string => !!id && Types.ObjectId.isValid(id));
  const chunks = await RagChunk.find({ _id: { $in: ids }, embeddingModel: embeddingModel() }).select('_id sourceId revision').lean();
  const sources = await RagSource.find({ _id: { $in: chunks.map(c => c.sourceId) }, enabled: true, embeddingModel: embeddingModel() })
    .select('_id revision').lean();
  const revisions = new Map(sources.map(s => [String(s._id), s.revision]));
  const active = new Set(chunks.filter(c => revisions.get(String(c.sourceId)) === c.revision).map(c => String(c._id)));
  return questions.filter(q => !q.generation || (
    !!q.generation.expiresAt && new Date(q.generation.expiresAt).getTime() > Date.now() &&
    !!q.generation.sources?.length && q.generation.sources.every(s => !!s.chunkId && active.has(s.chunkId))
  ));
}
