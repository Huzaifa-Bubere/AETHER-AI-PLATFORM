import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import {
  Play, Send, RotateCcw, Loader2, ChevronLeft, Maximize2, Minimize2,
  CheckCircle2, XCircle, Clock, MemoryStick, Eye, EyeOff, ShieldAlert,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { useCodingStore } from '../stores/codingStore';
import { AstTreeView } from '../components/AstTreeView';
import { ComplexityPanel, AstMetricsPanel, ScorePanel } from '../components/AnalysisPanels';
import { CODING_LANGUAGES, type ITestOutcome } from '../types';
import { useIntegrityMonitor } from '../../integrity/useIntegrityMonitor';
import { DEFAULT_POLICIES } from '../../integrity/integrity.types';
import { IntegrityIndicator } from '../../integrity/IntegrityIndicator';
import { IntegrityWarningModal } from '../../integrity/IntegrityWarningModal';
import toast from 'react-hot-toast';

/**
 * AETHER Coding — Problem Workspace.
 * Left: problem statement. Right: Monaco editor. Bottom: tabs
 * (Test Cases / Output / AST / Complexity / Analysis) with source ↔ AST sync.
 */
export function ProblemWorkspacePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const store = useCodingStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [integrityLocked, setIntegrityLocked] = useState(false);

  const {
    problem, language, codeByLanguage, activeTab, isRunning, isSubmitting,
    runResult, submitResult, analysis, selectedLine, error,
    loadProblem, setLanguage, setCode, resetCode, setActiveTab,
    runCode, submitCode, refreshAnalysis, setSelectedLine,
  } = store;

  useEffect(() => {
    if (slug) void loadProblem(slug);
    return () => store.clear();
    // eslint-disable-line react-hooks/exhaustive-deps
  }, [slug]);

  const code = codeByLanguage[language] || '';
  const monacoLanguage = CODING_LANGUAGES.find(l => l.id === language)?.monaco || 'plaintext';

  // Bidirectional sync: current editor line (from store) ↔ AST node
  const highlightedLine = useMemo(() => selectedLine, [selectedLine]);

  const editorRef = useRef<any>(null);
  const decorationsRef = useRef<any[]>([]);

  const handleEditorCursor = (line: number | null) => setSelectedLine(line);

  // AST node click → reveal + highlight the source range in Monaco
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const editor = editorRef.current;
      if (!editor || !detail?.startLine) return;
      editor.revealLinesInCenter(detail.startLine, detail.endLine || detail.startLine);
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [{
        range: new (window as any).monaco.Range(detail.startLine, 1, (detail.endLine || detail.startLine) + 1, 1),
        options: { isWholeLine: true, className: 'aether-ast-highlight', inlineClassName: 'aether-ast-highlight-inline' },
      }]);
    };
    window.addEventListener('aether-ast-reveal', handler);
    return () => window.removeEventListener('aether-ast-reveal', handler);
  }, []);

  // ── Shared integrity system ──────────────────────────────────────────────
  // Coding policy: Monaco copy/cut/paste stays fully functional; only leaving
  // the page (tab switch / window blur) is monitored. Warning 5: flush the
  // current code as a final submission, then lock the editor.
  const integrity = useIntegrityMonitor({
    policy: DEFAULT_POLICIES.CODING,
    attemptId: slug ?? null,
    active: true,
    onAutoSubmit: async () => {
      try {
        if (code.trim() && problem) {
          await store.submitCode(); // idempotent official submission of current work
        }
      } catch { /* keep completed/submitted work */ }
      setIntegrityLocked(true);
      toast.success('Code saved. Submission locked after integrity warnings.', { duration: 6000 });
    },
  });

  const handleSubmit = async () => {
    const result = await submitCode();
    if (result) {
      toast.success(`Submitted — ${result.status} (${result.passedTests}/${result.totalTests} tests)`);
    }
  };

  if (!problem && !error) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="min-h-screen pt-16 flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-slate-600">{error || 'Problem not found'}</p>
        <Button variant="outline" onClick={() => navigate('/coding')}>Back to Coding Dashboard</Button>
      </div>
    );
  }

  const tests: ITestOutcome[] = runResult?.tests || submitResult?.tests || [];
  const currentResult = submitResult || runResult;

  // pt-16 clears the fixed app navbar (h-16); the page itself never scrolls —
  // each column scrolls internally, so nothing hides behind the navbar.
  return (
    <div className={
      isFullscreen
        ? 'fixed inset-0 z-50 bg-slate-50 flex flex-col overflow-hidden'
        : 'h-screen pt-16 flex flex-col overflow-hidden bg-slate-50'
    }>
      {/* Top bar */}
      <div className="shrink-0 bg-white border-b px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate('/coding')} aria-label="Back to coding dashboard">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h1 className="font-semibold text-slate-800 truncate">{problem.title}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            problem.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-700'
            : problem.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700'
            : 'bg-rose-100 text-rose-700'}`}>
            {problem.difficulty}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <IntegrityIndicator warningCount={integrity.warningCount} maximumWarnings={integrity.maximumWarnings} />
          <select
            value={language}
            onChange={e => setLanguage(e.target.value as any)}
            aria-label="Programming language"
            className="text-sm border rounded-md px-2 py-1.5 bg-white"
          >
            {CODING_LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={resetCode} aria-label="Reset code to starter">
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsFullscreen(f => !f)}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Problem panel (mobile — stacked above the editor) */}
        <div className="lg:hidden shrink-0 max-h-[38vh] overflow-y-auto border-b bg-white">
          <ProblemDescription />
        </div>

        {/* Problem panel (desktop) */}
        <aside className="hidden lg:block w-[42%] max-w-[640px] border-r bg-white overflow-y-auto">
          <ProblemDescription />
        </aside>

        {/* Editor + results */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="h-[45vh] shrink-0 border-b">
            <Editor
              height="100%"
              language={monacoLanguage}
              value={code}
              onChange={v => setCode(v || '')}
              theme="vs"
              onMount={(editor) => {
                editorRef.current = editor;
                editor.onDidChangeCursorPosition(e => handleEditorCursor(e.position.lineNumber));
              }}
              options={{
                readOnly: integrityLocked,
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                automaticLayout: true,
                tabSize: 4,
                renderLineHighlight: 'all',
              }}
            />
          </div>

          {/* Tabs */}
          <div className="shrink-0 border-b bg-white px-4 flex items-center gap-1 overflow-x-auto">
            {['testcases', 'output', 'ast', 'complexity', 'analysis'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                aria-selected={activeTab === tab}
                role="tab"
                className={`px-3 py-2 text-sm capitalize whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-700 font-medium'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab === 'ast' ? 'AST' : tab === 'analysis' ? 'Analysis' : tab}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2 py-1.5">
              <Button variant="outline" size="sm" onClick={() => runCode('sample')} disabled={isRunning}>
                {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Run
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || integrityLocked}
                className="bg-blue-600 hover:bg-blue-700 text-white">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit
              </Button>
            </div>
          </div>

          {/* Tab content */}
          <div className="p-4 flex-1 min-h-0 overflow-y-auto">
            {error && (
              <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
            )}

            {activeTab === 'testcases' && (
              <div className="space-y-3">
                {tests.length === 0 ? (
                  <p className="text-sm text-slate-400">Run your code to see test results.</p>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-slate-700">
                        {tests.filter(t => t.passed).length} / {tests.length} passed
                      </span>
                      <span className="text-slate-400">· hidden tests included on submit</span>
                    </div>
                    {tests.map(t => <TestResultCard key={t.index} test={t} />)}
                  </>
                )}
              </div>
            )}

            {activeTab === 'output' && (
              <div className="space-y-2">
                {currentResult?.status && (
                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {currentResult.runtimeMs} ms</span>
                    {currentResult.memoryKb != null && (
                      <span className="flex items-center gap-1"><MemoryStick className="w-4 h-4" /> {currentResult.memoryKb} KB</span>
                    )}
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-xs">{currentResult.executor}</span>
                  </div>
                )}
                {currentResult?.compileOutput && (
                  <pre className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-mono whitespace-pre-wrap text-rose-800">
                    {currentResult.compileOutput}
                  </pre>
                )}
                {currentResult?.stderr && (
                  <pre className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs font-mono whitespace-pre-wrap text-amber-800">
                    {currentResult.stderr}
                  </pre>
                )}
                <textarea
                  value={store.customInput}
                  onChange={e => store.setCustomInput(e.target.value)}
                  placeholder="Custom input (stdin)…"
                  aria-label="Custom input"
                  className="w-full h-24 rounded-lg border p-3 font-mono text-xs"
                />
                <Button variant="outline" size="sm" onClick={() => runCode('custom')} disabled={isRunning}>
                  {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Run Custom
                </Button>
                {store.runResult && (
                  <pre className="rounded-lg bg-slate-900 text-slate-100 p-3 text-xs font-mono whitespace-pre-wrap">
                    {store.runResult.tests.map(t => t.actualOutput).join('\n') || '(no output)'}
                  </pre>
                )}
              </div>
            )}

            {activeTab === 'ast' && (
              analysis?.ast ? (
                <div className="grid lg:grid-cols-[1fr_320px] gap-4">
                  <AstTreeView
                    tree={analysis.ast}
                    onSelectNode={node => {
                      if (node.loc) handleEditorCursor(null);
                      if (node.loc) {
                        // Reveal + highlight the node's source range in Monaco
                        window.dispatchEvent(new CustomEvent('aether-ast-reveal', {
                          detail: { startLine: node.loc.startLine, endLine: node.loc.endLine },
                        }));
                        setSelectedLine(node.loc.startLine);
                      }
                    }}
                    highlightedLine={highlightedLine}
                  />
                  <AstMetricsPanel analysis={analysis} />
                </div>
              ) : analysis ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  AST visualization unavailable — {analysis.reason || 'parser could not process this code.'}
                  <AstMetricsPanel analysis={analysis} />
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  Run or submit your code to generate the AST. Real programmatic parsing — never AI-generated.
                </p>
              )
            )}

            {activeTab === 'complexity' && (
              analysis ? (
                <ComplexityPanel
                  analysis={analysis}
                  expectedTime={problem.expectedTimeComplexity}
                  expectedSpace={problem.expectedSpaceComplexity}
                  knownApproaches={problem.knownApproaches}
                />
              ) : <p className="text-sm text-slate-400">Run or submit to estimate complexity.</p>
            )}

            {activeTab === 'analysis' && (
              <ScorePanel score={submitResult?.scoreBreakdown || null} explanation={submitResult?.explanation || null} />
            )}
          </div>
        </main>
      </div>

      {/* Shared integrity warning modal (warnings 1–4) */}
      {integrity.modalEvent && !integrity.shouldAutoSubmit && (
        <IntegrityWarningModal
          event={integrity.modalEvent}
          warningNumber={integrity.modalWarningNumber}
          maximumWarnings={integrity.maximumWarnings}
          onContinue={integrity.dismissModal}
        />
      )}

      {/* Warning-5 auto-submit overlay — huge full-screen red */}
      {integrity.submittingWork && (
        <div className="fixed inset-0 z-[210] bg-red-700 flex flex-col items-center justify-center gap-4">
          <ShieldAlert className="w-20 h-20 text-white animate-pulse" />
          <p className="text-4xl font-black tracking-tight text-white text-center px-4">SUBMISSION LOCKED</p>
          <p className="text-lg font-bold text-red-100 text-center px-4">Maximum integrity warnings reached (5 of 5)</p>
          <p className="text-sm text-red-200 text-center px-4">Your code has been saved as your final submission.</p>
        </div>
      )}
    </div>
  );
}

