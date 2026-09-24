/**
 * AETHER Interview — deterministic speech & language analysis.
 *
 * Measures OBSERVABLE delivery features only (spec §29–34):
 *   speaking rate, response length, fillers, pause estimate, WPM.
 * English analysis uses transcript evidence for grammar/clarity/vocabulary/
 * coherence. STAR analysis detects behavioral answer structure.
 *
 * NEVER inferred: personality, honesty, confidence-as-trait, emotion,
 * intelligence, mental state, or accent quality. Accent is NOT scored.
 */

export const FILLER_WORDS = [
  'um', 'uh', 'erm', 'hmm', 'like', 'you know', 'basically', 'actually',
  'literally', 'sort of', 'kind of', 'i mean', 'right', 'so yeah',
] as const;

const FILLER_RE = new RegExp(
  `\\b(${FILLER_WORDS.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')).join('|')})\\b`,
  'gi'
);

export interface IDeliveryMetrics {
  wordCount: number;
  fillerCount: number;
  wordsPerMinute: number | null;
  fillerRatePerMinute: number | null;
  sentenceCount: number;
  avgSentenceWords: number;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function countFillers(text: string): number {
  const m = text.match(FILLER_RE);
  return m ? m.length : 0;
}

/** Delivery metrics for one response. durationSeconds <= 0 → WPM unknown. */
export function analyzeDelivery(answer: string, durationSeconds: number): IDeliveryMetrics {
  const wordCount = countWords(answer);
  const fillerCount = countFillers(answer);
  const sentences = answer.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  const minutes = durationSeconds > 0 ? durationSeconds / 60 : 0;
  return {
    wordCount,
    fillerCount,
    wordsPerMinute: minutes > 0 ? Math.round(wordCount / minutes) : null,
    fillerRatePerMinute: minutes > 0 ? Math.round((fillerCount / minutes) * 10) / 10 : null,
    sentenceCount: sentences.length,
    avgSentenceWords: sentences.length ? Math.round(wordCount / sentences.length) : wordCount,
  };
}

/** Aggregate delivery across all responses of a session. */
export function aggregateDelivery(
  responses: Array<{ delivery?: { wordCount: number; fillerCount: number; wordsPerMinute: number | null }; durationSeconds: number }>
) {
  let totalWords = 0, totalFillers = 0, totalSeconds = 0, wpmSamples: number[] = [];
  for (const r of responses) {
    totalWords += r.delivery?.wordCount ?? 0;
    totalFillers += r.delivery?.fillerCount ?? 0;
    totalSeconds += Math.max(0, r.durationSeconds ?? 0);
    if (r.delivery?.wordsPerMinute && r.delivery.wordsPerMinute > 40 && r.delivery.wordsPerMinute < 300) {
      wpmSamples.push(r.delivery.wordsPerMinute);
    }
  }
  const minutes = totalSeconds / 60;
  return {
    responseCount: responses.length,
    totalWords,
    fillerCount: totalFillers,
    fillerRatePerMinute: minutes > 0 ? Math.round((totalFillers / minutes) * 10) / 10 : null,
    averageResponseSeconds: responses.length ? Math.round(totalSeconds / responses.length) : null,
    wordsPerMinute: wpmSamples.length
      ? Math.round(wpmSamples.reduce((s, w) => s + w, 0) / wpmSamples.length)
      : null,
    // Rough pause estimate from duration vs. word count (150 wpm articulation baseline).
    pauseRatioEstimate: minutes > 0 && totalWords > 0
      ? Math.max(0, Math.min(0.8, Math.round(((minutes - totalWords / 150) / minutes) * 100) / 100))
      : null,
    measuredAt: new Date(),
  };
}

/** Contextual pace coaching — no universal ideal, only intelligibility flags. */
export function paceNote(wpm: number | null): string | null {
  if (wpm == null) return null;
  if (wpm > 190) return `Speaking rate ${wpm} WPM is unusually fast — pausing between ideas can improve intelligibility.`;
  if (wpm < 85) return `Speaking rate ${wpm} WPM is unusually slow — this can be fine for emphasis, but watch total answer length within the interview time.`;
  return null;
}

// ── English communication analysis (transcript-based, deterministic) ────────

const GRAMMAR_ERROR_RE = /\b(i has|i were|he have|she have|they was|i is|we was|did not went|have went|could of|should of|would of|more better|most best|a hour|an university)\b/gi;
const PROFESSIONAL_RE = /\b(collaborat\w+|implement\w+|architect\w+|optimiz\w+|deliver\w+|resolv\w+|coordinat\w+|analyz\w+|design\w+)\b/gi;

export interface IEnglishResult {
  grammar: number;
  clarity: number;
  vocabulary: number;
  coherence: number;
  evidence: string[];
  improvements: string[];
  measuredFrom: 'transcript';
  measuredAt: Date;
}

export function analyzeEnglish(transcripts: string[]): IEnglishResult | null {
  const joined = transcripts.filter(t => t.trim()).join(' ');
  if (countWords(joined) < 40) return null; // not enough evidence — honest absence

  const words = countWords(joined);
  const sentences = joined.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  const fillers = countFillers(joined);

  // Grammar: error density vs. sentence count (STT noise-tolerant threshold).
  const grammarErrors = (joined.match(GRAMMAR_ERROR_RE) || []).length;
  const errorDensity = sentences.length ? grammarErrors / sentences.length : 0;
  const grammar = clamp100(Math.round(95 - errorDensity * 250));

  // Clarity: sentence length + filler pressure.
  const avgLen = sentences.length ? words / sentences.length : words;
  const fillerRatio = words ? fillers / words : 0;
  const clarity = clamp100(Math.round(
    88 - Math.max(0, avgLen - 22) * 1.8 - fillerRatio * 400
  ));

  // Vocabulary: type-token ratio + professional register.
  const tokens = joined.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(w => w.length > 3);
  const ttr = tokens.length ? new Set(tokens).size / tokens.length : 0;
  const professional = (joined.match(PROFESSIONAL_RE) || []).length;
  const vocabulary = clamp100(Math.round(55 + ttr * 120 + Math.min(15, professional)));

  // Coherence: connectives + explicit structure words.
  const connectives = (joined.match(/\b(then|after|because|therefore|however|which|so that|first|second|finally|as a result|for example)\b/gi) || []).length;
  const coherence = clamp100(Math.round(
    55 + Math.min(30, (connectives / Math.max(1, sentences.length)) * 22) + (sentences.length >= 6 ? 10 : 0)
  ));

  const evidence: string[] = [];
  if (avgLen > 26) evidence.push('You often joined multiple ideas into a single long sentence.');
  if (fillers >= 5) evidence.push(`Filler words appeared ${fillers} times across your answers.`);
  if (professional >= 3) evidence.push('You used precise professional vocabulary for technical work.');
  if (connectives >= 4) evidence.push('Your answers flowed with clear connectives between ideas.');

  const improvements: string[] = [];
  if (avgLen > 26) improvements.push('Use shorter sentences when describing technical architecture.');
  if (fillerRatio > 0.02) improvements.push('Try pausing briefly instead of filling silence with filler words.');
  if (ttr < 0.35) improvements.push('Vary your vocabulary — repeat the same few words less.');
  if (connectives / Math.max(1, sentences.length) < 0.2) improvements.push('Link your points explicitly: "first… then… as a result…".');
  if (grammarErrors >= 3) improvements.push('Review subject–verb agreement in past-tense sentences.');

  return {
    grammar, clarity, vocabulary, coherence,
    evidence: evidence.slice(0, 5),
    improvements: improvements.slice(0, 4),
    measuredFrom: 'transcript',
    measuredAt: new Date(),
  };
}

// ── STAR structure analysis (behavioral answers) ─────────────────────────────

export interface IStarResult {
  situation: boolean;
  task: boolean;
  action: boolean;
  result: boolean;
  recommendation: string;
}

export function analyzeStar(answer: string): IStarResult {
  const t = answer.toLowerCase();
  const situation = /\b(when|during|while|at (my|the) (last|previous)|in (my|the) (project|team|internship|college)|we were|our team|last year|once)\b/.test(t);
  const task = /\b(had to|needed to|was responsible|my (job|role|task)|goal was|assigned|challenge was|we needed)\b/.test(t);
  const action = /\b(i (built|created|wrote|designed|led|implemented|proposed|fixed|migrat|optimiz|debugg|coordinat|organized)|we (built|created|wrote|designed|implemented|decided|migrat|fixed))\b/.test(t);
  const result = /\b(result|outcome|reduced|improved|increased|decreased|saved|shipped|launched|delivered|\d+\s?(%|percent|x|ms|seconds|users|hours)|on time|successfully|accepted|praised|won)\b/.test(t);

  const missing: string[] = [];
  if (!situation) missing.push('set the situation');
  if (!task) missing.push('state your specific responsibility');
  if (!action) missing.push('describe YOUR concrete actions');
  if (!result) missing.push('finish with the measurable result');

  const recommendation = missing.length === 0
    ? 'Complete STAR structure — strong behavioral answer shape.'
    : `Finish the answer by: ${missing.slice(0, 2).join(', ')}.`;

  return { situation, task, action, result, recommendation };
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, n));
}
