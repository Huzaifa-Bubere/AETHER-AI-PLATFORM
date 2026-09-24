import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import type { Node } from 'acorn';
import type { ITraceEvent, TraceEventType } from './trace.types';

/**
 * AETHER Coding — JavaScript/TypeScript trace engine.
 *
 * The candidate's code is PARSED with acorn and INSTRUMENTED: statement lines,
 * loop headers, conditions, and assignments receive `_t(...)` probe calls that
 * emit a real event at real runtime. The instrumented program is executed in
 * the same sandboxed executor chain as official runs (Node via Judge0/Piston).
 * Every state in the visualizer comes from this real execution — never AI.
 *
 * TypeScript is transpiled with a conservative regex strip (type annotations,
 * interfaces, generics on declarations) before instrumentation, mirroring the
 * lightweight approach already used by the AST analyzer for TS.
 */

export const JS_TRACE_SENTINEL = '__AETHER_TRACE__';

interface Probe {
  line: number;
  kind: 'line' | 'loop' | 'condition' | 'assign' | 'call' | 'return';
  names?: string[];
}

function extractProbes(source: string): { probes: Probe[]; parseOk: boolean } {
  const probes: Probe[] = [];
  let parseOk = false;
  try {
    const ast = acorn.parse(source, { ecmaVersion: 2022, locations: true }) as Node;
    parseOk = true;
    walk.full(ast, (n: any) => {
      const line = n.loc?.start?.line;
      if (!line) return;
      if (/Statement$/.test(n.type) || n.type === 'VariableDeclaration') {
        probes.push({ line, kind: 'line' });
        if (n.type === 'ForStatement' || n.type === 'ForOfStatement' || n.type === 'ForInStatement' || n.type === 'WhileStatement' || n.type === 'DoWhileStatement') {
          probes.push({ line, kind: 'loop' });
        }
        if (n.type === 'IfStatement' || n.type === 'SwitchStatement') probes.push({ line, kind: 'condition' });
        if (n.type === 'ReturnStatement') probes.push({ line, kind: 'return' });
      }
      if (n.type === 'AssignmentExpression' || n.type === 'UpdateExpression') {
        const line = n.loc?.start?.line;
        if (line) probes.push({ line, kind: 'assign' });
      }
    });
  } catch {
    // Fallback: line-heuristic probes (still real events at runtime).
    source.split('\n').forEach((_, i) => {
      const line = i + 1;
      const text = source.split('\n')[i] || '';
      if (/^\s*(for|while)\b/.test(text)) probes.push({ line, kind: 'loop' });
      else if (/^\s*(if|switch)\b/.test(text)) probes.push({ line, kind: 'condition' });
      else if (/\S/.test(text)) probes.push({ line, kind: 'line' });
    });
  }
  // dedupe by line keeping the most specific kind
  const rank: Record<Probe['kind'], number> = { assign: 5, call: 4, return: 3, loop: 2, condition: 1, line: 0 };
  const byLine = new Map<number, Probe>();
  for (const p of probes) {
    const cur = byLine.get(p.line);
    if (!cur || rank[p.kind] > rank[cur.kind]) byLine.set(p.line, p);
  }
  return { probes: [...byLine.values()].sort((a, b) => a.line - b.line), parseOk };
}

/** Naive-but-careful TS → JS strip (annotations/interfaces/generics/as). */
export function stripTypes(ts: string): string {
  let s = ts;
  s = s.replace(/^\s*import\s+type\s+[^\n]*\n/gm, '');
  s = s.replace(/^\s*interface\s+\w+[^{]*\{[\s\S]*?\n\}/gm, '');
  s = s.replace(/^\s*type\s+\w+\s*=[\s\S]*?;\s*$/gm, '');
  s = s.replace(/\bas\s+(const|unknown|any|never)\b/g, '');
  s = s.replace(/:\s*(readonly\s+)?(string|number|boolean|any|unknown|never|void|object)\b(\[\])?/g, '');
  s = s.replace(/:\s*[A-Za-z_$][\w$<>,.\[\]|\s]*?(?=\s*[=,)\{;])/g, (m, off) => {
    // avoid stripping inside strings — cheap guard: skip if quotes nearby
    const before = s.slice(Math.max(0, off - 1), off);
    if (before === '"' || before === "'") return m;
    return '';
  });
  s = s.replace(/<\s*[A-Za-z_$][\w$,\s<>\[\]]*>\s*\(/g, '(');
  s = s.replace(/([)\]])\s*:\s*[A-Za-z_$][\w$<>\[\]|]*\s*=>/g, '$1 =>');
  s = s.replace(/!\./g, '.').replace(/(\w)!(?=[\s,;)\]])/g, '$1');
  return s;
}

