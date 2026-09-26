/**
 * AETHER Coding — Visual Story types.
 *
 * A "story" is a deterministic, replayable sequence of visual steps built from
 * a REAL execution trace. Every step is a full snapshot, so scrubbing/seeking
 * backwards is always correct (no incremental replay needed).
 *
 * Nothing here executes user code and nothing here is AI-generated: the story
 * engine only reshapes normalized trace events into animation state.
 */

/** Visual states for a single array cell. */
export type CellState =
  | 'default'
  | 'active'      // current element under inspection
  | 'comparing'   // part of an active pair comparison
  | 'matched'     // success state
  | 'visited'     // already inspected
  | 'discarded'   // excluded from the active range (binary search / two pointers)
  | 'updated'     // value just written (DP / sorting swap)
  | 'queued';     // waiting in queue (BFS)

export type Verdict = 'true' | 'false' | 'match' | 'mismatch' | 'neutral';

/** A large central arithmetic/logic expression rendered progressively. */
export interface VizExpression {
  /** Left operand, e.g. "55" or "nums[2]" */
  left: string;
  /** Operator, e.g. "+", "−", ">", "max" */
  op: string;
  /** Right operand, e.g. "25" */
  right?: string;
  /** Result value, e.g. "80" */
  result?: string;
  /** Post-result verdict chip, e.g. "TRUE", "≠ TARGET", "MATCH" */
  verdict?: Verdict;
  verdictText?: string;
}

/** A named pointer travelling over the primary array. */
export interface VizPointer {
  label: string;           // i, j, L, R, low, mid, high, start, end, slow, fast…
  index: number;           // cell index it points at
  side: 'top' | 'bottom';  // where the arrow renders
  tone: 'primary' | 'indigo' | 'success' | 'warning' | 'rose';
}

/** A key→value memory snapshot (hash map / seen set). */
export interface MemoryEntry {
  key: string;
  value: string;
  highlight?: 'stored' | 'hit';
}

export type StepImportance = 'minor' | 'normal' | 'important' | 'critical';

/** One fully-resolved animation frame of the story. */
export interface VizStep {
  /** 1-based step number within the story */
  n: number;
  /** underlying trace event type (LINE, CONDITION, FUNCTION_CALL…) */
  event: string;
  /** 1-based source line this step maps to (0 = n/a) */
  line: number;
  /** short headline, e.g. "MATCH FOUND" */
  title?: string;
  /** one-sentence educational explanation for this step */
  explanation: string;
  importance: StepImportance;
  /** primary array snapshot (values as rendered) */
  cells: Array<{ value: string; state: CellState }>;
  /** labelled pointers over the primary array */
  pointers: VizPointer[];
  /** sliding-window span over the primary array */
  window?: { start: number; end: number } | null;
  /** binary-search / two-pointer active interval (outside cells fade) */
  interval?: { start: number; end: number } | null;
  /** central animated expression */
  expression?: VizExpression | null;
  /** live operation counters, e.g. { comparisons: 3 } */
  counters: Record<string, number>;
  /** the counter shown prominently, e.g. "comparisons" */
  counterKey?: string;
  /** seen/hash memory strip snapshot */
  memory?: { label: string; entries: MemoryEntry[] } | null;
  /** stack snapshot (bottom → top) */
  stack?: { items: Array<{ value: string; state: CellState }>; op?: 'push' | 'pop' } | null;
  /** queue snapshot (front → rear) */
  queue?: { items: Array<{ value: string; state: CellState }>; op?: 'enqueue' | 'dequeue' } | null;
  /** graph nodes (adjacency view) */
  graph?: {
    nodes: Array<{ id: string; neighbors: string[]; state: CellState }>;
  } | null;
  /** 2D matrix snapshot with optional active cell */
  matrix?: {
    name: string;
    rows: string[][];
    active?: [number, number] | null;
    write?: { at: [number, number]; from: string; to: string } | null;
  } | null;
  /** linked-list nodes (left → right) */
  linkedList?: {
    nodes: Array<{ value: string; state: CellState }>;
  } | null;
  /** call stack frames (bottom → top) */
  callStack?: string[];
  /** recursion frames with args + return values */
  recursion?: {
    frames: Array<{ label: string; depth: number; returnValue?: string; state: CellState }>;
  } | null;
  /** accumulated stdout at this step */
  output?: string;
  /** runtime error state (§41) */
  error?: { message: string } | null;
  /** matched cell indices for MATCH FOUND moments */
  matched?: number[] | null;
}

/** Identified visualization mode (§35/§36). */
export type VizMode =
  | 'array'
  | 'two-pointer'
  | 'sliding-window'
  | 'binary-search'
  | 'sorting'
  | 'hash-map'
  | 'stack'
  | 'queue'
  | 'graph'
  | 'matrix'
  | 'linked-list'
  | 'recursion'
  | 'dynamic-programming'
  | 'generic';

export interface Story {
  mode: VizMode;
  /** problem title/objective for the canvas header (§4) */
  problemTitle?: string;
  problemObjective?: string;
  /** human label of the approach, e.g. "BRUTE FORCE", "HASH MAP" */
  approachLabel: string;
  /** one-line educational mantra for the approach (§10) */
  mantra: string;
  /** which counter drives the headline metric */
  counterKey: string;
  counterLabelSingular: string;
  steps: VizStep[];
  /** primary array name when one exists */
  arrayName?: string;
  /** target scalar when derivable */
  target?: number | null;
  /** evidence used to pick this mode (§36) */
  evidence: string[];
}

/** Story engine input. */
export interface StoryInput {
  events: Array<{
    step: number;
    line: number;
    event: string;
    function: string;
    variables?: Record<string, unknown>;
    collections?: Record<string, unknown>;
    stdout?: string;
    callDepth: number;
    callStack?: string[];
    note?: string;
  }>;
  patterns: Array<{ pattern: string; variables?: string[] }>;
  /** AST-derived approach hint from analysis, e.g. "hash-map" */
  approachHint?: string;
  /** AST-detected data structures, e.g. ["array", "hashmap"] */
  dataStructures?: string[];
  /** AST complexity evidence for the final summary */
  complexity?: { estimatedTime?: string; estimatedSpace?: string; evidence?: string[] } | null;
  /** problem title/objective for the header (§4) */
  problemTitle?: string;
  problemObjective?: string;
  runtimeError?: string | null;
}
