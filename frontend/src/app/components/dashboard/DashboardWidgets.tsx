import { Link } from 'react-router-dom';
import { Flame, Info } from 'lucide-react';
import type { MetricCard, RecommendedAction } from '../../services/dashboard';

/**
 * Dashboard presentation primitives (spec §9, §11, §12).
 *
 * Two rules encoded here rather than repeated per screen:
 *  - a metric with no evidence renders an explicit empty state, never "0%"
 *  - every number shows the basis it was computed from, so the dashboard is
 *    auditable rather than decorative
 */

export function MetricCardTile({
  title,
  card,
  href,
}: {
  title: string;
  card: MetricCard;
  href?: string;
}) {
  const hasValue = card.value !== null;

  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>
      <p className="mt-2 flex items-baseline gap-1">
        {hasValue ? (
          <>
            <span className="text-3xl font-bold tabular-nums text-foreground">{card.value}</span>
            {title === 'Resume Quality' && (
              <span className="text-sm text-muted-foreground">/ 100</span>
            )}
            <span className="text-sm text-muted-foreground">
              {title === 'Resume Quality' ? '' : '%'}
            </span>
          </>
        ) : (
          <span className="text-sm italic text-muted-foreground">Not assessed</span>
        )}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {card.status === 'NOT_ASSESSED' ? card.basis : card.basis}
      </p>
      {hasValue && card.confidence === 'LOW' && (
        <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
          <Info className="h-3 w-3" aria-hidden />
          Limited evidence
        </p>
      )}
      {card.detail && hasValue && (
        <p className="mt-1 truncate text-[11px] text-muted-foreground">{card.detail}</p>
      )}
    </>
  );

  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-colors">
      {href ? (
        <Link to={href} className="block hover:opacity-90">
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  );
}

export function StreakSummaryTile({
  streak,
}: {
  streak: { currentStreak: number; longestStreak: number; activeDays: number; timezone: string } | null;
}) {
  if (!streak) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Current Streak</p>
        <p className="mt-2 text-sm italic text-muted-foreground">No activity yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Complete a lesson, test or interview to start your streak.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Current Streak</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tabular-nums text-foreground">{streak.currentStreak}</span>
        <span className="text-sm text-muted-foreground">days</span>
        {streak.currentStreak > 0 && <Flame className="h-5 w-5 text-orange-500" aria-hidden />}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Longest {streak.longestStreak} · {streak.activeDays} active days
      </p>
    </div>
  );
}

/** The "Next Recommended Action" block, with the reason it was chosen (spec §9). */
export function NextRecommendedAction({ action }: { action: RecommendedAction | undefined }) {
  if (!action) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-5">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Next Recommended Action
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a target role and complete an assessment — then AETHER will point you at the most
          useful next step.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
      <h2 className="text-sm font-bold uppercase tracking-widest text-primary">Next Recommended Action</h2>
      <p className="mt-2 text-lg font-semibold text-foreground">{action.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{action.reason}</p>
      <Link
        to={action.href}
        className="mt-3 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        {action.cta}
      </Link>
    </div>
  );
}

/** Recent Activity, grouped by the candidate's local calendar day (spec §5). */
export function RecentActivity({
  activity,
}: {
  activity: {
    timezone: string;
    totalQualifyingEvents: number;
    days: Array<{
      date: string;
      label: string;
      entries: Array<{ eventType: string; verb: string; entityLabel?: string; occurredAt: string }>;
    }>;
  };
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Recent Activity</h2>
      {activity.days.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing here yet. Finish an assessment, submit code, complete a lesson or run an interview
          and it will show up here.
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          {activity.days.map(day => (
            <div key={day.date}>
              <p className="text-xs font-semibold text-muted-foreground">{day.label}</p>
              <ul className="mt-1 space-y-1">
                {day.entries.map((entry, i) => (
                  <li key={`${entry.occurredAt}-${i}`} className="text-sm text-foreground">
                    <span className="text-muted-foreground">{entry.verb}</span>
                    {entry.entityLabel && (
                      <>
                        {': '}
                        <span className="font-medium">{entry.entityLabel}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Generic chart frame. Charts with no data show an explicit empty state rather
 * than an axis with zero points, which would read as "you scored nothing".
 */
export function ChartFrame({
  title,
  subtitle,
  hasData,
  children,
}: {
  title: string;
  subtitle?: string;
  hasData: boolean;
  /** Optional — omitted entirely when the chart renders its empty state. */
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      <div className="mt-4">
        {hasData ? children : <p className="text-sm italic text-muted-foreground">No data yet</p>}
      </div>
    </section>
  );
}