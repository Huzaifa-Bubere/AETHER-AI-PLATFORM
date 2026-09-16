import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Code2, Flame, Target, TrendingUp, Trophy, Activity,
  BarChart3, ArrowRight, Sparkles,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { codingService } from '../services/coding.service';
import type { ICodingProgress, ISubmissionSummary, IRecommendations } from '../types';

/**
 * AETHER Coding — main dashboard at /coding.
 * Real data only: reads from CodingProgress + submissions. Shows explicit empty
 * states instead of fabricated numbers.
 */
export function CodingDashboardPage() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<ICodingProgress | null>(null);
  const [recent, setRecent] = useState<ISubmissionSummary[]>([]);
  const [recommendations, setRecommendations] = useState<IRecommendations | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [p, s, r] = await Promise.all([
        codingService.getMyProgress(),
        codingService.getMySubmissions(1, 8),
        codingService.getRecommendations(),
      ]);
      if (p.success && p.data) setProgress(p.data);
      if (s.success && s.data) setRecent(s.data.submissions);
      if (r.success && r.data) setRecommendations(r.data);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  const solved = progress?.solvedProblems?.length || 0;
  const diffStats = progress?.difficultyStats || [];
  const easySolved = diffStats.find(d => d.difficulty === 'Easy')?.solved || 0;
  const mediumSolved = diffStats.find(d => d.difficulty === 'Medium')?.solved || 0;
  const hardSolved = diffStats.find(d => d.difficulty === 'Hard')?.solved || 0;
  const totalSubs = progress?.totalSubmissions || 0;
  const accepted = progress?.acceptedSubmissions || 0;
  const acceptanceRate = totalSubs > 0 ? Math.round((accepted / totalSubs) * 100) : 0;
  const streak = progress?.streak?.current || 0;
  const avgScore = progress?.averageCodingScore || 0;

  const topicProgress = (progress?.topicStats || [])
    .filter(t => t.attempted > 0)
    .map(t => ({ topic: t.topic, pct: Math.round((t.solved / t.attempted) * 100), solved: t.solved, attempted: t.attempted }))
    .sort((a, b) => b.pct - a.pct);

  const weekly = buildLast14Days(progress?.recentActivity || []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Code2 className="w-6 h-6 text-blue-600" /> Coding Journey
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Practice DSA and improve your skills with real AST-driven feedback</p>
          </div>
          <Button onClick={() => navigate('/coding/problems')} className="bg-blue-600 hover:bg-blue-700 text-white">
            Browse Problems <ArrowRight className="ml-1 w-4 h-4" />
          </Button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<Trophy className="w-5 h-5 text-emerald-600" />} label="Solved" value={solved}
            sub={`${easySolved}E · ${mediumSolved}M · ${hardSolved}H`} />
          <StatCard icon={<Target className="w-5 h-5 text-blue-600" />} label="Accuracy" value={`${acceptanceRate}%`}
            sub={`${accepted}/${totalSubs} accepted`} />
          <StatCard icon={<Flame className="w-5 h-5 text-amber-600" />} label="Streak" value={`${streak} ${streak === 1 ? 'day' : 'days'}`}
            sub={`longest ${progress?.streak?.longest || 0}`} />
          <StatCard icon={<TrendingUp className="w-5 h-5 text-violet-600" />} label="Avg Score" value={avgScore || '—'}
            sub="deterministic scoring" />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Topic progress */}
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-blue-500" /> Topic Progress
            </h2>
            {topicProgress.length === 0 ? (
              <p className="text-sm text-slate-400">Complete your first problem to see topic progress.</p>
            ) : (
              <div className="space-y-2.5">
                {topicProgress.map(t => (
                  <div key={t.topic}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">{t.topic}</span>
                      <span className="text-slate-400">{t.solved}/{t.attempted} · {t.pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${t.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Weekly activity */}
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-500" /> Last 14 Days
            </h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weekly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748B' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748B' }} width={24} />
                <ReTooltip wrapperClassName="text-xs" />
                <Bar dataKey="submissions" fill="#2563EB" radius={[3, 3, 0, 0]} name="Submissions" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Recommendations */}
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-500" /> Recommended Problems
            </h2>
            {recommendations?.reasoning && (
              <p className="text-xs text-slate-400 mb-3">{recommendations.reasoning}</p>
            )}
            <div className="space-y-2">
              {(recommendations?.recommendations || []).map(r => (
                <Link key={r._id} to={`/coding/problems/${r.slug}`}
                  className="flex items-center justify-between p-2.5 rounded-lg border hover:border-blue-300 hover:bg-blue-50/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{r.title}</p>
                    <p className="text-xs text-slate-400">{r.category}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    r.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-700'
                    : r.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700'
                    : 'bg-rose-100 text-rose-700'}`}>
                    {r.difficulty}
                  </span>
                </Link>
              ))}
              {(recommendations?.recommendations || []).length === 0 && (
                <p className="text-sm text-slate-400">No recommendations yet — solve a few problems first.</p>
              )}
            </div>
          </Card>

          {/* Recent submissions */}
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Recent Submissions</h2>
            {recent.length === 0 ? (
              <p className="text-sm text-slate-400">No submissions yet. Your history will appear here.</p>
            ) : (
              <div className="space-y-2">
                {recent.map(s => (
                  <Link key={s._id} to={`/coding/submissions/${s._id}`}
                    className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-slate-50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {(s.problem as any)?.title || 'Problem'}
                      </p>
                      <p className="text-xs text-slate-400">{s.language} · {new Date(s.submittedAt).toLocaleString()}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-medium ${s.status === 'Accepted' ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {s.status}
                      </p>
                      {s.overallScore != null && <p className="text-xs text-slate-400">score {s.overallScore}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <Link to="/coding/submissions" className="text-xs text-blue-600 hover:underline mt-3 inline-block">
              View all submissions →
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-1.5">{icon}<span className="text-xs text-slate-500">{label}</span></div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </Card>
  );
}

function buildLast14Days(activity: Array<{ date: string; submissions: number }>) {
  const map = new Map(activity.map(a => {
    const d = new Date(a.date);
    return [`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, a.submissions];
  }));
  const days: Array<{ day: string; submissions: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      day: `${d.getMonth() + 1}/${d.getDate()}`,
      submissions: map.get(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`) || 0,
    });
  }
  return days;
}
