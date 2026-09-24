import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Search, Map, TrendingUp, CheckCircle2, Target, ArrowRight, BookOpen } from 'lucide-react';
import careerService, { type RoleListItem } from '../services/career';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

const CATEGORIES = ['All'];

export default function CareerLearningPage() {
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [categories, setCategories] = useState<string[]>(CATEGORIES);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    careerService.listRoles(search || undefined, category === 'All' ? undefined : category)
      .then(data => { if (!cancelled) { setRoles(data.roles); setCategories(['All', ...data.categories]); setError(null); } })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [search, category]);

  return (
    <div className="min-h-screen bg-background text-foreground px-4 sm:px-6 lg:px-8 pt-20 pb-14">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-2">
              <Compass className="w-3.5 h-3.5" /> Career Learning
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">What should I learn to become a…</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Pick a role to see its required skills, interactive roadmap, resources, quizzes and portfolio projects.
            </p>
          </div>
          <Link to="/career-intelligence" className="text-sm text-primary hover:underline flex items-center gap-1">
            See what the market asks for <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search roles (e.g. Backend Developer)…"
              className="w-full rounded-xl border border-border bg-card pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-colors ${category === c ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <Card className="p-4 text-sm text-destructive border-destructive/30">{error}</Card>
        )}

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Card key={i} className="h-44 animate-pulse bg-secondary/50" />)}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map(role => (
              <Link key={role.slug} to={`/career-learning/${role.slug}`} className="group">
                <Card className="h-full p-5 rounded-2xl border-border hover:border-primary/40 hover:shadow-md transition-all flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">{role.name}</h3>
                    {role.isGoal && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Target className="w-3 h-3" /> GOAL
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-4">{role.description}</p>

                  <div className="mt-auto space-y-3">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-muted-foreground font-medium">Your readiness</span>
                        <span className={`font-bold ${role.readiness >= 70 ? 'text-emerald-600' : role.readiness >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>{role.readiness}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${role.readiness >= 70 ? 'bg-emerald-500' : role.readiness >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, role.readiness)}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Map className="w-3 h-3" /> {role.stagesCount} stages</span>
                      <span className="inline-flex items-center gap-1"><BookOpen className="w-3 h-3" /> {role.skillsCount} skills</span>
                      {role.market && <span className="inline-flex items-center gap-1 text-primary"><TrendingUp className="w-3 h-3" /> market data</span>}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
            {!roles.length && !loading && (
              <Card className="p-8 text-center text-sm text-muted-foreground col-span-full">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                No roles match your search yet.
              </Card>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-xs">Back to top</Button>
        </div>
      </div>
    </div>
  );
}
