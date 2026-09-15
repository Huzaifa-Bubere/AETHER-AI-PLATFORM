import { CATEGORIES, Category, OptionKey } from '../../models/AptitudeQuestion';
import { Difficulty, validateDifficultyEvidence } from '../questions/difficulty';
import { normalizeQuestion } from '../questions/identity';
import { RetrievedChunk } from './retrieval';

export interface GroundedMCQ {
  questionText: string; options: Record<OptionKey, string>; correctOption: OptionKey;
  explanation: string; difficulty: Difficulty; category: Category;
  evidence: { reasoningSteps: string[]; concepts: string[]; edgeCase?: string };
  citations: { chunkId: string; quote: string }[];
}

export function validateGeneratedMCQ(value: unknown, expected: { difficulty: Difficulty; category: Category }, context: RetrievedChunk[]): GroundedMCQ {
  const q = value as GroundedMCQ;
  const fail = (message: string): never => { throw new Error(`Generated question rejected: ${message}`); };
  if (!q || typeof q !== 'object' || Array.isArray(q)) fail('object required');
  if (typeof q.questionText !== 'string' || q.questionText.trim().length < 15 || q.questionText.length > 4000) fail('invalid statement');
  if (!q.options || Array.isArray(q.options) || Object.keys(q.options).sort().join('') !== 'ABCD') fail('exactly four keyed options required');
  const options = Object.values(q.options);
  if (options.some(v => typeof v !== 'string' || !v.trim() || v.length > 1500) || new Set(options.map(normalizeQuestion)).size !== 4) fail('invalid or duplicate options');
  if (!['A', 'B', 'C', 'D'].includes(q.correctOption)) fail('one correct option required');
  if (typeof q.explanation !== 'string' || q.explanation.trim().length < 30 || q.explanation.length > 5000) fail('valid explanation required');
  if (q.category !== expected.category || !CATEGORIES.includes(q.category) || q.difficulty !== expected.difficulty) fail('category or difficulty mismatch');
  const errors = validateDifficultyEvidence(expected.difficulty, q.evidence);
  if (errors.length) fail(errors.join(' '));
  if (!Array.isArray(q.citations) || !q.citations.length || q.citations.length > 3) fail('source citations required');
  for (const citation of q.citations) {
    const chunk = context.find(c => c.id === citation?.chunkId);
    if (!chunk || typeof citation.quote !== 'string' || citation.quote.length < 20 || citation.quote.length > 240 ||
      !normalizeQuestion(chunk.text).includes(normalizeQuestion(citation.quote))) fail('citation is not an exact retrieved excerpt');
  }
  return q;
}