/** Build the instrumented JS program (harness appended). */
export function buildJsTraceProgram(params: {
  sourceCode: string;
  language: 'javascript' | 'typescript';
  testInput: string;
  functionName?: string;
  maxSteps: number;
}): { program: string; userEndLine: number } {
  const code = params.language === 'typescript' ? stripTypes(params.sourceCode) : params.sourceCode;
  const { probes } = extractProbes(code);
  const userEnd = code.split('\n').length;

  // Build a line→probe map embedded as JSON: { "5": "loop", "7": "assign" }
  const lineMap: Record<string, string> = {};
  for (const p of probes) lineMap[String(p.line)] = p.kind;

  const instrumented = instrumentSource(code, lineMap);

  const inputLines = params.testInput.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const inputLinesJson = JSON.stringify(inputLines);
  const preferredFn = params.functionName || '';

  const program = `${instrumented}

// ==== AETHER trace harness (user code: lines 1..${userEnd}) ====
(function () {
  const _SENTINEL = ${JSON.stringify(JS_TRACE_SENTINEL)};
  const _MAX_STEPS = ${params.maxSteps};
  let _steps = 0;
  let _stopped = false;
  const _KIND = ${JSON.stringify(lineMap)};

  function _ser(v, depth) {
    depth = depth || 0;
    try {
      if (v === undefined) return null;
      if (v === null || typeof v === 'boolean') return v;
      if (typeof v === 'number') return isFinite(v) ? v : String(v);
      if (typeof v === 'bigint') return String(v) + 'n';
      if (typeof v === 'string') return v.length > 120 ? v.slice(0, 120) + '…' : v;
      if (typeof v === 'function') return '<fn>';
      if (depth > 3) return '…';
      if (Array.isArray(v)) {
        const out = v.slice(0, 64).map(x => _ser(x, depth + 1));
        if (v.length > 64) out.push('…(+' + (v.length - 64) + ')');
        return out;
      }
      if (v instanceof Map) {
        const o = {};
        let i = 0;
        for (const [k, val] of v) { if (i++ >= 64) { o['…'] = '(+' + (v.size - 64) + ' more)'; break; } o[String(k).slice(0, 40)] = _ser(val, depth + 1); }
        return o;
      }
      if (v instanceof Set) {
        const arr = []; let i = 0;
        for (const val of v) { if (i++ >= 64) { arr.push('…(+' + (v.size - 64) + ')'); break; } arr.push(_ser(val, depth + 1)); }
        return arr;
      }
      const o = {};
      let i = 0;
      for (const k of Object.keys(v)) { if (i++ >= 64) { o['…'] = '(+more)'; break; } o[String(k).slice(0, 40)] = _ser(v[k], depth + 1); }
      return o;
    } catch (e) { return '<?>'; }
  }

  function _emit(kind, line, fn, vars, depth) {
    if (_stopped) return;
    _steps++;
    if (_steps > _MAX_STEPS) {
      _stopped = true;
      process.stdout.write(_SENTINEL + JSON.stringify({ e: '__STOPPED__' }) + '\\n');
      return;
    }
    const collections = {};
    const scalars = {};
    for (const k of Object.keys(vars || {})) {
      const val = vars[k];
      if (val && typeof val === 'object') collections[k] = _ser(val, 1);
      else scalars[k] = _ser(val, 0);
    }
    process.stdout.write(_SENTINEL + JSON.stringify({
      e: kind === 'loop' ? 'LOOP_ITERATION' : kind === 'condition' ? 'CONDITION' : kind === 'call' ? 'FUNCTION_CALL' : kind === 'return' ? 'FUNCTION_RETURN' : 'LINE',
      l: line <= ${userEnd} ? line : 0,
      f: fn || '<module>',
      d: depth || 0,
      v: scalars,
      c: collections,
    }) + '\\n');
  }

  global.__t = function (line, vars) {
    _emit(_KIND[String(line)] || 'line', line, _fnName, vars, 0);
  };

  function _parse(s) { try { return JSON.parse(s); } catch (e) { return s; } }
  const _args = ${inputLinesJson}.map(_parse);

  function _pickFunctionName() {
    const preferred = ${JSON.stringify(preferredFn)};
    try {
      if (preferred && typeof eval(preferred) === 'function') return preferred;
    } catch (e) {}
    if (typeof Solution !== 'undefined') {
      try {
        const inst = new Solution();
        for (const name of Object.getOwnPropertyNames(Object.getPrototypeOf(inst))) {
          if (!name.startsWith('_') && name !== 'constructor' && typeof inst[name] === 'function') return name;
        }
      } catch (e) {}
    }
    return '';
  }

  let _fnName = '';
  let _fn = null;
  const _pname = _pickFunctionName();
  try {
    if (_pname && typeof eval(_pname) === 'function') { _fn = eval(_pname); _fnName = _pname; }
  } catch (e) {}
  if (!_fn && typeof Solution !== 'undefined') {
    try {
      const inst = new Solution();
      for (const name of Object.getOwnPropertyNames(Object.getPrototypeOf(inst))) {
        if (!name.startsWith('_') && name !== 'constructor' && typeof inst[name] === 'function') { _fn = inst[name].bind(inst); _fnName = name; break; }
      }
    } catch (e) {}
  }
  if (!_fn) { process.stderr.write('ERROR: No callable solution function found\\n'); process.exit(1); }

  function _expand(args, fn) {
    if (args.length === 1 && args[0] !== null && typeof args[0] === 'object' && !Array.isArray(args[0])) {
      const sig = String(fn).match(/\\(([^)]*)\\)/);
      if (sig && sig[1]) {
        const params = sig[1].split(',').map(p => p.trim().split('=')[0].trim()).filter(Boolean);
        if (params.length > 0 && params.every(p => Object.prototype.hasOwnProperty.call(args[0], p))) {
          return params.map(p => args[0][p]);
        }
      }
    }
    if (args.length === 1 && Array.isArray(args[0]) && args[0].length === fn.length && fn.length !== 1) return args[0];
    return args;
  }

  let _result;
  try {
    const callArgs = _expand(_args, _fn);
    _result = _fn(...callArgs);
    if (_result && typeof _result.then === 'function') {
      _result.then(r => { process.stdout.write(_SENTINEL + JSON.stringify({ e: '__META__', ret: _ser(r, 0) }) + '\\n'); }).catch(e => {
        process.stderr.write('ERROR: ' + e.message + '\\n'); process.exit(1);
      });
      return;
    }
  } catch (e) {
    process.stdout.write(_SENTINEL + JSON.stringify({ e: '__META__', ret: null }) + '\\n');
    process.stderr.write('ERROR: ' + e.message + '\\n');
    process.exit(1);
  }
  process.stdout.write(_SENTINEL + JSON.stringify({ e: '__META__', ret: _ser(_result, 0) }) + '\\n');
})();
`;

  return { program, userEndLine: userEnd };
}

