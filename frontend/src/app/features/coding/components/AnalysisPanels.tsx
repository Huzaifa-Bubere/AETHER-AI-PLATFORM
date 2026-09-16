import { Gauge, Layers, Lightbulb, AlertTriangle, CheckCircle2, Sparkles, TrendingUp } from 'lucide-react';
import type { IAstAnalysis, IScoreBreakdown, IGeminiExplanation, IKnownApproach } from '../types';

/** Complexity tab content — estimated (never claimed as proven). */
export function ComplexityPanel({ analysis, expectedTime, expectedSpace, knownApproaches }: {
  analysis: IAstAnalysis;
  expectedTime?: string;
  expectedSpace?: string;
  knownApproaches?: IKnownApproach[];
}) {
  const c = analysis.complexity;
  const aligned = expectedTime && c.estimatedTime === expectedTime;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-slate-500 mb-1">Estimated Time Complexity</p>
          <p className="text-2xl font-bold font-mono text-slate-900">{c.estimatedTime}</p>
          {expectedTime && (
            <p className={`text-xs mt-1 ${aligned ? 'text-emerald-600' : 'text-amber-600'}`}>
              Expected: {expectedTime} {aligned ? '✓ aligned' : '— consider optimizing'}
            </p>
          )}
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-slate-500 mb-1">Estimated Space Complexity</p>
          <p className="text-2xl font-bold font-mono text-slate-900">{c.estimatedSpace}</p>
          {expectedSpace && (
            <p className="text-xs mt-1 text-slate-500">Expected: {expectedSpace}</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-slate-700">Estimate Confidence</p>
          <span className="text-sm font-mono">{Math.round(c.confidence * 100)}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${c.confidence * 100}%` }} />
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Complexity is estimated from AST structure, library operation costs, and problem metadata — it is not a formal proof.
        </p>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <p className="text-sm font-semibold text-slate-700 mb-2">Evidence</p>
        <ul className="space-y-1.5">
          {c.evidence.map((e, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
              <TrendingUp className="w-3.5 h-3.5 mt-0.5 text-blue-500 shrink-0" />
              {e}
            </li>
          ))}
        </ul>
      </div>

      {knownApproaches && knownApproaches.length > 0 && (
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm font-semibold text-slate-700 mb-2">Known Approaches for This Problem</p>
          <div className="space-y-2">
            {knownApproaches.map(a => (
              <div key={a.approachId} className="flex items-start justify-between gap-3 p-2 rounded border">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {a.name}
                    {a.optimal && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">OPTIMAL</span>}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{a.outline}</p>
                </div>
                <span className="text-xs font-mono text-slate-500 shrink-0">{a.timeComplexity}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** AST/metrics tab content — structural metrics, approach detection, quality. */
export function AstMetricsPanel({ analysis, onJumpToLine }: {
  analysis: IAstAnalysis;
  onJumpToLine?: (line: number) => void;
}) {
  const m = analysis.metrics;
  const q = analysis.quality;

  const metricCards = [
    { label: 'Loops', value: m.loops },
    { label: 'Nested Loop Depth', value: m.nestedLoopDepth },
    { label: 'Max Nesting', value: m.maxNestingDepth },
    { label: 'Functions', value: m.functions },
    { label: 'Conditionals', value: m.conditionals },
    { label: 'Statements', value: m.statements },
    { label: 'Variables', value: m.variableDeclarations },
    { label: 'Calls', value: m.functionCalls },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {metricCards.map(mc => (
          <div key={mc.label} className="rounded-lg border bg-white p-3 text-center">
            <p className="text-lg font-bold text-slate-900">{mc.value}</p>
            <p className="text-[11px] text-slate-500">{mc.label}</p>
          </div>
        ))}
      </div>

      {m.recursionDetected && (
        <div className="flex items-center gap-2 text-sm text-violet-700 bg-violet-50 border border-violet-200 rounded-lg p-3">
          <Layers className="w-4 h-4" /> Recursion detected — function calls itself.
        </div>
      )}

      <div className="rounded-lg border bg-white p-4">
        <p className="text-sm font-semibold text-slate-700 mb-2">Detected Approach</p>
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-1 rounded-md bg-blue-100 text-blue-800 text-sm font-mono font-semibold">
            {analysis.approach.detectedApproach.replace(/_/g, ' ')}
          </span>
          <span className="text-xs text-slate-500">confidence {Math.round(analysis.approach.confidence * 100)}%</span>
        </div>
        <ul className="space-y-1">
          {analysis.approach.evidence.map((e, i) => (
            <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
              <span className="text-blue-400 mt-0.5">▸</span>{e}
            </li>
          ))}
        </ul>
        {analysis.dataStructures.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {analysis.dataStructures.map(ds => (
              <span key={ds} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">{ds}</span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4">
        <p className="text-sm font-semibold text-slate-700 mb-2">Code Quality</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <div className="flex justify-between text-xs mb-1"><span className="text-slate-500">Modularity</span><span className="font-mono">{q.modularity}</span></div>
            <div className="h-1.5 rounded-full bg-slate-100"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${q.modularity}%` }} /></div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1"><span className="text-slate-500">Readability</span><span className="font-mono">{q.structuralReadability}</span></div>
            <div className="h-1.5 rounded-full bg-slate-100"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${q.structuralReadability}%` }} /></div>
          </div>
        </div>
        {q.issues.length > 0 ? (
          <div className="space-y-2">
            {q.issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded border border-amber-200 bg-amber-50">
                <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${issue.severity === 'high' ? 'text-rose-500' : 'text-amber-500'}`} />
                <div>
                  <p className="text-xs font-medium text-slate-800">{issue.issue.replace(/_/g, ' ')} <span className="text-slate-400">({issue.severity})</span></p>
                  <p className="text-xs text-slate-500">{issue.evidence}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{issue.recommendation}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-sm text-emerald-600"><CheckCircle2 className="w-4 h-4" /> No structural issues detected.</p>
        )}
      </div>

      {analysis.parser === 'heuristic' && (
        <p className="text-[11px] text-slate-400">
          Analyzed with the structural parser for {analysis.language}. JavaScript/TypeScript submissions receive fully deterministic AST parsing.
        </p>
      )}
      {onJumpToLine && analysis.quality.issues.some(i => i.line) && (
        <p className="text-[11px] text-slate-400">Click an issue to jump to its line in the editor.</p>
      )}
    </div>
  );
}

