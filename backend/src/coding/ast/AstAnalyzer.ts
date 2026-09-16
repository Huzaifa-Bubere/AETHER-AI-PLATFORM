import * as walk from 'acorn-walk';
import type { Node } from 'acorn';
import { parseSource } from './LanguageParserRegistry';
import {
  CodingLanguage,
  IAstAnalysis,
  IAstNode,
  IStructuralMetrics,
  IPatternDetection,
  IComplexityEstimate,
  ICodeQuality,
  ICodeQualityIssue,
  AlgorithmApproachId,
  AST_UNAVAILABLE,
  IKnownApproach,
} from '../types/coding.types';

/**
 * AETHER Coding — AST Analysis Engine.
 *
 * Fully programmatic: acorn (JS/TS) or structural parser → metrics →
 * data-structure detection → approach rules → complexity estimate → quality.
 * No AI involved in this stage; Gemini only narrates these results later.
 *
 * Semantics:
 * - nestedLoopDepth: deepest LOOP CHAIN depth (0 = no loops, 1 = single loop,
 *   2 = loop inside a loop, …). Used for complexity and brute-force detection.
 * - maxNestingDepth: deepest CONTROL-FLOW nesting (loops/ifs/switch/try),
 *   not raw AST depth, so block wrappers don't inflate quality penalties.
 */

interface AnalysisContext {
  language: CodingLanguage;
  sourceLines: string[];
  problemContext?: {
    expectedTimeComplexity?: string;
    expectedSpaceComplexity?: string;
    knownApproaches?: IKnownApproach[];
  };
}

const LOOP_TYPES = new Set(['ForStatement', 'ForOfStatement', 'ForInStatement', 'WhileStatement', 'DoWhileStatement']);
const CONTROL_TYPES = new Set([...LOOP_TYPES, 'IfStatement', 'SwitchStatement', 'TryStatement']);

function emptyMetrics(): IStructuralMetrics {
  return {
    statements: 0, functions: 0, maxFunctionLines: 0, loops: 0, nestedLoopDepth: 0,
    conditionals: 0, switches: 0, maxNestingDepth: 0, recursionDetected: false,
    breaks: 0, continues: 0, returns: 0, variableDeclarations: 0, functionCalls: 0,
    tryCatch: 0,
  };
}

// ── Metrics pass (JS/TS via ESTree) ──────────────────────────────────────────

function metricsFromEstree(ast: Node): IStructuralMetrics {
  const metrics = emptyMetrics();
  const functionNames = new Set<string>();

  walk.full(ast, (node: any) => {
    switch (node.type) {
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        metrics.functions++;
        if (node.id?.name) functionNames.add(node.id.name);
        if (node.loc) {
          metrics.maxFunctionLines = Math.max(metrics.maxFunctionLines, node.loc.end.line - node.loc.start.line + 1);
        }
        break;
      case 'ForStatement':
      case 'ForOfStatement':
      case 'ForInStatement':
      case 'WhileStatement':
      case 'DoWhileStatement':
        metrics.loops++;
        break;
      case 'IfStatement': metrics.conditionals++; break;
      case 'SwitchStatement': metrics.switches++; break;
      case 'BreakStatement': metrics.breaks++; break;
      case 'ContinueStatement': metrics.continues++; break;
      case 'ReturnStatement': metrics.returns++; break;
      case 'VariableDeclarator': metrics.variableDeclarations++; break;
      case 'CallExpression': metrics.functionCalls++; break;
      case 'TryStatement': metrics.tryCatch++; break;
      default:
        if (/Statement$/.test(node.type)) metrics.statements++;
    }
  });

  // Recursion: self-call inside the function's own body (excluding the def line itself)
  walk.full(ast, (node: any) => {
    const isNamedFn = (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') && node.id?.name;
    if (!isNamedFn) return;
    let selfCall = false;
    walk.full(node.body, (inner: any) => {
      if (inner.type === 'CallExpression' && inner.callee?.name === node.id.name) selfCall = true;
    });
    if (selfCall) metrics.recursionDetected = true;
  });

  // Structural walk: control-flow nesting depth + loop chain depth
  let maxNesting = 0;
  const visit = (node: any, controlDepth: number, loopDepth: number): void => {
    const isControl = CONTROL_TYPES.has(node.type);
    const isLoop = LOOP_TYPES.has(node.type);
    const nextControl = isControl ? controlDepth + 1 : controlDepth;
    const nextLoop = isLoop ? loopDepth + 1 : loopDepth;
    if (isControl) maxNesting = Math.max(maxNesting, nextControl);
    if (isLoop) metrics.nestedLoopDepth = Math.max(metrics.nestedLoopDepth, nextLoop);

    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'start' || key === 'end') continue;
      const value = (node as any)[key];
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child.type === 'string') visit(child, nextControl, nextLoop);
        }
      } else if (value && typeof value.type === 'string') {
        visit(value, nextControl, nextLoop);
      }
    }
  };
  visit(ast, 0, 0);
  metrics.maxNestingDepth = maxNesting;

  return metrics;
}

