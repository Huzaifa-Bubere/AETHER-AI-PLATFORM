import { useEffect, useState } from 'react';
import {
  X, CheckCircle2, XCircle, Clock, MemoryStick, EyeOff, Layers, ListChecks,
  GitBranch, Gauge, Sparkles, AlertTriangle,
} from 'lucide-react';
import type { IAstAnalysis, ISubmitResult, ITestOutcome } from '../types';
import { AstTreeView } from './AstTreeView';
import { ComplexityPanel, AstMetricsPanel, ScorePanel } from './AnalysisPanels';
import { OptimizationFeedback } from './OptimizationFeedback';

/**
 * AETHER Coding — post-submission SUBMISSION ANALYSIS panel (spec §3A–§3F).
 *
 * Opens automatically after a successful submit, sits ABOVE the fixed header,
 * the sidebar, Monaco and the sticky controls (z-[140] > header z-50), and
 * scrolls internally (max-h 88vh) so a tall AST/visualizer never hides content.
 *
 * Only tabs whose data actually exists are shown, so a submission with no AST
 * (unsupported language) never offers a dead-end tab.
 */

type TabId = 'overview' | 'testcases' | 'ast' | 'visualize' | 'complexity' | 'optimization' | 'explanation';

export function SubmissionAnalysisModal({
  open, onClose, result, analysis, code, language, monacoLanguage,
  visualizerSupported, onOpenVisualizer,
  problemTitle, expectedTime, expectedSpace, knownApproaches,
}: {
  open: boolean;
  onClose: () => void;
  result: ISubmitResult | null;
  analysis: IAstAnalysis | null;
  code: string;
  language: string;
  monacoLanguage: string;
  visualizerSupported: boolean;
  onOpenVisualizer: () => void;
  problemTitle: string;
  expectedTime?: string;
  expectedSpace?: string;
  knownApproaches?: import('../types').IKnownApproach[];
}) {
  const [tab, setTab] = useState<TabId>('overview');

  // Reset to Overview each time a new submission opens the panel.
  useEffect(() => { if (open) setTab('overview'); }, [open, result?.submissionId]);

  // Escape closes the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !result) return null;

  const tests = Array.isArray(result.tests) ? result.tests : [];
  const hasAst = !!analysis?.ast;
  const tabs: Array<{ id: TabId; label: string; icon: any; show: boolean }> = [
    { id: 'overview', label: 'Overview', icon: ListChecks, show: true },
    { id: 'testcases', label: 'Test Cases', icon: CheckCircle2, show: tests.length > 0 },
    { id: 'ast', label: 'AST Analysis', icon: GitBranch, show: !!analysis },
    { id: 'visualize', label: 'Visualize', icon: Layers, show: true },
    { id: 'complexity', label: 'Complexity', icon: Gauge, show: !!analysis?.complexity },
    { id: 'optimization', label: 'Optimization', icon: Sparkles, show: !!result.optimization },
    { id: 'explanation', label: 'AI Explanation', icon: Sparkles, show: !!result.explanation },
  ];
  const visibleTabs = tabs.filter(t => t.show);

  const accepted = result.status === 'Accepted';

  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center bg-slate-900/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Submission analysis">
      <div className="flex max-h-[90vh] w-[min(1200px,96vw)] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Submission Analysis</p>
            <h2 className="truncate text-lg font-bold text-slate-900">{problemTitle}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {language} · submitted {new Date().toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${
              accepted ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
              {accepted ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {result.status}
            </span>
            <button type="button" onClick={onClose} aria-label="Close submission analysis"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label="Submission analysis sections" className="flex items-end gap-1 overflow-x-auto border-b border-border px-3 sm:px-5">
          {visibleTabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
                  tab === t.id ? 'border-blue-600 font-semibold text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Metric label="Tests passed" value={`${result.passedTests}/${result.totalTests}`} />
                <Metric label="Runtime" value={`${result.runtimeMs} ms`} />
                <Metric label="Memory" value={result.memoryKb != null ? `${result.memoryKb} KB` : '—'} />
                <Metric label="Language" value={language} />
                <Metric label="Est. complexity" value={analysis?.complexity?.estimatedTime ?? '—'} />
                <Metric label="Expected" value={expectedTime ?? '—'} />
              </div>

              {result.optimization && (
                <div className="rounded-xl border border-border p-4">
                  <p className="text-sm font-semibold text-slate-700">Efficiency</p>
                  <p className="mt-1 text-sm text-slate-600">{result.optimization.message}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Candidate {result.optimization.candidateTime} vs expected {result.optimization.expectedTime}
                    {' · '}analyzer confidence {Math.round(result.optimization.analyzerConfidence * 100)}%
                  </p>
                </div>
              )}

              <ScorePanel score={result.scoreBreakdown} explanation={null} />
            </div>
          )}

          {tab === 'testcases' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">
                {tests.filter(t => t.passed).length} / {tests.length} passed · hidden tests are included on submit.
              </p>
              {tests.map(t => <TestOutcomeCard key={t.index} test={t} />)}
            </div>
          )}

          {tab === 'ast' && (
            analysis ? (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="min-h-[420px]">
                  {hasAst ? (
                    <AstTreeView tree={analysis.ast!} height="min(60vh, 560px)" />
                  ) : (
                    <div className="flex h-full min-h-[220px] items-center justify-center rounded-lg border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-800">
                      AST tree unavailable — {analysis.reason || 'the parser could not process this code.'} The structural metrics below are still reported.
                    </div>
                  )}
                </div>
                <AstMetricsPanel analysis={analysis} />
              </div>
            ) : (
              <EmptyState icon={GitBranch} message="AST analysis is not available for this submission." />
            )
          )}

          {tab === 'visualize' && (
            <div className="space-y-4">
              {visualizerSupported ? (
                <>
                  <p className="text-sm text-slate-600">
                    Watch an animated dry run of your submitted code, step by step, with the executing line highlighted.
                  </p>
                  <button type="button" onClick={onOpenVisualizer}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
                    <Layers className="h-4 w-4" /> Open Execution Visualizer
                  </button>
                </>
              ) : (
                <EmptyState icon={Layers} message={`Visualization unavailable for this submission (${language}). Run and Submit still work normally.`} />
              )}
            </div>
          )}

          {tab === 'complexity' && (
            analysis?.complexity ? (
              <ComplexityPanel
                analysis={analysis}
                expectedTime={expectedTime}
                expectedSpace={expectedSpace}
                knownApproaches={knownApproaches}
              />
            ) : <EmptyState icon={Gauge} message="Complexity was not estimated for this submission." />
          )}

          {tab === 'optimization' && (
            result.optimization ? (
              <OptimizationFeedback
                optimization={result.optimization}
                submissionId={result.submissionId}
                status={result.status}
                score={result.scoreBreakdown?.overall ?? null}
                referenceApproachAvailable={!!(result.referenceApproach?.available || result.optimization.optimizationAvailable)}
              />
            ) : <EmptyState icon={Sparkles} message="No optimization feedback for this submission." />
          )}

          {tab === 'explanation' && (
            result.explanation ? (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-slate-700">{result.explanation.summary}</p>
                {result.explanation.strengths.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Strengths</p>
                    <ul className="space-y-1">
                      {result.explanation.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.explanation.improvements.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Improvements</p>
                    <ul className="space-y-1">
                      {result.explanation.improvements.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-[11px] text-slate-400">
                  Generated by {result.explanation.generatedBy === 'gemini' ? 'AETHER AI' : 'AETHER deterministic analysis'} — it narrates the computed evidence and never changes your score.
                </p>
              </div>
            ) : <EmptyState icon={Sparkles} message="No AI explanation was produced for this submission." />
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-slate-50 px-3 py-2.5">
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
      <Icon className="h-7 w-7 text-slate-300" aria-hidden />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

function TestOutcomeCard({ test }: { test: ITestOutcome }) {
  return (
    <div className={`rounded-lg border p-3 ${test.passed ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        {test.passed ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-rose-500" />}
        <span className={test.passed ? 'text-emerald-700' : 'text-rose-700'}>
          Test {test.index + 1} — {test.passed ? 'Passed' : 'Failed'}
        </span>
        {test.hidden && (
          <span className="ml-1 inline-flex items-center gap-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600">
            <EyeOff className="h-3 w-3" /> Hidden
          </span>
        )}
        {test.executionTimeMs != null && <span className="ml-auto text-xs text-slate-400">{test.executionTimeMs} ms</span>}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-mono">
        <div><p className="font-sans text-slate-400">Input</p><pre className="whitespace-pre-wrap text-slate-700">{test.input || '(empty)'}</pre></div>
        <div><p className="font-sans text-slate-400">Expected</p><pre className="whitespace-pre-wrap text-slate-700">{test.expectedOutput || '(none)'}</pre></div>
        <div><p className="font-sans text-slate-400">Got</p><pre className="whitespace-pre-wrap text-slate-700">{test.actualOutput || '(empty)'}</pre></div>
      </div>
      {test.error && <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-rose-600">{test.error}</pre>}
    </div>
  );
}
