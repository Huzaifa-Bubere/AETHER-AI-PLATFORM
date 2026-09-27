import { IKnownApproach } from '../types/coding.types';

/**
 * AETHER Coding — deterministic complexity comparison engine.
 *
 * This module owns the FACTS of the post-submission optimization feedback.
 * Gemini may only narrate what this module decides; it never classifies
 * complexity, never upgrades/downgrades a warning level and never invents an
 * "expected" complexity.
 *
 * Design guarantees:
 * - Complexity strings are canonicalized through an explicit alias table, so
 *   `O(N)`, `O(n)`, `O(n*n)`, `O(N^2)` and `O(n²)` all compare correctly.
 * - A RED (worst) warning requires ALL of: validated problem metadata
 *   (`verified === true`), a candidate class clearly worse than the accepted
 *   set, and analyzer confidence above the configured threshold.
 * - Anything uncertain degrades to AMBER or UNKNOWN — never a false claim.
 */

// ── Levels & confidence ──────────────────────────────────────────────────────

/** Warning levels from spec §4 — GREEN / AMBER / RED. */
export type OptimizationLevel =
  | 'OPTIMAL'
  | 'POSSIBLY_IMPROVABLE'
  | 'CLEAR_OPTIMIZATION_OPPORTUNITY'
  | 'UNKNOWN';

export type AnalyzerConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface IComplexityClass {
  /** Canonical, display-ready form, e.g. `O(n log n)`. */
  canonical: string;
  /** Deterministic rank used for comparison only. */
  rank: number;
}

/**
 * Fixed ordering (spec §7): O(1) < O(log n) < O(n) < O(n log n) < O(n²) <
 * O(n³) < O(2^n) < O(n!). Polynomial degrees above 3 are interpolated so they
 * still rank below exponential classes.
 */
const RANK = {
  constant: 0,
  log: 1,
  linear: 2,
  linearithmic: 3,
  quadratic: 4,
  cubic: 5,
  exponential: 8,
  factorial: 9,
} as const;

/** Default confidence threshold below which RED is never shown. */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;

export function confidenceThreshold(): number {
  const raw = Number(process.env.COMPLEXITY_CONFIDENCE_THRESHOLD);
  if (!Number.isFinite(raw)) return DEFAULT_CONFIDENCE_THRESHOLD;
  return Math.min(0.95, Math.max(0.3, raw));
}

// ── Canonicalization ─────────────────────────────────────────────────────────

/**
 * Normalize an arbitrary complexity string to a canonical class.
 * Returns null when the string cannot be classified — callers must treat that
 * as "uncertain" rather than guessing.
 */
/**
 * Classify an already-normalized complexity body.
 * `@` is the internal marker for an exponent-of-n term (from `^n`).
 */
function classifyNormalized(s: string): IComplexityClass | null {
  if (/^(1|c|constant|o1)$/.test(s)) return { canonical: 'O(1)', rank: RANK.constant };
  if (/^(logn|log2n|log10n|lgn)$/.test(s)) return { canonical: 'O(log n)', rank: RANK.log };
  if (/^(n|m|n\+m|m\+n|ne|ve)$/.test(s)) return { canonical: 'O(n)', rank: RANK.linear };
  if (/^n(logn|log2n)$/.test(s)) return { canonical: 'O(n log n)', rank: RANK.linearithmic };

  // n^2 / n^3 / n^4 … written as n2, n3 or as repeated factors (nn, nnn).
  const power = s.match(/^n([2-9])$/) || (/^n{2,9}$/.test(s) ? [s, String(s.length)] as unknown as RegExpMatchArray : null);
  if (power) {
    const k = Number(power[1]);
    // n^2 and n^3 sit exactly on the documented ordering; higher degrees are
    // interpolated strictly between cubic and exponential.
    const rank = k <= 3 ? RANK.quadratic + (k - 2) : RANK.cubic + (k - 3) * 0.9;
    return { canonical: `O(n^${k})`, rank };
  }

  // Exponential: 2^n (normalized to `2@` / `@`).
  if (/^\d*@$/.test(s)) return { canonical: 'O(2^n)', rank: RANK.exponential };
  if (/^n!$/.test(s)) return { canonical: 'O(n!)', rank: RANK.factorial };

  // Graph-shaped linear forms: O(V+E), O(n+m), O(rows+cols)…
  if (/^[a-z](\+[a-z])+$/.test(s)) return { canonical: 'O(n)', rank: RANK.linear };

  return null;
}

