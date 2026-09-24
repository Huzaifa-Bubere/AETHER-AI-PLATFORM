import type { ITraceEvent, TraceEventType } from './trace.types';

/**
 * AETHER Coding — Python trace engine.
 *
 * Runs the candidate's code under a line-tracing harness inside the SAME
 * sandboxed executor chain used for official runs (Judge0 when configured,
 * else the existing Piston/legacy path). The harness is ordinary Python code
 * that emits JSON events on stdout with a sentinel prefix — every variable
 * state in the visualizer therefore comes from a REAL execution, never from
 * an LLM.
 *
 * Line mapping: user code is placed FIRST in the combined file, so a trace
 * line ≤ userEndLine maps 1:1 to the user's source line. Harness lines are
 * never emitted.
 */

export const TRACE_SENTINEL = '__AETHER_TRACE__';

function loopAndBranchLines(source: string): { loops: number[]; branches: number[] } {
  const loops: number[] = [];
  const branches: number[] = [];
  source.split('\n').forEach((line, idx) => {
    const n = idx + 1;
    if (/^\s*(for|while)\b/.test(line)) loops.push(n);
    else if (/^\s*(if|elif)\b/.test(line)) branches.push(n);
  });
  return { loops, branches };
}

/** Build the combined trace harness for Python. */
export function buildPythonTraceHarness(params: {
  sourceCode: string;
  testInput: string;
  functionName?: string;
  maxSteps: number;
  timeoutSec: number;
}): string {
  const { sourceCode, testInput, functionName, maxSteps, timeoutSec } = params;
  const inputLines = testInput.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const userEnd = sourceCode.split('\n').length;
  const { loops, branches } = loopAndBranchLines(sourceCode);

  // `loops`/`branches` are embedded as JSON arrays of user-file line numbers.
  return `${sourceCode}

# ==== AETHER trace harness (appended; user code occupies lines 1..${userEnd}) ====
import sys as _sys, json as _json, ast as _ast, time as _time

_SENTINEL = "${TRACE_SENTINEL}"
_MAX_STEPS = ${maxSteps}
_DEADLINE = _time.monotonic() + ${timeoutSec}
_USER_END = ${userEnd}
_LOOP_LINES = frozenset(${JSON.stringify(loops)})
_IF_LINES = frozenset(${JSON.stringify(branches)})

def _tser(v, _depth=0):
    try:
        if v is None or isinstance(v, bool):
            return v
        if isinstance(v, int):
            return v if abs(v) < 10 ** 15 else str(v)
        if isinstance(v, float):
            if v != v or v in (float("inf"), float("-inf")):
                return str(v)
            return v
        if isinstance(v, str):
            return v[:120]
        if _depth > 3:
            return "…"
        if isinstance(v, (list, tuple)):
            out = [_tser(x, _depth + 1) for x in list(v)[:64]]
            if len(v) > 64:
                out.append("…(+" + str(len(v) - 64) + ")")
            return out
        tn = type(v).__name__
        if tn == "deque":
            return [_tser(x, _depth + 1) for x in list(v)[:64]]
        if isinstance(v, (set, frozenset)):
            vals = [_tser(x, _depth + 1) for x in list(v)[:64]]
            try:
                return sorted(vals, key=lambda x: str(x))
            except Exception:
                return vals
        if isinstance(v, dict):
            out = {}
            for i, (k, val) in enumerate(v.items()):
                if i >= 64:
                    out["…"] = "(+" + str(len(v) - 64) + " more)"
                    break
                out[str(k)[:40]] = _tser(val, _depth + 1)
            return out
        return str(v)[:120]
    except Exception:
        return "<?>"

def _tlocals(frame):
    vs = {}
    try:
        for k, val in frame.f_locals.items():
            if k.startswith("__"):
                continue
            if callable(val) or type(val).__name__ == "module":
                continue
            vs[str(k)[:40]] = _tser(val)
    except Exception:
        pass
    return vs

class _Limit(Exception):
    pass

_STACK = []
_prev_vars = None
_prev_line = -1
_steps = 0

def _temit(obj):
    _sys.stdout.write(_SENTINEL + _json.dumps(obj, separators=(",", ":"), default=str) + "\\n")

def _bump():
    global _steps
    _steps += 1
    if _steps > _MAX_STEPS:
        raise _Limit("trace step limit reached")
    if (_steps & 255) == 0 and _time.monotonic() > _DEADLINE:
        raise _Limit("trace time limit reached")

def _tracer(frame, event, arg):
    fname = frame.f_code.co_name
    if isinstance(fname, str) and fname.startswith("_"):
        return None
    if event == "call":
        _bump()
        _STACK.append(str(fname))
        recursive = _STACK.count(str(fname)) > 1
        _temit({
            "e": "RECURSION_CALL" if recursive else "FUNCTION_CALL",
            "l": frame.f_lineno if frame.f_lineno <= _USER_END else 0,
            "f": str(fname),
            "d": max(0, len(_STACK) - 1),
            "s": list(_STACK),
            "v": _tlocals(frame),
        })
        return _tracer
    if event == "return":
        if _STACK:
            _STACK.pop()
        _temit({
            "e": "FUNCTION_RETURN",
            "l": frame.f_lineno if frame.f_lineno <= _USER_END else 0,
            "f": str(fname),
            "d": max(0, len(_STACK)),
            "s": list(_STACK),
            "v": {"__ret": _tser(arg)},
        })
        return None
    if event == "line":
        _bump()
        line = frame.f_lineno
        if line > _USER_END:
            return _tracer
        vs = _tlocals(frame)
        global _prev_vars, _prev_line
        if vs == _prev_vars and line == _prev_line:
            return _tracer
        _prev_vars = vs
        _prev_line = line
        if line in _LOOP_LINES:
            e = "LOOP_ITERATION"
        elif line in _IF_LINES:
            e = "CONDITION"
        else:
            e = "LINE"
        _temit({
            "e": e, "l": line, "f": str(fname), "d": max(0, len(_STACK) - 1),
            "s": list(_STACK), "v": vs,
        })
    return _tracer

def _tparse(s):
    s = s.strip()
    try:
        return _json.loads(s)
    except Exception:
        try:
            return _ast.literal_eval(s)
        except Exception:
            return s

_input_lines = ${JSON.stringify(inputLines)}
_args = [_tparse(x) for x in _input_lines]

_user_funcs = [n for n, o in list(globals().items())
               if callable(o) and type(o).__name__ == "function" and not n.startswith("_")]

_fn = None
_preferred = ${JSON.stringify(functionName || "")}
if _preferred and _preferred in globals() and callable(globals()[_preferred]):
    _fn = globals()[_preferred]
elif _user_funcs:
    _fn = globals()[_user_funcs[-1]]
else:
    _sol = globals().get("Solution")
    if _sol is not None:
        try:
            _inst = _sol()
            for _name in dir(_inst):
                if not _name.startswith("_") and callable(getattr(_inst, _name)):
                    _fn = getattr(_inst, _name)
                    break
        except Exception:
            pass

if _fn is None:
    _sys.stderr.write("ERROR: No callable solution function found\\n")
    _sys.exit(1)

import inspect as _inspect

def _n_params(f):
    try:
        return len(_inspect.signature(f).parameters)
    except Exception:
        return None

_call_args = _args
_np = _n_params(_fn)
if _np is not None and len(_args) != _np and len(_args) == 1 and isinstance(_args[0], list):
    if len(_args[0]) == _np:
        _call_args = _args[0]

_result = None
_truncated = False
sys.settrace(_tracer)
try:
    _result = _fn(*_call_args)
except _Limit:
    _truncated = True
except Exception as e:
    sys.settrace(None)
    _sys.stderr.write("ERROR: " + str(e) + "\\n")
    _sys.exit(1)
sys.settrace(None)

_temit({"e": "__META__", "truncated": _truncated, "ret": _tser(_result)})

if isinstance(_result, (list, dict, tuple)):
    print(_json.dumps(_result))
elif _result is None:
    print("")
else:
    print(str(_result))
`;
}

