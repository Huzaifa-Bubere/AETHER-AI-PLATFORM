import { useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  Play, Pause, SkipBack, SkipForward, RotateCcw, X, Layers, Braces,
  Binary, GitBranch, Gauge, AlertTriangle, Terminal, SplitSquareVertical,
  Maximize2, ArrowRight, ArrowDown, ArrowUp, CheckCircle, Flame
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import type { ITraceResult, ITraceEvent, ITraceInputOption, ITraceMetadata } from '../services/trace.service';
import { traceService } from '../services/trace.service';

/**
 * AETHER Coding — Truly Graphical Program Visualizer.
 *
 * Implements a 4-quadrant layout:
 * 1. CODE (Monaco editor with real-time active line highlighting)
 * 2. PROGRAM STATE (Variables table + Graphical Data Structures: Array, Two-Pointer,
 *    Sliding Window, Stack, Queue, HashMap, Matrix, Tree/Graph)
 * 3. CALL STACK (Hierarchical call stack with active frame indicator)
 * 4. OUTPUT & CONSOLE (Terminal stdout, pattern detection, step commentary)
 *
 * Plus Timeline controls (Restart, Prev, Play/Pause, Next, End, scrubber, speed 0.5x-2x),
 * AST bidirectional synchronization, and visualization safety guards.
 */

type VisualMode = 'split' | 'structures' | 'calltree' | 'ast' | 'complexity';

const SPEEDS = [0.5, 1, 1.5, 2] as const;

export function ExecutionVisualizer(props: {
  open: boolean;
  onClose: () => void;
  submissionId: string;
  sourceCode: string;
  language: string;
  monacoLanguage: string;
  astTree?: any;
  complexity?: { estimatedTime?: string; estimatedSpace?: string } | null;
}) {
  const { open, onClose, submissionId, sourceCode, language, monacoLanguage, astTree, complexity } = props;
  const [inputs, setInputs] = useState<ITraceInputOption[]>([]);
  const [selectedInput, setSelectedInput] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trace, setTrace] = useState<ITraceResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setTrace(null);
    setError(null);
    setSelectedInput(null);
    setCustomInput('');
    traceService.listInputs(submissionId).then(data => {
      if (data) setInputs(data.inputs);
    }).catch(() => setInputs([]));
  }, [open, submissionId]);

  if (!open) return null;

  const runTrace = async (inputId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await traceService.trace(
        submissionId,
        inputId,
        inputId === 'custom' ? customInput : undefined
      );
      setTrace(result);
      setSelectedInput(inputId);
    } catch (e: any) {
      setError(e?.message || 'Trace failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-sm flex flex-col justify-end lg:justify-center p-0 lg:p-4" role="dialog" aria-label="Execution Visualizer">
      <div className="bg-slate-50 w-full h-full lg:max-w-7xl lg:h-[95vh] lg:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="shrink-0 bg-white border-b px-5 py-3 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-slate-800 text-base">Execution Visualizer</h2>
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100 uppercase tracking-wide">
                  {language}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-100 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Real Deterministic Trace
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Graphical execution engine · never simulated by LLM
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close visualizer" className="rounded-full hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-600" />
          </Button>
        </div>

        {/* Input chooser */}
        {!trace && (
          <div className="flex-1 flex items-center justify-center p-6 bg-slate-100/50">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-xl shadow-lg space-y-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Select Input to Trace</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Visualization executes against sample test cases or your own custom input. Hidden test cases are strictly protected and never exposed.
                </p>
              </div>

              {inputs.length === 0 && !loading && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                  No sample inputs found. Please provide a custom input below.
                </div>
              )}

              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {inputs.map(inp => (
                  inp.id === 'custom' ? (
                    <div key={inp.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-800">Custom Stdin Input</p>
                        <span className="text-xs text-slate-500">Provide arguments line-by-line</span>
                      </div>
                      <textarea
                        value={customInput}
                        onChange={e => setCustomInput(e.target.value)}
                        placeholder={'e.g.\n[2, 7, 11, 15]\n9\n(or any stdin accepted by your code)'}
                        className="w-full h-24 rounded-lg border border-slate-300 bg-white p-2.5 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden"
                      />
                      <Button
                        size="sm"
                        disabled={loading || !customInput.trim()}
                        onClick={() => runTrace('custom')}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                      >
                        {loading ? 'Executing trace…' : 'Visualize Custom Input'}
                      </Button>
                    </div>
                  ) : (
                    <button
                      key={inp.id}
                      onClick={() => runTrace(inp.id)}
                      disabled={loading}
                      className="w-full text-left rounded-xl border border-slate-200 bg-white p-3.5 hover:border-blue-500 hover:bg-blue-50/30 transition-all shadow-2xs group disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700">{inp.label}</p>
                        <span className="text-xs text-slate-400 group-hover:text-blue-600 flex items-center gap-1">Trace this input →</span>
                      </div>
                      <pre className="text-xs text-slate-600 font-mono bg-slate-50 rounded-md p-2 mt-2 whitespace-pre-wrap border border-slate-100">
                        {inp.input}
                      </pre>
                    </button>
                  )
                ))}
              </div>

              {loading && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
                  <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  Running instrumented sandbox tracer and generating execution trace…
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <div>
                    <p className="font-semibold">Tracing could not complete</p>
                    <p className="mt-0.5">{error}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Visualizer body */}
        {trace && (
          trace.ok && trace.events.length > 0 ? (
            <GraphicalTracePlayer
              key={`${selectedInput}-${trace.metadata.totalSteps}`}
              trace={trace}
              sourceCode={sourceCode}
              monacoLanguage={monacoLanguage}
              astTree={astTree}
              complexity={complexity}
              onBackToInputs={() => setTrace(null)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 bg-slate-100/50">
              <div className="bg-white rounded-2xl border border-amber-200 bg-amber-50/50 p-6 max-w-lg text-sm text-amber-900 shadow-md space-y-3">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <span>Visualization Unavailable</span>
                </div>
                <p className="text-xs text-amber-700">
                  {trace.reason || (trace.metadata?.engine === 'none' ? trace.reason : 'No execution steps were captured for this input.')}
                </p>
                <Button variant="outline" size="sm" onClick={() => setTrace(null)} className="border-amber-300 hover:bg-amber-100">
                  Choose another input
                </Button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

/**
 * Main Graphical Player providing the 4-Quadrant View + Fullscreen Focus Modes.
 */
function GraphicalTracePlayer(props: {
  trace: ITraceResult;
  sourceCode: string;
  monacoLanguage: string;
  astTree?: any;
  complexity?: { estimatedTime?: string; estimatedSpace?: string } | null;
  onBackToInputs: () => void;
}) {
  const { trace, sourceCode, monacoLanguage, astTree, complexity, onBackToInputs } = props;
  const events = trace.events;
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [mode, setMode] = useState<VisualMode>('split');
  const editorRef = useRef<any>(null);
  const decorationsRef = useRef<any[]>([]);

  const current: ITraceEvent | undefined = events[stepIdx];
  const prevEvent: ITraceEvent | undefined = stepIdx > 0 ? events[stepIdx - 1] : undefined;

  // Monaco line highlight follows the active event
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const line = current?.line || 0;
    const RangeCtor = (window as any).monaco?.Range;
    const range = RangeCtor
      ? new RangeCtor(line, 1, line, 1)
      : { startLineNumber: line, endLineNumber: line, startColumn: 1, endColumn: 1 };

    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      line > 0 ? [{
        range,
        options: {
          isWholeLine: true,
          className: 'aether-trace-line bg-blue-100/70 border-l-4 border-blue-600 font-semibold',
          overviewRuler: { color: '#2563EB', position: 4 },
        },
      }] : []
    );

    if (line > 0) {
      editor.revealLineInCenter(line);
    }
  }, [current?.line, editorRef.current]);

  // Playback timer
  useEffect(() => {
    if (!playing) return;
    const interval = Math.max(70, 600 / speed);
    const t = setInterval(() => {
      setStepIdx(s => {
        if (s >= events.length - 1) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, interval);
    return () => clearInterval(t);
  }, [playing, speed, events.length]);

  // Reset to first step on new trace
  useEffect(() => {
    setStepIdx(0);
    setPlaying(false);
  }, [trace]);

  // Jump to specific line in Monaco editor when clicking AST or variable
  const jumpToLine = (line: number) => {
    if (editorRef.current && line > 0) {
      editorRef.current.revealLineInCenter(line);
      const RangeCtor = (window as any).monaco?.Range;
      const range = RangeCtor
        ? new RangeCtor(line, 1, line, 1)
        : { startLineNumber: line, endLineNumber: line, startColumn: 1, endColumn: 1 };
      decorationsRef.current = editorRef.current.deltaDecorations(
        decorationsRef.current,
        [{
          range,
          options: {
            isWholeLine: true,
            className: 'aether-trace-line bg-amber-100/70 border-l-4 border-amber-600',
            overviewRuler: { color: '#D97706', position: 4 },
          },
        }]
      );
    }
  };

  const vars = useMemo(() => Object.entries(current?.variables || {}), [current]);
  const collections = useMemo(() => Object.entries(current?.collections || {}), [current]);
  const patterns = trace.metadata.patterns || [];

  // Determine which variables changed in this step compared to previous
  const changedVarKeys = useMemo(() => {
    const s = new Set<string>();
    if (!prevEvent) {
      vars.forEach(([k]) => s.add(k));
      return s;
    }
    const prevVars = prevEvent.variables || {};
    vars.forEach(([k, v]) => {
      if (JSON.stringify(v) !== JSON.stringify(prevVars[k])) {
        s.add(k);
      }
    });
    return s;
  }, [vars, prevEvent]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-slate-100/70">
      {/* View Mode Navigation Bar */}
      <div className="shrink-0 border-b bg-white px-5 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {([
            ['split', '4-Quadrant Visualizer', SplitSquareVertical],
            ['structures', 'Data Structures', Binary],
            ['calltree', 'Call Tree & Stack', GitBranch],
            ['ast', 'AST Code Sync', Braces],
            ['complexity', 'Complexity', Gauge],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              role="tab"
              aria-selected={mode === id}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                mode === id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
          <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700 border">
            {trace.metadata.engine}
          </span>
          <span className="font-medium text-slate-600">
            {trace.metadata.totalSteps} steps total
          </span>
          {trace.metadata.truncated && (
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold border border-amber-300">
              Truncated at 2,000 steps
            </span>
          )}
          <Button variant="outline" size="sm" onClick={onBackToInputs} className="h-7 text-xs">
            Change Input
          </Button>
        </div>
      </div>

      {/* Safety Alert if Truncated */}
      {trace.metadata.truncated && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-xs text-amber-800 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Visualization safely stopped because execution generated too many steps (step limit cap: 2,000 events).
          </span>
        </div>
      )}

      {/* Active Workspace / Panes */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {mode === 'split' && (
          <div className="h-full grid grid-cols-1 lg:grid-cols-2 grid-rows-2 gap-px bg-slate-200">
            {/* Top-Left: CODE (Monaco Editor) */}
            <div className="bg-white flex flex-col min-h-0 overflow-hidden">
              <div className="shrink-0 bg-slate-50 px-4 py-2 border-b flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-blue-600" /> SOURCE CODE
                </span>
                {current?.line ? (
                  <span className="font-mono text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    Executing Line {current.line}
                  </span>
                ) : (
                  <span className="text-slate-400 font-mono">Module scope</span>
                )}
              </div>
              <div className="flex-1 min-h-0 relative">
                <Editor
                  height="100%"
                  language={monacoLanguage}
                  value={sourceCode}
                  theme="vs"
                  onMount={(editor) => { editorRef.current = editor; }}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 12.5,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    renderLineHighlight: 'none',
                    lineDecorationsWidth: 6,
                  }}
                />
              </div>
            </div>

            {/* Top-Right: PROGRAM STATE (Variables + Graphical Structures) */}
            <div className="bg-white flex flex-col min-h-0 overflow-hidden">
              <div className="shrink-0 bg-slate-50 px-4 py-2 border-b flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Binary className="w-3.5 h-3.5 text-indigo-600" /> PROGRAM STATE & DATA STRUCTURES
                </span>
                <span className="text-slate-400">Step {stepIdx + 1} of {events.length}</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
                {/* Scalar Variables */}
                <section>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                    <span>Variables</span>
                    {vars.length > 0 && <span className="text-[10px] text-slate-400 lowercase">{vars.length} in scope</span>}
                  </h4>
                  {vars.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No scalar variables at this step.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {vars.map(([k, v]) => {
                        const isChanged = changedVarKeys.has(k);
                        return (
                          <div
                            key={k}
                            className={`px-3 py-1.5 rounded-lg border font-mono text-xs flex items-baseline gap-2 transition-all ${
                              isChanged
                                ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-2xs ring-2 ring-blue-100 font-bold'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <span className="text-slate-500 font-medium">{k}</span>
                            <span className="text-slate-400">=</span>
                            <span className={isChanged ? 'text-blue-700' : 'text-slate-900'}>{formatValue(v)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Graphical Data Structures */}
                <section className="space-y-3 pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Graphical Structures</h4>
                  <GraphicalStructuresView event={current} metadata={trace.metadata} onLineJump={jumpToLine} />
                </section>
              </div>
            </div>

            {/* Bottom-Left: CALL STACK */}
            <div className="bg-white flex flex-col min-h-0 overflow-hidden">
              <div className="shrink-0 bg-slate-50 px-4 py-2 border-b flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-emerald-600" /> CALL STACK
                </span>
                <span className="font-mono text-xs text-slate-400">Depth: {current?.callDepth ?? 0}</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4">
                <CallStackView event={current} />
              </div>
            </div>

            {/* Bottom-Right: OUTPUT & NOTES */}
            <div className="bg-white flex flex-col min-h-0 overflow-hidden">
              <div className="shrink-0 bg-slate-50 px-4 py-2 border-b flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-amber-600" /> OUTPUT & ALGORITHM CONTEXT
                </span>
                <span className="text-xs text-slate-400 font-mono">{current?.event}</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                {/* Standard Output */}
                <div>
                  <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Standard Output</h5>
                  <pre className="rounded-lg bg-slate-900 text-emerald-400 p-3 text-xs font-mono whitespace-pre-wrap min-h-[5rem] shadow-inner">
                    {current?.stdout || trace.metadata.finalOutput || '(no console output)'}
                  </pre>
                </div>

                {/* Return Value */}
                {trace.metadata.returnValue !== undefined && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs flex items-center justify-between">
                    <span className="font-bold text-emerald-900">Return Value:</span>
                    <span className="font-mono font-bold text-emerald-700">{trace.metadata.returnValue}</span>
                  </div>
                )}

                {/* Detected Patterns */}
                {patterns.length > 0 && (
                  <div>
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Detected Patterns</h5>
                    <div className="flex flex-wrap gap-1.5">
                      {patterns.map(p => (
                        <span key={p.pattern} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200 flex items-center gap-1">
                          <Flame className="w-3 h-3 text-blue-500" /> {p.pattern}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step Commentary / Note */}
                {current?.note && (
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">Note: </span>
                    {current.note}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Focused Data Structures Tab */}
        {mode === 'structures' && (
          <div className="h-full bg-white p-6 overflow-y-auto space-y-6">
            <div className="border-b pb-3">
              <h3 className="text-base font-bold text-slate-800">Complete Data Structures Inspector</h3>
              <p className="text-xs text-slate-500">Live graphical render of collections, matrices, stacks, queues, and hashmaps</p>
            </div>
            <GraphicalStructuresView event={current} metadata={trace.metadata} onLineJump={jumpToLine} expanded />
          </div>
        )}

        {/* Focused Call Tree / Graph Tab */}
        {mode === 'calltree' && (
          <div className="h-full bg-white p-6 overflow-y-auto">
            <RecursionTreePane events={events} currentStep={current?.step ?? 1} onLineJump={jumpToLine} />
          </div>
        )}

        {/* Focused AST Tree Tab */}
        {mode === 'ast' && (
          <div className="h-full bg-white p-6 overflow-y-auto">
            <AstSyncPane astTree={astTree} onLineJump={jumpToLine} />
          </div>
        )}

        {/* Complexity Tab */}
        {mode === 'complexity' && (
          <div className="h-full bg-white p-6 overflow-y-auto max-w-2xl mx-auto space-y-4">
            <div className="border-b pb-3">
              <h3 className="text-base font-bold text-slate-800">Complexity & Performance Metrics</h3>
              <p className="text-xs text-slate-500">Static AST complexity analysis vs. measured runtime execution</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Estimated Time</p>
                <p className="text-lg font-bold text-slate-800">{complexity?.estimatedTime || 'O(N)'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Estimated Space</p>
                <p className="text-lg font-bold text-slate-800">{complexity?.estimatedSpace || 'O(1)'}</p>
              </div>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
              <p className="text-xs uppercase tracking-wider text-blue-600 mb-1 font-semibold">Real Trace Runtime</p>
              <p className="text-lg font-bold text-blue-900">{trace.metadata.runtimeMs} ms</p>
              <p className="text-xs text-blue-700/80 mt-1">Measured from sandbox execution across {trace.metadata.totalSteps} steps</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Timeline Controls Bar */}
      <div className="shrink-0 border-t bg-white px-5 py-3 flex items-center gap-4 shadow-sm">
        {/* Step Counter */}
        <span className="text-xs font-bold text-slate-700 whitespace-nowrap bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
          Step {stepIdx + 1} / {events.length}
        </span>

        {/* Transport buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setPlaying(false); setStepIdx(0); }}
            aria-label="Restart"
            title="Restart (|◀)"
            className="h-8 px-2"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setPlaying(false); setStepIdx(s => Math.max(0, s - 1)); }}
            aria-label="Previous step"
            title="Previous (◀)"
            className="h-8 px-2.5"
          >
            <SkipBack className="w-3.5 h-3.5 text-slate-600" />
          </Button>
          <Button
            size="sm"
            className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs"
            onClick={() => setPlaying(p => !p)}
            aria-label={playing ? 'Pause' : 'Play'}
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setPlaying(false); setStepIdx(s => Math.min(events.length - 1, s + 1)); }}
            aria-label="Next step"
            title="Next (▶)"
            className="h-8 px-2.5"
          >
            <SkipForward className="w-3.5 h-3.5 text-slate-600" />
          </Button>
        </div>

        {/* Speed Selector */}
        <div className="flex items-center gap-1 border-l pl-3 text-xs">
          <span className="text-slate-400 mr-1 font-medium">Speed:</span>
          {SPEEDS.map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-0.5 rounded text-xs font-semibold transition-all ${
                speed === s
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Timeline Scrubber Slider */}
        <div className="flex-1 flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={events.length - 1}
            value={stepIdx}
            onChange={e => { setPlaying(false); setStepIdx(Number(e.target.value)); }}
            className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
            aria-label="Timeline scrubber"
          />
        </div>

        {/* Current Event Badge */}
        <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border text-xs font-mono font-medium">
          {current?.event || 'LINE'}
        </span>
      </div>
    </div>
  );
}

/**
 * Graphical Data Structures Visualizer:
 * Renders Array (with single/two-pointer and sliding window), Stack (vertical),
 * Queue (horizontal), HashMap (structured table), Matrix (2D grid), and Graphs.
 */
function GraphicalStructuresView(props: {
  event?: ITraceEvent;
  metadata: ITraceMetadata;
  onLineJump: (line: number) => void;
  expanded?: boolean;
}) {
  const { event, metadata, onLineJump } = props;
  if (!event) return <p className="text-xs text-slate-400">No step selected.</p>;

  const cols = Object.entries(event.collections || {});
  const vars = event.variables || {};

  if (cols.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 italic">
        No collection or data structure created at this step.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {cols.map(([name, value]) => {
        // 1. Matrix (2D Array)
        if (Array.isArray(value) && value.length > 0 && Array.isArray(value[0])) {
          return <MatrixView key={name} name={name} matrix={value as any[][]} variables={vars} />;
        }

        // 2. Stack (array named stack/st/stk)
        if (Array.isArray(value) && /^(stack|st|stk)$/i.test(name)) {
          return <StackView key={name} name={name} stack={value} />;
        }

        // 3. Queue (array named queue/q/deque)
        if (Array.isArray(value) && /^(queue|q|dq|deque)$/i.test(name)) {
          return <QueueView key={name} name={name} queue={value} />;
        }

        // 4. Graph Adjacency Dictionary
        if (
          typeof value === 'object' && value !== null && !Array.isArray(value) &&
          (name.toLowerCase().includes('graph') || name.toLowerCase().includes('adj') ||
           Object.values(value).every(v => Array.isArray(v)))
        ) {
          return <GraphAdjacencyView key={name} name={name} graph={value as Record<string, any[]>} variables={vars} />;
        }

        // 5. Standard 1D Array (with Two Pointer / Sliding Window detection)
        if (Array.isArray(value)) {
          return <ArrayVisualizer key={name} name={name} array={value} variables={vars} />;
        }

        // 6. HashMap / Dictionary
        if (typeof value === 'object' && value !== null) {
          return <HashMapVisualizer key={name} name={name} map={value as Record<string, unknown>} />;
        }

        return (
          <div key={name} className="p-3 rounded-xl border bg-slate-50 font-mono text-xs">
            <span className="font-bold text-slate-700">{name}:</span> {formatValue(value)}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Graphical Array Component:
 * Boxed cells with index numbers, single pointer (↑), Two Pointer (L ↓ and R ↓),
 * and Sliding Window container box.
 */
function ArrayVisualizer({
  name,
  array,
  variables
}: {
  name: string;
  array: unknown[];
  variables: Record<string, unknown>;
}) {
  // Detect Two Pointers (left & right, low & high, start & end, i & j)
  const leftKey = Object.keys(variables).find(k => /^(left|l|low|start|buy)$/i.test(k) && typeof variables[k] === 'number');
  const rightKey = Object.keys(variables).find(k => /^(right|r|high|end|sell)$/i.test(k) && typeof variables[k] === 'number');
  const isTwoPointer = leftKey !== undefined && rightKey !== undefined;

  const leftIdx = leftKey ? (variables[leftKey] as number) : null;
  const rightIdx = rightKey ? (variables[rightKey] as number) : null;

  // Single pointer fallback
  const singlePtrKey = !isTwoPointer
    ? Object.keys(variables).find(k => /^(i|j|idx|index|mid|curr|current)$/i.test(k) && typeof variables[k] === 'number')
    : undefined;
  const singleIdx = singlePtrKey ? (variables[singlePtrKey] as number) : null;

  // Sliding window check: leftIdx <= rightIdx
  const isSlidingWindow = isTwoPointer && leftIdx !== null && rightIdx !== null && leftIdx <= rightIdx;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-bold text-slate-800 text-xs font-mono flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          {name} <span className="text-slate-400 font-normal">[{array.length}]</span>
        </span>
        {isTwoPointer && (
          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold">
            Two Pointer: {leftKey}={leftIdx}, {rightKey}={rightIdx}
          </span>
        )}
      </div>

      <div className="overflow-x-auto pb-2 pt-3">
        <div className="inline-flex items-center gap-1.5 min-w-full">
          {array.map((val, idx) => {
            const isLeft = leftIdx === idx;
            const isRight = rightIdx === idx;
            const isSingle = singleIdx === idx;
            const inWindow = isSlidingWindow && leftIdx !== null && rightIdx !== null && idx >= leftIdx && idx <= rightIdx;

            return (
              <div key={idx} className="flex flex-col items-center">
                {/* Pointer marker from above */}
                <div className="h-5 flex items-center justify-center font-bold text-[10px]">
                  {isLeft && isRight && <span className="text-purple-600 animate-bounce">L,R ↓</span>}
                  {isLeft && !isRight && <span className="text-blue-600 font-bold">L ↓</span>}
                  {!isLeft && isRight && <span className="text-emerald-600 font-bold">R ↓</span>}
                  {isSingle && <span className="text-blue-600 font-bold">↑ {singlePtrKey}</span>}
                </div>

                {/* Boxed Cell */}
                <div
                  className={`w-11 h-11 flex items-center justify-center rounded-xl border text-center font-mono text-xs transition-all ${
                    isLeft || isRight || isSingle
                      ? 'border-blue-600 bg-blue-600 text-white font-bold ring-2 ring-blue-200 shadow-xs'
                      : inWindow
                        ? 'border-indigo-300 bg-indigo-50/70 text-indigo-900 font-semibold'
                        : 'border-slate-200 bg-slate-50 text-slate-800'
                  }`}
                >
                  {formatValue(val)}
                </div>

                {/* Index label underneath */}
                <span className="text-[10px] text-slate-400 font-mono mt-1">
                  {idx}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Graphical Stack Component:
 * Rendered vertically (top element on top) with arrow pointing to TOP.
 */
function StackView({ name, stack }: { name: string; stack: unknown[] }) {
  const reversed = useMemo(() => [...stack].reverse(), [stack]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-bold text-slate-800 text-xs font-mono flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          STACK: {name}
        </span>
        <span className="text-[10px] text-slate-400 font-mono">size: {stack.length}</span>
      </div>

      {stack.length === 0 ? (
        <div className="p-3 text-center rounded-lg border border-dashed text-slate-400 text-xs font-mono">
          (empty stack)
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1 py-1 max-w-[14rem] mx-auto">
          {reversed.map((val, idx) => {
            const isTop = idx === 0;
            return (
              <div key={idx} className="w-full flex items-center justify-between gap-2">
                <div
                  className={`flex-1 py-1.5 px-3 rounded-lg border text-center font-mono text-xs transition-all ${
                    isTop
                      ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold ring-2 ring-amber-100 shadow-2xs'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  {formatValue(val)}
                </div>
                {isTop && (
                  <span className="text-[10px] font-bold text-amber-700 flex items-center gap-0.5 shrink-0">
                    <ArrowDown className="w-3 h-3 text-amber-600 rotate-90" /> TOP
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Graphical Queue Component:
 * Rendered horizontally with front ↓ and rear ↓ arrows.
 */
function QueueView({ name, queue }: { name: string; queue: unknown[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-bold text-slate-800 text-xs font-mono flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          QUEUE: {name}
        </span>
        <span className="text-[10px] text-slate-400 font-mono">size: {queue.length}</span>
      </div>

      {queue.length === 0 ? (
        <div className="p-3 text-center rounded-lg border border-dashed text-slate-400 text-xs font-mono">
          (empty queue)
        </div>
      ) : (
        <div className="overflow-x-auto py-2">
          <div className="inline-flex items-center gap-2">
            <span className="text-[10px] font-bold text-emerald-700">FRONT ↓</span>
            {queue.map((val, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="min-w-[2.5rem] px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 font-mono text-xs font-bold text-center shadow-2xs">
                  {formatValue(val)}
                </div>
                {idx < queue.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                )}
              </div>
            ))}
            <span className="text-[10px] font-bold text-blue-700">REAR ↓</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Graphical HashMap Component:
 * Rendered as a structured 2-column table with key/value headers and updated item pulse.
 */
function HashMapVisualizer({ name, map }: { name: string; map: Record<string, unknown> }) {
  const entries = Object.entries(map);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-bold text-slate-800 text-xs font-mono flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          HASHMAP: {name}
        </span>
        <span className="text-[10px] text-slate-400 font-mono">{entries.length} entries</span>
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-slate-400 italic">(empty hashmap)</p>
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-2 px-3 border-r">Key</th>
                <th className="py-2 px-3">Value</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([k, v], i) => (
                <tr key={k} className={`border-b last:border-b-0 hover:bg-slate-50/50 ${i === entries.length - 1 ? 'bg-blue-50/50' : ''}`}>
                  <td className="py-1.5 px-3 border-r font-semibold text-slate-700">{k}</td>
                  <td className="py-1.5 px-3 text-indigo-700 font-bold">{formatValue(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Graphical Matrix Component:
 * 2D table grid with column and row indices and active cell coordinate highlight.
 */
function MatrixView({
  name,
  matrix,
  variables
}: {
  name: string;
  matrix: any[][];
  variables: Record<string, unknown>;
}) {
  const r = typeof variables.r === 'number' ? variables.r : typeof variables.row === 'number' ? variables.row : typeof variables.i === 'number' ? variables.i : null;
  const c = typeof variables.c === 'number' ? variables.c : typeof variables.col === 'number' ? variables.col : typeof variables.j === 'number' ? variables.j : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-bold text-slate-800 text-xs font-mono flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-500" />
          MATRIX: {name} [{matrix.length}×{matrix[0]?.length || 0}]
        </span>
        {r !== null && c !== null && (
          <span className="text-[10px] font-mono font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
            Current: [{r}][{c}]
          </span>
        )}
      </div>

      <div className="overflow-x-auto py-1">
        <table className="border-collapse font-mono text-xs text-center">
          <thead>
            <tr>
              <th className="w-7 h-7 text-[10px] text-slate-300"></th>
              {matrix[0]?.map((_, colIdx) => (
                <th key={colIdx} className="w-8 h-7 text-[10px] text-slate-400 font-normal">
                  {colIdx}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIdx) => (
              <tr key={rowIdx}>
                <td className="text-[10px] text-slate-400 pr-2 font-normal">{rowIdx}</td>
                {row.map((cell, colIdx) => {
                  const isActive = r === rowIdx && c === colIdx;
                  return (
                    <td key={colIdx} className="p-0.5">
                      <div
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-xs transition-all ${
                          isActive
                            ? 'border-cyan-600 bg-cyan-600 text-white ring-2 ring-cyan-200 shadow-xs'
                            : 'border-slate-200 bg-slate-50 text-slate-800'
                        }`}
                      >
                        {formatValue(cell)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Graphical Adjacency Graph Component (BFS/DFS traversal).
 */
function GraphAdjacencyView({
  name,
  graph,
  variables
}: {
  name: string;
  graph: Record<string, any[]>;
  variables: Record<string, unknown>;
}) {
  const currentKey = typeof variables.curr === 'string' ? variables.curr : typeof variables.start === 'string' ? variables.start : null;
  const visitedArr = Array.isArray(variables.visited) ? variables.visited : [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-bold text-slate-800 text-xs font-mono flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-violet-500" />
          GRAPH (Adjacency): {name}
        </span>
        {currentKey && (
          <span className="text-[10px] font-mono font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded border border-violet-200">
            Current Node: {currentKey}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
        {Object.entries(graph).map(([node, neighbors]) => {
          const isCurrent = node === currentKey;
          const isVisited = visitedArr.includes(node);

          return (
            <div
              key={node}
              className={`p-2 rounded-lg border font-mono text-xs transition-all ${
                isCurrent
                  ? 'border-violet-600 bg-violet-50 text-violet-900 ring-2 ring-violet-200 font-bold'
                  : isVisited
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">{node}</span>
                {isCurrent && <span className="text-[10px] text-violet-600 font-bold">active</span>}
                {isVisited && !isCurrent && <span className="text-[10px] text-emerald-600">visited</span>}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                → {neighbors.join(', ') || '∅'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Call Stack Component.
 */
function CallStackView({ event }: { event?: ITraceEvent }) {
  const stack = event?.callStack || [event?.function || '<module>'];

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        {stack.map((frame, i) => {
          const isTop = i === stack.length - 1;
          return (
            <div
              key={`${frame}-${i}`}
              className={`p-2.5 rounded-xl border font-mono text-xs flex items-center justify-between transition-all ${
                isTop
                  ? 'border-blue-500 bg-blue-50 text-blue-900 font-bold shadow-2xs ring-1 ring-blue-200'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
              style={{ marginLeft: i * 12 }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">#{i}</span>
                <span>{frame}</span>
              </div>
              {isTop && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600 text-white font-semibold">
                  ACTIVE
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Interactive Recursion Tree Component.
 */
function RecursionTreePane({
  events,
  currentStep,
  onLineJump
}: {
  events: ITraceEvent[];
  currentStep: number;
  onLineJump: (line: number) => void;
}) {
  const callEvents = useMemo(() => {
    return events.filter(e => e.event === 'FUNCTION_CALL' || e.event === 'RECURSION_CALL');
  }, [events]);

  return (
    <div className="space-y-4">
      <div className="border-b pb-3">
        <h3 className="text-base font-bold text-slate-800">Recursion & Call Tree</h3>
        <p className="text-xs text-slate-500">Visual call sequence and frames across recursive iterations</p>
      </div>

      {callEvents.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No recursive function calls detected in this execution.</p>
      ) : (
        <div className="space-y-2 max-w-xl">
          {callEvents.map((e, idx) => {
            const isCurrent = e.step === currentStep;
            return (
              <div
                key={idx}
                onClick={() => onLineJump(e.line)}
                className={`p-3 rounded-xl border font-mono text-xs cursor-pointer transition-all ${
                  isCurrent
                    ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold shadow-xs ring-2 ring-blue-100'
                    : 'border-slate-200 bg-white hover:border-blue-300 text-slate-700'
                }`}
                style={{ marginLeft: (e.callDepth || 0) * 20 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">└─</span>
                    <span className="font-bold text-slate-800">{e.function}()</span>
                    <span className="text-[10px] text-slate-500 font-normal">Line {e.line}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Step {e.step}</span>
                </div>
                {e.variables && Object.keys(e.variables).length > 0 && (
                  <div className="mt-1 text-[11px] text-slate-500 pl-5">
                    args: {Object.entries(e.variables).map(([k, v]) => `${k}=${formatValue(v)}`).join(', ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Interactive AST Tree Sync:
 * Clicking an AST node highlights corresponding code line in Monaco editor.
 */
function AstSyncPane({ astTree, onLineJump }: { astTree?: any; onLineJump: (line: number) => void }) {
  if (!astTree) {
    return (
      <div className="p-4 rounded-xl bg-slate-50 border text-xs text-slate-500 italic">
        AST tree representation is unavailable for this submission.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="border-b pb-3">
        <h3 className="text-base font-bold text-slate-800">Abstract Syntax Tree (AST) Synchronization</h3>
        <p className="text-xs text-slate-500">Click any syntax node to navigate and highlight the source code line in Monaco</p>
      </div>
      <AstSyncNode node={astTree} depth={0} onLineJump={onLineJump} />
    </div>
  );
}

function AstSyncNode({ node, depth, onLineJump }: { node: any; depth: number; onLineJump: (line: number) => void }) {
  const [open, setOpen] = useState(depth < 3);
  if (!node) return null;
  const children: any[] = node.children || [];
  const startLine = node.loc?.startLine;

  return (
    <div style={{ paddingLeft: depth ? 16 : 0 }} className="border-l border-slate-200 first:border-l-0">
      <div className="flex items-center gap-2 py-1">
        {children.length > 0 && (
          <button
            onClick={() => setOpen(!open)}
            className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600 font-mono text-xs"
          >
            {open ? '▾' : '▸'}
          </button>
        )}
        <button
          onClick={() => startLine && onLineJump(startLine)}
          className="flex items-center gap-2 px-2 py-0.5 rounded hover:bg-blue-50 text-left font-mono text-xs group"
        >
          <span className="font-semibold text-slate-700 group-hover:text-blue-700">{node.type}</span>
          {node.label && <span className="text-slate-400">"{node.label}"</span>}
          {startLine && (
            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 text-[10px] group-hover:bg-blue-100 group-hover:text-blue-700">
              L{startLine}
            </span>
          )}
        </button>
      </div>
      {open && children.map((c, i) => (
        <AstSyncNode key={c.id || i} node={c} depth={depth + 1} onLineJump={onLineJump} />
      ))}
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return `"${v}"`;
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}
