export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = typeof DIFFICULTIES[number];

export const DIFFICULTY_RULES = {
  easy: { minSteps: 1, maxSteps: 1, minConcepts: 1, rubric: 'One fundamental concept with one direct reasoning step; no advanced edge case.' },
  medium: { minSteps: 2, maxSteps: 3, minConcepts: 1, rubric: 'Apply a concept in a concrete scenario using two or three dependent reasoning steps.' },
  hard: { minSteps: 3, maxSteps: 8, minConcepts: 2, rubric: 'Combine at least two concepts across three or more reasoning steps, including an edge case or tradeoff.' },
} as const;

export function isDifficulty(value: unknown): value is Difficulty {
  return DIFFICULTIES.includes(value as Difficulty);
}

export function validateDifficultyEvidence(difficulty: Difficulty, evidence: unknown): string[] {
  const e = evidence as { reasoningSteps?: unknown; concepts?: unknown; edgeCase?: unknown } | null;
  if (!e || !Array.isArray(e.reasoningSteps) || !Array.isArray(e.concepts)) return ['Difficulty evidence is required.'];
  const steps = e.reasoningSteps.filter((v): v is string => typeof v === 'string' && v.trim().length >= 12);
  const concepts = new Set(e.concepts.filter((v): v is string => typeof v === 'string' && v.trim().length >= 2).map(v => v.trim().toLowerCase()));
  const rule = DIFFICULTY_RULES[difficulty];
  const errors: string[] = [];
  if (steps.length < rule.minSteps || steps.length > rule.maxSteps || new Set(steps).size !== steps.length) errors.push('Reasoning steps do not match the requested difficulty.');
  if (concepts.size < rule.minConcepts) errors.push('Insufficient distinct concepts for the requested difficulty.');
  if (difficulty === 'hard' && (typeof e.edgeCase !== 'string' || e.edgeCase.trim().length < 12)) errors.push('Hard questions require an explicit edge case or tradeoff.');
  return errors;
}
