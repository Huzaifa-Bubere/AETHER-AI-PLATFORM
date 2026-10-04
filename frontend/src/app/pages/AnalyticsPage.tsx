/**
 * AETHER — Analytics page (spec §40, §15-§27, §70-§79).
 *
 * Every chart renders the backend's deterministic analytics envelope
 * (metricId, calculationVersion, source, sampleSize, confidence). Empty data
 * shows an empty state — never a fake graph. AI insight comes LAST and only
 * explains already-verified numbers.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, RadarChart, PolarGrid, PolarAngleAxis,
  Radar, PieChart, Pie, Cell,
} from 'recharts';
import { Loader2, RefreshCw, Info, TrendingUp } from 'lucide-react';
import { apiService } from '../services/api';
import { Button } from '../components/ui/button';

const CHART_COLORS = ['#2563EB', '#4F46E5', '#10B981', '#F59E0B', '#DC2626', '#64748B', '#0EA5E9', '#8B5CF6'];

const RANGES = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: 'all', label: 'All time' },
] as const;

// ── Types mirroring the backend envelope ────────────────────────────────────

interface Envelope<T> {
  metricId: string;
  calculationVersion: string;
  generatedAt: string;
  source: string[];
  sampleSize: number;
  dateRange: string;
  confidence?: 'LOW' | 'MEDIUM' | 'HIGH';
  status?: 'OK' | 'EMPTY' | 'NOT_ASSESSED';
  data: T[];
}

type Range = (typeof RANGES)[number]['id'];

// ── Building blocks ─────────────────────────────────────────────────────────

function ChartCard({
  title, subtitle, env, children, sourceNote,
}: {
  title: string;
  subtitle?: string;
  env: Envelope<any> | null;
  /**
   * Lazily evaluated on purpose. The chart bodies dereference `env.data`, and JSX
   * children passed as a value are built eagerly by the parent — so a plain
   * `ReactNode` child would throw "Cannot read properties of null (reading 'data')"
   * while the envelope is still loading or after a failed request.
   */
  children: () => React.ReactNode;
  sourceNote?: string;
}) {
  const [showWhy, setShowWhy] = useState(false);

  // Defensive: keep the card safe against a missing or partially-shaped envelope.
  const rows = env && typeof env === 'object' && Array.isArray(env.data) ? env.data : null;
  if (!env || !rows) return <ChartSkeleton />;

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {env && (
          <button
            onClick={() => setShowWhy(w => !w)}
            className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-400 hover:text-slate-600 shrink-0"
            aria-expanded={showWhy}
          >
            <Info className="w-3 h-3" /> Why this number?
          </button>
        )}
      </div>

      {showWhy && env && (
        <div className="mb-4 rounded-xl bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-600 space-y-1">
          <p><b>Source:</b> {env.source.join(', ')}</p>
          <p><b>Sample size:</b> {env.sampleSize} record{env.sampleSize === 1 ? '' : 's'}</p>
          {env.confidence && <p><b>Confidence:</b> {env.confidence}</p>}
          <p><b>Calculation:</b> v{env.calculationVersion} · {env.metricId} · generated {new Date(env.generatedAt).toLocaleString('en-IN')}</p>
          {sourceNote && <p className="text-slate-500">{sourceNote}</p>}
        </div>
      )}

      {!env ? (
        <ChartSkeleton />
      ) : env.status === 'EMPTY' || rows.length === 0 ? (
        <EmptyChart metricId={env.metricId} />
      ) : (
        children()
      )}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-56 flex items-end gap-2 animate-pulse" aria-label="Loading chart">
      {[45, 70, 55, 85, 60, 75, 50].map((h, i) => (
        <div key={i} className="flex-1 bg-slate-100 rounded-t-lg" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

function EmptyChart({ metricId }: { metricId: string }) {
  const messages: Record<string, { title: string; cta?: string; to?: string }> = {
    technical_accuracy_by_category: { title: 'Not enough data yet.', cta: 'Start Assessment', to: '/aptitude' },
    assessment_score_over_time: { title: 'Complete your first assessment to see score trends.', cta: 'Start Assessment', to: '/aptitude' },
    coding_performance: { title: 'Solve your first coding problem to see coding analytics.', cta: 'Open Coding', to: '/coding' },
    interview_scores_over_time: { title: 'Complete an AI interview to see communication trends.', cta: 'Start Interview', to: '/interview' },
    learning_progress: { title: 'Enroll in a course to start tracking learning progress.', cta: 'Explore Learning', to: '/career-learning' },
    ats_score_over_time: { title: 'Build or analyze a resume to track ATS quality.', cta: 'Open Resume Builder', to: '/resume-builder' },
    skill_profile: { title: 'Skill evidence builds up from assessments, quizzes and projects.' },
    career_readiness: { title: 'Set a target role to compute career readiness.', cta: 'Career Intelligence', to: '/career-intelligence' },
  };
  const m = messages[metricId] || { title: 'Not enough data yet.' };
  return (
    <div className="h-56 flex flex-col items-center justify-center text-center px-4">
      <p className="text-sm font-semibold text-slate-600">{m.title}</p>
      {m.cta && m.to && (
        <a href={m.to} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800">
          {m.cta} →
        </a>
      )}
    </div>
  );
}

function ConfidenceChip({ env }: { env: Envelope<any> | null }) {
  if (!env?.confidence) return null;
  const c = env.confidence === 'HIGH' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : env.confidence === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-slate-100 text-slate-500 border-slate-200';
  return (
    <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${c}`} title={`Based on ${env.sampleSize} records`}>
      {env.confidence === 'LOW' ? 'Limited evidence' : `${env.confidence} confidence`}
    </span>
  );
}

const tooltipStyle = {
  contentStyle: { borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 },
  labelStyle: { fontWeight: 700, color: '#0F172A' },
} as const;

// ── Page ────────────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const [range, setRange] = useState<Range>('90d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tech, setTech] = useState<Envelope<any> | null>(null);
  const [assess, setAssess] = useState<Envelope<any> | null>(null);
  const [coding, setCoding] = useState<Envelope<any> | null>(null);
  const [interview, setInterview] = useState<Envelope<any> | null>(null);
  const [learning, setLearning] = useState<Envelope<any> | null>(null);
  const [ats, setAts] = useState<Envelope<any> | null>(null);
  const [skills, setSkills] = useState<Envelope<any> | null>(null);
  const [readiness, setReadiness] = useState<Envelope<any> | null>(null);

  const load = async (r: Range) => {
    setLoading(true);
    setError(null);
    try {
      const qs = (path: string) => apiService.get<Envelope<any>>(`${path}?range=${r}`);
      const [t, a, c, i, l, at, sk, rd] = await Promise.all([
        qs('/analytics/technical-accuracy'),
        qs('/analytics/assessment-scores'),
        qs('/analytics/coding-performance'),
        qs('/analytics/interview-scores'),
        qs('/analytics/learning'),
        apiService.get<Envelope<any>>('/analytics/ats-scores'),
        apiService.get<Envelope<any>>('/analytics/skill-profile'),
        apiService.get<Envelope<any>>('/analytics/career-readiness'),
      ]);
      // Backend analytics routes return { success: true, data: <envelope> }.
      // apiService.get() already unwraps axios into that JSON shape, so the
      // envelope is the response itself — not response.data.data.
      setTech(t.data ?? null); setAssess(a.data ?? null); setCoding(c.data ?? null); setInterview(i.data ?? null);
      setLearning(l.data ?? null); setAts(at.data ?? null); setSkills(sk.data ?? null); setReadiness(rd.data ?? null);
    } catch {
      setError('Unable to load analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(range); }, [range]); // eslint-disable-line react-hooks/exhaustive-deps

  const radarData = useMemo(() => {
    // Normalized 0-100 radar across dimensions, each documented in its envelope.
    const norm = (env: Envelope<any> | null, pick: (d: any) => number | null): number | null => {
      if (!env || env.status === 'EMPTY' || !Array.isArray(env.data) || !env.data.length) return null;
      const v = pick(env.data[env.data.length - 1]);
      return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : null;
    };
    const dims = [
      { dim: 'Technical', v: norm(assess, d => d.score) },
      { dim: 'Coding', v: norm(coding, d => d.score) },
      { dim: 'Interview', v: norm(interview, d => d.score) },
      { dim: 'Resume', v: norm(ats, d => d.score) },
      { dim: 'Learning', v: norm(learning, d => d.pct) },
      { dim: 'Readiness', v: norm(readiness, d => d.readiness) },
    ];
    // Radar needs all axes; missing dimensions render as explicit gaps via 0
    // but the legend notes them "not assessed" — never claimed as zero ability.
    return dims.map(d => ({ ...d, v: d.v ?? 0, missing: d.v === null }));
  }, [assess, coding, interview, ats, learning, readiness]);

  const missingDims = radarData.filter(d => d.missing).map(d => d.dim);

  return (
    <div className="min-h-screen pt-16 bg-[#F8FAFC]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-black text-slate-900">Analytics</h1>
            <p className="text-xs text-slate-500 mt-0.5">Every number traces to your real activity records.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex bg-white border border-slate-200 rounded-lg p-0.5">
              {RANGES.map(r => (
                <button
                  key={r.id}
                  onClick={() => setRange(r.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold ${range === r.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => load(range)}
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800"
              aria-label="Refresh analytics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 mb-5 flex items-center justify-between">
            <span className="text-sm text-rose-700">{error}</span>
            <Button size="sm" variant="outline" onClick={() => load(range)}>Retry</Button>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-5">
          <ChartCard title="Technical Accuracy by Topic" subtitle="correct ÷ attempted × 100" env={tech}>
            {() => (
              <>
                <div className="flex items-center gap-2 mb-2"><ConfidenceChip env={tech} /></div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={tech!.data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="category" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={54} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip {...tooltipStyle}
                      formatter={(v: any, _n, p: any) => [`${v}% · ${p.payload.correct}/${p.payload.attempted} correct`, 'Accuracy']}
                      labelFormatter={l => `${l}`} />
                    <Bar dataKey="accuracy" radius={[6, 6, 0, 0]}>
                      {tech!.data.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </ChartCard>

          <ChartCard title="Assessment Score Over Time" subtitle="completed assessments, real dates only" env={assess}>
            {() => (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={assess!.data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip {...tooltipStyle} formatter={(v: any) => [`${v}%`, 'Score']} />
                  <Line type="monotone" dataKey="score" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 4, fill: '#2563EB' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Coding Performance" subtitle="per-submission score (passed ÷ total tests)" env={coding}>
            {() => (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={coding!.data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip {...tooltipStyle} formatter={(v: any, _n, p: any) => [`${v} (${p.payload.difficulty})`, 'Score']} />
                  <Line type="monotone" dataKey="score" stroke="#4F46E5" strokeWidth={2.5} dot={{ r: 4, fill: '#4F46E5' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Interview Communication Over Time" subtitle="completed AI interview sessions" env={interview}>
            {() => (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={interview!.data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip {...tooltipStyle} formatter={(v: any, _n, p: any) => [`${v} · ${p.payload.domain}`, 'Score']} />
                  <Line type="monotone" dataKey="score" stroke="#10B981" strokeWidth={2.5} dot={{ r: 4, fill: '#10B981' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Learning Progress by Course" subtitle="completed ÷ total lessons" env={learning}>
            {() => (
              <>
                <div className="flex items-center gap-2 mb-2"><ConfidenceChip env={learning} /></div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={learning!.data} layout="vertical" margin={{ top: 4, right: 16, left: 30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="course" width={120} tick={{ fontSize: 10 }} />
                    <Tooltip {...tooltipStyle} formatter={(v: any, _n, p: any) => [`${v}% · ${p.payload.completed}/${p.payload.total} lessons`, 'Progress']} />
                    <Bar dataKey="pct" radius={[0, 6, 6, 0]} fill="#4F46E5" />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </ChartCard>

          <ChartCard title="Resume ATS Quality Over Time" subtitle="saved resume versions (labelled by scoring version)" env={ats}>
            {() => (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={ats!.data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip {...tooltipStyle} formatter={(v: any, _n, p: any) => [`${v} · ${p.payload.label} (scoring v${p.payload.scoringVersion})`, 'ATS Quality']} />
                  <Line type="monotone" dataKey="score" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 4, fill: '#F59E0B' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            title="Skill Radar"
            subtitle="normalized 0–100 across dimensions"
            env={skills && Array.isArray(skills.data) && skills.data.length ? readiness : null}
            sourceNote="Each axis uses its own documented normalized metric; dimensions without data are excluded from claims."
          >
            {() => (
              <>
                {missingDims.length > 0 && (
                  <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                    Not assessed yet (shown at baseline, not zero ability): {missingDims.join(', ')}
                  </p>
                )}
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData} outerRadius="72%">
                    <PolarGrid stroke="#E2E8F0" />
                    <PolarAngleAxis dataKey="dim" tick={{ fontSize: 11, fill: '#475569' }} />
                    <Tooltip {...tooltipStyle} formatter={(v: any, _n, p: any) => p.payload.missing ? ['Not assessed', '—'] : [`${v}/100`, 'Score']} />
                    <Radar dataKey="v" stroke="#2563EB" fill="#2563EB" fillOpacity={0.25} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </>
            )}
          </ChartCard>

          <ChartCard
            title="Career Readiness"
            subtitle="deterministic weighted skill coverage for your target role"
            env={readiness}
            sourceNote="Formula: weight(priority) × user confidence ÷ total weight, from career_roles + skill profiles."
          >
            {() => {
              const row = readiness!.data[0];
              const gaps: any[] = Array.isArray(row?.gaps) ? row.gaps : [];
              return (
                <div className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-slate-900">{row?.readiness}%</span>
                    <span className="text-xs text-slate-500">ready for {row?.roleSlug}</span>
                  </div>
                  {gaps.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Top gaps</p>
                      <div className="space-y-1.5">
                        {gaps.slice(0, 5).map((g: any, i: number) => (
                          <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-100 px-3 py-1.5">
                            <span className="text-xs font-semibold text-slate-700">{g.skillSlug || g.skill || g.name}</span>
                            <span className="text-[11px] font-bold text-amber-600">
                              {typeof g.confidence === 'number' ? `${g.confidence}% evidenced` : g.priority || 'gap'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> {readiness!.sampleSize} skill dimensions considered
                  </p>
                </div>
              );
            }}
          </ChartCard>
        </div>

        {loading && (
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Recalculating from your records…
          </div>
        )}
      </div>
    </div>
  );
}
