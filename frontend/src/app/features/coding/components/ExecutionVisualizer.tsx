import { useEffect, useMemo, useRef, useState } from 'react';
import { Monaco } from '@monaco-editor/react';
import Editor from '@monaco-editor/react';
import {
  Play, Pause, SkipBack, SkipForward, RotateCcw, X, Layers, Braces,
  Binary, GitBranch, Gauge, AlertTriangle,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import type { ITraceResult, ITraceEvent, ITraceInputOption, ITraceMetadata } from '../services/trace.service';
import { traceService } from '../services/trace.service';

/**
 * AETHER Coding — Execution Visualizer.
 *
 * Two-pane playback: source (active line highlighted in Monaco, real trace
 * events only) ↔ program state (variables + data-structure views). Tabs keep
 * the AST (static structure) separate from the Execution trace (runtime).
 */

type VisualTab = 'execution' | 'structures' | 'ast' | 'callgraph' | 'complexity';

const SPEEDS = [0.5, 1, 2] as const;

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
  const [tab, setTab] = useState<VisualTab>('execution');

  useEffect(() => {
    if (!open) return;
    setTrace(null); setError(null); setSelectedInput(null); setCustomInput('');
    traceService.listInputs(submissionId).then(data => {
      if (data) setInputs(data.inputs);
    }).catch(() => setInputs([]));
  }, [open, submissionId]);

  if (!open) return null;

  const runTrace = async (inputId: string) => {
    setLoading(true); setError(null);
    try {
      const result = await traceService.trace(
        submissionId,
        inputId,
        inputId === 'custom' ? customInput : undefined
      );
      setTrace(result);
      setSelectedInput(inputId);
      setTab('execution');
    } catch (e: any) {
      setError(e?.message || 'Trace failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-50 flex flex-col" role="dialog" aria-label="Execution Visualizer">
      {/* Header */}
      <div className="shrink-0 bg-white border-b px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-slate-800">Execution Visualizer</h2>
          <span className="text-xs text-slate-400">{language} · real execution trace — not AI-generated</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close visualizer">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Input chooser */}
      {!trace && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl border p-6 w-full max-w-lg space-y-4">
            <h3 className="font-semibold text-slate-800">Choose an input to visualize</h3>
            <p className="text-xs text-slate-500">
              Only sample test cases and your own custom input can be visualized. Hidden test cases are never exposed.
            </p>
            {inputs.length === 0 && <p className="text-sm text-slate-400">No traceable inputs found for this submission.</p>}
            <div className="space-y-2">
              {inputs.map(inp => (
                inp.id === 'custom' ? (
                  <div key={inp.id} className="rounded-xl border p-3 space-y-2">
                    <p className="text-sm font-medium text-slate-700">Custom Input</p>
                    <textarea
                      value={customInput}
                      onChange={e => setCustomInput(e.target.value)}
                      placeholder={'e.g.\n[7,1,5,3,6,4]\n(or any stdin your solution accepts)'}
                      className="w-full h-20 rounded-lg border p-2 font-mono text-xs"
                    />
                    <Button size="sm" disabled={loading || !customInput.trim()} onClick={() => runTrace('custom')}>
                      {loading ? 'Tracing…' : 'Visualize Custom Input'}
                    </Button>
                  </div>
                ) : (
                  <button
                    key={inp.id}
                    onClick={() => runTrace(inp.id)}
                    disabled={loading}
                    className="w-full text-left rounded-xl border p-3 hover:border-blue-400 transition-colors disabled:opacity-50"
                  >
                    <p className="text-sm font-medium text-slate-700">{inp.label}</p>
                    <pre className="text-xs text-slate-500 font-mono whitespace-pre-wrap mt-1">{inp.input}</pre>
                  </button>
                )
              ))}
            </div>
            {loading && <p className="text-xs text-blue-600 animate-pulse">Running instrumented execution…</p>}
            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <AlertTriangle className="w-4 h-4 inline mr-1" />{error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Visualizer body */}
      {trace && (
        trace.ok && trace.events.length > 0 ? (
          <TracePlayer
            key={`${selectedInput}-${trace.metadata.totalSteps}`}
            trace={trace}
            sourceCode={sourceCode}
            monacoLanguage={monacoLanguage}
            astTree={astTree}
            complexity={complexity}
            onBackToInputs={() => setTrace(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl border border-amber-200 bg-amber-50 p-6 max-w-lg text-sm text-amber-800 space-y-2">
              <p className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Visualization unavailable</p>
              <p>{trace.reason || trace.metadata?.engine === 'none' ? trace.reason : 'No events were captured.'}</p>
              <Button variant="outline" size="sm" onClick={() => setTrace(null)}>Choose another input</Button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

/** Two-pane playback once a trace exists. */
function TracePlayer(props: {
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
  const [tab, setTab] = useState<VisualTab>('execution');
  const editorRef = useRef<any>(null);
  const decorationsRef = useRef<any[]>([]);

  const current: ITraceEvent | undefined = events[stepIdx];

  // Monaco line highlight follows the active event.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const line = current?.line || 0;
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, line ? [{
      range: new (window as any).monaco.Range(line, 1, line, 1),
      options: {
        isWholeLine: true,
        className: 'aether-trace-line',
        overviewRuler: { color: '#2563EB', position: (window as any).monaco.OverviewRulerLane.Right },
      },
    }] : []);
    if (line) editor.revealLineInCenter(line);
  }, [current?.line, editorRef.current]);

  // Playback timer.
  useEffect(() => {
    if (!playing) return;
    const interval = Math.max(80, 600 / speed);
    const t = setInterval(() => {
      setStepIdx(s => {
        if (s >= events.length - 1) { setPlaying(false); return s; }
        return s + 1;
      });
    }, interval);
    return () => clearInterval(t);
  }, [playing, speed, events.length]);

  // Jump to first event when a new trace arrives.
  useEffect(() => { setStepIdx(0); setPlaying(false); }, [trace]);

  const vars = useMemo(() => Object.entries(current?.variables || {}), [current]);
  const collections = useMemo(() => Object.entries(current?.collections || {}), [current]);
  const patterns = trace.metadata.patterns || [];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Tabs: Execution / Data Structures / AST / Call Graph / Complexity */}
      <div className="shrink-0 border-b bg-white px-4 flex items-center gap-1">
        {([
          ['execution', 'Execution', Play],
          ['structures', 'Data Structures', Binary],
          ['ast', 'AST Tree', Braces],
          ['callgraph', 'Call Graph', GitBranch],
          ['complexity', 'Complexity', Gauge],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            role="tab"
            aria-selected={tab === id}
            className={`px-3 py-2 text-sm border-b-2 flex items-center gap-1.5 transition-colors ${
              tab === id ? 'border-blue-600 text-blue-700 font-medium' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          <span>{trace.metadata.engine}</span>
          <span>· {trace.metadata.totalSteps} steps</span>
          {trace.metadata.truncated && <span className="text-amber-600">· truncated</span>}
          <Button variant="ghost" size="sm" onClick={onBackToInputs}>Change input</Button>
        </div>
      </div>

      {/* Panes */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
        {/* Left: source with active line */}
        <div className="min-h-0 border-r overflow-hidden">
          <Editor
            height="100%"
            language={monacoLanguage}
            value={sourceCode}
            theme="vs"
            onMount={(editor) => { editorRef.current = editor; }}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              renderLineHighlight: 'none',
            }}
          />
        </div>

        {/* Right: state / structures / ast / callgraph / complexity */}
        <div className="min-h-0 overflow-y-auto p-4 bg-white">
          {tab === 'execution' && (
            <div className="space-y-4">
              <section>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Variables</h4>
                {vars.length === 0 && <p className="text-sm text-slate-400">No local variables at this step.</p>}
                <div className="space-y-1">
                  {vars.map(([k, v]) => (
                    <div key={k} className="flex items-baseline gap-2 font-mono text-sm">
                      <span className="text-slate-500">{k}</span>
                      <span className="text-slate-400">=</span>
                      <span className="text-blue-700">{formatValue(v)}</span>
                    </div>
                  ))}
                </div>
              </section>
              {collections.length > 0 && (
                <section>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Collections</h4>
                  <div className="space-y-1">
                    {collections.map(([k, v]) => (
                      <div key={k} className="flex items-baseline gap-2 font-mono text-sm">
                        <span className="text-slate-500">{k}</span>
                        <span className="text-slate-400">=</span>
                        <span className="text-indigo-700">{formatValue(v)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {current?.stdout && (
                <section>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Output</h4>
                  <pre className="rounded-lg bg-slate-900 text-slate-100 p-3 text-xs font-mono whitespace-pre-wrap">{current.stdout}</pre>
                </section>
              )}
              {current?.note && <p className="text-xs text-slate-500">{current.note}</p>}
              {patterns.length > 0 && (
                <section>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Detected patterns</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {patterns.map(p => (
                      <span key={p.pattern} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs">{p.pattern}</span>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {tab === 'structures' && <StructureView event={current} metadata={trace.metadata} />}
          {tab === 'ast' && <AstPane astTree={astTree} />}
          {tab === 'callgraph' && <CallGraphPane events={events} currentStep={current?.step ?? 1} />}
          {tab === 'complexity' && (
            <div className="space-y-3 text-sm">
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">Estimated time</p>
                <p className="font-semibold text-slate-800">{complexity?.estimatedTime || trace.metadata.language.toUpperCase() + ' trace'}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">Estimated space</p>
                <p className="font-semibold text-slate-800">{complexity?.estimatedSpace || '—'}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">Trace runtime</p>
                <p className="font-semibold text-slate-800">{trace.metadata.runtimeMs} ms</p>
              </div>
              <p className="text-xs text-slate-400">Static complexity comes from the AST analyzer; the trace runtime is measured from the real instrumented run.</p>
            </div>
          )}
        </div>
      </div>

      {/* Playback controls */}
      <div className="shrink-0 border-t bg-white px-4 py-2.5 flex items-center gap-3">
        <span className="text-sm text-slate-600 font-medium whitespace-nowrap">Step {stepIdx + 1} / {events.length}</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => { setPlaying(false); setStepIdx(0); }} aria-label="Restart">
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setPlaying(false); setStepIdx(s => Math.max(0, s - 1)); }} aria-label="Previous step">
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setPlaying(p => !p)} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setPlaying(false); setStepIdx(s => Math.min(events.length - 1, s + 1)); }} aria-label="Next step">
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-slate-400 mr-1">Speed:</span>
          {SPEEDS.map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-1 rounded-full border text-xs ${speed === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}
            >
              {s}x
            </button>
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={events.length - 1}
          value={stepIdx}
          onChange={e => { setPlaying(false); setStepIdx(Number(e.target.value)); }}
          className="flex-1 accent-blue-600"
          aria-label="Timeline scrubber"
        />
        <span className="text-xs text-slate-500 whitespace-nowrap">{current?.event}</span>
      </div>
    </div>
  );
}

/** Data-structure views derived from real collection snapshots. */
function StructureView({ event, metadata }: { event?: ITraceEvent; metadata: ITraceMetadata }) {
  if (!event) return <p className="text-sm text-slate-400">No step selected.</p>;
  const cols = Object.entries(event.collections || {});
  const vars = Object.entries(event.variables || {});
  if (cols.length === 0 && vars.length === 0) {
    return <p className="text-sm text-slate-400">No collection state captured at this step.</p>;
  }
  return (
    <div className="space-y-5">
      {cols.map(([name, value]) => (
        <section key={name}>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{name}</h4>
          <CollectionView name={name} value={value} variables={event.variables || {}} />
        </section>
      ))}
      {cols.length === 0 && vars.length > 0 && (
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Scalars</h4>
          <div className="flex flex-wrap gap-2">
            {vars.map(([k, v]) => (
              <span key={k} className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-100 font-mono text-xs text-blue-700">{k}={formatValue(v)}</span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CollectionView({ name, value, variables }: { name: string; value: unknown; variables: Record<string, unknown> }) {
  // Array → boxed cells with a pointer marker when a scalar index var matches.
  if (Array.isArray(value)) {
    const pointerVar = Object.keys(variables).find(k => /^(i|j|idx|index|left|l|low|right|r|high|mid|buy|sell|start|end)$/.test(k) && typeof variables[k] === 'number');
    const ptr = pointerVar ? (variables[pointerVar] as number) : null;
    return (
      <div>
        <div className="flex flex-wrap gap-1">
          {value.map((v, i) => (
            <div
              key={i}
              className={`min-w-[2.2rem] px-2 py-1.5 rounded-lg border text-center font-mono text-xs ${
                ptr === i ? 'border-blue-600 bg-blue-600 text-white font-bold ring-2 ring-blue-200' : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              {formatValue(v)}
            </div>
          ))}
        </div>
        {ptr != null && (
          <p className="mt-1 text-xs text-blue-600 font-medium">↑ {pointerVar} = {ptr}</p>
        )}
      </div>
    );
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <div className="space-y-1">
        {entries.length === 0 && <p className="text-xs text-slate-400">(empty)</p>}
        {entries.map(([k, v]) => (
          <div key={k} className="inline-flex items-center gap-1.5 mr-2 mb-1 px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs">
            <span className="text-slate-600">{k}</span>
            <span className="text-slate-400">→</span>
            <span className="text-indigo-700">{formatValue(v)}</span>
          </div>
        ))}
      </div>
    );
  }
  return <p className="font-mono text-sm text-slate-700">{formatValue(value)}</p>;
}

/** Collapsible AST tree (static structure — clearly labeled, not execution). */
function AstPane({ astTree }: { astTree?: any }) {
  if (!astTree) {
    return <p className="text-sm text-slate-400">AST is unavailable for this submission. The AST tab shows static code structure — it is distinct from the runtime execution trace.</p>;
  }
  return (
    <div>
      <p className="text-xs text-slate-400 mb-2">Static code structure (AST) — what the code IS, not what it did at runtime.</p>
      <AstNode node={astTree} depth={0} />
    </div>
  );
}

function AstNode({ node, depth }: { node: any; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  if (!node) return null;
  const children: any[] = node.children || [];
  return (
    <div style={{ paddingLeft: depth ? 14 : 0 }} className="border-l border-slate-100 first:border-l-0">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 py-0.5 text-xs hover:text-blue-700">
        {children.length > 0 && <span className="text-slate-400 w-3">{open ? '▾' : '▸'}</span>}
        <span className="font-medium text-slate-700">{node.type}</span>
        {node.label && <span className="text-slate-400">{node.label}</span>}
        {node.loc && <span className="text-slate-300">L{node.loc.startLine}</span>}
      </button>
      {open && children.map((c, i) => <AstNode key={c.id || i} node={c} depth={depth + 1} />)}
    </div>
  );
}

/** Call graph: function call sequence + current call stack frames. */
function CallGraphPane({ events, currentStep }: { events: ITraceEvent[]; currentStep: number }) {
  const current = events.find(e => e.step === currentStep) || events[events.length - 1];
  const stack = current?.callStack || [current?.function || '<module>'];
  const calledFns = useMemo(() => {
    const names = new Map<string, number>();
    for (const e of events) {
      if (e.event === 'FUNCTION_CALL' || e.event === 'RECURSION_CALL') {
        names.set(e.function, (names.get(e.function) || 0) + 1);
      }
    }
    return [...names.entries()];
  }, [events]);

  return (
    <div className="space-y-5">
      <section>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Call stack at this step</h4>
        <div className="space-y-1">
          {stack.map((frame, i) => (
            <div
              key={`${frame}-${i}`}
              className={`px-3 py-1.5 rounded-lg border font-mono text-xs ${
                i === stack.length - 1 ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold' : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
              style={{ marginLeft: i * 14 }}
            >
              {frame}
            </div>
          ))}
        </div>
      </section>
      <section>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Functions called</h4>
        {calledFns.length === 0 && <p className="text-xs text-slate-400">No function calls captured.</p>}
        <div className="flex flex-wrap gap-1.5">
          {calledFns.map(([fn, count]) => (
            <span key={fn} className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-mono">{fn} ×{count}</span>
          ))}
        </div>
      </section>
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return `"${v}"`;
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}
