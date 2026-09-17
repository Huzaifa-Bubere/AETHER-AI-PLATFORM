import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { aptitudeImageUrl } from '../../lib/aptitudeApi';
import { integrityApi, IntegritySummary, sanitizeIntegritySummary } from '../../app/features/integrity/integrity.types';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';


interface ReviewItem {
  questionText?: string;
  options?: Record<string, string>;
  questionImageUrl: string;
  category: string;
  difficulty: string;
  correctOption: string;
  explanation: string;
  selectedOption: string | null;
  isCorrect: boolean;
  timeSpentSeconds: number;
}

interface AIAnalysis {
  source?: 'computed' | 'ai';
  strongTopics: string[];
  weakTopics: string[];
  categoryPerformance: { category: string; accuracy: number }[];
  difficultyPerformance: { difficulty: string; accuracy: number }[];
  speedAnalysis: string;
  timeManagement: string;
  guessingBehaviorNote: string;
  recommendedPracticeAreas: string[];
  studyPlan: string[];
  placementReadinessScore: number;
  motivationalFeedback: string;
}

interface Result {
  score: number;
  totalMarks: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  accuracyPercent: number;
  scorePercent: number;
  passStatus: 'pass' | 'fail';
  autoSubmitted: boolean;
  timeTakenSeconds: number;
  aiAnalysis: AIAnalysis | null;
  review: ReviewItem[];
}

const PIE_COLORS = ['#10b981', '#ef4444', '#737373']; // correct, incorrect, unanswered