/** Problem statement panel shared between desktop sidebar and mobile drawer. */
function ProblemDescription() {
  const problem = useCodingStore(s => s.problem);
  if (!problem) return null;
  return (
    <div className="p-5 space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{problem.title}</h2>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            problem.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-700'
            : problem.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700'
            : 'bg-rose-100 text-rose-700'}`}>
            {problem.difficulty}
          </span>
          <span className="text-xs text-slate-400">{problem.category}</span>
          {problem.points != null && <span className="text-xs text-slate-400">· {problem.points} pts</span>}
        </div>
      </div>

      <p className="text-sm text-slate-600 whitespace-pre-wrap">{problem.description}</p>

      {problem.examples?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Examples</h3>
          <div className="space-y-2">
            {problem.examples.map((ex, i) => (
              <div key={i} className="rounded-lg border bg-slate-50 p-3 text-xs space-y-1">
                <p><span className="font-semibold text-slate-500">Input:</span> <code>{ex.input}</code></p>
                <p><span className="font-semibold text-slate-500">Output:</span> <code>{ex.output}</code></p>
                {ex.explanation && <p className="text-slate-500">{ex.explanation}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {problem.constraints?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Constraints</h3>
          <ul className="space-y-1">
            {problem.constraints.map((c, i) => (
              <li key={i} className="text-xs text-slate-500 flex items-start gap-1.5">
                <span className="text-slate-300 mt-0.5">•</span>{c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {problem.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {problem.tags.map(t => (
            <span key={t} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function statusIcon(passed: boolean) {
  return passed ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-rose-500" />;
}

function TestResultCard({ test }: { test: ITestOutcome }) {
  return (
    <div className={`rounded-lg border p-3 space-y-1.5 ${test.passed ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        {statusIcon(test.passed)}
        <span className={test.passed ? 'text-emerald-700' : 'text-rose-700'}>
          Test Case {test.index + 1} — {test.passed ? 'Passed' : 'Failed'}
        </span>
        {test.hidden && (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
            <EyeOff className="w-3 h-3" /> Hidden
          </span>
        )}
        {test.executionTimeMs != null && <span className="ml-auto text-xs text-slate-400">{test.executionTimeMs} ms</span>}
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs font-mono">
        <div><p className="text-slate-400 font-sans">Input</p><pre className="whitespace-pre-wrap text-slate-700">{test.input || '(empty)'}</pre></div>
        <div><p className="text-slate-400 font-sans">Expected</p><pre className="whitespace-pre-wrap text-slate-700">{test.expectedOutput || '(none)'}</pre></div>
        <div><p className="text-slate-400 font-sans">Got</p><pre className="whitespace-pre-wrap text-slate-700">{test.actualOutput || '(empty)'}</pre></div>
      </div>
      {test.error && <pre className="text-xs text-rose-600 font-mono whitespace-pre-wrap">{test.error}</pre>}
    </div>
  );
}
