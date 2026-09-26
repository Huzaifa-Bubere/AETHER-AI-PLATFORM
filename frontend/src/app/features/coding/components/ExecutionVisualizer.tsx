/**
 * AETHER Coding — Animated Algorithm Dry-Run Visualizer.
 *
 * A post-submission learning layer: press "Visualize Execution" and watch the
 * submitted algorithm explain itself step by step — animated cells, pointers,
 * a large live expression, operation counters, one-line explanations, the
 * executing code line, and a final complexity summary.
 *
 * Every frame comes from a REAL instrumented trace (Python sys.settrace /
 * Acorn JS instrumentation). Nothing is simulated by AI and hidden test
 * inputs are never exposed — only sample and custom inputs can be traced.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Play, X, Layers, AlertTriangle, Binary, Loader2, PanelRightClose, PanelRightOpen,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import type { ITraceResult, ITraceInputOption } from '../services/trace.service';
import { traceService } from '../services/trace.service';
import { buildStory } from './visualizer/story';
import type { StoryInput, VizStep } from './visualizer/story.types';
import { AlgorithmCanvas } from './visualizer/AlgorithmCanvas';
import { ExecutionCodePanel, PlaybackControls, ExecutionSummary } from './visualizer/ExecutionCodePanel';
import { VariablesDrawer } from './visualizer/StructureVisualizers';

const SPEEDS = [0.5, 1, 1.5, 2] as const;

/** Playback pacing per importance (§29/§30) — milliseconds at 1× speed. */
const DWELL: Record<string, number> = {
  minor: 650,
  normal: 900,
  important: 1000,
  critical: 1700,
};