/**
 * Normalize an arbitrary complexity string to a canonical class.
 * Returns null when the string cannot be classified — callers must treat that
 * as "uncertain" rather than guessing.
 */
export function canonicalizeComplexity(raw?: string | null): IComplexityClass | null {
  if (raw == null) return null;
  let s = String(raw).toLowerCase().trim();
  if (!s) return null;
  if (/^(unknown|n\/a|na|\?|unavailable|pending)$/.test(s)) return null;

  // Unicode superscripts → ASCII digits.
  s = s.replace(/²/g, '2').replace(/³/g, '3').replace(/⁴/g, '4').replace(/⁵/g, '5');
  // Strip an outer O(...) / Θ(...) / Ω(...) wrapper.
  s = s.replace(/^[oθω]\s*\(/, '').replace(/\)\s*$/, '');
  // Remove whitespace, multiplication marks and leftover brackets.
  s = s.replace(/[\s·×*_]/g, '');
  s = s.replace(/[()]/g, '');
  s = s.replace(/⁻/g, '-');
  // Mark an exponent-of-n term, then drop the remaining powers (n^2 → n2).
  s = s.replace(/\^n(?![a-z0-9])/g, '@').replace(/\^/g, '');

  const direct = classifyNormalized(s);
  if (direct) return direct;

  // Drop a leading constant coefficient, e.g. 3n → n, 4log n → log n.
  const stripped = s.replace(/^\d+(?=(n|log|m))/, '');
  if (stripped !== s) return classifyNormalized(stripped);

  return null;
}

/** True when both strings denote the same complexity class (alias-safe). */
export function sameComplexity(a?: string | null, b?: string | null): boolean {
  const ca = canonicalizeComplexity(a);
  const cb = canonicalizeComplexity(b);
  return !!ca && !!cb && ca.rank === cb.rank;
}

export function confidenceBand(analyzerConfidence: number): AnalyzerConfidence {
  if (analyzerConfidence >= 0.75) return 'HIGH';
  if (analyzerConfidence >= 0.5) return 'MEDIUM';
  return 'LOW';
}

// ── Problem metadata resolution ──────────────────────────────────────────────

export interface IComplexityGuidance {
  expectedTime?: string;
  expectedSpace?: string;
  acceptedTimeClasses?: string[];
  explanation?: string;
  optimizationHint?: string;
  source?: string;
  verified?: boolean;
}

export interface IProblemComplexitySource {
  expectedTimeComplexity?: string | null;
  expectedSpaceComplexity?: string | null;
  complexityGuidance?: IComplexityGuidance | null;
  knownApproaches?: Array<Pick<IKnownApproach, 'name' | 'approachId' | 'timeComplexity' | 'spaceComplexity' | 'outline' | 'optimal'>> | null;
}

export interface IResolvedComplexityMetadata {
  expectedTime: string;
  expectedSpace: string;
  acceptedTimeClasses: string[];
  explanation: string;
  optimizationHint: string | null;
  source: string;
  verified: boolean;
  /** true when the metadata comes from the hand-curated problem record. */
  curated: boolean;
}

/**
 * Merge `complexityGuidance` (authoritative when present) with the legacy
 * top-level expected-complexity fields and the curated known approaches.
 * Absent guidance degrades to unverified metadata, which can never produce RED.
 */
