import {
  IExecutionResult,
  IAstAnalysis,
  IScoreBreakdown,
  IKnownApproach,
} from '../types/coding.types';

/**
 * AETHER Coding — deterministic scoring engine.
 *
 * Weights (fixed):
 *   Correctness      45%  — Judge0 test results (real execution)
 *   Efficiency       20%  — complexity alignment + runtime signals
 *   Code Quality     15%  — AST structural evidence
 *   Problem Solving  15%  — approach detection vs expected approaches
 *   Maintainability   5%  — decomposition, nesting, readability
 *
 * No randomness. No AI-assigned base scores. Gemini narrates afterwards.
 */

const WEIGHTS = {
  correctness: 0.45,
  efficiency: 0.20,
  codeQuality: 0.15,
  problemSolving: 0.15,
  maintainability: 0.05,
} as const;

const COMPLEXITY_ORDER = ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n^2)', 'O(n^3)', 'O(2^n)', 'O(n!)'];

function complexityRank(c: string | undefined): number {
  if (!c) return -1;
  const normalized = c.replace('²', '^2').replace('³', '^3').replace(/\s/g, '');
  const idx = COMPLEXITY_ORDER.findIndex(o => o.replace(/\s/g, '') === normalized);
  return idx === -1 ? -1 : idx;
}

function scoreCorrectness(exec: IExecutionResult): number {
  if (exec.status === 'Compilation Error') return 0;
  if (exec.totalTests === 0) return 0;
  const ratio = exec.passedTests / exec.totalTests;
  return Math.round(ratio * 100);
}

function scoreEfficiency(
  exec: IExecutionResult,
  ast: IAstAnalysis,
  expectedTime: string,
  expectedSpace: string,
  problemApproaches: IKnownApproach[]
): number {
  if (!ast.parseSuccess) {
    // Without AST, fall back to execution outcome only
    return exec.status === 'Accepted' ? 60 : 30;
  }

  let score = 50;

  // Complexity alignment vs expected
  const candidateTime = complexityRank(ast.complexity.estimatedTime);
  const targetTime = complexityRank(expectedTime);
  const optimalTimeRank = Math.min(
    ...problemApproaches.map(a => complexityRank(a.timeComplexity)).filter(r => r >= 0),
    targetTime >= 0 ? targetTime : Infinity
  );

  if (candidateTime >= 0 && targetTime >= 0) {
    if (candidateTime === targetTime) score += 25;
    else if (candidateTime < targetTime) score += 30; // better than expected
    else score -= Math.min(30, (candidateTime - targetTime) * 15);
  }

  // Approach alignment: did they pick an optimal known approach?
  const detected = ast.approach.detectedApproach;
  if (detected !== 'UNKNOWN' && problemApproaches.length > 0) {
    const match = problemApproaches.find(a => a.approachId === detected);
    if (match) score += match.optimal ? 15 : 8;
  }

  // Runtime sanity bonus (relative signal, not absolute — machines differ)
  if (exec.status === 'Accepted' && exec.runtimeMs > 0 && exec.runtimeMs < 2000) score += 5;

  // Space alignment
  const candidateSpace = complexityRank(ast.complexity.estimatedSpace);
  const targetSpace = complexityRank(expectedSpace);
  if (candidateSpace >= 0 && targetSpace >= 0) {
    if (candidateSpace <= targetSpace) score += 5;
    else score -= Math.min(10, (candidateSpace - targetSpace) * 5);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreCodeQuality(ast: IAstAnalysis): number {
  if (!ast.parseSuccess) return 0;
  const q = ast.quality;
  let score = (q.modularity + q.structuralReadability) / 2;
  // Issue penalties
  for (const issue of q.issues) {
    if (issue.severity === 'high') score -= 12;
    else if (issue.severity === 'medium') score -= 7;
    else score -= 3;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreProblemSolving(ast: IAstAnalysis, problemApproaches: IKnownApproach[]): number {
  if (!ast.parseSuccess) return 0;
  const detected = ast.approach.detectedApproach;
  if (detected === 'UNKNOWN') return 40; // working code, unrecognized structure

  const optimalApproaches = problemApproaches.filter(a => a.optimal);
  const allApproaches = problemApproaches.map(a => a.approachId);

  if (optimalApproaches.some(a => a.approachId === detected)) return 95;
  if (allApproaches.includes(detected)) return 78; // valid but not optimal
  // Unknown approach — partial credit proportional to detection confidence
  return Math.round(45 + ast.approach.confidence * 20);
}

function scoreMaintainability(ast: IAstAnalysis): number {
  if (!ast.parseSuccess) return 0;
  const q = ast.quality;
  let score = q.structuralReadability * 0.6 + q.modularity * 0.4;
  if (q.excessiveNesting) score -= 10;
  if (q.largeFunctionDetected) score -= 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function computeScore(
  exec: IExecutionResult,
  ast: IAstAnalysis,
  problem: {
    expectedTimeComplexity: string;
    expectedSpaceComplexity: string;
    knownApproaches: IKnownApproach[];
  }
): IScoreBreakdown {
  const correctness = scoreCorrectness(exec);
  const efficiency = scoreEfficiency(exec, ast, problem.expectedTimeComplexity, problem.expectedSpaceComplexity, problem.knownApproaches);
  const codeQuality = scoreCodeQuality(ast);
  const problemSolving = scoreProblemSolving(ast, problem.knownApproaches);
  const maintainability = scoreMaintainability(ast);

  const overall = Math.round(
    correctness * WEIGHTS.correctness +
    efficiency * WEIGHTS.efficiency +
    codeQuality * WEIGHTS.codeQuality +
    problemSolving * WEIGHTS.problemSolving +
    maintainability * WEIGHTS.maintainability
  );

  return {
    correctness,
    efficiency,
    codeQuality,
    problemSolving,
    maintainability,
    overall,
    astAvailable: ast.parseSuccess,
  };
}
