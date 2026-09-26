import type { ITraceResult, ITraceMetadata, ITracePattern, ITraceEvent } from './trace.types';
import { TRACE_LIMITS, safeSerialize } from './trace.types';
import { buildPythonTraceHarness, parsePythonTraceStdout, normalizePythonEvent, appendOutputEvent } from './pythonTrace';
import { buildJsTraceProgram, parseJsTraceStdout, normalizeJsEvent } from './jsTrace';

/**
 * AETHER Coding — trace orchestration service.
 *
 * Language support (honest, per the upgrade spec §7):
 *  - python               → full line/variable/call-stack trace (sys.settrace)
 *  - javascript / typescript → full trace via acorn instrumentation
 *  - java                 → adapter runs the candidate solution on the real
 *                           input and records a FUNCTION-level trace (entry,
 *                           exit, result). NOT claimed as line-level support.
 *  - cpp / c              → visualization unavailable; Judge0 runs continue.
 *
 * The tracer executes through the SAME sandboxed chain as official runs
 * (Judge0 when configured → existing Piston/legacy runner). Candidate code is
 * never eval'd or spawned directly inside the Express process.
 */

import { codingExecutionService } from '../services/execution.service';

/**
 * Serialize a return value for display.
 * Primitives use String(); arrays and objects use JSON.stringify() so that
 * a Python list [0,1] displays as "[0, 1]" rather than JS's "0,1".
 */
function serializeReturnValue(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v) || (typeof v === 'object' && v !== null)) {
    try { return JSON.stringify(v); } catch { /* fall through */ }
  }
  return String(v);
}

const SUPPORTED: Record<string, boolean> = {
  python: true,
  javascript: true,
  typescript: true,
  java: false, // function-level adapter only — see runJavaFunctionTrace
};

export function traceSupportedFor(language: string): boolean {
  return !!SUPPORTED[language];
}

export function traceCapabilities() {
  return {
    fullTrace: ['python', 'javascript', 'typescript'],
    functionTrace: ['java'],
    unavailable: ['cpp', 'c'],
    limits: {
      maxTraceSteps: TRACE_LIMITS.maxTraceSteps,
      maxTraceBytes: TRACE_LIMITS.maxTraceBytes,
      timeoutMs: TRACE_LIMITS.runtimeTimeoutMs,
    },
  };
}

/** Serialized payload size check — protects the browser. */
function payloadTooLarge(events: unknown[]): boolean {
  try {
    let size = 0;
    for (const e of events) {
      size += JSON.stringify(e).length;
      if (size > TRACE_LIMITS.maxEventsArrayBytes) return true;
    }
    return false;
  } catch {
    return true;
  }
}

/** Deterministic post-pass: detect algorithm patterns from the event stream. */
function detectPatterns(events: Array<Record<string, any>>, collectionsSeen: Set<string>): ITracePattern[] {
  const patterns: ITracePattern[] = [];
  const has = (p: ITracePattern['pattern']) => patterns.some(x => x.pattern === p);

  let loopCount = 0;
  let sawLoopVar: string | null = null;
  let depthEver = 0;
  for (const e of events) {
    if (e.event === 'LOOP_ITERATION') loopCount++;
    if ((e.event === 'LINE' || e.event === 'LOOP_ITERATION') && !sawLoopVar) {
      const vars = e.variables || {};
      sawLoopVar = Object.keys(vars).find(k => /^(i|j|idx|index|left|l|low)$/.test(k)) || null;
    }
    if (typeof e.callDepth === 'number') depthEver = Math.max(depthEver, e.callDepth);
  }
  if (collectionsSeen.has('map') || collectionsSeen.has('memo') || collectionsSeen.has('seen')) {
    if (!has('HASHING')) patterns.push({ pattern: 'HASHING' });
  }
  if (depthEver >= 2) {
    if (!has('RECURSION')) patterns.push({ pattern: 'RECURSION' });
  }
  if (loopCount >= 1) {
    if (!has('ARRAY_SCAN')) patterns.push({ pattern: 'ARRAY_SCAN', variables: sawLoopVar ? [sawLoopVar] : undefined });
  }
  if (loopCount >= 2 && !has('NESTED_LOOP')) patterns.push({ pattern: 'NESTED_LOOP' });
  return patterns;
}

async function runInSandbox(language: string, program: string): Promise<{ stdout: string; stderr: string; success: boolean; error?: string }> {
  // Reuses the existing runner chain: Piston (default) → Judge0 when
  // configured. NO local spawn, NO eval inside the Express process.
  const result = await (codingExecutionService as any).traceRun(program, language);
  return result;
}

