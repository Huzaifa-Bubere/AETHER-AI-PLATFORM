/**
 * AETHER Coding — Trace → Visual Story reducer (TraceStateReducer).
 *
 * Deterministically converts a normalized REAL execution trace into a list of
 * fully-resolved animation frames (VizStep). Every frame is a complete
 * snapshot, so timeline scrubbing and backward jumps are always correct.
 *
 * The engine NEVER invents values: expressions, counters, memory strips and
 * pointers are derived exclusively from the trace's variables/collections.
 */

import type {
  CellState, MemoryEntry, Story, StoryInput, StepImportance, Verdict,
  VizExpression, VizPointer, VizStep,
} from './story.types';
import {
  approachLabels, flattenLinkedList, identifyMode, looksLikeGraph,
} from './identify';

type RawEvent = StoryInput['events'][number];

// ── Small value helpers ─────────────────────────────────────────────────────

function fmt(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000);
  if (typeof v === 'string') return /^-?\d+(\.\d+)?$/.test(v) ? v : `"${v}"`;
  try { return JSON.stringify(v); } catch { return String(v); }
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v);
  return null;
}

function numericArray(v: unknown): number[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.map(toNum);
  return out.every(n => n !== null) ? (out as number[]) : null;
}

function explanationFor(mode: string, ctx: {
  matched?: boolean; stored?: boolean; swapped?: boolean;
  discardedHalf?: 'left' | 'right' | null;
  windowGrew?: boolean; windowShrank?: boolean;
  pushed?: boolean; popped?: boolean; enqueued?: boolean; dequeued?: boolean;
  returned?: boolean; writing?: boolean; pointer?: string;
}): string {
  if (ctx.matched) return 'A match was found — the algorithm can stop here.';
  switch (mode) {
    case 'hash-map':
      if (ctx.stored) return 'Store this number in memory so its complement can find it later.';
      return 'Look up the complement needed to reach the target.';
    case 'two-pointer':
      if (ctx.discardedHalf === 'left') return 'The sum is too small — only moving the left pointer can help.';
      if (ctx.discardedHalf === 'right') return 'The sum is too large — only moving the right pointer can help.';
      return 'Compare the pair at the two pointers.';
    case 'sliding-window':
      if (ctx.windowShrank) return 'The range broke its rule — shrink it from the left.';
      if (ctx.windowGrew) return 'Grow the window by including the next element.';
      return 'Keep the active range valid while scanning.';
    case 'binary-search':
      if (ctx.discardedHalf === 'left') return 'Discard the left half — it cannot contain the target.';
      if (ctx.discardedHalf === 'right') return 'Discard the right half — it cannot contain the target.';
      return 'Check the middle element against the target.';
    case 'sorting':
      if (ctx.swapped) return 'These neighbours were out of order — they swapped.';
      return 'Compare neighbouring elements.';
    case 'stack':
      if (ctx.pushed) return 'Push the value onto the top of the stack.';
      if (ctx.popped) return 'Pop the top of the stack.';
      return 'Operate on the top of the stack.';
    case 'queue':
      if (ctx.enqueued) return 'Enqueue the value at the rear of the queue.';
      if (ctx.dequeued) return 'Dequeue the front of the queue.';
      return 'Process the front of the queue.';
    case 'graph':
      return 'Visit the current node and record it.';
    case 'recursion':
      if (ctx.returned) return 'This call returns its value back to the caller.';
      return 'Recurse deeper on the smaller subproblem.';
    case 'dynamic-programming':
      if (ctx.writing) return 'Fill this cell from previously computed subproblems.';
      return 'Read the subproblem answers needed for this cell.';
    case 'linked-list':
      if (ctx.pointer) return `Advance the ${ctx.pointer} pointer to the next node.`;
      return 'Walk the chain one node at a time.';
    default:
      return 'Inspect the current element.';
  }
}

function verdictOf(op: string, cmp: number): { verdict: Verdict; text: string } {
  if (op === '>') return cmp > 0 ? { verdict: 'true', text: 'TRUE' } : { verdict: 'false', text: 'FALSE' };
  if (op === '<') return cmp < 0 ? { verdict: 'true', text: 'TRUE' } : { verdict: 'false', text: 'FALSE' };
  return cmp === 0 ? { verdict: 'true', text: 'TRUE' } : { verdict: 'false', text: 'FALSE' };
}