/** Parsed harness stdout → raw event objects + program output + meta. */
export function parsePythonTraceStdout(stdout: string): {
  events: Array<Record<string, any>>;
  programOutput: string;
  truncated: boolean;
  returnValue: unknown;
  sawLimit: boolean;
} {
  const events: Array<Record<string, any>> = [];
  const outputLines: string[] = [];
  let truncated = false;
  let returnValue: unknown = undefined;
  let sawLimit = false;

  for (const raw of stdout.split('\n')) {
    const line = raw.trimEnd();
    if (!line) continue;
    if (line.startsWith(TRACE_SENTINEL)) {
      try {
        const obj = JSON.parse(line.slice(TRACE_SENTINEL.length));
        if (obj.e === '__META__') {
          truncated = !!obj.truncated;
          returnValue = obj.ret;
          continue;
        }
        events.push(obj);
      } catch {
        // Partial final line (stdout cap) — ignore.
      }
      continue;
    }
    if (line.startsWith('ERROR:')) sawLimit = true;
    outputLines.push(line);
  }
  return { events, programOutput: outputLines.join('\n'), truncated, returnValue, sawLimit };
}

/** Compact wire event → normalized ITraceEvent (server-side, with caps). */
export function normalizePythonEvent(raw: Record<string, any>, step: number, programOutput: string): ITraceEvent {
  const typeMap: Record<string, TraceEventType> = {
    LINE: 'LINE',
    CONDITION: 'CONDITION',
    LOOP_ITERATION: 'LOOP_ITERATION',
    FUNCTION_CALL: 'FUNCTION_CALL',
    RECURSION_CALL: 'RECURSION_CALL',
    FUNCTION_RETURN: 'FUNCTION_RETURN',
  };
  const vars = (raw.v && typeof raw.v === 'object') ? raw.v : {};
  const collections: Record<string, unknown> = {};
  const scalars: Record<string, unknown> = {};
  for (const [k, v] of Object.entries<any>(vars)) {
    if (Array.isArray(v) || (v && typeof v === 'object')) collections[k] = v;
    else scalars[k] = v;
  }
  return {
    step,
    line: Number(raw.l) || 0,
    event: typeMap[raw.e] || 'LINE',
    function: String(raw.f || '<module>'),
    variables: scalars,
    collections,
    stdout: raw.e === 'FUNCTION_RETURN' ? undefined : undefined,
    callDepth: Number(raw.d) || 0,
    callStack: Array.isArray(raw.s) ? raw.s.map(String) : undefined,
    note: step === 1 && programOutput ? undefined : undefined,
  };
}

/** Attach the final program output as an OUTPUT event (server-side). */
export function appendOutputEvent(events: ITraceEvent[], programOutput: string): ITraceEvent[] {
  if (!programOutput) return events;
  const last = events[events.length - 1];
  events.push({
    step: (last?.step ?? 0) + 1,
    line: 0,
    event: 'OUTPUT',
    function: last?.function || '<module>',
    variables: {},
    stdout: programOutput,
    callDepth: last?.callDepth ?? 0,
  });
  return events;
}