/** Trace a Python solution. */
async function tracePython(params: {
  sourceCode: string;
  testInput: string;
  functionName?: string;
}): Promise<ITraceResult> {
  const harness = buildPythonTraceHarness({
    sourceCode: params.sourceCode,
    testInput: params.testInput,
    functionName: params.functionName,
    maxSteps: TRACE_LIMITS.maxTraceSteps,
    timeoutSec: Math.ceil(TRACE_LIMITS.runtimeTimeoutMs / 1000),
  });

  const started = Date.now();
  let run: { stdout: string; stderr: string; success: boolean; error?: string };
  try {
    run = await runInSandbox('python', harness);
  } catch (err: any) {
    return unavailable(`Trace execution failed: ${err?.message || 'unknown error'}`, { ...params, language: 'python' });
  }

  const parsed = parsePythonTraceStdout(run.stdout || '');
  const engine: ITraceMetadata['engine'] = 'python-instrumented';

  if (parsed.events.length === 0) {
    const reason = run.error
      ? `Execution failed: ${String(run.error).slice(0, 300)}`
      : 'No trace events were produced (harness output missing).';
    return unavailable(reason, { ...params, language: 'python' }, engine);
  }

  // When the traced run raised mid-execution, keep the events captured before
  // the failure and surface the error so the UI can show the failure state (§41).
  const runtimeError = (parsed.sawLimit && run.error && parsed.events.length > 0)
    ? String(run.error).slice(0, 300)
    : (run.error && parsed.events.length > 0 ? String(run.error).slice(0, 300) : undefined);

  const events = parsed.events.map((raw, i) => normalizePythonEvent(raw, i + 1, parsed.programOutput));
  appendOutputEvent(events, parsed.programOutput);

  if (parsed.truncated || events.length > TRACE_LIMITS.maxTraceSteps || payloadTooLarge(events)) {
    return buildResult(events.slice(0, TRACE_LIMITS.maxTraceSteps), {
      language: 'python',
      functionName: params.functionName,
      inputPreview: params.testInput,
      totalSteps: events.length,
      truncated: true,
      finalOutput: parsed.programOutput,
      runtimeMs: Date.now() - started,
      patterns: [],
      returnValue: parsed.returnValue === undefined ? undefined : serializeReturnValue(parsed.returnValue),
      engine,
    }, true, 'Visualization stopped because execution generated too many steps.');
  }

  const collectionsSeen = new Set<string>();
  for (const e of events) {
    for (const k of Object.keys(e.collections || {})) collectionsSeen.add(k.toLowerCase());
  }
  return buildResult(events, {
    language: 'python',
    functionName: params.functionName,
    inputPreview: params.testInput,
    totalSteps: events.length,
    truncated: false,
    finalOutput: parsed.programOutput,
    runtimeMs: Date.now() - started,
    patterns: detectPatterns(parsed.events, collectionsSeen),
    returnValue: parsed.returnValue === undefined ? undefined : serializeReturnValue(parsed.returnValue),
    runtimeError,
    engine,
  }, false);
}

/** Trace a JS/TS solution. */
async function traceJs(params: {
  sourceCode: string;
  language: 'javascript' | 'typescript';
  testInput: string;
  functionName?: string;
}): Promise<ITraceResult> {
  let program: string;
  try {
    const built = buildJsTraceProgram({
      sourceCode: params.sourceCode,
      language: params.language,
      testInput: params.testInput,
      functionName: params.functionName,
      maxSteps: TRACE_LIMITS.maxTraceSteps,
    });
    program = built.program;
  } catch (err: any) {
    return unavailable(`Could not instrument this code: ${err?.message || 'parse failure'}`, { ...params, language: params.language });
  }

  const started = Date.now();
  let run: { stdout: string; stderr: string; success: boolean; error?: string };
  try {
    run = await runInSandbox(params.language, program);
  } catch (err: any) {
    return unavailable(`Trace execution failed: ${err?.message || 'unknown error'}`, { ...params, language: params.language });
  }

  const parsed = parseJsTraceStdout(run.stdout || '');
  const engine: ITraceMetadata['engine'] = 'js-instrumented';

  if (parsed.events.length === 0) {
    const reason = run.error
      ? `Execution failed: ${String(run.error).slice(0, 300)}`
      : 'No trace events were produced (harness output missing).';
    return unavailable(reason, { ...params, language: params.language }, engine);
  }

  const events = parsed.events.map((raw, i) => normalizeJsEvent(raw, i + 1));
  if (parsed.programOutput) {
    const last = events[events.length - 1];
    events.push({
      step: (last?.step ?? 0) + 1, line: 0, event: 'OUTPUT',
      function: last?.function || '<module>', variables: {},
      stdout: parsed.programOutput, callDepth: last?.callDepth ?? 0,
    });
  }

  if (parsed.stopped || events.length > TRACE_LIMITS.maxTraceSteps || payloadTooLarge(events)) {
    return buildResult(events.slice(0, TRACE_LIMITS.maxTraceSteps), {
      language: params.language,
      functionName: params.functionName,
      inputPreview: params.testInput,
      totalSteps: events.length,
      truncated: true,
      finalOutput: parsed.programOutput,
      runtimeMs: Date.now() - started,
      patterns: [],
      returnValue: parsed.returnValue === undefined ? undefined : serializeReturnValue(parsed.returnValue),
      engine,
    }, true, 'Visualization stopped because execution generated too many steps.');
  }

  const collectionsSeen = new Set<string>();
  for (const e of parsed.events) {
    for (const k of Object.keys(e.c || {})) collectionsSeen.add(k.toLowerCase());
  }
  return buildResult(events, {
    language: params.language,
    functionName: params.functionName,
    inputPreview: params.testInput,
    totalSteps: events.length,
    truncated: false,
    finalOutput: parsed.programOutput,
    runtimeMs: Date.now() - started,
    patterns: detectPatterns(parsed.events, collectionsSeen),
    returnValue: parsed.returnValue === undefined ? undefined : serializeReturnValue(parsed.returnValue),
    runtimeError: run.error ? String(run.error).slice(0, 300) : undefined,
    engine,
  }, false);
}

