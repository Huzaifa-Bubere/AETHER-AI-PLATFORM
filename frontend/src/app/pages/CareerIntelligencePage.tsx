import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Search, TrendingUp, Database, ArrowRight, Info, Target } from 'lucide-react';
import careerService, { type RoleListItem } from '../services/career';
import { Card } from '../components/ui/card';

export default function CareerIntelligencePage() {
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    careerService.listRoles(search || undefined)
      .then(data => { if (!cancelled) { setRoles(data.roles); setError(null); } })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [search]);

  const withMarket = roles.filter(r => r.market).length;

  return (
    <div className="min-h-screen bg-background text-foreground px-4 sm:px-6 lg:px-8 pt-20 pb-14">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-2">
              <LineChart className="w-3.5 h-3.5" /> Career Intelligence
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">What does the market expect?</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Job-role requirements, trending technologies, and your personal skill gap — computed from stored market
              datasets, never invented by AI. Learning what a role needs? See <Link to="/career-learning" className="text-primary hover:underline inline-flex items-center gap-0.5">Career Learning <ArrowRight className="w-3 h-3" /></Link>.
            </p>
          </div>
        </div>

        {/* Data transparency banner */}
        <Card className="p-4 rounded-xl border-blue-200 bg-blue-50/50 flex items-start gap-3">
          <Database className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-900 leading-relaxed">
            <strong>How market data works here:</strong> statistics come from imported job-posting datasets (admin uploads
            or licensed providers), processed by AETHER's deterministic skill-extraction pipeline. Every panel shows its
            dataset period, region and sample size. {withMarket > 0
              ? `${withMarket} role${withMarket === 1 ? '' : 's'} currently have snapshot data.`
              : 'No market snapshot is loaded yet — admins can import one; role requirements still work.'}
          </p>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search a job role (e.g. Software Engineer)…"
            className="w-full rounded-xl border border-border bg-card pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {error && <Card className="p-4 text-sm text-destructive border-destructive/30">{error}</Card>}

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Card key={i} className="h-40 animate-pulse bg-secondary/50" />)}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map(role => (
              <Link key={role.slug} to={`/career-intelligence/${role.slug}`} className="group">
                <Card className="h-full p-5 rounded-2xl border-border hover:border-primary/40 hover:shadow-md transition-all flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">{role.name}</h3>
                    {role.isGoal && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"><Target className="w-3 h-3" /> GOAL</span>}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-4">{role.description}</p>
                  <div className="mt-auto space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Your readiness</span>
                      <span className="font-bold text-foreground">{role.readiness}%</span>
                    </div>
                    {role.market ? (
                      <div className="flex items-center justify-between text-[11px] rounded-lg bg-secondary/60 px-2.5 py-1.5">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <TrendingUp className="w-3 h-3 text-primary" /> {role.market.postings} postings
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(role.market.updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                        <Info className="w-3 h-3" /> No market snapshot yet
                      </div>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
