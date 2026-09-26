/**
 * AETHER Coding — Algorithm identification (§36).
 *
 * Chooses the visualization mode from EVIDENCE ONLY: runtime patterns,
 * variable/pointer names, collection shapes and AST data-structure hints.
 * Never relies on the problem title or function name. When confidence is low
 * the story falls back to Generic Animated Execution — a wrong specialized
 * visualization is worse than an honest generic one.
 */

import type { StoryInput, VizMode } from './story.types';

export interface ModeDecision {
  mode: VizMode;
  confidence: number;
  evidence: string[];
}

const ARRAY_NAMES = /^(nums|arr|array|a|list|items|values|data|heights|prices|nums_list)$/i;
const MAP_NAMES = /^(seen|memo|map|hash|hashmap|dict|count|counter|freq|frequency|cache|prefix)$/i;
const STACK_NAMES = /^(stack|st|stk|s)$/i;
const QUEUE_NAMES = /^(queue|q|dq|deque|frontier|bfs_queue)$/i;
const DP_NAMES = /^(dp|table|grid|memo2d|cache2d)$/i;
const MATRIX_ROW_HINT = Array.isArray as unknown as (v: unknown) => boolean;

function isNumber(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v);
}

export function isNamedArray(name: string): boolean {
  return ARRAY_NAMES.test(name);
}

export function looksLikeGraph(name: string, value: unknown): boolean {
  if (typeof value !== 'object' || value === null || MATRIX_ROW_HINT(value)) return false;
  const n = name.toLowerCase();
  if (/graph|adj/.test(n)) return true;
  const vals = Object.values(value as Record<string, unknown>);
  return vals.length > 0 && vals.every(v => Array.isArray(v));
}

/** Flatten a serialized linked-list chain (Node {value|val, next}). */
export function flattenLinkedList(value: unknown, depth = 0): Array<{ value: string }> | null {
  if (depth > 64) return null;
  if (value === null || value === undefined) return [];
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const hasValue = 'value' in obj || 'val' in obj || 'data' in obj;
  const hasNext = 'next' in obj;
  if (!hasValue || !hasNext) return null;
  const v = (obj.value ?? obj.val ?? obj.data);
  const rest = flattenLinkedList(obj.next, depth + 1);
  if (rest === null) return null;
  return [{ value: String(v) }, ...rest];
}

/**
 * Identify the visualization mode with evidence.
 * Priority: recursion → sorting → binary-search → two-pointer/window →
 * stack/queue → graph → hash-map → matrix/dp → linked-list → array → generic.
 */