/** Inject _t(line, {names...}) probes into statement heads. */
function instrumentSource(code: string, lineMap: Record<string, string>): string {
  const lines = code.split('\n');
  const out = lines.map((text, i) => {
    const line = i + 1;
    const kind = lineMap[String(line)];
    if (!kind) return text;
    const trimmed = text.trimStart();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return text;
    if (/_t\(/.test(text)) return text;
    const indent = text.slice(0, text.length - text.trimStart().length);
    // Simple heuristic variable capture: declared/assigned identifiers on this line.
    const names = new Set<string>();
    const decl = trimmed.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)/);
    if (decl) names.add(decl[1]);
    const assign = trimmed.match(/^\s*([A-Za-z_$][\w$]*)\s*(?:=[^=]|\+\+|--)/);
    if (assign) names.add(assign[1]);
    const loopVar = trimmed.match(/(?:for\s*\(?\s*(?:const|let|var)?\s*)([A-Za-z_$][\w$]*)\b/);
    if (loopVar) names.add(loopVar[1]);
    const paramBind = trimmed.match(/function\s+[A-Za-z_$][\w$]*\s*\(([^)]*)\)/);
    if (paramBind) paramBind[1].split(',').map(p => p.trim().split(/[=:]/)[0].trim()).filter(Boolean).forEach(p => names.add(p));
    const nameArr = [...names].slice(0, 8);
    const probe = `_t(${line}, {${nameArr.map(n => JSON.stringify(n) + ':' + n).join(',')}});`;
    if (trimmed.startsWith('}') || /^[}\)]/.test(trimmed)) return text;
    return indent + probe + text.trimStart();
  });
  return out.join('\n');
}

export interface JsRawParse {
  events: Array<Record<string, any>>;
  programOutput: string;
  truncated: boolean;
  returnValue: unknown;
  stopped: boolean;
}

export function parseJsTraceStdout(stdout: string): JsRawParse {
  const events: Array<Record<string, any>> = [];
  const outputLines: string[] = [];
  let truncated = false;
  let stopped = false;
  let returnValue: unknown = undefined;
  for (const raw of stdout.split('\n')) {
    const line = raw.trimEnd();
    if (!line) continue;
    if (line.startsWith(JS_TRACE_SENTINEL)) {
      try {
        const obj = JSON.parse(line.slice(JS_TRACE_SENTINEL.length));
        if (obj.e === '__META__') { returnValue = obj.ret; continue; }
        if (obj.e === '__STOPPED__') { stopped = true; continue; }
        events.push(obj);
      } catch { /* partial line */ }
      continue;
    }
    outputLines.push(line);
  }
  return { events, programOutput: outputLines.join('\n'), truncated: truncated || stopped, returnValue, stopped };
}

export function normalizeJsEvent(raw: Record<string, any>, step: number): ITraceEvent {
  const typeMap: Record<string, TraceEventType> = {
    LINE: 'LINE', CONDITION: 'CONDITION', LOOP_ITERATION: 'LOOP_ITERATION',
    FUNCTION_CALL: 'FUNCTION_CALL', FUNCTION_RETURN: 'FUNCTION_RETURN',
  };
  return {
    step,
    line: Number(raw.l) || 0,
    event: typeMap[raw.e] || 'LINE',
    function: String(raw.f || '<module>'),
    variables: (raw.v && typeof raw.v === 'object') ? raw.v : {},
    collections: (raw.c && typeof raw.c === 'object') ? raw.c : undefined,
    callDepth: Number(raw.d) || 0,
  };
}
