import { Request } from 'express';

/**
 * AETHER Coding Module — shared types
 * ------------------------------------------------------------------
 * Language adapters, AST analysis contracts, scoring, and execution
 * result normalization types.
 */

// ── Languages ────────────────────────────────────────────────────────────────

export type CodingLanguage =
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'java'
  | 'cpp'
  | 'c';

/** Future-ready extension set — adapters accepted by execution, AST-limited for now. */
export const FUTURE_LANGUAGES = ['csharp', 'go', 'kotlin', 'rust'] as const;

export const SUPPORTED_LANGUAGES: CodingLanguage[] = [
  'python',
  'javascript',
  'typescript',
  'java',
  'cpp',
  'c',
];

export function isCodingLanguage(value: unknown): value is CodingLanguage {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as string[]).includes(value);
}

// ── Difficulty / categories ──────────────────────────────────────────────────

export type CodingDifficulty = 'Easy' | 'Medium' | 'Hard';

export const CODING_CATEGORIES = [
  'Arrays', 'Strings', 'Linked Lists', 'Stacks', 'Queues', 'Hashing',
  'Binary Search', 'Sorting', 'Recursion', 'Backtracking', 'Trees',
  'Binary Search Trees', 'Heaps', 'Graphs', 'Greedy', 'Dynamic Programming',
  'Sliding Window', 'Two Pointers', 'Bit Manipulation', 'Math',
  'Prefix Sum', 'Tries',
] as const;

export type CodingCategory = (typeof CODING_CATEGORIES)[number];

// ── Problems ─────────────────────────────────────────────────────────────────

export interface ITestCase {
  input: string;
  expectedOutput: string;
}

export interface IProblemExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface IKnownApproach {
  name: string;
  approachId: AlgorithmApproachId;
  timeComplexity: string;
  spaceComplexity: string;
  outline: string;
  optimal: boolean;
}

export interface IProblemDTO {
  title: string;
  slug: string;
  description: string;
  difficulty: CodingDifficulty;
  category: CodingCategory | string;
  tags: string[];
  companies?: string[];
  examples: IProblemExample[];
  constraints: string[];
  starterCode: Record<CodingLanguage, string>;
  sampleTests: ITestCase[];
  functionNames: Partial<Record<CodingLanguage, string>>;
  knownApproaches: IKnownApproach[];
  expectedTimeComplexity: string;
  expectedSpaceComplexity: string;
  points: number;
  isPublished: boolean;
  hints?: string[];
  solutionOutline?: string;
}

// ── Execution (Judge0 / fallback runner) ─────────────────────────────────────

export type ExecutionStatus =
  | 'Accepted'
  | 'Wrong Answer'
  | 'Compilation Error'
  | 'Runtime Error'
  | 'Time Limit Exceeded'
  | 'Memory Limit Exceeded'
  | 'Internal Error';

export interface ITestOutcome {
  index: number;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  executionTimeMs?: number;
  error?: string;
  hidden: boolean;
}

export interface IExecutionResult {
  status: ExecutionStatus;
  passedTests: number;
  totalTests: number;
  tests: ITestOutcome[];
  runtimeMs: number;
  memoryKb: number | null;
  compileOutput?: string;
  stderr?: string;
  executor: 'judge0' | 'piston' | 'local';
}

// ── AST analysis contracts ───────────────────────────────────────────────────

export type AlgorithmApproachId =
  | 'BRUTE_FORCE'
  | 'HASHING'
  | 'TWO_POINTER'
  | 'SLIDING_WINDOW'
  | 'BINARY_SEARCH'
  | 'DFS'
  | 'BFS'
  | 'BACKTRACKING'
  | 'GREEDY'
  | 'DYNAMIC_PROGRAMMING'
  | 'MEMOIZATION'
  | 'TABULATION'
  | 'SORTING_BASED'
  | 'PREFIX_SUM'
  | 'HEAP'
  | 'STACK'
  | 'QUEUE'
  | 'UNION_FIND'
  | 'TRIE'
  | 'DIVIDE_AND_CONQUER'
  | 'RECURSION';

export interface IAstNode {
  id: string;
  type: string;
  label: string;
  /** 1-based line numbers in the original source. */
  loc?: { startLine: number; endLine: number; startCol?: number; endCol?: number };
  children: IAstNode[];
}

export interface IStructuralMetrics {
  statements: number;
  functions: number;
  maxFunctionLines: number;
  loops: number;
  nestedLoopDepth: number;
  conditionals: number;
  switches: number;
  maxNestingDepth: number;
  recursionDetected: boolean;
  breaks: number;
  continues: number;
  returns: number;
  variableDeclarations: number;
  functionCalls: number;
  tryCatch: number;
}