export function identifyMode(input: StoryInput): ModeDecision {
  const { events, patterns, dataStructures, approachHint } = input;
  const evidence: string[] = [];
  const patternNames = new Set(patterns.map(p => p.pattern));
  const ds = (dataStructures || []).map(d => String(d).toLowerCase());

  // ── Scan collection shapes across the trace ─────────────────────────────
  let sawStack = false, sawQueue = false, sawMap = false, sawMatrix = false;
  let sawGraph = false, sawLinkedList = false, sawNumericArray = false;
  const pointerNames = new Set<string>();
  let maxDepth = 0;
  let recursionCalls = 0;

  for (const e of events) {
    maxDepth = Math.max(maxDepth, e.callDepth || 0);
    if (e.event === 'RECURSION_CALL') recursionCalls++;
    for (const [name, value] of Object.entries(e.collections || {})) {
      if (Array.isArray(value) && value.length > 0 && Array.isArray(value[0])) sawMatrix = true;
      else if (Array.isArray(value) && STACK_NAMES.test(name)) sawStack = true;
      else if (Array.isArray(value) && QUEUE_NAMES.test(name)) sawQueue = true;
      else if (Array.isArray(value) && value.every(isNumber)) sawNumericArray = true;
      else if (typeof value === 'object' && value !== null && MAP_NAMES.test(name)) sawMap = true;
      else if (looksLikeGraph(name, value)) sawGraph = true;
      else if (flattenLinkedList(value) && flattenLinkedList(value)!.length > 0) sawLinkedList = true;
    }
    for (const k of Object.keys(e.variables || {})) {
      if (/^(i|j|k|left|right|l|r|low|high|mid|start|end|slow|fast|curr|current|buy|sell|head|prev)$/i.test(k)) {
        pointerNames.add(k.toLowerCase());
      }
    }
  }

  // ── Recursion ────────────────────────────────────────────────────────────
  if (patternNames.has('RECURSION') || recursionCalls > 0 || maxDepth >= 2) {
    evidence.push(`call depth ${maxDepth}${recursionCalls ? `, ${recursionCalls} recursive call(s)` : ''}`);
    if (!sawStack && !sawQueue) return { mode: 'recursion', confidence: 0.85, evidence };
  }

  // ── Sorting: array snapshots that get permuted over time ────────────────
  if (patternNames.has('SORTING')) {
    evidence.push('runtime pattern: SORTING');
    return { mode: 'sorting', confidence: 0.9, evidence };
  }
  const arrays = collectArraySnapshots(events);
  if (arrays.length >= 3) {
    let permutions = 0;
    for (let i = 1; i < arrays.length; i++) {
      if (sameMultiset(arrays[i - 1], arrays[i]) && !sameSequence(arrays[i - 1], arrays[i])) permutions++;
    }
    if (permutions >= 1 && permutions >= arrays.length * 0.15) {
      evidence.push(`${permutions} in-place reorder(s) of the same elements`);
      return { mode: 'sorting', confidence: 0.8, evidence };
    }
  }

  // ── Binary search: low/mid/high pointers ─────────────────────────────────
  if (pointerNames.has('mid') && (pointerNames.has('low') || pointerNames.has('high') || pointerNames.has('left') || pointerNames.has('right'))) {
    evidence.push('pointer variables low/mid/high observed');
    return { mode: 'binary-search', confidence: 0.9, evidence };
  }
  if (patternNames.has('BINARY_SEARCH')) {
    evidence.push('runtime pattern: BINARY_SEARCH');
    return { mode: 'binary-search', confidence: 0.85, evidence };
  }

  // ── Two pointers vs sliding window (movement direction) ─────────────────
  const twoPointer = pointerNames.has('left') || pointerNames.has('right') || pointerNames.has('low') || pointerNames.has('high')
    || (pointerNames.has('slow') && pointerNames.has('fast'))
    || patternNames.has('TWO_POINTER');
  if (twoPointer) {
    const dirs = pointerDirections(events, ['left', 'right', 'l', 'r', 'low', 'high', 'start', 'end', 'slow', 'fast']);
    const bothForward = dirs.size > 0 && [...dirs.values()].every(d => d === 'forward');
    if (bothForward && dirs.size >= 2) {
      evidence.push('left & right markers both only advance forward');
      return { mode: 'sliding-window', confidence: 0.75, evidence };
    }
    if (patternNames.has('SLIDING_WINDOW')) {
      evidence.push('runtime pattern: SLIDING_WINDOW');
      return { mode: 'sliding-window', confidence: 0.8, evidence };
    }
    evidence.push('two converging pointer variables observed');
    return { mode: 'two-pointer', confidence: 0.8, evidence };
  }

  // ── Stack / queue structures ─────────────────────────────────────────────
  if (sawStack) {
    evidence.push('stack collection with push/pop size changes');
    return { mode: 'stack', confidence: 0.85, evidence };
  }
  if (sawQueue) {
    evidence.push('queue collection with enqueue/dequeue size changes');
    return { mode: 'queue', confidence: 0.8, evidence };
  }

  // ── Graph traversal ──────────────────────────────────────────────────────
  if (sawGraph || patternNames.has('DFS_BFS')) {
    evidence.push('adjacency structure with visited tracking');
    return { mode: 'graph', confidence: 0.8, evidence };
  }

  // ── Hash map approaches ──────────────────────────────────────────────────
  if (sawMap || patternNames.has('HASHING') || ds.some(d => d.includes('hash') || d.includes('map'))) {
    evidence.push('hash-map/seen collection with lookups');
    return { mode: 'hash-map', confidence: 0.75, evidence };
  }

  // ── Matrix / DP ──────────────────────────────────────────────────────────
  if (sawMatrix || patternNames.has('DP_TABLE') || ds.some(d => d.includes('matrix') || d.includes('2d'))) {
    evidence.push('2D table with cell updates');
    return { mode: 'dynamic-programming', confidence: 0.7, evidence };
  }

  // ── Linked list ──────────────────────────────────────────────────────────
  if (sawLinkedList || ds.some(d => d.includes('linked'))) {
    evidence.push('linked node chain (value/next)');
    return { mode: 'linked-list', confidence: 0.75, evidence };
  }

  // ── Approach hint from AST analysis (secondary signal) ──────────────────
  const hint = String(approachHint || '').toLowerCase();
  if (hint.includes('two pointer')) return { mode: 'two-pointer', confidence: 0.6, evidence: ['AST approach hint'] };
  if (hint.includes('sliding')) return { mode: 'sliding-window', confidence: 0.6, evidence: ['AST approach hint'] };
  if (hint.includes('binary')) return { mode: 'binary-search', confidence: 0.6, evidence: ['AST approach hint'] };
  if (hint.includes('sort')) return { mode: 'sorting', confidence: 0.6, evidence: ['AST approach hint'] };
  if (hint.includes('hash')) return { mode: 'hash-map', confidence: 0.6, evidence: ['AST approach hint'] };
  if (hint.includes('bfs') || hint.includes('dfs') || hint.includes('graph')) return { mode: 'graph', confidence: 0.6, evidence: ['AST approach hint'] };
  if (hint.includes('stack')) return { mode: 'stack', confidence: 0.6, evidence: ['AST approach hint'] };
  if (hint.includes('queue')) return { mode: 'queue', confidence: 0.6, evidence: ['AST approach hint'] };
  if (hint.includes('recursion') || hint.includes('recursive')) return { mode: 'recursion', confidence: 0.6, evidence: ['AST approach hint'] };
  if (hint.includes('dynamic') || hint.includes('dp')) return { mode: 'dynamic-programming', confidence: 0.6, evidence: ['AST approach hint'] };

  // ── Fallbacks ────────────────────────────────────────────────────────────
  if (sawNumericArray) {
    evidence.push('numeric array scanned under a loop');
    return { mode: 'array', confidence: 0.5, evidence };
  }
  return { mode: 'generic', confidence: 0.4, evidence: ['no strong structural signal — generic animated execution'] };
}

