import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL });

interface ReviewItem {
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
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (attemptId) api.get(`/api/aptitude/attempts/${attemptId}/result`).then(({ data }) => setResult(data));
  }, [attemptId]);

  if (!result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">Loading results…</div>
    );
  }

  const pieData = [
    { name: 'Correct', value: result.correctCount },
    { name: 'Incorrect', value: result.incorrectCount },
    { name: 'Unanswered', value: result.unansweredCount },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 px-6 py-10 text-neutral-100">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Score header */}
        <section className="flex flex-col items-center gap-6 rounded-xl border border-neutral-800 bg-neutral-900 p-8 sm:flex-row sm:justify-between">
          <ScoreMeter percent={result.scorePercent} />
          <div className="grid flex-1 grid-cols-2 gap-4 text-center sm:grid-cols-4">
            <Stat label="Score" value={`${result.score}/${result.totalMarks}`} />
            <Stat label="Accuracy" value={`${result.accuracyPercent}%`} />
            <Stat label="Time Taken" value={formatTime(result.timeTakenSeconds)} />
            <Stat
              label="Result"
              value={result.passStatus.toUpperCase()}
              accent={result.passStatus === 'pass' ? 'text-emerald-400' : 'text-red-400'}
            />
          </div>
        </section>
        {result.autoSubmitted && (
          <p className="rounded-lg bg-amber-950 px-4 py-2 text-sm text-amber-400">
            This test was auto-submitted (time expired or tab was switched).
          </p>
        )}

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
                <BarChart data={result.aiAnalysis.categoryPerformance}>
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
            {result.review.map((item, i) => (
              <div key={i} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-400">
                    Q{i + 1} · {item.category.replace(/-/g, ' ')} · {item.difficulty}
                  </span>
                  <span className={item.isCorrect ? 'font-semibold text-emerald-400' : 'font-semibold text-red-400'}>
                    {item.isCorrect ? 'Correct' : item.selectedOption ? 'Incorrect' : 'Not Answered'}
                  </span>
                </div>
                <img src={item.questionImageUrl} alt={`Question ${i + 1}`} className="mt-3 max-h-64 rounded-lg bg-white" />
                <div className="mt-3 flex gap-6 text-sm">
                  <span>
                    Your answer: <strong>{item.selectedOption ?? '—'}</strong>
                  </span>
                  <span>
                    Correct answer: <strong className="text-emerald-400">{item.correctOption}</strong>
                  </span>
                </div>
                {item.explanation && <p className="mt-2 text-sm text-neutral-400">{item.explanation}</p>}
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
        <span className="text-xs text-neutral-500">Score</span>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className={`text-xl font-bold ${accent ?? ''}`}>{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <h3 className="mb-2 text-sm font-semibold text-neutral-300">{title}</h3>
      {children}
    </div>
  );
}

function AIFeedbackPanel({ analysis }: { analysis: AIAnalysis }) {
  return (
    <section className="rounded-xl border border-blue-900/50 bg-blue-950/20 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-blue-300">AI Performance Analysis</h2>
        <span className="rounded-full bg-blue-900/50 px-3 py-1 text-sm font-medium text-blue-300">
          Placement Readiness: {analysis.placementReadinessScore}%
        </span>
      </div>

      <p className="mb-4 text-sm italic text-neutral-300">"{analysis.motivationalFeedback}"</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <TagList label="Strong Topics" items={analysis.strongTopics} color="emerald" />
        <TagList label="Weak Topics" items={analysis.weakTopics} color="red" />
        <TagList label="Recommended Practice" items={analysis.recommendedPracticeAreas} color="amber" />
        <div>
          <h4 className="mb-2 text-sm font-medium text-neutral-400">Study Plan</h4>
          <ol className="list-decimal space-y-1 pl-4 text-sm text-neutral-300">
            {analysis.studyPlan.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-4 grid gap-2 border-t border-blue-900/30 pt-4 text-sm text-neutral-400 sm:grid-cols-3">
        <p><strong className="text-neutral-300">Speed:</strong> {analysis.speedAnalysis}</p>
        <p><strong className="text-neutral-300">Time management:</strong> {analysis.timeManagement}</p>
        <p><strong className="text-neutral-300">Guessing:</strong> {analysis.guessingBehaviorNote}</p>
      </div>
    </section>
  );
}

function TagList({ label, items, color }: { label: string; items: string[]; color: 'emerald' | 'red' | 'amber' }) {
  const colorClasses = {
    emerald: 'bg-emerald-950 text-emerald-300',
    red: 'bg-red-950 text-red-300',
    amber: 'bg-amber-950 text-amber-300',
  }[color];

  return (
    <div>
      <h4 className="mb-2 text-sm font-medium text-neutral-400">{label}</h4>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
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
