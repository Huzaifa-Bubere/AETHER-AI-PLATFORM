import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, TrendingUp, TrendingDown, Minus, Sparkles, Database,
  CheckCircle2, XCircle, GraduationCap, Loader2, Layers, Briefcase, Calendar,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import careerService, {
  type MarketSnapshot, type CareerRoleDetail, type ReadinessData, type SkillStat,
} from '../services/career';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

const TREND_ICON: Record<string, { icon: typeof TrendingUp; cls: string; label: string }> = {
  TRENDING_UP: { icon: TrendingUp, cls: 'text-emerald-600', label: 'Trending up' },
  TRENDING_DOWN: { icon: TrendingDown, cls: 'text-rose-600', label: 'Trending down' },
  STABLE: { icon: Minus, cls: 'text-slate-500', label: 'Stable' },
  NEW_SIGNAL: { icon: Sparkles, cls: 'text-blue-600', label: 'New signal' },
  INSUFFICIENT_DATA: { icon: Minus, cls: 'text-slate-400', label: 'Sample too small for trend' },
};

function TrendBadge({ stat }: { stat: SkillStat }) {
  const t = TREND_ICON[stat.trend] || TREND_ICON.STABLE;
  const Icon = t.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${t.cls}`} title={t.label}>
      <Icon className="w-3.5 h-3.5" />
      {stat.trend === 'TRENDING_UP' && stat.previousPercentage != null && `+${Math.round(stat.percentage - stat.previousPercentage)} pts`}
    </span>
  );
}

export default function CareerIntelligenceRolePage() {
  const { roleSlug } = useParams<{ roleSlug: string }>();
  const [role, setRole] = useState<CareerRoleDetail | null>(null);
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingGoal, setSettingGoal] = useState(false);

  const load = () => {
    if (!roleSlug) return;
    setLoading(true);
    Promise.all([
      careerService.getRole(roleSlug),
      careerService.getMarket(roleSlug).catch(() => null),
      careerService.getReadiness(roleSlug).catch(() => null),
    ])
      .then(([r, m, rd]) => {
        setRole(r.role); setSnapshot(m?.snapshot ?? null); setReadiness(rd); setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [roleSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const setGoal = async () => {
    if (!roleSlug) return;
    setSettingGoal(true);
    try {
      await careerService.setGoal({ roleSlug });
      toast.success('Target role set — readiness and gaps now tracked');
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSettingGoal(false); }
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground pt-16"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading market intelligence…</div>;
  }
  if (error || !role) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 pt-16 text-center px-4">
        <p className="text-destructive text-sm">{error || 'Role not found'}</p>
        <Link to="/career-intelligence" className="text-primary underline text-sm">Back to Career Intelligence</Link>
      </div>
    );
  }

  const period = snapshot
    ? `${new Date(snapshot.periodStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(snapshot.periodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : null;
  const demandBySlug = new Map((snapshot?.topSkills || []).map(s => [s.skill, s]));

  const skillGroups: Array<{ title: string; slugs: string[] }> = [
    { title: 'Languages', slugs: role.skills.filter(s => s.skillType === 'LANGUAGE').map(s => s.skillSlug) },
    { title: 'Frameworks', slugs: role.skills.filter(s => s.skillType === 'FRAMEWORK').map(s => s.skillSlug) },
    { title: 'Databases', slugs: role.skills.filter(s => s.skillType === 'DATABASE').map(s => s.skillSlug) },
    { title: 'Cloud & DevOps', slugs: role.skills.filter(s => ['CLOUD', 'DEVOPS'].includes(s.skillType)).map(s => s.skillSlug) },
    { title: 'Tools', slugs: role.skills.filter(s => s.skillType === 'TOOL').map(s => s.skillSlug) },
    { title: 'Core Concepts', slugs: role.skills.filter(s => ['CONCEPT', 'SOFT_SKILL'].includes(s.skillType)).map(s => s.skillSlug) },
  ];
  const nameOf = (slug: string) => role.skills.find(s => s.skillSlug === slug)?.name || slug;

  return (
    <div className="min-h-screen bg-background text-foreground px-4 sm:px-6 lg:px-8 pt-20 pb-14">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div>
          <Link to="/career-intelligence" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Career Intelligence
          </Link>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">{role.name}</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{role.description}</p>
              {/* Source transparency — required by project spec #58 */}
              {snapshot && (
                <div className="inline-flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11px] text-muted-foreground bg-secondary/60 rounded-lg px-3 py-2">
                  <span className="inline-flex items-center gap-1"><Database className="w-3 h-3" /> {snapshot.sourceMetadata?.sourceName}</span>
                  <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> Period: {period}</span>
                  <span>Region: {snapshot.region}</span>
                  <span>Sample: {snapshot.totalPostings} postings</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={setGoal} disabled={settingGoal} className="text-xs font-bold">
                {settingGoal ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <GraduationCap className="w-3.5 h-3.5 mr-1.5" />}
                Set as target & build learning path
              </Button>
              <Link to={`/career-learning/${role.slug}`}>
                <Button variant="outline" className="text-xs">Open roadmap</Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Overview stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-4 rounded-2xl">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Market demand</p>
            <p className="text-2xl font-extrabold text-foreground mt-1">
              {snapshot ? (snapshot.totalPostings >= 100 ? 'High' : snapshot.totalPostings >= 30 ? 'Moderate' : 'Sample') : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground">{snapshot ? `${snapshot.totalPostings} postings in snapshot` : 'No snapshot loaded'}</p>
          </Card>
          <Card className="p-4 rounded-2xl">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Your readiness</p>
            <p className={`text-2xl font-extrabold mt-1 ${(readiness?.readiness ?? 0) >= 70 ? 'text-emerald-600' : (readiness?.readiness ?? 0) >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>
              {readiness ? `${readiness.readiness}%` : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground">{readiness ? `${readiness.skillsMatched} / ${readiness.skillsTotal} skills matched` : 'Set as target to track'}</p>
          </Card>
          <Card className="p-4 rounded-2xl">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Essential skills</p>
            <p className="text-2xl font-extrabold text-foreground mt-1">
              {readiness ? `${readiness.essentialMatched}/${readiness.essentialTotal + readiness.essentialMatched}` : `${role.skills.filter(s => s.priority === 'ESSENTIAL').length}`}
            </p>
            <p className="text-[10px] text-muted-foreground">verified / required</p>
          </Card>
          <Card className="p-4 rounded-2xl">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Skill gaps</p>
            <p className="text-2xl font-extrabold text-rose-600 mt-1">{readiness?.gaps.length ?? '—'}</p>
            <p className="text-[10px] text-muted-foreground">prioritized for you</p>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Most requested skills */}
          <Card className="p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2"><Briefcase className="w-4 h-4 text-primary" /> Most requested skills</h3>
              {snapshot && <span className="text-[10px] text-muted-foreground">% of {snapshot.totalPostings} postings</span>}
            </div>
            {snapshot?.topSkills.length ? (
              <div className="space-y-2.5">
                {snapshot.topSkills.slice(0, 10).map(stat => (
                  <div key={stat.skill}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-foreground">{nameOf(stat.skill)}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{stat.percentage}%</span>
                        <TrendBadge stat={stat} />
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, stat.percentage)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No market snapshot for this role yet. Skill requirements below come from AETHER's curated role definition —
                import a job dataset (admin) to see real demand statistics.
              </p>
            )}
          </Card>

          {/* Trending technologies */}
          <Card className="p-6 rounded-2xl space-y-4">
            <h3 className="text-base font-bold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Trending technologies</h3>
            {snapshot?.topSkills.some(s => ['TRENDING_UP', 'NEW_SIGNAL'].includes(s.trend)) ? (
              <div className="space-y-2">
                {snapshot.topSkills.filter(s => ['TRENDING_UP', 'NEW_SIGNAL'].includes(s.trend)).map(stat => (
                  <div key={stat.skill} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card">
                    <span className="text-sm font-medium text-foreground">{nameOf(stat.skill)}</span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">{stat.previousPercentage != null ? `${stat.previousPercentage}% → ` : ''}{stat.percentage}%</span>
                      <TrendBadge stat={stat} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground space-y-2">
                <p>No verified trend data yet.</p>
                <p className="text-xs">
                  AETHER only labels a technology “trending” when its share increased between two comparable snapshot
                  periods with a sufficient sample size (≥30 postings). The current snapshot
                  {snapshot ? ` (${snapshot.totalPostings} postings)` : ''} is
                  {snapshot && snapshot.totalPostings < 30 ? ' too small for trend classification.' : ' stable — import a new period to compare.'}
                </p>
              </div>
            )}
            {/* Skill combinations */}
            {snapshot?.skillPairs.length ? (
              <div className="pt-3 border-t border-border">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Commonly requested together</h4>
                <div className="flex flex-wrap gap-1.5">
                  {snapshot.skillPairs.slice(0, 8).map((pair, i) => (
                    <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-accent border border-border text-accent-foreground">
                      {nameOf(pair.skills[0])} + {nameOf(pair.skills[1])} · {pair.percentage}%
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>
        </div>

        {/* Required skills by category */}
        <Card className="p-6 rounded-2xl space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold">Required skills by category</h3>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Essential</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Recommended</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" /> Optional</span>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {skillGroups.filter(g => g.slugs.length).map(group => (
              <div key={group.title}>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{group.title}</h4>
                <div className="flex flex-wrap gap-1.5">
                  {group.slugs.map(slug => {
                    const skill = role.skills.find(s => s.skillSlug === slug);
                    const conf = readiness?.matched.find(m => m.skillSlug === slug)?.confidence;
                    const dot = skill?.priority === 'ESSENTIAL' ? 'bg-rose-500' : skill?.priority === 'RECOMMENDED' ? 'bg-amber-500' : 'bg-slate-400';
                    return (
                      <span key={slug} className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${conf != null ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-card border-border text-foreground'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                        {nameOf(slug)}
                        {conf != null && <span className="text-[10px] font-bold">{conf}%</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {(role.experienceExpectations || role.portfolioExpectations) && (
            <div className="grid sm:grid-cols-2 gap-4 pt-3 border-t border-border">
              {role.experienceExpectations && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Experience expectations</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{role.experienceExpectations}</p>
                </div>
              )}
              {role.portfolioExpectations && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Portfolio expectations</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{role.portfolioExpectations}</p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Your skill gap */}
        {readiness && (
          <Card className="p-6 rounded-2xl space-y-4">
            <h3 className="text-base font-bold">Your skill gap {readiness.snapshot?.source ? <span className="text-xs font-normal text-muted-foreground">(evidence-weighted vs market snapshot)</span> : ''}</h3>
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2">Skills you have ({readiness.matched.length})</h4>
                <div className="space-y-1">
                  {readiness.matched.slice(0, 10).map(m => (
                    <div key={m.skillSlug} className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1.5 text-foreground"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {m.name}</span>
                      <span className="text-muted-foreground">{m.confidence}% · {m.priority.toLowerCase()}</span>
                    </div>
                  ))}
                  {!readiness.matched.length && <p className="text-xs text-muted-foreground">No verified skills yet — take assessments or declare skills to build evidence.</p>}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 mb-2">Missing / weak ({readiness.gaps.length})</h4>
                <div className="space-y-2">
                  {readiness.gaps.slice(0, 8).map(gap => (
                    <div key={gap.skillSlug} className="p-3 rounded-xl border border-border bg-card">
                      <div className="flex items-center justify-between mb-1">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                          <XCircle className="w-3.5 h-3.5 text-rose-500" /> {gap.name}
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${gap.priority === 'ESSENTIAL' ? 'bg-rose-100 text-rose-700' : gap.priority === 'RECOMMENDED' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                            {gap.priority}
                          </span>
                        </span>
                        {gap.nodeId ? (
                          <Link to={`/career-learning/${role.slug}`} className="text-[11px] font-bold text-primary hover:underline whitespace-nowrap">Learn it →</Link>
                        ) : null}
                      </div>
                      {/* Explainable recommendation — required by project spec #63 */}
                      <details className="text-[11px] text-muted-foreground">
                        <summary className="cursor-pointer text-primary">Why this recommendation?</summary>
                        <ul className="mt-1.5 space-y-1 list-disc pl-4">
                          {gap.reasons.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                        {gap.demand?.frequency != null && (
                          <p className="mt-1 font-medium text-foreground">
                            {Math.round(gap.demand.frequency)}% of the analyzed {role.name} postings request {gap.name}
                            {gap.demand.trend === 'TRENDING_UP' && ' — and demand is increasing'}.
                          </p>
                        )}
                      </details>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