export function ExecutionVisualizer(props: {
  open: boolean;
  onClose: () => void;
  submissionId: string;
  sourceCode: string;
  language: string;
  monacoLanguage: string;
  astTree?: any;
  complexity?: { estimatedTime?: string; estimatedSpace?: string; evidence?: string[] } | null;
  problemTitle?: string;
  problemObjective?: string;
}) {
  const { open, onClose, submissionId, sourceCode, monacoLanguage, complexity, problemTitle, problemObjective } = props;
  const [inputs, setInputs] = useState<ITraceInputOption[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trace, setTrace] = useState<ITraceResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setTrace(null);
    setError(null);
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
    } catch (e: any) {
      setError(e?.message || 'Trace failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-sm flex flex-col justify-end lg:justify-center p-0 lg:p-4" role="dialog" aria-label="Animated Algorithm Visualizer">
      <div className="bg-[#F8FAFC] w-full h-full lg:max-w-6xl lg:h-[95vh] lg:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="shrink-0 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow-xs">
              <Binary className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Algorithm Visualizer</h2>
              <p className="text-xs text-slate-500">
                Real instrumented execution trace · never simulated by AI
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close visualizer" className="rounded-full hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-600" />
          </Button>
        </div>

        {/* Input chooser (§2) */}
        {!trace && (
          <div className="flex-1 flex items-center justify-center p-6 bg-[#F1F5F9]/60">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-xl shadow-lg space-y-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Select Input to Visualize</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Choose a sample test case or provide your own input. Hidden test cases are strictly protected and never exposed.
                </p>
              </div>

              {inputs.length === 0 && !loading && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                  No sample inputs found. Provide a custom input below.
                </div>
              )}

              <div className="space-y-2.5 max-h-[45vh] overflow-y-auto pr-1">
                {inputs.map(inp => (
                  inp.id === 'custom' ? (
                    <div key={inp.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-800">Custom Stdin Input</p>
                        <span className="text-xs text-slate-500">one argument per line</span>
                      </div>
                      <textarea
                        value={customInput}
                        onChange={e => setCustomInput(e.target.value)}
                        placeholder={'e.g.\n[55, 25, 23, 35, 92, 10, 89, 22]\n111'}
                        className="w-full h-24 rounded-lg border border-slate-300 bg-white p-2.5 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden"
                      />
                      <Button
                        size="sm"
                        disabled={loading || !customInput.trim()}
                        onClick={() => runTrace('custom')}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                      >
                        {loading ? 'Executing…' : 'Visualize Custom Input'}
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
                        <span className="text-xs text-slate-400 group-hover:text-blue-600">Visualize this input →</span>
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
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Running instrumented sandbox tracer…
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

        {/* Animated story player */}
        {trace && (
          trace.ok && trace.events.length > 0 ? (
            <StoryPlayer
              key={`${trace.metadata.inputPreview}-${trace.metadata.totalSteps}`}
              trace={trace}
              sourceCode={sourceCode}
              monacoLanguage={monacoLanguage}
              complexity={complexity}
              problemTitle={problemTitle}
              problemObjective={problemObjective}
              onBackToInputs={() => setTrace(null)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 bg-[#F1F5F9]/60">
              <div className="bg-white rounded-2xl border border-amber-200 p-6 max-w-lg text-sm text-amber-900 shadow-md space-y-3">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <span>Visualization Unavailable</span>
                </div>
                <p className="text-xs text-amber-700">{trace.reason || 'No execution steps were captured for this input.'}</p>
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

// ── Story player ────────────────────────────────────────────────────────────

function StoryPlayer(props: {
  trace: ITraceResult;
  sourceCode: string;
  monacoLanguage: string;
  complexity?: { estimatedTime?: string; estimatedSpace?: string; evidence?: string[] } | null;
  problemTitle?: string;
  problemObjective?: string;
  onBackToInputs: () => void;
}) {
  const { trace, sourceCode, complexity, problemTitle, problemObjective, onBackToInputs } = props;
  const reduce = useReducedMotion();

  const story = useMemo<ReturnType<typeof buildStory>>(() => buildStory({
    events: trace.events,
    patterns: trace.metadata.patterns || [],
    approachHint: undefined,
    dataStructures: undefined,
    complexity,
    problemTitle,
    problemObjective,
    runtimeError: trace.metadata.runtimeError || null,
  } as StoryInput), [trace, complexity, problemTitle, problemObjective]);

  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const autoStarted = useRef(false);

  const steps = story.steps;
  const total = steps.length;
  const current: VizStep | undefined = steps[stepIndex];
  const isLast = stepIndex >= total - 1;

  // Auto-start playback like the reference experience
  useEffect(() => {
    if (!autoStarted.current && total > 1) {
      autoStarted.current = true;
      setPlaying(true);
    }
  }, [total]);

  // ── Playback engine: dwell per step importance × speed ──
  useEffect(() => {
    if (!playing) return;
    if (isLast) { setPlaying(false); return; }
    const step = steps[stepIndex];
    const importance = reduce ? 'minor' : (step?.importance || 'minor');
    const base = reduce ? 260 : DWELL[importance] ?? 800;
    const delay = Math.max(120, base / speed);
    const t = setTimeout(() => setStepIndex(i => Math.min(total - 1, i + 1)), delay);
    return () => clearTimeout(t);
  }, [playing, stepIndex, speed, total, steps, reduce]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { setPlaying(false); setStepIndex(i => Math.min(total - 1, i + 1)); }
      if (e.key === 'ArrowLeft') { setPlaying(false); setStepIndex(i => Math.max(0, i - 1)); }
      if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total]);

  // ── Variable history for the drawer (§33) ──
  const variableHistory = useMemo(() => {
    const hist = new Map<string, string[]>();
    for (const e of trace.events.slice(0, stepIndex + 1)) {
      for (const [k, v] of Object.entries(e.variables || {})) {
        if (k === '__ret') continue;
        const arr = hist.get(k) || [];
        const val = typeof v === 'string' ? v : JSON.stringify(v);
        if (arr[arr.length - 1] !== val && arr.length < 24) arr.push(val);
        hist.set(k, arr);
      }
    }
    return [...hist.entries()].map(([name, values]) => ({ name, values }));
  }, [stepIndex, trace.events]);

  const onViewInEditor = (line: number) => {
    window.dispatchEvent(new CustomEvent('aether-visualizer-reveal', { detail: { line } }));
  };

  if (!current) return null;

  const isSummary = current.event === 'SUMMARY';

  return (
    <div className="flex-1 min-h-0 flex flex-col relative">
      {/* Engine / safety strip */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-5 py-1.5 flex items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-2 text-slate-500">
          <span className="font-mono bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">{trace.metadata.engine}</span>
          <span className="font-mono bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-semibold">
            {story.approachLabel}
          </span>
          {trace.metadata.truncated && (
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold border border-amber-300 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Stopped at safety limit (2,000 steps)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDrawerOpen(o => !o)}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-semibold"
            aria-pressed={drawerOpen}
          >
            {drawerOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
            Variables
          </button>
          <Button variant="outline" size="sm" onClick={onBackToInputs} className="h-6 text-[11px]">
            Change Input
          </Button>
        </div>
      </div>

      {/* Main stage: animation canvas + code panel */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Animation column — vertical storytelling (§4) */}
        <div className="flex-1 min-w-0 overflow-y-auto p-5 lg:p-8 flex flex-col justify-center">
          <motion.div
            key={current.n}
            initial={reduce ? false : { opacity: 0.6 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {isSummary ? (
              <div className="max-w-2xl mx-auto pt-6 space-y-5">
                <ExecutionSummary story={story} finalStep={current} complexity={complexity} problemTitle={problemTitle} />
                <div className="text-center">
                  <Button variant="outline" size="sm" onClick={() => { setStepIndex(0); setPlaying(true); }} className="mr-2">
                    <Play className="w-3.5 h-3.5 mr-1" /> Replay
                  </Button>
                  <Button variant="ghost" size="sm" onClick={onBackToInputs}>Choose another input</Button>
                </div>
              </div>
            ) : (
              <AlgorithmCanvas story={story} step={current} />
            )}
          </motion.div>
        </div>

        {/* Code column */}
        <aside className="shrink-0 lg:w-[380px] border-t lg:border-t-0 lg:border-l border-slate-200 bg-white p-4 overflow-y-auto">
          <ExecutionCodePanel
            sourceCode={sourceCode}
            step={current}
            onViewInEditor={onViewInEditor}
            errorLine={current.error && current.line ? current.line : null}
          />
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-500 space-y-1">
            <p><span className="font-bold text-slate-600">Why this view?</span> Evidence: {story.evidence.join('; ') || 'generic execution'}.</p>
            <p>Mode <span className="font-mono font-semibold text-slate-700">{story.mode}</span> · confidence from runtime + AST evidence only.</p>
          </div>
        </aside>

        {/* Variables drawer (§33) */}
        <AnimatePresence>
          {drawerOpen && (
            <VariablesDrawer open onClose={() => setDrawerOpen(false)} history={variableHistory} />
          )}
        </AnimatePresence>
      </div>

      {/* Playback controls (§28) */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-2.5">
        <PlaybackControls
          stepIndex={stepIndex}
          totalSteps={total}
          playing={playing}
          speed={speed}
          onSeek={n => { setPlaying(false); setStepIndex(Math.max(0, Math.min(total - 1, n))); }}
          onStep={d => { setPlaying(false); setStepIndex(i => Math.max(0, Math.min(total - 1, i + d))); }}
          onTogglePlay={() => (isLast ? (setStepIndex(0), setPlaying(true)) : setPlaying(p => !p))}
          onSpeed={setSpeed}
        />
      </div>
    </div>
  );
}

// Re-export SPEEDS for tests.
export { SPEEDS };
