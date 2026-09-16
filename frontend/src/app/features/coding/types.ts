// AETHER Coding — frontend types (mirror backend contracts)

export type CodingLanguage = 'python' | 'javascript' | 'typescript' | 'java' | 'cpp' | 'c';
export type CodingDifficulty = 'Easy' | 'Medium' | 'Hard';
export type ExecutionStatus =
  | 'Accepted' | 'Wrong Answer' | 'Compilation Error'
  | 'Runtime Error' | 'Time Limit Exceeded' | 'Memory Limit Exceeded' | 'Internal Error';

export const CODING_LANGUAGES: Array<{ id: CodingLanguage; label: string; monaco: string }> = [
  { id: 'python', label: 'Python 3', monaco: 'python' },
  { id: 'javascript', label: 'JavaScript', monaco: 'javascript' },
  { id: 'typescript', label: 'TypeScript', monaco: 'typescript' },
  { id: 'java', label: 'Java', monaco: 'java' },
  { id: 'cpp', label: 'C++', monaco: 'cpp' },
  { id: 'c', label: 'C', monaco: 'c' },
];

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
  approachId: string;
  timeComplexity: string;
  spaceComplexity: string;
  outline: string;
  optimal: boolean;
}

export interface CodingProblem {
  _id: string;
  title: string;
  slug: string;
  description: string;
  difficulty: CodingDifficulty;
  category: string;
  tags: string[];
  companies?: string[];
  examples: IProblemExample[];
  constraints: string[];
  starterCode: Record<string, string> | Record<string, never>;
  sampleTests: ITestCase[];
  functionNames: Record<string, string>;
  knownApproaches?: IKnownApproach[];
  expectedTimeComplexity?: string;
  expectedSpaceComplexity?: string;
  points: number;
  hints?: string[];
  status?: { solved: boolean; attempted: boolean };
}

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
  executor: string;
}

// ── AST analysis (mirrors backend) ───────────────────────────────────────────

export interface IAstNode {
  id: string;
  type: string;
  label: string;
  loc?: { startLine: number; endLine: number; startCol?: number; endCol?: number };
  children: IAstNode[];
}

export interface IStructuralMetrics {
  statements: number; functions: number; maxFunctionLines: number; loops: number;
  nestedLoopDepth: number; conditionals: number; switches: number; maxNestingDepth: number;
  recursionDetected: boolean; breaks: number; continues: number; returns: number;
  variableDeclarations: number; functionCalls: number; tryCatch: number;
}

export interface IComplexityEstimate {
  estimatedTime: string;
  estimatedSpace: string;
  confidence: number;
  evidence: string[];
}

export interface IPatternDetection {
  detectedApproach: string;
  confidence: number;
  evidence: string[];
  secondaryApproaches: Array<{ approach: string; confidence: number }>;
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
  modularity: number;
  structuralReadability: number;
  excessiveNesting: boolean;
  largeFunctionDetected: boolean;
  issues: ICodeQualityIssue[];
}

export interface IAstAnalysis {
  parseSuccess: boolean;
  parser: 'acorn' | 'heuristic' | 'none';
  language: string;
  reason?: string;
  metrics: IStructuralMetrics;
  dataStructures: string[];
  patterns: string[];
  approach: IPatternDetection;
  complexity: IComplexityEstimate;
  quality: ICodeQuality;
  ast?: IAstNode;
  callGraph?: Array<{ caller: string; callee: string }>;
}

export interface IScoreBreakdown {
  correctness: number;
  efficiency: number;
  codeQuality: number;
  problemSolving: number;
  maintainability: number;
  overall: number;
  astAvailable: boolean;
}

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

export interface ISubmitResult {
  submissionId: string;
  status: ExecutionStatus;
  passedTests: number;
  totalTests: number;
  tests: ITestOutcome[];
  runtimeMs: number;
  memoryKb: number | null;
  compileOutput?: string;
  stderr?: string;
  executor?: string;
  astAnalysis: IAstAnalysis | null;
  scoreBreakdown: IScoreBreakdown | null;
  explanation: IGeminiExplanation | null;
  problem: { title: string; slug: string; difficulty: string; category: string };
}

export interface ISubmissionSummary {
  _id: string;
  problem: { _id: string; title: string; slug: string; difficulty: string; category: string };
  language: string;
  status: ExecutionStatus;
  passedTests: number;
  totalTests: number;
  runtimeMs: number;
  memoryKb: number | null;
  overallScore: number | null;
  submittedAt: string;
}

export interface ISubmissionDetail extends ISubmissionSummary {
  sourceCode: string;
  tests: ITestOutcome[];
  astAnalysis: IAstAnalysis | null;
  scoreBreakdown: IScoreBreakdown | null;
  explanation: IGeminiExplanation | null;
}

// ── Progress ─────────────────────────────────────────────────────────────────

export interface ICodingProgress {
  exists: boolean;
  solvedProblems: Array<{ problemId: string; solvedAt: string }>;
  attemptedProblems: Array<{ problemId: string; lastAttemptAt: string; attemptCount: number }>;
  topicStats: Array<{ topic: string; solved: number; attempted: number; averageScore: number; lastPracticedAt?: string }>;
  difficultyStats: Array<{ difficulty: CodingDifficulty; solved: number; attempted: number }>;
  streak: { current: number; longest: number; lastActiveDate?: string };
  totalSubmissions: number;
  acceptedSubmissions: number;
  averageCodingScore: number;
  languageUsage: Array<{ language: string; count: number }>;
  recentActivity: Array<{ date: string; submissions: number }>;
}

export interface IRecommendations {
  recommendations: Array<Pick<CodingProblem, '_id' | 'title' | 'slug' | 'difficulty' | 'category' | 'points'>>;
  reasoning: string;
}