function findVisitedVar(vars: Record<string, unknown>): unknown {
  for (const [k, v] of Object.entries(vars || {})) {
    if (/^(visited|vis|seen_set|visited_set)$/.test(k.toLowerCase())) return v;
  }
  return null;
}

function firstErrorLine(stdout: string): string {
  for (const line of stdout.split('\n')) {
    if (line.trim()) return line.trim().slice(0, 200);
  }
  return 'Runtime error';
}

function lastNonEmptyVariables(events: RawEvent[]): Record<string, unknown> {
  for (let i = events.length - 1; i >= 0; i--) {
    const v = events[i].variables;
    if (v && Object.keys(v).length > 0) return v;
  }
  return {};
}

function deriveCondition(vars: Record<string, unknown>, arr: number[] | null): VizExpression | null {
  const nums = Object.entries(vars).filter(([, v]) => toNum(v) !== null).slice(0, 2);
  if (nums.length === 2) {
    const [k1, v1] = nums[0];
    const [k2, v2] = nums[1];
    const a = toNum(v1)!;
    const b = toNum(v2)!;
    // Ignore index-like variables (0,1,2…) — prefer meaningful scalars.
    const idxLike = (k: string, n: number) => /^(i|j|k|idx|index)$/i.test(k) && n >= 0 && n < (arr ? arr.length : 16);
    if (idxLike(k1, a) && !idxLike(k2, b)) {
      const v = verdictOf('=', a - b);
      return { left: k2, op: '=', right: fmt(b), verdict: v.verdict, verdictText: v.text };
    }
    if (idxLike(k2, b) && !idxLike(k1, a)) {
      const v = verdictOf('=', a - b);
      return { left: k1, op: '=', right: fmt(a), verdict: v.verdict, verdictText: v.text };
    }
    const op = a > b ? '>' : a < b ? '<' : '=';
    const v = verdictOf(op, a - b);
    return { left: `${fmt(a)} (${k1})`, op, right: `${fmt(b)} (${k2})`, verdict: v.verdict, verdictText: v.text };
  }
  if (nums.length === 1) {
    const [k1, v1] = nums[0];
    return { left: k1, op: '=', right: fmt(v1) };
  }
  return null;
}

// ── The reducer ─────────────────────────────────────────────────────────────

