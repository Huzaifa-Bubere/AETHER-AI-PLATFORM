import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { fetchDashboardSummary, type DashboardSummary } from '../services/dashboard';
import { RoleSelector } from '../components/roles/RoleSelector';
import {
  ChartFrame,
  MetricCardTile,
  NextRecommendedAction,
  RecentActivity,
  StreakSummaryTile,
} from '../components/dashboard/DashboardWidgets';
import {
  AssessmentOverTimeChart,
  AtsOverTimeChart,
  InterviewByRoleChart,
  SkillCoverageChart,
  TechnicalByCategoryChart,
} from '../components/dashboard/DashboardCharts';

/**
 * AETHER home dashboard (spec §8–§14).
 *
 * Answers, from real stored evidence only:
 *   what am I preparing for · how far along am I · what did I just do
 *   what am I weak at · what should I do next
 *
 * Everything comes from ONE request — GET /api/dashboard/summary — so the page
 * never renders a number the backend did not compute. Switching role refetches
 * the same endpoint with ?role=, which is what makes the screen role-aware
 * rather than a fixed set of figures.
 */

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (role: string | null) => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await fetchDashboardSummary(role ?? undefined));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(selectedRole);
  }, [load, selectedRole]);

  if (loading && !summary) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-8 sm:px-6 lg:px-8">
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-6">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-destructive">
            <AlertCircle className="h-5 w-5" />
            We could not load your dashboard
          </h1>
          <p className="mt-2 text-sm text-destructive">{error}</p>
          <Button className="mt-4" onClick={() => void load(selectedRole)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const { metricCards, charts } = summary;
  const firstName = summary.user.firstName?.split(' ')[0] ?? '';
  const roleSummaries = summary.roleProgress.roles.map(r => ({
    roleSlug: r.slug,
    roleName: r.name,
    isPrimary: r.isPrimary,
    priority: 0,
    readiness: r.readiness,
    met: 0,
    belowRequired: 0,
    notAssessed: 0,
    requirementCount: 0,
    nextActions: [],
  }));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.primaryRole ? (
              <>
                Preparing for{' '}
                <span className="font-medium text-foreground">{summary.primaryRole.name}</span>
                {summary.roleProgress.readiness !== null && (
                  <> · {summary.roleProgress.readiness}% requirement coverage</>
                )}
              </>
            ) : (
              'Choose a target role to see role-specific progress and recommendations.'
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load(selectedRole)} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </header>

      {error && (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Showing the last successful load — {error}
        </div>
      )}

      {/* ── Role selector + next action ─────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RoleSelector
          roles={roleSummaries}
          selected={selectedRole ?? summary.primaryRole?.slug ?? null}
          onSelect={setSelectedRole}
          loading={loading && !summary}
        />
        <NextRecommendedAction action={summary.recommendations[0]} />
      </div>

      {/* ── Metric cards ────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <MetricCardTile title="Technical Accuracy" card={metricCards.technicalAccuracy} href="/technical" />
        <MetricCardTile title="Coding Performance" card={metricCards.codingPerformance} href="/coding" />
        <MetricCardTile title="Interview Score" card={metricCards.interviewScore} href="/interview" />
        <MetricCardTile title="Resume Quality" card={metricCards.resumeQuality} href="/resume-builder" />
        <MetricCardTile title="Learning" card={metricCards.learning} href="/career-learning" />
      </div>

      {/* ── Streak ──────────────────────────────────────────────────────── */}
      <StreakSummaryTile streak={summary.streak} />

      {/* ── Charts ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AssessmentOverTimeChart data={charts.assessmentOverTime} />
        <TechnicalByCategoryChart data={charts.technicalByCategory} />
        <SkillCoverageChart data={charts.skillCategoryCoverage} />
        <AtsOverTimeChart data={charts.atsOverTime} />
      </div>

      <InterviewByRoleChart data={charts.interviewByRole} />

      {/* ── Activity ────────────────────────────────────────────────────── */}
      <RecentActivity activity={summary.activity} />

      {/* ── More recommendations ────────────────────────────────────────── */}
      {summary.recommendations.length > 1 && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">
            Also worth doing
          </h2>
          <ul className="mt-3 space-y-3">
            {summary.recommendations.slice(1).map(action => (
              <li key={action.title} className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{action.title}</p>
                  <p className="text-sm text-muted-foreground">{action.reason}</p>
                </div>
                <a
                  href={action.href}
                  className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {action.cta}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="pb-4 text-center text-xs text-muted-foreground">
        Calculated from your own records · calculation v{summary.calculationVersion} · generated{' '}
        {new Date(summary.generatedAt).toLocaleString()}
      </footer>
    </div>
  );
}

export { ChartFrame };