/** Score breakdown + AI explanation tab content. */
export function ScorePanel({ score, explanation }: {
  score: IScoreBreakdown | null;
  explanation: IGeminiExplanation | null;
}) {
  if (!score) {
    return (
      <div className="rounded-lg border bg-amber-50 border-amber-200 p-4 text-sm text-amber-800">
        <p className="flex items-center gap-2 font-medium"><AlertTriangle className="w-4 h-4" /> Scoring unavailable</p>
        <p className="mt-1 text-xs">AST analysis could not process this submission, so only correctness results are shown.</p>
      </div>
    );
  }

  const rows = [
    { label: 'Correctness', value: score.correctness, weight: '45%', color: 'bg-emerald-500' },
    { label: 'Efficiency', value: score.efficiency, weight: '20%', color: 'bg-blue-500' },
    { label: 'Code Quality', value: score.codeQuality, weight: '15%', color: 'bg-violet-500' },
    { label: 'Problem Solving', value: score.problemSolving, weight: '15%', color: 'bg-amber-500' },
    { label: 'Maintainability', value: score.maintainability, weight: '5%', color: 'bg-rose-400' },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-700">Overall Score</p>
          <p className="text-3xl font-bold text-slate-900">{score.overall}<span className="text-base text-slate-400">/100</span></p>
        </div>
        <div className="space-y-2.5">
          {rows.map(r => (
            <div key={r.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600">{r.label} <span className="text-slate-400">({r.weight})</span></span>
                <span className="font-mono text-slate-700">{r.value}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full ${r.color} rounded-full transition-all`} style={{ width: `${r.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {explanation && (
        <div className="rounded-lg border bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-500" /> AI Explanation
            </p>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
              {explanation.generatedBy === 'gemini' ? 'Gemini' : 'Rule-based'}
            </span>
          </div>
          <p className="text-sm text-slate-600">{explanation.summary}</p>

          {explanation.strengths.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-emerald-700 mb-1">Strengths</p>
              <ul className="space-y-1">
                {explanation.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-500 shrink-0" />{s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {explanation.improvements.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-1">Improvements</p>
              <ul className="space-y-1">
                {explanation.improvements.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                    <Lightbulb className="w-3.5 h-3.5 mt-0.5 text-amber-500 shrink-0" />{s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {explanation.suggestedImprovement && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
              <p className="text-sm font-semibold text-indigo-800 flex items-center gap-1.5">
                <Gauge className="w-4 h-4" /> {explanation.suggestedImprovement.title}
              </p>
              <p className="text-xs text-indigo-700 mt-1">{explanation.suggestedImprovement.description}</p>
              {explanation.suggestedImprovement.complexityComparison && (
                <p className="text-xs font-mono text-indigo-600 mt-2">
                  {explanation.suggestedImprovement.complexityComparison}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