export function buildStory(input: StoryInput): Story {
  const decision = identifyMode(input);
  const mode = decision.mode;
  const events = input.events.filter(e => e.event !== 'OUTPUT');

  // Detect a nested i/j pair scan (brute-force two-sum style) so the label can
  // say BRUTE FORCE instead of TWO POINTERS.
  let sawI = false, sawJ = false;
  for (const e of events) {
    const keys = new Set(Object.keys(e.variables || {}).map(k => k.toLowerCase()));
    if (keys.has('i')) sawI = true;
    if (keys.has('j')) sawJ = true;
  }
  const nestedPairScan = sawI && sawJ && (mode === 'two-pointer' || mode === 'array');

  const labels = approachLabels(mode, nestedPairScan);

  // ── Primary array + target discovery ─────────────────────────────────────
  let arrayName: string | undefined;
  let primaryArray: number[] | null = null;
  const ARRAY_KEY = /^(nums|arr|array|a|list|values|data|heights|prices|items)$/i;
  for (const e of events) {
    for (const [name, value] of Object.entries(e.collections || {})) {
      const arr = numericArray(value);
      if (arr && arr.length >= 2 && arr.length <= 64) {
        if (!primaryArray || ARRAY_KEY.test(name)) {
          arrayName = name;
          primaryArray = arr;
        }
        if (ARRAY_KEY.test(name)) break;
      }
    }
  }

  const targetKeys = ['target', 't', 'k', 'goal', 'key', 'needle', 'wanted'];
  let target: number | null = null;
  const lastVars = lastNonEmptyVariables(events);
  for (const src of [lastVars]) {
    for (const k of targetKeys) {
      const n = toNum(src[k]);
      if (n !== null) { target = n; break; }
    }
    if (target !== null) break;
  }

  // ── Per-frame working state ──────────────────────────────────────────────
  const steps: VizStep[] = [];
  const counters: Record<string, number> = {};
  const bump = (key: string) => { counters[key] = (counters[key] || 0) + 1; };

  // Live cell values — a separate mirror of the array so sorting swaps and
  // ARRAY_UPDATE writes mutate what is displayed (trace snapshots are truth).
  let liveValues: number[] = primaryArray ? [...primaryArray] : [];
  const cellStates: CellState[] = liveValues.map(() => 'default');
  const pointers = new Map<string, VizPointer>();
  let window: { start: number; end: number } | null = null;
  let interval: { start: number; end: number } | null = null;
  let memory: MemoryEntry[] = [];
  let memoryLabel = 'SEEN';
  let stackItems: Array<{ value: string; state: CellState }> = [];
  let stackOp: 'push' | 'pop' | undefined;
  let queueItems: Array<{ value: string; state: CellState }> = [];
  let queueOp: 'enqueue' | 'dequeue' | undefined;
  let graphNodes: Array<{ id: string; neighbors: string[]; state: CellState }> = [];
  let matrix: { name: string; rows: string[][] } | null = null;
  let matrixActive: [number, number] | null = null;
  let matrixWrite: { at: [number, number]; from: string; to: string } | null = null;
  let linkedNodes: Array<{ value: string; state: CellState }> | null = null;
  let matchedIdx: number[] | null = null;
  let matchFound = false;
  let runtimeError: string | null = input.runtimeError || null;
  let prevSizes = new Map<string, number>();
  let prevStackValues: string[] = [];
  let prevQueueValues: string[] = [];
  let lastVarsCache: Record<string, unknown> = {};
  // Cursor for index-less scans (`for price in prices`) — the current element
  // is identified by VALUE from the trace scalars, advancing monotonically.
  let scanCursor = 0;

  /**
   * Locate the current element of an index-less scan. Finds a scalar that is
   * NOT an index-like variable whose value equals an array element at/after
   * the cursor. Returns the element index and loop-variable name, or null.
   */
  const detectScanIndex = (vars: Record<string, unknown>): { index: number; name: string } | null => {
    const skipNames = /^(i|j|k|idx|index|n|len|length|target|best|max_profit|min_price|min_profit|total|count)$/i;
    for (const [k, v] of Object.entries(vars)) {
      if (skipNames.test(k)) continue;
      const n = toNum(v);
      if (n === null) continue;
      for (let ix = scanCursor; ix < liveValues.length; ix++) {
        if (liveValues[ix] === n) return { index: ix, name: k };
      }
    }
    return null;
  };
  const lastCollection: Record<string, unknown> = {};

  const pointerTones: Record<string, VizPointer['tone']> = {
    l: 'primary', left: 'primary', low: 'primary', start: 'primary', buy: 'primary', slow: 'primary', head: 'primary',
    r: 'success', right: 'success', high: 'success', end: 'success', sell: 'success', fast: 'success',
    i: 'indigo', j: 'warning', mid: 'warning', curr: 'indigo', current: 'indigo', prev: 'rose',
  };

  /** Read the first available pointer value from the live pointer map. */
  const ptr = (names: string[]): number | null => {
    for (const n of names) {
      const p = pointers.get(n);
      if (p) return p.index;
    }
    return null;
  };

  const applyPointers = (vars: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(vars)) {
      const key = k.toLowerCase();
      const n = toNum(v);
      if (n === null) continue;
      if (
        ['i', 'j', 'mid', 'curr', 'current', 'idx'].includes(key) ||
        /^(left|right|l|r|low|high|start|end|slow|fast|buy|sell|head|prev)$/.test(key)
      ) {
        if (n >= -1 && n <= 4096) {
          pointers.set(key, {
            label: k,
            index: n,
            side: key === 'j' || key === 'r' || key === 'right' || key === 'high' || key === 'end' || key === 'sell' || key === 'fast' ? 'bottom' : 'top',
            tone: pointerTones[key] || 'indigo',
          });
        }
      }
    }
  };

  const syncStructures = (collections: Record<string, unknown>) => {
    for (const [name, value] of Object.entries(collections)) {
      const key = name.toLowerCase();
      if (Array.isArray(value)) {
        if (/^(stack|st|stk|s)$/.test(key)) {
          const values = value.map(v => fmt(v));
          stackOp = values.length > prevStackValues.length ? 'push'
            : values.length < prevStackValues.length ? 'pop' : undefined;
          const topChanged = values[values.length - 1] !== prevStackValues[prevStackValues.length - 1];
          stackItems = values.map((v, i) => ({
            value: v,
            state: i === values.length - 1 && (stackOp || topChanged) ? 'active' : 'default',
          }));
          prevStackValues = values;
        } else if (/^(queue|q|dq|deque|frontier|bfs_queue)$/.test(key)) {
          const values = value.map(v => fmt(v));
          queueOp = values.length > prevQueueValues.length ? 'enqueue'
            : values.length < prevQueueValues.length ? 'dequeue' : undefined;
          queueItems = values.map((v, i) => ({
            value: v,
            state: (queueOp === 'enqueue' && i === values.length - 1) || (queueOp === 'dequeue' && i === 0) ? 'active' : 'default',
          }));
          prevQueueValues = values;
        } else {
          const arr = numericArray(value);
          if (arr && value.length > 0 && !Array.isArray(value[0])) {
            // Primary array (first numeric array wins; named arrays preferred).
            if (!ARRAY_KEY.test(arrayName || '') && (!primaryArray || ARRAY_KEY.test(name))) {
              arrayName = name;
              primaryArray = arr;
              liveValues = [...arr];
            } else if (name === arrayName && !sameArr(arr, liveValues)) {
              // In-place mutation of the primary array (sorting swap / write).
              const changed = diffIndices(liveValues, arr);
              liveValues = [...arr];
              for (const ix of changed) if (cellStates[ix] !== 'matched') cellStates[ix] = 'updated';
            } else if (!primaryArray) {
              primaryArray = arr;
              liveValues = [...arr];
            }
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        if (/graph|adj/.test(key) || looksLikeGraph(name, value)) {
          const visited = new Set<string>();
          const visitedVar = findVisitedVar(lastVarsCache);
          if (Array.isArray(visitedVar)) visitedVar.forEach(v => visited.add(String(v)));
          graphNodes = Object.entries(value as Record<string, unknown>).map(([node, neighbors]) => ({
            id: node,
            neighbors: Array.isArray(neighbors) ? (neighbors as unknown[]).map(n => String(n)) : [],
            state: visited.has(node) ? 'visited' : 'default',
          }));
        } else if (Array.isArray((value as unknown[])[0])) {
          matrix = { name, rows: (value as unknown[][]).map(row => (row as unknown[]).map(c => fmt(c))) };
        } else {
          const chain = flattenLinkedList(value);
          if (chain && chain.length > 1) {
            linkedNodes = chain.map(x => ({ value: x.value, state: 'default' as CellState }));
          } else {
            memoryLabel = /^(seen|visited)$/.test(key) ? 'SEEN' : name.toUpperCase();
            const entries: MemoryEntry[] = Object.entries(value as Record<string, unknown>)
              .slice(0, 48)
              .map(([ek, ev]) => ({ key: ek, value: fmt(ev) }));
            const prevCount = memory.length;
            memory = entries;
            if (entries.length > prevCount) {
              for (let i = prevCount; i < entries.length; i++) entries[i].highlight = 'stored';
            }
          }
        }
      }
    }
  };

  const pushFrame = (e: RawEvent, extra: { expression?: VizExpression | null; title?: string; explanation?: string }) => {
    const n = steps.length + 1;
    const importance: StepImportance =
      extra.title === 'MATCH FOUND' || extra.title === 'VISUALIZATION STOPPED' ? 'critical'
      : e.event === 'FUNCTION_RETURN' ? 'critical'
      : e.event === 'CONDITION' ? 'normal'
      : e.event === 'FUNCTION_CALL' || e.event === 'RECURSION_CALL' ? 'important'
      : 'minor';

    steps.push({
      n,
      event: e.event,
      line: e.line || 0,
      explanation: extra.explanation || explanationFor(mode, {}),
      importance,
      cells: liveValues.map((v, idx) => ({ value: fmt(v), state: cellStates[idx] })),
      pointers: [...pointers.values()].sort((a, b) => a.index - b.index),
      window: window ? { ...window } : null,
      interval: interval ? { ...interval } : null,
      counters: { ...counters },
      counterKey: labels.counterKey,
      memory: memory.length ? { label: memoryLabel, entries: memory.map(m => ({ ...m })) } : null,
      stack: stackItems.length || stackOp ? { items: stackItems.map(s => ({ ...s })), op: stackOp } : null,
      queue: queueItems.length || queueOp ? { items: queueItems.map(q => ({ ...q })), op: queueOp } : null,
      graph: graphNodes.length ? { nodes: graphNodes.map(g => ({ ...g, neighbors: [...g.neighbors] })) } : null,
      matrix: matrix ? { name: matrix.name, rows: matrix.rows.map(r => [...r]), active: matrixActive, write: matrixWrite } : null,
      linkedList: linkedNodes ? { nodes: linkedNodes.map(x => ({ ...x })) } : null,
      callStack: e.callStack && e.callStack.length ? [...e.callStack] : undefined,
      recursion: e.event === 'RECURSION_CALL' || e.event === 'FUNCTION_CALL' || e.event === 'FUNCTION_RETURN'
        ? buildRecursionFrames(events, steps.length, e)
        : undefined,
      output: e.stdout || undefined,
      error: runtimeError ? { message: runtimeError } : null,
      matched: matchedIdx ? [...matchedIdx] : null,
      title: extra.title,
      expression: extra.expression ?? null,
    });
  };

  // ── Main event walk ──────────────────────────────────────────────────────
  for (const e of events) {
    const vars = e.variables || {};
    const varsNoRet = { ...vars };
    delete varsNoRet.__ret;
    if (Object.keys(varsNoRet).length > 0) {
      lastVarsCache = { ...lastVarsCache, ...varsNoRet };
      applyPointers(varsNoRet);
    }
    if (e.collections && Object.keys(e.collections).length > 0) {
      Object.assign(lastCollection, e.collections);
      syncStructures(e.collections);
    }

    // Window / interval derived from pointer pairs
    const l = ptr(['left', 'l', 'low', 'start']);
    const r = ptr(['right', 'r', 'high', 'end']);
    if (l !== null && r !== null) {
      if (l <= r) { window = { start: l, end: r }; interval = { start: l, end: r }; }
      else { window = null; interval = null; }
    } else {
      window = null;
      if (l === null && r === null) interval = null;
    }
    const mid = ptr(['mid']);
    if (mode === 'binary-search' && mid !== null) {
      const lo = ptr(['left', 'l', 'low']);
      const hi = ptr(['right', 'r', 'high']);
      if (lo !== null && hi !== null) interval = { start: lo, end: hi };
    }

    let expr: VizExpression | null = null;
    let title: string | undefined;
    let explanation: string | undefined;

    // Hash-map memory size delta counter
    for (const [name, value] of Object.entries(lastCollection)) {
      const size = Array.isArray(value) ? value.length
        : typeof value === 'object' && value !== null ? Object.keys(value as object).length : 0;
      const prev = prevSizes.get(name);
      if (prev !== undefined && size !== prev && /^(seen|memo|map|hash|cache|count|freq)/i.test(name)) {
        bump('lookups');
      }
      prevSizes.set(name, size);
    }

    if (e.event === 'CONDITION' || e.event === 'LINE') {
      // ── Brute-force pair scan (i, j) ──
      const i = ptr(['i']);
      const j = ptr(['j']);
      if (expr === null && liveValues.length && i !== null && j !== null && i !== j
        && liveValues[i] !== undefined && liveValues[j] !== undefined
        && (nestedPairScan || mode === 'array')) {
        cellStates[i] = 'comparing';
        cellStates[j] = 'comparing';
        for (let x = 0; x < cellStates.length; x++) {
          if (cellStates[x] === 'comparing' && x !== i && x !== j) cellStates[x] = 'visited';
        }
        pointers.set('i', { label: 'i', index: i, side: 'top', tone: 'indigo' });
        pointers.set('j', { label: 'j', index: j, side: 'bottom', tone: 'warning' });
        if (target !== null) {
          const sum = liveValues[i] + liveValues[j];
          bump('comparisons');
          if (sum === target) {
            expr = { left: `${fmt(liveValues[i])} + ${fmt(liveValues[j])}`, op: '=', right: fmt(target), verdict: 'match', verdictText: 'MATCH' };
            title = 'MATCH FOUND';
            cellStates[i] = 'matched';
            cellStates[j] = 'matched';
            matchedIdx = [i, j];
            matchFound = true;
          } else {
            expr = { left: `${fmt(liveValues[i])} + ${fmt(liveValues[j])}`, op: '=', right: fmt(sum), verdict: 'mismatch', verdictText: `≠ ${fmt(target)}` };
          }
          explanation = explanationFor('two-pointer', { matched: matchFound });
        } else {
          expr = { left: `${fmt(liveValues[i])}`, op: '+', right: fmt(liveValues[j]) };
        }
      }

      // ── Two-pointer converging sum (L/R) ──
      const lp = ptr(['l', 'left', 'low', 'start', 'slow']);
      const rp = ptr(['r', 'right', 'high', 'end', 'fast']);
      if (expr === null && liveValues.length && lp !== null && rp !== null && !nestedPairScan
        && lp !== rp && liveValues[lp] !== undefined && liveValues[rp] !== undefined && target !== null
        && (mode === 'two-pointer' || mode === 'sliding-window')) {
        const sum = liveValues[lp] + liveValues[rp];
        bump('comparisons');
        cellStates[lp] = 'comparing';
        cellStates[rp] = 'comparing';
        if (sum === target) {
          expr = { left: `${fmt(liveValues[lp])} + ${fmt(liveValues[rp])}`, op: '=', right: fmt(target), verdict: 'match', verdictText: 'MATCH' };
          title = 'MATCH FOUND';
          cellStates[lp] = 'matched';
          cellStates[rp] = 'matched';
          matchedIdx = [lp, rp];
          matchFound = true;
        } else if (sum < target) {
          expr = { left: fmt(sum), op: '<', right: fmt(target), verdict: 'true', verdictText: 'TOO SMALL' };
        } else {
          expr = { left: fmt(sum), op: '>', right: fmt(target), verdict: 'false', verdictText: 'TOO LARGE' };
        }
      }

      // ── Binary search mid probe ──
      if (expr === null && mode === 'binary-search' && mid !== null && liveValues[mid] !== undefined) {
        bump('iterations');
        const midVal = liveValues[mid];
        cellStates[mid] = 'active';
        if (target !== null) {
          if (midVal === target) {
            expr = { left: fmt(midVal), op: '=', right: fmt(target), verdict: 'match', verdictText: 'MATCH' };
            title = 'MATCH FOUND';
            cellStates[mid] = 'matched';
            matchedIdx = [mid];
            matchFound = true;
          } else if (midVal < target) {
            expr = { left: fmt(midVal), op: '<', right: fmt(target), verdict: 'true', verdictText: 'GO RIGHT' };
          } else {
            expr = { left: fmt(midVal), op: '>', right: fmt(target), verdict: 'true', verdictText: 'GO LEFT' };
          }
          explanation = explanationFor('binary-search', {});
        } else {
          expr = { left: `nums[${mid}]`, op: '=', right: fmt(midVal) };
        }
      }

      // ── Hash-map complement lookup ──
      if (expr === null && mode === 'hash-map' && target !== null && liveValues.length) {
        const idx = ptr(['i', 'curr', 'current', 'idx']);
        if (idx !== null && liveValues[idx] !== undefined) {
          const current = liveValues[idx];
          cellStates[idx] = 'active';
          const complement = target - current;
          const hit = memory.find(m => m.key === String(complement));
          bump('lookups');
          if (hit) {
            hit.highlight = 'hit';
            const hitIdx = liveValues.findIndex((v, ix) => String(v) === hit.value && ix !== idx);
            if (hitIdx >= 0) cellStates[hitIdx] = 'matched';
            cellStates[idx] = 'matched';
            expr = { left: `${fmt(target)} − ${fmt(current)}`, op: '=', right: fmt(complement), verdict: 'match', verdictText: 'FOUND IN SEEN' };
            title = 'MATCH FOUND';
            matchedIdx = [hitIdx >= 0 ? hitIdx : idx, idx];
            matchFound = true;
            explanation = explanationFor('hash-map', { matched: true });
          } else {
            expr = { left: `${fmt(target)} − ${fmt(current)}`, op: '=', right: fmt(complement), verdict: 'mismatch', verdictText: 'NOT IN SEEN' };
            explanation = explanationFor('hash-map', { stored: false });
          }
        }
      }

      // ── Sorting neighbour comparison ──
      if (expr === null && mode === 'sorting') {
        const a = ptr(['i', 'a']);
        const b = ptr(['j', 'b']);
        if (a !== null && b !== null && a !== b && liveValues[a] !== undefined && liveValues[b] !== undefined) {
          cellStates[a] = 'comparing';
          cellStates[b] = 'comparing';
          const cmp = liveValues[a] - liveValues[b];
          const v = verdictOf('>', cmp);
          expr = { left: fmt(liveValues[a]), op: '>', right: fmt(liveValues[b]), verdict: v.verdict, verdictText: v.text };
          bump('comparisons');
          if (cmp > 0) bump('swaps');
          explanation = explanationFor('sorting', { swapped: cmp > 0 });
        }
      }

      // ── Index-less array scan (for x in array, no numeric index var) ──
      // e.g. maxProfit: `for price in prices` — locate the current element by
      // value among the trace scalars, at or after the previous cursor.
      if (expr === null && liveValues.length && (mode === 'array' || mode === 'generic')) {
        const found = detectScanIndex(varsNoRet);
        if (found) {
          const { index: foundIdx, name: loopVar } = found;
          cellStates[foundIdx] = 'active';
          for (let x = 0; x < foundIdx; x++) {
            if (cellStates[x] === 'default' || cellStates[x] === 'active' || cellStates[x] === 'comparing') cellStates[x] = 'visited';
          }
          pointers.set('curr', { label: loopVar.slice(0, 6), index: foundIdx, side: 'top', tone: 'indigo' });
          // Show the most informative tracked scalar: min/max trackers first,
          // then the loop variable itself.
          const tracked = ['max_profit', 'maxProfit', 'best', 'min_price', 'minPrice', 'min_val', 'lowest']
            .find(k => varsNoRet[k] !== undefined && toNum(varsNoRet[k]) !== null);
          if (tracked) {
            expr = { left: tracked.replace(/_/g, ' '), op: '=', right: fmt(varsNoRet[tracked]) };
          } else {
            expr = { left: loopVar, op: '=', right: fmt(varsNoRet[loopVar] ?? liveValues[foundIdx]) };
          }
          if (foundIdx >= scanCursor) {
            bump('comparisons');
            scanCursor = foundIdx + 1;
          }
        }
      }

      // ── Generic condition ──
      if (expr === null && e.event === 'CONDITION') {
        const cond = deriveCondition(varsNoRet, liveValues);
        if (cond) expr = cond;
      }
    }

    // Array writes / updates
    if (e.event === 'ARRAY_UPDATE') {
      const idx = ptr(['i', 'idx', 'curr', 'current', 'j']);
      if (idx !== null && idx >= 0 && idx < cellStates.length && cellStates[idx] !== 'matched') {
        cellStates[idx] = 'updated';
      }
      bump('writes');
    }
    if (e.event === 'STACK_PUSH') { bump('operations'); stackOp = 'push'; }
    if (e.event === 'STACK_POP') { bump('operations'); stackOp = 'pop'; }
    if (e.event === 'QUEUE_ENQUEUE') { bump('operations'); queueOp = 'enqueue'; }
    if (e.event === 'QUEUE_DEQUEUE') { bump('operations'); queueOp = 'dequeue'; }

    // Graph traversal state
    if (mode === 'graph' && graphNodes.length) {
      const visitedVar = findVisitedVar(varsNoRet) || findVisitedVar(lastVarsCache);
      const curr = typeof varsNoRet.curr === 'string' ? varsNoRet.curr
        : typeof varsNoRet.current === 'string' ? varsNoRet.current
        : typeof varsNoRet.node === 'string' ? varsNoRet.node : null;
      const visitedSet = new Set((Array.isArray(visitedVar) ? visitedVar : []).map(v => String(v)));
      graphNodes = graphNodes.map(g => ({
        ...g,
        state: g.id === curr ? 'active' : visitedSet.has(g.id) ? 'visited' : g.state === 'visited' ? 'visited' : 'default',
      }));
      if (curr || visitedSet.size) bump('visited');
    }

    // Matrix / DP cursor + write animation
    if (matrix) {
      const mi = ptr(['r', 'row', 'i']);
      const mj = ptr(['c', 'col', 'j']);
      if (mi !== null && mj !== null && matrix.rows[mi]?.[mj] !== undefined) {
        const before = matrix.rows[mi][mj];
        matrixActive = [mi, mj];
        // Refresh matrix snapshot if the latest collection carries new values
        const latest = lastCollection[matrix.name];
        if (Array.isArray(latest)) {
          const rows = (latest as unknown[][]).map(row => (row as unknown[]).map(c => fmt(c)));
          if (JSON.stringify(rows) !== JSON.stringify(matrix.rows)) {
            matrix = { name: matrix.name, rows };
            const after = matrix.rows[mi]?.[mj];
            if (after !== undefined && before !== after) {
              matrixWrite = { at: [mi, mj], from: before, to: after };
              bump('fills');
              explanation = explanationFor('dynamic-programming', { writing: true });
            }
          }
        }
      }
    }

    // Runtime errors surfaced in the trace stdout
    if (/Traceback|RuntimeError|IndexError|KeyError|TypeError|ValueError|ERROR:/i.test(e.stdout || '')) {
      runtimeError = firstErrorLine(e.stdout || '');
      title = 'VISUALIZATION STOPPED';
    }

    pushFrame(e, { expression: expr, title, explanation });
  }

  // ── Final summary frame (§31) ────────────────────────────────────────────
  const finalOutput = input.events.length
    ? (input.events[input.events.length - 1]?.stdout || '')
    : '';
  steps.push({
    n: steps.length + 1,
    event: 'SUMMARY',
    line: 0,
    title: 'EXECUTION COMPLETE',
    explanation: runtimeError
      ? 'Execution stopped with an error — step backward to inspect the last valid state.'
      : matchFound
        ? 'The algorithm finished with a successful match.'
        : 'The algorithm has finished executing.',
    importance: 'critical',
    cells: liveValues.map((v, idx) => ({ value: fmt(v), state: matchedIdx?.includes(idx) ? 'matched' : 'visited' })),
    pointers: [],
    window: null,
    interval: null,
    counters: { ...counters },
    counterKey: labels.counterKey,
    memory: memory.length ? { label: memoryLabel, entries: memory.map(m => ({ ...m })) } : null,
    stack: null,
    queue: null,
    graph: graphNodes.length ? { nodes: graphNodes.map(g => ({ ...g, neighbors: [...g.neighbors] })) } : null,
    matrix: null,
    linkedList: null,
    callStack: undefined,
    recursion: undefined,
    output: finalOutput || undefined,
    error: runtimeError ? { message: runtimeError } : null,
    matched: matchedIdx ? [...matchedIdx] : null,
    expression: null,
  });

  return {
    mode,
    problemTitle: input.problemTitle,
    problemObjective: input.problemObjective,
    approachLabel: labels.label,
    mantra: labels.mantra,
    counterKey: labels.counterKey,
    counterLabelSingular: labels.counterSingular,
    steps,
    arrayName,
    target,
    evidence: decision.evidence,
  };
}

// ── Frame helpers ───────────────────────────────────────────────────────────

function sameArr(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function diffIndices(prev: number[], next: number[]): number[] {
  const out: number[] = [];
  const n = Math.min(prev.length, next.length);
  for (let i = 0; i < n; i++) if (prev[i] !== next[i]) out.push(i);
  return out;
}

function buildRecursionFrames(
  events: RawEvent[],
  upToStep: number,
  current: RawEvent,
): NonNullable<VizStep['recursion']> {
  const stack = current.callStack && current.callStack.length ? current.callStack : [current.function];
  const retVals = new Map<string, string>();
  for (let i = 0; i < upToStep && i < events.length; i++) {
    const e = events[i];
    if (e.event === 'FUNCTION_RETURN' && e.variables?.__ret !== undefined) {
      retVals.set(e.function, fmt(e.variables.__ret));
    }
  }
  return {
    frames: stack.map((frame, i) => ({
      label: frame,
      depth: i,
      state: i === stack.length - 1 ? 'active' : 'default',
      returnValue: retVals.get(frame),
    })),
  };
}