export interface ApproachLabels {
  label: string;
  mantra: string;
  counterKey: string;
  counterSingular: string;
}

/** Deterministic educational copy per mode (§10) — no AI needed per step. */
export function approachLabels(mode: VizMode, isNestedPairScan: boolean): ApproachLabels {
  switch (mode) {
    case 'hash-map':
      return { label: 'HASH MAP', mantra: 'Remember every number you pass.', counterKey: 'lookups', counterSingular: 'LOOKUP' };
    case 'two-pointer':
      return isNestedPairScan
        ? { label: 'BRUTE FORCE', mantra: 'Check every pair.', counterKey: 'comparisons', counterSingular: 'COMPARISON' }
        : { label: 'TWO POINTERS', mantra: 'Move the pointer that can improve the sum.', counterKey: 'comparisons', counterSingular: 'COMPARISON' };
    case 'sliding-window':
      return { label: 'SLIDING WINDOW', mantra: 'Expand or shrink the active range.', counterKey: 'windows', counterSingular: 'WINDOW STEP' };
    case 'binary-search':
      return { label: 'BINARY SEARCH', mantra: 'Discard the half that cannot contain the target.', counterKey: 'iterations', counterSingular: 'ITERATION' };
    case 'sorting':
      return { label: 'SORTING', mantra: 'Swap neighbours that are out of order.', counterKey: 'swaps', counterSingular: 'SWAP' };
    case 'stack':
      return { label: 'STACK', mantra: 'Last in, first out.', counterKey: 'operations', counterSingular: 'OPERATION' };
    case 'queue':
      return { label: 'QUEUE', mantra: 'First in, first out.', counterKey: 'operations', counterSingular: 'OPERATION' };
    case 'graph':
      return { label: 'TRAVERSAL', mantra: 'Explore nodes level by level.', counterKey: 'visited', counterSingular: 'VISITED NODE' };
    case 'recursion':
      return { label: 'RECURSION', mantra: 'Follow one path before backtracking.', counterKey: 'calls', counterSingular: 'CALL' };
    case 'dynamic-programming':
    case 'matrix':
      return { label: 'DYNAMIC PROGRAMMING', mantra: 'Build the answer from smaller subproblems.', counterKey: 'fills', counterSingular: 'CELL FILL' };
    case 'linked-list':
      return { label: 'LINKED LIST', mantra: 'Walk the chain one node at a time.', counterKey: 'steps', counterSingular: 'NODE STEP' };
    case 'array':
      return { label: 'ARRAY SCAN', mantra: 'Inspect each element as you pass it.', counterKey: 'comparisons', counterSingular: 'COMPARISON' };
    default:
      return { label: 'EXECUTION', mantra: 'Watch each step of the execution.', counterKey: 'steps', counterSingular: 'STEP' };
  }
}

// ── Small helpers shared with the story engine ──────────────────────────────

export function collectArraySnapshots(events: StoryInput['events']): unknown[][] {
  const out: unknown[][] = [];
  for (const e of events) {
    for (const [name, value] of Object.entries(e.collections || {})) {
      if (Array.isArray(value) && !(value.length > 0 && Array.isArray(value[0])) && ARRAY_NAMES.test(name)) {
        out.push(value as unknown[]);
      }
    }
  }
  return out;
}

export function sameMultiset(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  const sig = (arr: unknown[]) => arr.map(v => JSON.stringify(v)).sort().join('|');
  return sig(a) === sig(b);
}

export function sameSequence(a: unknown[], b: unknown[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export type PointerDir = 'forward' | 'backward' | 'none';

export function pointerDirections(events: StoryInput['events'], names: string[]): Map<string, PointerDir> {
  const last = new Map<string, number>();
  const dir = new Map<string, PointerDir>();
  const set = new Set(names);
  for (const e of events) {
    for (const [k, v] of Object.entries(e.variables || {})) {
      const key = k.toLowerCase();
      if (!set.has(key) || !isNumber(v)) continue;
      const n = v as number;
      const prev = last.get(key);
      if (prev !== undefined && prev !== n) {
        dir.set(key, n > prev ? 'forward' : 'backward');
      }
      last.set(key, n);
    }
  }
  return dir;
}