/**
 * Java adapter — REAL run of the candidate's solution on the real input via
 * the existing Java harness, reported honestly at function granularity.
 */
async function traceJavaFunctionLevel(params: {
  sourceCode: string;
  testInput: string;
  functionName?: string;
}): Promise<ITraceResult> {
  const started = Date.now();
  try {
    const { codeExecutionService } = await import('../../services/codeExecution');
    const harness = codeExecutionService.buildHarness('java', params.sourceCode, params.testInput, params.functionName);
    const run = await (codingExecutionService as any).traceRun(harness, 'java');

    const lines = (run.stdout || '').split('\n').filter((l: string) => l.trim().length > 0);
    const output = lines.join('\n');
    if (run.error && !output) {
      return unavailable(`Execution failed: ${String(run.error).slice(0, 300)}`, { ...params, language: 'java' }, 'java-adapter');
    }

    const events: ITraceEvent[] = [
      { step: 1, line: 0, event: 'FUNCTION_CALL', function: params.functionName || 'Solution', variables: {}, callDepth: 1, note: 'Java function-level trace: line-level visualization not claimed for Java.' },
      { step: 2, line: 0, event: 'FUNCTION_RETURN', function: params.functionName || 'Solution', variables: { __ret: output || '(no output)' }, callDepth: 0, note: 'Solution returned.' },
    ];
    return buildResult(events, {
      language: 'java',
      functionName: params.functionName,
      inputPreview: params.testInput,
      totalSteps: events.length,
      truncated: false,
      finalOutput: output,
      runtimeMs: Date.now() - started,
      patterns: [],
      engine: 'java-adapter',
    }, false);    } catch (err: any) {
    return unavailable(`Java trace failed: ${err?.message || 'unknown error'}`, { ...params, language: 'java' }, 'java-adapter');
  }
}

function unavailable(reason: string, params: { language: string; testInput: string; functionName?: string; sourceCode?: string }, engine?: ITraceMetadata['engine']): ITraceResult {
  return {
    ok: false,
    supported: false,
    reason,
    events: [],
    metadata: {
      language: params.language,
      functionName: params.functionName,
      inputPreview: params.testInput.slice(0, 400),
      totalSteps: 0,
      truncated: false,
      finalOutput: '',
      runtimeMs: 0,
      patterns: [],
      engine: engine || 'none',
    },
  };
}

function buildResult(
  events: ITraceEvent[],
  metadata: ITraceMetadata,
  truncated: boolean,
  reason?: string
): ITraceResult {
  return {
    ok: true,
    supported: true,
    reason: truncated ? reason : undefined,
    events: events.map(e => ({
      ...e,
      variables: e.variables ? safeSerialize(e.variables) as Record<string, unknown> : undefined,
      collections: e.collections ? safeSerialize(e.collections) as Record<string, unknown> : undefined,
    })),
    metadata: { ...metadata, totalSteps: events.length, truncated },
  };
}

/** Public entry — used by the visualization controller. */
export async function generateTrace(params: {
  language: string;
  sourceCode: string;
  testInput: string;
  functionName?: string;
}): Promise<ITraceResult> {
  if (!params.sourceCode?.trim()) return unavailable('Source code is empty.', { language: params.language, testInput: params.testInput, functionName: params.functionName });
  if (!params.testInput) return unavailable('A sample or custom input is required for visualization.', { language: params.language, testInput: params.testInput, functionName: params.functionName });

  switch (params.language) {
    case 'python':
      return tracePython({ sourceCode: params.sourceCode, testInput: params.testInput, functionName: params.functionName });
    case 'javascript':
    case 'typescript':
      return traceJs({ sourceCode: params.sourceCode, language: params.language, testInput: params.testInput, functionName: params.functionName });
    case 'java':
      return traceJavaFunctionLevel({ sourceCode: params.sourceCode, testInput: params.testInput, functionName: params.functionName });
    case 'cpp':
    case 'c':
    default:
      return unavailable(
        `Line-level visualization is not yet supported for ${params.language}. Judge0 execution and AST analysis remain fully available.`,
        { language: params.language, testInput: params.testInput, functionName: params.functionName }
      );
  }
}
