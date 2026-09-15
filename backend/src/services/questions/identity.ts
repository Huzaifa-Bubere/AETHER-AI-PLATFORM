import { createHash } from 'crypto';

export interface QuestionIdentity {
  _id?: unknown;
  questionId?: unknown;
  questionText?: string;
  text?: string;
  imageUrl?: string;
  fingerprint?: string;
}

// Keep operators and numbers: changing <= to < or 10 to 100 changes a question.
export function normalizeQuestion(text: string): string {
  return text.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ')
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"');
}

export function fingerprintQuestion(question: QuestionIdentity): string {
  const text = normalizeQuestion(question.questionText || question.text || '');
  const content = text ? `text:${text}` : question.imageUrl ? `image:${question.imageUrl}`
    : `legacy-id:${String(question.questionId || question._id)}`;
  return createHash('sha256').update(content).digest('hex');
}

// Conservative near-duplicate signal, not a substitute for embedding similarity.
export function similarQuestions(a: QuestionIdentity, b: QuestionIdentity): boolean {
  if (fingerprintQuestion(a) === fingerprintQuestion(b)) return true;
  const left = normalizeQuestion(a.questionText || a.text || '');
  const right = normalizeQuestion(b.questionText || b.text || '');
  const tokens = (value: string) => value.match(/[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) || [];
  const x = tokens(left), y = tokens(right);
  if (x.length < 12 || y.length < 12) return false;
  // Do not merge different numerical problems or logical negations/operators.
  const significant = (value: string) => (value.match(/\d+(?:\.\d+)?|[<>=!+*/%-]+|\b(?:not|never|except|least|most)\b/g) || []).join(' ');
  if (significant(left) !== significant(right)) return false;
  const shingles = (words: string[]) => new Set(words.slice(0, -2).map((_, i) => words.slice(i, i + 3).join(' ')));
  const xs = shingles(x), ys = shingles(y);
  const intersection = [...xs].filter(s => ys.has(s)).length;
  return intersection / (xs.size + ys.size - intersection) >= 0.9;
}

export function uniqueQuestions<T extends QuestionIdentity>(questions: T[]): T[] {
  const unique: T[] = [];
  for (const question of questions) {
    if (!unique.some(existing => similarQuestions(existing, question))) unique.push(question);
  }
  return unique;
}
