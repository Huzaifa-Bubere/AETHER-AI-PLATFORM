/**
 * AETHER — Dashboard hero band (spec §6-§8).
 *
 * Answers: Where am I now? What should I do next? What is weak?
 * All values come from /analytics/dashboard (deterministic, with basis text).
 * This component renders ABOVE the existing dashboard sections without
 * replacing any working content.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Target, ArrowRight, Brain, Code, MessageSquare, FileText, GraduationCap, Compass, Loader2 } from 'lucide-react';
import { apiService } from '../services/api';

interface MetricCard { value: number | null; basis: string; confidence?: string; sampleSize?: number }
interface DashboardPayload {
  generatedAt: string;
  calculationVersion: string;
  metrics: {
    technicalAccuracy: (MetricCard & { topCategory?: string }) | null;
    codingScore: MetricCard | null;
    interviewCommunication: MetricCard | null;
    resumeQuality: MetricCard | null;
    learningProgress: MetricCard | null;
    careerReadiness: (MetricCard & { gaps?: any[] }) | null;
  };
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function scoreTone(v: number): string {
  return v >= 75 ? 'text-emerald-600' : v >= 50 ? 'text-amber-600' : 'text-rose-500';
}

export function DashboardAnalyticsHero({ firstName, hasCareerGoal }: { firstName?: string; hasCareerGoal?: boolean }) {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiService.get<any>('/analytics/dashboard')
      .then(res => { if (res.success) setData(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const m = data?.metrics;
  const readiness = m?.careerReadiness;
  const topGap = readiness?.gaps?.[0];

  const cards = [
    { icon: Brain, label: 'Technical Accuracy', metric: m?.technicalAccuracy, to: '/aptitude' },
    { icon: Code, label: 'Coding Score', metric: m?.codingScore, to: '/coding' },
    { icon: MessageSquare, label: 'Interview Communication', metric: m?.interviewCommunication, to: '/interview' },
    { icon: FileText, label: 'Resume Quality', metric: m?.resumeQuality, to: '/resume-builder' },
    { icon: GraduationCap, label: 'Learning Progress', metric: m?.learningProgress, to: '/career-learning' },
  ];

  return (
    <div className="space-y-5">
      {/* ── Hero ── */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{greeting()}{firstName ? `, ${firstName}` : ''}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <h2 className="text-xl font-black text-slate-900">
                {readiness ? 'Target Role' : 'Your preparation'}
              </h2>
              {readiness && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-xs font-bold text-blue-700">
                  <Target className="w-3 h-3" /> {readiness.basis?.replace('Skills for target role: ', '') || '—'}
                </span>
              )}
            </div>
            {!hasCareerGoal && !loading && (
              <Link to="/career-intelligence" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800">
                <Compass className="w-3 h-3" /> Set a target role to personalize your plan
              </Link>
            )}
          </div>

          {readiness && typeof readiness.value === 'number' && (
            <div className="text-right shrink-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Career readiness</p>
              <p className={`text-4xl font-black ${scoreTone(readiness.value)}`}>{readiness.value}<span className="text-lg text-slate-300">%</span></p>
              <p className="text-[10.5px] text-slate-400 max-w-48">{readiness.basis}</p>
            </div>
          )}
        </div>

        {/* Next best action (§7) */}
        {topGap && (
          <div className="mt-5 rounded-xl bg-indigo-50/60 border border-indigo-200 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Next recommended action</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">
                {topGap.skillSlug || topGap.skill || topGap.name} — below your target-role requirement
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {typeof topGap.confidence === 'number' ? `${topGap.confidence}% evidenced` : 'Evidence needed'} · closing this gap raises readiness the most
              </p>
            </div>
            <Link
              to="/career-learning"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 transition-colors shrink-0"
            >
              Continue Learning <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>

      {/* ── Metric cards (§8) — every card shows where the number came from ── */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-white border border-slate-200 p-4 animate-pulse">
              <div className="h-3 w-20 bg-slate-100 rounded mb-3" />
              <div className="h-7 w-14 bg-slate-100 rounded mb-2" />
              <div className="h-2.5 w-28 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {cards.map(({ icon: Icon, label, metric, to }) => (
            <Link key={label} to={to} className="rounded-2xl bg-white border border-slate-200 p-4 hover:border-blue-300 hover:shadow-xs transition-all group">
              <div className="flex items-center justify-between">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                <Icon className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-400 transition-colors" />
              </div>
              {metric && typeof metric.value === 'number' ? (
                <>
                  <p className={`text-2xl font-black mt-1.5 ${scoreTone(metric.value)}`}>{metric.value}<span className="text-sm text-slate-300">%</span></p>
                  <p className="text-[10.5px] text-slate-400 mt-1 leading-snug" title={metric.basis}>
                    {metric.basis}
                  </p>
                  {metric.confidence === 'LOW' && (
                    <span className="inline-block mt-1.5 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[9px] font-bold text-slate-500">
                      Limited evidence
                    </span>
                  )}
                </>
              ) : (
                <>
                  <p className="text-2xl font-black mt-1.5 text-slate-300">—</p>
                  <p className="text-[10.5px] text-slate-400 mt-1">Not enough data yet</p>
                </>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