export default function ResultsDashboard() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setResult(null);
    setError(null);
    let active = true;
    if (attemptId) api.get(`/api/aptitude/attempts/${attemptId}/result`)
      .then(({ data }) => { if (active) setResult(data); })
      .catch(error => { if (active) setError(error?.response?.data?.message || error?.response?.data?.error || 'Could not load results. Please reload to retry.'); });
    return () => { active = false; };
  }, [attemptId, reload]);

  if (error) return <div className="pt-32 px-6"><p role="alert">{error}</p><button onClick={() => setReload(v => v + 1)} className="text-primary underline">Retry</button> ? <Link to="/aptitude">Back to Tests</Link></div>;
  if (!result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Loading results…</div>
    );
  }

  const pieData = [
    { name: 'Correct', value: result.correctCount ?? 0 },
    { name: 'Incorrect', value: result.incorrectCount ?? 0 },
    { name: 'Unanswered', value: result.unansweredCount ?? 0 },
  ];
  const review = Array.isArray(result.review) ? result.review : [];

  return (
    <div className="min-h-screen bg-background px-6 py-20 text-foreground">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex justify-between"><Link to="/aptitude" className="text-primary underline">Back to Tests & Attempts</Link><button onClick={() => setReload(v => v + 1)} className="text-primary underline">Refresh Analysis</button></div>
        {/* Score header */}
        <section className="flex flex-col items-center gap-6 rounded-xl border border-border bg-card p-8 sm:flex-row sm:justify-between">
          <ScoreMeter percent={result.scorePercent} />
          <div className="grid flex-1 grid-cols-2 gap-4 text-center sm:grid-cols-4">
            <Stat label="Score" value={`${result.score}/${result.totalMarks}`} />
            <Stat label="Accuracy" value={`${result.accuracyPercent}%`} />
            <Stat label="Time Taken" value={formatTime(result.timeTakenSeconds)} />
            <Stat
              label="Result"
              value={result.passStatus.toUpperCase()}
              accent={result.passStatus === 'pass' ? 'text-emerald-700' : 'text-destructive'}
            />
          </div>
        </section>
        {result.autoSubmitted && (
          <p className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-700">
            This test was auto-submitted (time expired or integrity warning limit reached). Your answered questions were scored normally.
          </p>
        )}
        <IntegritySummarySection attemptId={attemptId || ''} />

        {/* Charts */}
        <section className="grid gap-6 sm:grid-cols-2">
          <ChartCard title="Correct vs Incorrect">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#171717', border: '1px solid #404040' }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          {result.aiAnalysis && (
            <ChartCard title="Category-wise Performance">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={result.aiAnalysis.categoryPerformance ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                  <XAxis dataKey="category" tick={{ fill: '#a3a3a3', fontSize: 11 }} tickFormatter={(v) => v.replace(/-/g, ' ')} />
                  <YAxis tick={{ fill: '#a3a3a3', fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: '#171717', border: '1px solid #404040' }} />
                  <Bar dataKey="accuracy" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </section>

        {/* AI feedback */}
        {result.aiAnalysis && <AIFeedbackPanel analysis={result.aiAnalysis} />}

        {/* Question review */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">Question-wise Review</h2>
          <div className="space-y-4">
            {review.map((item, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Q{i + 1} · {item.category.replace(/-/g, ' ')} · {item.difficulty}
                  </span>
                  <span className={item.isCorrect ? 'font-semibold text-emerald-700' : 'font-semibold text-destructive'}>
                    {item.isCorrect ? 'Correct' : item.selectedOption ? 'Incorrect' : 'Not Answered'}
                  </span>
                </div>
                {item.questionImageUrl && <img src={aptitudeImageUrl(item.questionImageUrl)} alt={`Question ${i + 1}`} className="mt-3 max-h-64 rounded-lg bg-white" />}
                {item.questionText && <p className="mt-3 whitespace-pre-wrap">{item.questionText}</p>}
                {item.options && Object.values(item.options).some(Boolean) && <ul className="mt-3 space-y-1 text-sm">
                  {Object.entries(item.options).map(([option, text]) => <li key={option}><strong>{option}.</strong> {text}</li>)}
                </ul>}
                <div className="mt-3 flex gap-6 text-sm">
                  <span>
                    Your answer: <strong>{item.selectedOption ?? '—'}</strong>
                  </span>
                  <span>
                    Correct answer: <strong className="text-emerald-700">{item.correctOption}</strong>
                  </span>
                </div>
                {item.explanation && <p className="mt-2 text-sm text-muted-foreground">{item.explanation}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ScoreMeter({ percent }: { percent: number }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (percent / 100) * circumference;
  const color = percent >= 70 ? '#10b981' : percent >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r="54" fill="none" stroke="#262626" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">{percent}%</span>
        <span className="text-xs text-muted-foreground">Score</span>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className={`text-xl font-bold ${accent ?? ''}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function AIFeedbackPanel({ analysis }: { analysis: AIAnalysis }) {
  return (
    <section className="rounded-xl border border-primary/20 bg-primary/10 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary">{analysis.source === 'ai' ? 'AI Performance Analysis' : 'Performance Analysis'}</h2>
        <span className="rounded-full bg-primary/20 px-3 py-1 text-sm font-medium text-primary">
          Test Score: {analysis.placementReadinessScore}%
        </span>
      </div>

      <p className="mb-4 text-sm italic text-foreground">"{analysis.motivationalFeedback}"</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <TagList label="Strong Topics" items={analysis.strongTopics} color="emerald" />
        <TagList label="Weak Topics" items={analysis.weakTopics} color="red" />
        <TagList label="Recommended Practice" items={analysis.recommendedPracticeAreas} color="amber" />
        <div>
          <h4 className="mb-2 text-sm font-medium text-muted-foreground">Study Plan</h4>
          <ol className="list-decimal space-y-1 pl-4 text-sm text-foreground">
            {(analysis.studyPlan ?? []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-4 grid gap-2 border-t border-blue-900/30 pt-4 text-sm text-muted-foreground sm:grid-cols-3">
        <p><strong className="text-foreground">Speed:</strong> {analysis.speedAnalysis}</p>
        <p><strong className="text-foreground">Time management:</strong> {analysis.timeManagement}</p>
        <p><strong className="text-foreground">Guessing:</strong> {analysis.guessingBehaviorNote}</p>
      </div>
    </section>
  );
}

function TagList({ label, items, color }: { label: string; items?: string[]; color: 'emerald' | 'red' | 'amber' }) {
  const colorClasses = {
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-destructive',
    amber: 'bg-amber-950 text-amber-300',
  }[color];

  return (
    <div>
      <h4 className="mb-2 text-sm font-medium text-muted-foreground">{label}</h4>
      <div className="flex flex-wrap gap-1.5">
        {(items ?? []).map((item, i) => (
          <span key={i} className={`rounded-full px-2.5 py-0.5 text-xs ${colorClasses}`}>
            {item.replace(/-/g, ' ')}
          </span>
        ))}
      </div>
    </div>
  );
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

/** Shared integrity summary — one system for all modules (AETHER). */
function IntegritySummarySection({ attemptId }: { attemptId: string }) {
  const [summary, setSummary] = useState<IntegritySummary | null>(null);
  useEffect(() => {
    if (!attemptId) return;
    integrityApi.getSummary('APTITUDE', attemptId).then(raw => setSummary(sanitizeIntegritySummary(raw))).catch(() => {});
  }, [attemptId]);

  if (!summary) return null;
  const statusLabel = summary.status === 'terminated' ? 'Automatically Submitted' : summary.status === 'warning' ? 'Warning' : 'Clean';
  const statusCls = summary.status === 'terminated' ? 'bg-red-50 border-red-200 text-red-700'
    : summary.status === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Assessment Integrity</h3>
        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusCls}`}>Status: {statusLabel}</span>
      </div>
      <p className="text-sm text-slate-600 mb-3">Warnings: <strong>{summary.warningCount} / {summary.maximumWarnings}</strong></p>
      {summary.events.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          {summary.events.map((e, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-2.5 text-xs ${i % 2 ? 'bg-slate-50' : 'bg-white'}`}>
              <span className="tabular-nums text-slate-400">{new Date(e.timestamp).toLocaleTimeString()}</span>
              <span className="font-semibold text-slate-700">{e.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</span>
              <span className="ml-auto text-slate-400">Warning {e.warningNumber}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