export function resolveComplexityMetadata(problem: IProblemComplexitySource): IResolvedComplexityMetadata {
  const guidance = problem.complexityGuidance || {};
  const approaches = problem.knownApproaches || [];
  const optimal = approaches.filter(a => a.optimal);

  const expectedTime = guidance.expectedTime || problem.expectedTimeComplexity || '';
  const expectedSpace = guidance.expectedSpace || problem.expectedSpaceComplexity || '';

  const accepted = (guidance.acceptedTimeClasses || [])
    .map(c => canonicalizeComplexity(c)?.canonical)
    .filter((c): c is string => !!c);
  if (accepted.length === 0) {
    const derived = [expectedTime, ...optimal.map(a => a.timeComplexity)]
      .map(c => canonicalizeComplexity(c)?.canonical)
      .filter((c): c is string => !!c);
    accepted.push(...Array.from(new Set(derived)));
  }

  const hint = guidance.optimizationHint
    || optimal.map(a => a.outline).find(o => !!o && o.trim().length > 0)
    || null;

  const explicit = !!problem.complexityGuidance;

  return {
    expectedTime,
    expectedSpace,
    acceptedTimeClasses: Array.from(new Set(accepted)),
    explanation: guidance.explanation || '',
    optimizationHint: hint,
    source: guidance.source || (explicit ? 'CURATED' : 'DERIVED'),
    verified: guidance.verified === true,
    curated: optimal.length > 0,
  };
}

// ── Comparison ───────────────────────────────────────────────────────────────

export interface IComplexityComparisonInput {
  candidateTime?: string | null;
  candidateSpace?: string | null;
  expectedTime?: string | null;
  expectedSpace?: string | null;
  acceptedTimeClasses?: string[];
  /** AST estimator confidence, 0..1. */
  analyzerConfidence?: number | null;
  /** Validated problem metadata (verified === true) — required for RED. */
  metadataVerified?: boolean;
  /** false when the parser could not analyse the submission. */
  analysisAvailable?: boolean;
  /** Execution outcome, used only for wording — never for classification. */
  correctnessAccepted?: boolean;
  evidence?: string[];
  optimizationHint?: string | null;
  optimizationExplanation?: string;
}

export interface IComplexityComparison {
  candidateTime: string;
  candidateSpace: string;
  expectedTime: string;
  expectedSpace: string;
  acceptedTimeClasses: string[];
  candidateTimeRank: number | null;
  expectedTimeRank: number | null;
  confidence: AnalyzerConfidence;
  analyzerConfidence: number;
  level: OptimizationLevel;
  /** true only when the candidate is measurably worse than the accepted set. */
  optimizationAvailable: boolean;
  /** true when the UI must render a warning card (AMBER or RED). */
  warn: boolean;
  headline: string;
  message: string;
  reason: string;
  optimizationHint: string | null;
  optimizationExplanation: string;
  evidence: string[];
  /** Threshold actually applied, for traceability in analytics. */
  threshold: number;
}

function expectedWorstCase(classes: string[]): IComplexityClass | null {
  const parsed = classes.map(canonicalizeComplexity).filter((c): c is IComplexityClass => !!c);
  if (parsed.length === 0) return null;
  // "Efficient" means the best (lowest-rank) accepted class.
  return parsed.reduce((best, c) => (c.rank < best.rank ? c : best));
}

/**
 * Compare the candidate's estimated complexity against the validated expected
 * complexity of the problem and derive the warning level (spec §2–§8).
 */