// ── Metrics pass (Python / Java / C / C++ via condensed tree + source) ───────

function metricsFromCondensedTree(tree: IAstNode, sourceLines: string[]): IStructuralMetrics {
  const metrics = emptyMetrics();
  const functionNames: string[] = [];

  const visit = (node: IAstNode, controlDepth: number, loopDepth: number): void => {
    const isControl = CONTROL_TYPES.has(node.type);
    const isLoop = LOOP_TYPES.has(node.type);
    const nextControl = isControl ? controlDepth + 1 : controlDepth;
    const nextLoop = isLoop ? loopDepth + 1 : loopDepth;
    if (isControl) metrics.maxNestingDepth = Math.max(metrics.maxNestingDepth, nextControl);
    if (isLoop) metrics.nestedLoopDepth = Math.max(metrics.nestedLoopDepth, nextLoop);

    switch (node.type) {
      case 'ForStatement':
      case 'WhileStatement':
      case 'DoWhileStatement':
        metrics.loops++;
        break;
      case 'FunctionDeclaration': {
        metrics.functions++;
        const name = node.label.replace(/^Function:\s*/, '');
        functionNames.push(name);
        const span = node.loc ? node.loc.endLine - node.loc.startLine + 1 : 0;
        metrics.maxFunctionLines = Math.max(metrics.maxFunctionLines, span);
        break;
      }
      case 'IfStatement': metrics.conditionals++; break;
      case 'SwitchStatement': metrics.switches++; break;
      case 'TryStatement': metrics.tryCatch++; break;
      case 'BreakStatement': metrics.breaks++; break;
      case 'ContinueStatement': metrics.continues++; break;
      case 'ReturnStatement': metrics.returns++; break;
      case 'Variable':
      case 'Declaration': metrics.variableDeclarations++; break;
      case 'Statement': metrics.statements++; break;
    }

    for (const child of node.children) visit(child, nextControl, nextLoop);
  };

  visit(tree, 0, 0);

  // Recursion: call sites matching declared function names — skip definition lines
  const defLineRe = /^\s*(?:def|function)\s+/;
  for (const line of sourceLines) {
    if (defLineRe.test(line)) continue;
    const calls = line.match(/([A-Za-z_]\w*)\s*\(/g) || [];
    for (const c of calls) {
      const name = c.replace(/\s*\($/, '');
      if (functionNames.includes(name)) {
        metrics.recursionDetected = true;
        metrics.functionCalls++;
      }
    }
  }

  metrics.statements = Math.max(
    metrics.statements,
    sourceLines.filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('#')).length
  );
  return metrics;
}

// ── Data structure detection ─────────────────────────────────────────────────

function detectDataStructures(sourceLines: string[], language: CodingLanguage): string[] {
  const found = new Set<string>();
  const joined = sourceLines.join('\n');

  const patterns: Array<[RegExp, string]> = [
    [/\bnew\s+Map\b|\bMap\s*\(|unordered_map|HashMap|\bdict\s*\(|=\s*\{\}\s*$|\{\}\s*;|:=\s*\{\}/, 'HashMap'],
    [/\bnew\s+Set\b|\bSet\s*\(|unordered_set|HashSet|(?<![.\w])set\s*\(/, 'HashSet'],
    [/\[\s*\]|\bnew\s+Array\b|\bArray\s*\(|vector<|ArrayList|(?<![.\w])list\s*\(/, 'Array'],
    [/\bnew\s+Stack\b|Stack<|stack<|(?<![.\w])stack\s*\(|\.push\([^)]*\)\s*;?\s*$/m, 'Stack'],
    [/\bnew\s+Queue\b|Queue<|queue<|LinkedList|deque|(?<![.\w])queue\s*\(/, 'Queue'],
    [/\bnew\s+PriorityQueue\b|PriorityQueue|priority_queue|heapq|\bHeap\b/, 'Heap'],
    [/TreeNode|ListNode|struct\s+Node|->next\s*=|\.next\s*=\s*new/, 'LinkedList'],
    [/TreeNode\b|->left|->right|\.left\s*=\s*new|\.right\s*=\s*new|val\s*,\s*left/, 'Tree'],
    [/\bunion\b.*\bparent\b|\bfind\s*\(|parent\[|\bUnionFind\b/, 'UnionFind'],
    [/\bTrie\b|\btrie\b/, 'Trie'],
  ];

  for (const [re, name] of patterns) {
    try {
      if (re.test(joined)) found.add(name);
    } catch {
      // lookbehind unsupported — skip that pattern
    }
  }

  // Python dict literal (e.g. `seen = {}`) is a HashMap — must test per line
  if (language === 'python' && sourceLines.some(l => /=\s*\{\}\s*;?\s*$/.test(l.replace(/\r$/, '').trimEnd()))) {
    found.add('HashMap');
  }

  // Python list used as a stack: append/pop-only mutation pattern (no random index writes)
  if (language === 'python') {
    const hasListLiteral = sourceLines.some(l => /=\s*\[\]\s*$/.test(l.replace(/\r$/, '').trimEnd()));
    const hasAppend = /\.append\s*\(/.test(joined);
    const hasPop = /\.pop\s*\(/.test(joined);
    const indexWrite = /\w+\[\s*\d+\s*\]\s*=/.test(joined) || /\[\s*\w+\+?\d*\s*\]\s*=/.test(joined);
    if (hasListLiteral && hasAppend && !indexWrite) {
      found.add('Stack');
      found.delete('Array');
    }
  }

  // Tree implies LinkedList-style node structure for our purposes; keep both distinct
  return Array.from(found);
}

// ── Complexity estimation (estimate, never claim proof) ──────────────────────

const COMPLEXITY_ORDER = ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n^2)', 'O(n^3)', 'O(2^n)', 'O(n!)'];

function idxOf(c: string): number {
  return COMPLEXITY_ORDER.indexOf(c);
}

function complexityFromMetrics(
  metrics: IStructuralMetrics,
  dataStructures: string[],
  sourceLines: string[]
): IComplexityEstimate {
  const evidence: string[] = [];
  let timeIdx = 0; // O(1)
  let spaceIdx = 0;
  const joined = sourceLines.join('\n');

  const sortCall = /\b(sort|sorted|Arrays\.sort|Collections\.sort|qsort|std::sort|\.sort\s*\()\b/.test(joined);
  const hasMid = /\bmid\s*=|\blo\s*\+\s*hi|\bleft\s*\+\s*right\b/.test(joined);
  const shrinks = /(left|lo)\s*=\s*\w+\s*\+\s*1|(right|hi)\s*=\s*\w+\s*-\s*1|(left|lo)\s*=\s*mid|(right|hi)\s*=\s*mid/.test(joined);
  const isBinarySearchPattern = hasMid && shrinks;

  if (sortCall) {
    timeIdx = Math.max(timeIdx, idxOf('O(n log n)'));
    evidence.push('Sorting call detected — contributes O(n log n) baseline');
  }

  if (isBinarySearchPattern && !sortCall) {
    timeIdx = Math.max(timeIdx, idxOf('O(log n)'));
    evidence.push('Halving search (mid computed, bounds shrink to mid) — O(log n) pattern');
  } else if (metrics.nestedLoopDepth >= 3) {
    timeIdx = Math.max(timeIdx, idxOf(`O(n^${metrics.nestedLoopDepth})`));
    evidence.push(`${metrics.nestedLoopDepth} nested loop levels — ~O(n^${metrics.nestedLoopDepth})`);
  } else if (metrics.nestedLoopDepth === 2) {
    timeIdx = Math.max(timeIdx, idxOf('O(n^2)'));
    evidence.push('Two nested loop levels — ~O(n²)');
  } else if (metrics.nestedLoopDepth === 1 && !isBinarySearchPattern) {
    timeIdx = Math.max(timeIdx, idxOf('O(n)'));
    evidence.push(metrics.loops > 1 ? `${metrics.loops} sequential loops — O(n) overall (not multiplied)` : 'Single primary traversal — O(n)');
  }

  if (metrics.recursionDetected && !isBinarySearchPattern) {
    if (/memo|cache|memoize|dp\[|memo\[/i.test(joined)) {
      evidence.push('Recursion with memoization table — memoized recursion');
      timeIdx = Math.max(timeIdx, idxOf('O(n)'));
    } else if (timeIdx === 0) {
      timeIdx = idxOf('O(2^n)');
      evidence.push('Recursion without memoization detected — potentially exponential');
    }
  }

  const auxiliaryDs = dataStructures.filter(d => /HashMap|HashSet|Heap|Queue|Stack|LinkedList|Tree|UnionFind|Trie/.test(d));
  if (auxiliaryDs.length > 0) {
    spaceIdx = Math.max(spaceIdx, idxOf('O(n)'));
    evidence.push(`${auxiliaryDs.join(', ')} may store up to n elements — O(n) space`);
  }
  if (/dp\[|memo\[|memoize/i.test(joined)) {
    spaceIdx = Math.max(spaceIdx, idxOf('O(n)'));
    evidence.push('DP/memo table allocated — O(n) space');
  }
  if (spaceIdx === 0 && metrics.loops > 0) {
    evidence.push('No auxiliary structures beyond a few variables — O(1) space');
  }

  let confidence = 0.55;
  if (metrics.loops > 0) confidence += 0.1;
  if (sortCall || isBinarySearchPattern || metrics.nestedLoopDepth >= 2) confidence += 0.1;
  if (dataStructures.length > 0) confidence += 0.05;
  confidence = Math.min(0.9, confidence);

  return {
    estimatedTime: COMPLEXITY_ORDER[timeIdx],
    estimatedSpace: COMPLEXITY_ORDER[spaceIdx],
    confidence,
    evidence: evidence.slice(0, 6),
  };
}

// ── Approach detection ───────────────────────────────────────────────────────

function detectApproach(
  metrics: IStructuralMetrics,
  dataStructures: string[],
  sourceLines: string[],
  problemContext?: AnalysisContext['problemContext']
): IPatternDetection {
  const joined = sourceLines.join('\n');
  const evidence: string[] = [];
  const scores = new Map<AlgorithmApproachId, { score: number; ev: string[] }>();
  const add = (id: AlgorithmApproachId, score: number, ev: string) => {
    const cur = scores.get(id) || { score: 0, ev: [] };
    cur.score += score;
    cur.ev.push(ev);
    scores.set(id, cur);
  };

  const hasHashMap = dataStructures.includes('HashMap');
  const hasHashSet = dataStructures.includes('HashSet');
  const hasStack = dataStructures.includes('Stack');
  const hasQueue = dataStructures.includes('Queue');
  const hasHeap = dataStructures.includes('Heap');
  const sortCall = /\b(sort|sorted|Arrays\.sort|Collections\.sort|qsort|std::sort|\.sort\s*\()\b/.test(joined);
  const nestedLoops = metrics.nestedLoopDepth >= 2;
  const singleLoop = metrics.loops === 1 && metrics.nestedLoopDepth === 1;

  if (hasHashMap || hasHashSet) add('HASHING', 3, 'hash-based structure used for lookup/insert');
  if (hasStack) {
    const pushPop = /\.(append|push)\s*\(/.test(joined) && /\.pop\s*\(\)/.test(joined);
    add('STACK', pushPop ? 5 : 3, pushPop ? 'stack push/pop operations drive the algorithm' : 'stack structure drives the algorithm');
  }
  if (hasQueue) add('QUEUE', 2, 'queue structure used');
  if (hasHeap) add('HEAP', 3, 'heap/priority structure used');
  if (sortCall) add('SORTING_BASED', 2, 'input is sorted before processing');
  if (metrics.recursionDetected && /memo|cache|memoize/i.test(joined)) add('MEMOIZATION', 3, 'recursive calls with memo/cache table');
  if (/dp\[|memo\[|bottom.?up|tabulation/i.test(joined)) add('TABULATION', 3, 'DP table filled iteratively');
  if (metrics.recursionDetected && !/memo|cache/i.test(joined)) add('RECURSION', 2, 'recursive decomposition without memoization');
  if (/backtrack|\.pop\(\)[\s\S]{0,80}\.pop\(\)|removeLast/i.test(joined)) add('BACKTRACKING', 2, 'choose/explore/un-choose pattern');
  if (/\bdfs\b|depth.?first/i.test(joined)) add('DFS', 3, 'explicit DFS reference');
  if (/\bbfs\b|level.?order/i.test(joined)) add('BFS', 3, 'explicit BFS reference');

  // Two-pointer: converging pointer updates in a single pass
  const pointerUpdates = /(left|lo|i)\s*\+\+|(right|hi|j)\s*--|(left|lo)\s*=\s*(left|lo|i)\s*\+ ?1|(right|hi)\s*=\s*(right|hi|j)\s*- ?1/.test(joined)
    || /(arr|nums|a|s)\s*\[\s*(left|right|lo|hi|i|j)\s*\]/.test(joined);
  if (pointerUpdates && singleLoop && !hasHashMap) add('TWO_POINTER', 2, 'two indices moving over the input in one pass');

  // Sliding window: expanding traversal (+ optional inner shrink loop) over a set/map with left-edge shrink
  const windowShrink = /(left|lo|start)\s*\+\+|(left|lo|start)\s*\+=\s*1|delete\s+\w+\[\s*(left|lo|start)\s*\]|\.shift\s*\(/.test(joined);
  const singleTraversal = metrics.loops <= 2 && metrics.nestedLoopDepth <= 2;
  if (singleTraversal && (hasHashSet || hasHashMap) && windowShrink) {
    add('SLIDING_WINDOW', 5, 'window expansion with left-edge shrink over a set/map in a single pass');
  }

  // Binary search: mid computation + bounds shrink to mid
  const hasMid = /\bmid\s*=|\blo\s*\+\s*hi|\bleft\s*\+\s*right\b/.test(joined);
  const shrinks = /(left|lo)\s*=\s*mid|(right|hi)\s*=\s*mid|(left|lo)\s*=\s*\w+\s*\+\s*1|(right|hi)\s*=\s*\w+\s*-\s*1/.test(joined);
  if (hasMid && shrinks) add('BINARY_SEARCH', 3, 'search space halved via mid computation');

  if (/prefix|cumulative|running.?sum|acc(?:umulate)?/i.test(joined)) add('PREFIX_SUM', 2, 'prefix/cumulative accumulation');

  // Brute force: nested loops over the same input without hashing
  if (nestedLoops && !hasHashMap && !hasHashSet) add('BRUTE_FORCE', 3, 'nested loops over the same input without hashing');

  if (sortCall && singleLoop) add('GREEDY', 2, 'sorted order + single greedy pass');

  let best: AlgorithmApproachId | 'UNKNOWN' = 'UNKNOWN';
  let bestScore = 0;
  let bestEv: string[] = [];
  for (const [id, v] of scores) {
    if (v.score > bestScore) {
      bestScore = v.score;
      best = id;
      bestEv = v.ev;
    }
  }

  const expected = problemContext?.knownApproaches?.map(a => a.approachId) || [];
  if (best !== 'UNKNOWN' && expected.includes(best)) {
    bestScore += 1;
    evidence.push('detected approach matches a known approach for this problem');
  }

  const secondary = Array.from(scores.entries())
    .filter(([id]) => id !== best)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 3)
    .map(([approach, v]) => ({ approach, confidence: Math.min(0.95, v.score / 6) }));

  const confidence = best === 'UNKNOWN' ? 0 : Math.min(0.95, bestScore / 6);

  return {
    detectedApproach: best,
    confidence,
    evidence: [...bestEv, ...evidence].slice(0, 6),
    secondaryApproaches: secondary,
    dataStructures,
  };
}

// ── Code quality ─────────────────────────────────────────────────────────────

function analyzeQuality(metrics: IStructuralMetrics, sourceLines: string[]): ICodeQuality {
  const issues: ICodeQualityIssue[] = [];
  const effectiveLines = sourceLines.filter(l => {
    const t = l.trim();
    return t && !t.startsWith('//') && !t.startsWith('#') && !t.startsWith('/*') && !t.startsWith('*');
  }).length;

  const excessiveNesting = metrics.maxNestingDepth >= 5;
  if (excessiveNesting) {
    issues.push({
      issue: 'EXCESSIVE_NESTING',
      severity: 'medium',
      evidence: `Maximum control-flow nesting depth is ${metrics.maxNestingDepth}`,
      recommendation: 'Extract inner logic into helper functions.',
    });
  }

  const largeFunctionDetected = metrics.maxFunctionLines > 60;
  if (largeFunctionDetected) {
    issues.push({
      issue: 'LARGE_FUNCTION',
      severity: 'low',
      evidence: `Largest function spans ${metrics.maxFunctionLines} lines`,
      recommendation: 'Split into smaller, single-purpose functions.',
    });
  }

  if (metrics.functions === 0 && effectiveLines > 25) {
    issues.push({
      issue: 'NO_DECOMPOSITION',
      severity: 'low',
      evidence: `${effectiveLines} lines with no function boundaries`,
      recommendation: 'Wrap logic in a function for reusability and testing.',
    });
  }

  if (metrics.nestedLoopDepth >= 3) {
    issues.push({
      issue: 'DEEP_LOOP_NESTING',
      severity: 'high',
      evidence: `${metrics.nestedLoopDepth} nested loop levels`,
      recommendation: 'Consider hashing, sorting, or a different algorithm to reduce nesting.',
    });
  }

  const modularity = Math.max(
    20,
    Math.min(100, 60 + metrics.functions * 12 - Math.max(0, metrics.maxFunctionLines - 40) * 0.5)
  );
  const readability = Math.max(
    20,
    Math.min(100, 92 - Math.max(0, metrics.maxNestingDepth - 3) * 8 - Math.max(0, effectiveLines - 60) * 0.2)
  );

  return {
    modularity: Math.round(modularity),
    structuralReadability: Math.round(readability),
    excessiveNesting,
    largeFunctionDetected,
    issues,
  };
}

// ── Call graph (name-based, conservative) ────────────────────────────────────

function buildCallGraph(sourceLines: string[]): Array<{ caller: string; callee: string }> {
  const edges: Array<{ caller: string; callee: string }> = [];
  const defRe = /(?:def|function)\s+([A-Za-z_]\w*)|(?:([A-Za-z_]\w*)\s*\([^)]*\)\s*\{)/;
  const fnNames: string[] = [];

  for (const line of sourceLines) {
    const m = line.match(/(?:def|function)\s+([A-Za-z_]\w*)/);
    if (m) fnNames.push(m[1]);
  }
  if (fnNames.length === 0) return edges;

  let currentCaller = 'main';
  for (const line of sourceLines) {
    const defMatch = line.match(/(?:def|function)\s+([A-Za-z_]\w*)/);
    if (defMatch && fnNames.includes(defMatch[1])) {
      currentCaller = defMatch[1];
      continue;
    }
    for (const fn of fnNames) {
      if (fn !== currentCaller && new RegExp(`(?<![.\\w])${fn}\\s*\\(`).test(line)) {
        edges.push({ caller: currentCaller, callee: fn });
      }
    }
  }
  const seen = new Set<string>();
  return edges.filter(e => {
    const k = `${e.caller}->${e.callee}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ── Public analyzer ──────────────────────────────────────────────────────────

export function analyzeSource(
  sourceCode: string,
  language: CodingLanguage,
  problemContext?: AnalysisContext['problemContext']
): IAstAnalysis {
  try {
    const parsed = parseSource(sourceCode, language);

    if (!parsed.parseSuccess || !parsed.tree) {
      return {
        ...AST_UNAVAILABLE,
        language,
        reason: parsed.reason || AST_UNAVAILABLE.reason,
      };
    }

    const metrics =
      parsed.parser === 'acorn' && parsed.estree
        ? metricsFromEstree(parsed.estree)
        : metricsFromCondensedTree(parsed.tree, parsed.sourceLines);

    const dataStructures = detectDataStructures(parsed.sourceLines, language);
    const approach = detectApproach(metrics, dataStructures, parsed.sourceLines, problemContext);
    const complexity = complexityFromMetrics(metrics, dataStructures, parsed.sourceLines);
    const quality = analyzeQuality(metrics, parsed.sourceLines);
    const callGraph = buildCallGraph(parsed.sourceLines);

    const patterns: string[] = [];
    if (approach.detectedApproach !== 'UNKNOWN') patterns.push(approach.detectedApproach);
    for (const ds of dataStructures) patterns.push(ds.toUpperCase());

    return {
      parseSuccess: true,
      parser: parsed.parser,
      language,
      metrics,
      dataStructures,
      patterns,
      approach,
      complexity,
      quality,
      ast: parsed.tree,
      callGraph,
    };
  } catch (err: any) {
    return {
      ...AST_UNAVAILABLE,
      language,
      reason: `AST analysis error: ${err?.message || 'unknown'}`,
    };
  }
}