export interface IComplexityEstimate {
  estimatedTime: string;
  estimatedSpace: string;
  confidence: number; // 0..1
  evidence: string[];
}

export interface IPatternDetection {
  detectedApproach: AlgorithmApproachId | 'UNKNOWN';
  confidence: number;
  evidence: string[];
  secondaryApproaches: Array<{ approach: AlgorithmApproachId; confidence: number }>;
  dataStructures: string[];
}

export interface ICodeQualityIssue {
  issue: string;
  severity: 'low' | 'medium' | 'high';
  line?: number;
  evidence: string;
  recommendation: string;
}

export interface ICodeQuality {
  modularity: number;          // 0..100
  structuralReadability: number; // 0..100
  excessiveNesting: boolean;
  largeFunctionDetected: boolean;
  issues: ICodeQualityIssue[];
}

export interface IAstAnalysis {
  parseSuccess: boolean;
  parser: 'acorn' | 'heuristic' | 'none';
  language: CodingLanguage;
  reason?: string; // set when parseSuccess === false
  metrics: IStructuralMetrics;
  dataStructures: string[];
  patterns: string[];
  approach: IPatternDetection;
  complexity: IComplexityEstimate;
  quality: ICodeQuality;
  ast?: IAstNode;         // condensed tree for visualization
  callGraph?: Array<{ caller: string; callee: string }>;
}

export const AST_UNAVAILABLE: IAstAnalysis = {
  parseSuccess: false,
  parser: 'none',
  language: 'python',
  reason: 'Parser could not process submitted code.',
  metrics: {
    statements: 0, functions: 0, maxFunctionLines: 0, loops: 0, nestedLoopDepth: 0,
    conditionals: 0, switches: 0, maxNestingDepth: 0, recursionDetected: false,
    breaks: 0, continues: 0, returns: 0, variableDeclarations: 0, functionCalls: 0,
    tryCatch: 0,
  },
  dataStructures: [],
  patterns: [],
  approach: { detectedApproach: 'UNKNOWN', confidence: 0, evidence: [], secondaryApproaches: [], dataStructures: [] },
  complexity: { estimatedTime: 'Unknown', estimatedSpace: 'Unknown', confidence: 0, evidence: [] },
  quality: { modularity: 0, structuralReadability: 0, excessiveNesting: false, largeFunctionDetected: false, issues: [] },
};

// ── Deterministic scoring ────────────────────────────────────────────────────

export interface IScoreBreakdown {
  correctness: number;      // 0..100 — Judge0 results (weight 45)
  efficiency: number;       // 0..100 — complexity alignment + runtime (weight 20)
  codeQuality: number;      // 0..100 — AST structural evidence (weight 15)
  problemSolving: number;   // 0..100 — approach detection vs expected (weight 15)
  maintainability: number;  // 0..100 — decomposition/nesting (weight 5)
  overall: number;          // weighted total 0..100
  astAvailable: boolean;
}

// ── Gemini explainable feedback ──────────────────────────────────────────────

export interface IGeminiExplanation {
  summary: string;
  strengths: string[];
  improvements: string[];
  suggestedImprovement?: {
    title: string;
    description: string;
    complexityComparison?: string;
  };
  generatedBy: 'gemini' | 'fallback';
}

// ── API payloads ─────────────────────────────────────────────────────────────

export interface AuthedRequest extends Request {
  user?: { userId: string; [key: string]: unknown };
}

export interface RunRequest {
  problemSlug?: string;
  language: CodingLanguage;
  sourceCode: string;
  customInput?: string;
}

export interface SubmitRequest {
  problemSlug: string;
  language: CodingLanguage;
  sourceCode: string;
}

export interface SubmissionSummaryDTO {
  _id: string;
  problem: { title: string; slug: string; difficulty: string; category: string } | string;
  language: CodingLanguage;
  status: ExecutionStatus;
  passedTests: number;
  totalTests: number;
  runtimeMs: number;
  memoryKb: number | null;
  overallScore: number | null;
  submittedAt: string | Date;
}

export interface SubmissionDetailDTO extends SubmissionSummaryDTO {
  sourceCode: string;
  tests: ITestOutcome[];
  astAnalysis: IAstAnalysis | null;
  scoreBreakdown: IScoreBreakdown | null;
  explanation: IGeminiExplanation | null;
}