export function compareComplexity(input: IComplexityComparisonInput): IComplexityComparison {
  const threshold = confidenceThreshold();
  const analyzerConfidence = typeof input.analyzerConfidence === 'number' ? input.analyzerConfidence : 0;
  const confidence = confidenceBand(analyzerConfidence);
  const evidence = (input.evidence || []).slice(0, 8);

  const candidate = canonicalizeComplexity(input.candidateTime);
  const expectClass = expectedWorstCase(input.acceptedTimeClasses || [input.expectedTime || '']);

  const candidateTime = candidate?.canonical || (input.candidateTime ? String(input.candidateTime) : 'Unknown');
  const expectedTime = expectClass?.canonical || (input.expectedTime ? String(input.expectedTime) : 'Unknown');

  const base: IComplexityComparison = {
    candidateTime,
    candidateSpace: canonicalizeComplexity(input.candidateSpace)?.canonical || (input.candidateSpace ? String(input.candidateSpace) : 'Unknown'),
    expectedTime,
    expectedSpace: canonicalizeComplexity(input.expectedSpace)?.canonical || (input.expectedSpace ? String(input.expectedSpace) : 'Unknown'),
    acceptedTimeClasses: input.acceptedTimeClasses || [],
    candidateTimeRank: candidate?.rank ?? null,
    expectedTimeRank: expectClass?.rank ?? null,
    confidence,
    analyzerConfidence,
    level: 'UNKNOWN',
    optimizationAvailable: false,
    warn: false,
    headline: 'Analysis uncertain',
    message: 'Estimated complexity could not be compared to a validated expectation for this submission.',
    reason: '',
    optimizationHint: null,
    optimizationExplanation: '',
    evidence,
    threshold,
  };

  // ── Uncertain: no AST analysis, unparseable candidate, or no expectation ──
  if (input.analysisAvailable === false) {
    return {
      ...base,
      level: 'UNKNOWN',
      reason: 'Static analysis could not process this submission, so no complexity claim is made.',
      message: 'Complexity analysis is unavailable for this submission. Correctness results are unaffected.',
    };
  }
  if (!candidate || !expectClass) {
    return {
      ...base,
      level: 'UNKNOWN',
      confidence,
      reason: !candidate
        ? 'The estimated complexity of this submission could not be classified deterministically.'
        : 'This problem has no validated expected complexity, so no optimization warning can be justified.',
      message: 'Estimated complexity could not be compared to a validated expectation for this submission.',
    };
  }

  const gap = candidate.rank - expectClass.rank;

  // ── GREEN: matches (or beats) the accepted efficient class ────────────────
  if (gap <= 0) {
    const better = gap < 0;
    return {
      ...base,
      level: 'OPTIMAL',
      optimizationAvailable: false,
      warn: false,
      headline: 'EFFICIENT',
      message: better
        ? `Your solution is more efficient than the expected complexity (${candidateTime} vs ${expectedTime}).`
        : 'Your solution matches the expected efficient complexity.',
      reason: input.acceptedTimeClasses?.length
        ? `Estimated time complexity ${candidateTime} is within the accepted classes for this problem (${(input.acceptedTimeClasses || []).join(', ')}).`
        : `Estimated time complexity ${candidateTime} matches the expected ${expectedTime}.`,
      optimizationHint: null,
      optimizationExplanation: '',
    };
  }

  // ── Worse than expected: decide AMBER vs RED ─────────────────────────────
  const clearlyWorse = gap >= 2;
  const verified = input.metadataVerified === true;
  const confidentEnough = analyzerConfidence >= threshold;

  const optimizationHint = input.optimizationHint || null;
  const optimizationExplanation = input.optimizationExplanation || '';

  const hintSentence = optimizationHint ? ` Optimization direction: ${optimizationHint}` : '';

  if (clearlyWorse && verified && confidentEnough) {
    // RED — spec §4: all three conditions satisfied.
    const correctnessClause = input.correctnessAccepted
      ? 'Your solution passes the tests, but it can be optimized.'
      : 'Your solution is not fully correct yet, and it is also more expensive than necessary.';
    return {
      ...base,
      level: 'CLEAR_OPTIMIZATION_OPPORTUNITY',
      optimizationAvailable: true,
      warn: true,
      headline: 'OPTIMIZATION OPPORTUNITY',
      message: `${correctnessClause} Its estimated time complexity is ${candidateTime}, while this problem can be solved in ${expectedTime}. For larger inputs the current approach may perform significantly more work than necessary.${hintSentence}`,
      reason: `Estimated ${candidateTime} is ${gap} complexity class(es) above the validated expectation ${expectedTime} (analyzer confidence ${confidence}, threshold ${threshold}).`,
      optimizationHint,
      optimizationExplanation,
    };
  }

  // AMBER — slightly worse, unverified metadata, or low analyzer confidence.
  const why = !clearlyWorse
    ? `Estimated ${candidateTime} is one class above the expected ${expectedTime}.`
    : !verified
      ? 'This problem has no human-validated complexity guidance, so the difference cannot be asserted as a clear optimization opportunity.'
      : `Analyzer confidence (${confidence}) is below the ${threshold} threshold required for a definite optimization warning.`;

  return {
    ...base,
    level: 'POSSIBLY_IMPROVABLE',
    optimizationAvailable: true,
    warn: true,
    headline: 'POSSIBLY IMPROVABLE',
    message: `This solution may be optimizable. Its estimated time complexity is ${candidateTime}; the expected efficient complexity is ${expectedTime}.${hintSentence}`,
    reason: why,
    optimizationHint,
    optimizationExplanation,
  };
}
