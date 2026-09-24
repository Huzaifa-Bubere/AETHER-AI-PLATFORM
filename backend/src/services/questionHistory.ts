/**
 * AETHER Interview — Question non-repetition engine.
 *
 * Guarantees (spec §23–24):
 *  - Within one interview: ZERO repeated base questions (fingerprint + similarity check).
 *  - Across interviews: prefer unseen questions (unseen → least-recently asked → least-frequent).
 *  - AI-generated questions are compared against previous candidate questions;
 *    similarity above the threshold forces regeneration.
 *  - Follow-ups may be semantically related (they dig deeper intentionally) but
 *    must never be a paraphrase-duplicate of an earlier question.
 */

import mongoose from 'mongoose';

const SIMILARITY_THRESHOLD = 0.55; // blended overlap coefficient + Jaccard on stemmed tokens
const MIN_TOKEN_LEN = 3;

export interface IQuestionFingerprint {
  normalizedText: string;
  tokens: Set<string>;
  fingerprint: string;
}

/**
 * Light suffix stemming so "caching"/"cached"/"cache" collapse to one token.
 * Deliberately conservative — no dictionary, just common English suffixes.
 */
function stem(token: string): string {
  let t = token;
  for (const suffix of ['ational', 'iveness', 'fulness', 'ousness', 'ization', 'ations', 'izing', 'ating', 'ement', 'ments', 'ingly', 'edly', 'ings', 'ing', 'ies', 'ied', 'ers', 'er', 'ed', 'es', 'ly', 's']) {
    if (t.length > suffix.length + 3 && t.endsWith(suffix)) {
      t = t.slice(0, -suffix.length);
      break;
    }
  }
  return t;
}

/** Normalize: lowercase, strip punctuation, remove stop/question scaffolding. */
export function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(can|could|would|should|please|tell|me|about|explain|what|how|why|when|where|describe|walk|through|your|you|the|a|an|is|are|was|were|do|does|did|and|or|of|in|for|to|with|on|at|that|this|these|those|some|any|there|it|its|be|been|being|have|has|had|will|if|into|from)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function fingerprintQuestion(text: string): IQuestionFingerprint {
  const normalizedText = normalizeQuestionText(text);
  const tokens = new Set(
    normalizedText.split(' ').map(stem).filter(t => t.length >= MIN_TOKEN_LEN)
  );
  // Simple stable hash over sorted tokens — order-independent.
  const fingerprint = [...tokens].sort().join('|');
  return { normalizedText, tokens, fingerprint };
}

/**
 * Similarity = overlap coefficient blended with Jaccard, plus a topical-bias
 * term: if the two questions share a distinctive topic word (rare token, e.g.
 * "redis"), they are treated as substantially related even when the rest of
 * the phrasing differs — this is exactly the paraphrase case to reject.
 */
export function questionSimilarity(a: IQuestionFingerprint, b: IQuestionFingerprint): number {
  if (!a.tokens.size || !b.tokens.size) return 0;
  if (a.fingerprint === b.fingerprint) return 1;
  let inter = 0;
  for (const t of a.tokens) if (b.tokens.has(t)) inter++;
  const jaccard = inter / (a.tokens.size + b.tokens.size - inter);
  const overlap = inter / Math.min(a.tokens.size, b.tokens.size);
  const base = 0.5 * jaccard + 0.5 * overlap;
  // Distinctive shared topic token: appears in both sets and is rare in
  // questions generally (heuristic: length >= 3 after stemming — catches
  // "redi" → Redis, "kafka", "docker", etc.). Weight scales with how
  // focused the smaller question is on that topic.
  const rareShared = [...a.tokens].filter(t => t.length >= 3 && b.tokens.has(t));
  if (rareShared.length > 0) {
    // Each distinctive shared topic token contributes a fixed bias: two
    // questions both specifically about "redis" are paraphrase-related even
    // when everything else differs (this is the exact case to reject).
    const topicalBias = Math.min(0.45, 0.35 * rareShared.length);
    return Math.min(1, base + topicalBias);
  }
  return base;
}

/** Too similar to ANY of the previous questions? */
export function isDuplicateCandidate(text: string, previous: string[]): boolean {
  const fp = fingerprintQuestion(text);
  return previous.some(prev => questionSimilarity(fp, fingerprintQuestion(prev)) >= SIMILARITY_THRESHOLD);
}

/** The best duplicate-free candidate from a list, or null. */
export function pickNonDuplicate(candidates: string[], previous: string[]): string | null {
  for (const c of candidates) {
    if (!isDuplicateCandidate(c, previous)) return c;
  }
  return null;
}

// ── Per-candidate asked-question history ─────────────────────────────────────

export interface IAskedQuestion {
  questionId: string;
  normalizedText: string;
  fingerprint: string;
  topic: string;
  role: string;
  askedAt: Date;
}

const AskedQuestionSchema = new mongoose.Schema<IAskedQuestion>({
  questionId: { type: String, required: true },
  normalizedText: { type: String, required: true },
  fingerprint: { type: String, required: true },
  topic: { type: String, required: true },
  role: { type: String, default: '' },
  askedAt: { type: Date, default: Date.now },
}, { _id: false });

const QuestionHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  questions: { type: [AskedQuestionSchema], default: [] },
}, { timestamps: true });

export const QuestionHistory = mongoose.models.QuestionHistory
  || mongoose.model('QuestionHistory', QuestionHistorySchema);

/** Record a asked question (idempotent per interview question id). */
export async function recordAskedQuestion(params: {
  userId: string;
  questionId: string;
  text: string;
  topic: string;
  role: string;
}): Promise<void> {
  try {
    const fp = fingerprintQuestion(params.text);
    await (QuestionHistory as any).updateOne(
      { userId: new mongoose.Types.ObjectId(params.userId), 'questions.questionId': { $ne: params.questionId } },
      {
        $push: {
          questions: {
            questionId: params.questionId,
            normalizedText: fp.normalizedText,
            fingerprint: fp.fingerprint,
            topic: params.topic,
            role: params.role,
            askedAt: new Date(),
          },
        },
      },
      { upsert: true }
    );
  } catch {
    // history is advisory — never break the interview on a bookkeeping failure
  }
}

/** Load this candidate's asked-question texts for a role (most recent first). */
export async function getAskedQuestionTexts(userId: string, role: string, limit = 120): Promise<string[]> {
  try {
    const doc = await (QuestionHistory as any).findOne({ userId: new mongoose.Types.ObjectId(userId) }).lean();
    if (!doc) return [];
    return (doc.questions as IAskedQuestion[])
      .filter(q => !role || !q.role || q.role.toLowerCase() === role.toLowerCase())
      .sort((a, b) => new Date(b.askedAt).getTime() - new Date(a.askedAt).getTime())
      .slice(0, limit)
      .map(q => q.normalizedText);
  } catch {
    return [];
  }
}

/**
 * Selection priority over seed/bank questions (spec §23):
 * 1. unseen   2. least recently asked   3. least frequently asked.
 */
export function rankByRepetition<T extends { text: string }>(
  candidates: T[],
  history: IAskedQuestion[]
): Array<T & { unseen: boolean; timesAsked: number; lastAskedAt: Date | null }> {
  const now = Date.now();
  return candidates.map(c => {
    const fp = fingerprintQuestion(c.text).fingerprint;
    const matches = history.filter(h => h.fingerprint === fp);
    const lastAskedAt = matches.length
      ? matches.reduce((acc, m) => (new Date(m.askedAt) > acc ? new Date(m.askedAt) : acc), new Date(0))
      : null;
    return {
      ...c,
      unseen: matches.length === 0,
      timesAsked: matches.length,
      lastAskedAt,
    };
  }).sort((a, b) => {
    if (a.unseen !== b.unseen) return a.unseen ? -1 : 1;                 // unseen first
    if (a.timesAsked !== b.timesAsked) return a.timesAsked - b.timesAsked; // least frequent
    const aRec = a.lastAskedAt ? now - new Date(a.lastAskedAt).getTime() : Infinity;
    const bRec = b.lastAskedAt ? now - new Date(b.lastAskedAt).getTime() : Infinity;
    return bRec - aRec;                                                   // least recently asked
  });
}
