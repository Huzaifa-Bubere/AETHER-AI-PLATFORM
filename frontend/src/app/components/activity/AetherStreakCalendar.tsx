import { useMemo, useState } from 'react';
import { Flame, Info } from 'lucide-react';

/**
 * AETHER streak calendar (spec §18–§22).
 *
 * A GitHub-contribution-style heatmap in the AETHER light theme. Every cell is a
 * real day of real qualifying activity supplied by StreakService — there is no
 * seed data and no fallback pattern, so a brand-new account correctly renders
 * as a fully empty grid rather than a plausible-looking fake history.
 *
 * "Contributions" is deliberately replaced by "AETHER STREAK".
 */

export interface StreakDay {
  date: string;
  count: number;
  /** 0–4, from the server's LEVEL_THRESHOLDS. */
  level: number;
  label: string;
  isToday: boolean;
  breakdown?: Record<string, number>;
}

export interface StreakSummary {
  timezone: string;
  currentStreak: number;
  longestStreak: number;
  activeDays: number;
}

/** Human phrase per event type, matching the server's ACTIVITY_VERBS. */
const EVENT_LABELS: Record<string, string> = {
  APTITUDE_COMPLETED: 'Aptitude test',
  TECHNICAL_COMPLETED: 'Technical test',
  CODING_SUBMITTED: 'Coding submission',
  CODING_ACCEPTED: 'Coding problem solved',
  INTERVIEW_COMPLETED: 'Interview',
  RESUME_ANALYZED: 'Resume analysis',
  RESUME_UPDATED: 'Resume update',
  COURSE_STARTED: 'Course',
  LESSON_COMPLETED: 'Lesson',
  QUIZ_COMPLETED: 'Quiz',
  PROJECT_COMPLETED: 'Project',
  JOB_SAVED: 'Job saved',
  JOB_APPLIED: 'Job applied',
  PROFILE_UPDATED: 'Profile update',
};

/** AETHER light-theme heat ramp, level 0 → 4. */
const LEVEL_CLASSES = [
  'bg-slate-100 border-slate-200', // 0 — no activity
  'bg-indigo-100 border-indigo-200', // 1
  'bg-indigo-200 border-indigo-300', // 2
  'bg-indigo-300 border-indigo-400', // 3
  'bg-indigo-500 border-indigo-600', // 4
];

const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

/**
 * Convert a flat, oldest-first day list into week columns.
 * Each column is one week; the first column is padded so every cell in a
 * column shares a weekday, which is what makes the grid read as a calendar.
 */
function toWeekColumns(days: StreakDay[]): StreakDay[][] {
  if (days.length === 0) return [];
  const columns: StreakDay[][] = [];
  let current: StreakDay[] = [];
  // 1970-01-01 was a Thursday (index 4 with Monday-first weeks).
  const firstWeekday = (new Date(`${days[0].date}T00:00:00Z`).getUTCDay() + 6) % 7;
  for (let i = 0; i < firstWeekday; i++) current.push(null as unknown as StreakDay);
  for (const day of days) {
    current.push(day);
    if (current.length === 7) {
      columns.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    while (current.length < 7) current.push(null as unknown as StreakDay);
    columns.push(current);
  }
  return columns;
}

/**
 * Month label per week column, shown only on the column where a new month
 * starts. Derived from the first real day in each column, so a leading padded
 * column does not shift the labels.
 */
function monthLabelsForColumns(columns: StreakDay[][]): (string | null)[] {
  let previousMonth: string | null = null;
  return columns.map(column => {
    const firstReal = column.find(Boolean);
    if (!firstReal) return null;
    const month = firstReal.date.slice(0, 7);
    if (month === previousMonth) return null;
    previousMonth = month;
    return new Date(Date.UTC(2020, Number(firstReal.date.slice(5, 7)) - 1, 1)).toLocaleString('en-GB', {
      month: 'short',
      timeZone: 'UTC',
    });
  });
}

function TooltipContent({ day }: { day: StreakDay }) {
  if (day.count === 0) {
    return (
      <>
        <p className="font-semibold">No activity on {day.label}</p>
        <p className="text-white/70">Counts toward your streak only when you complete something.</p>
      </>
    );
  }
  const entries = Object.entries(day.breakdown ?? {}).filter(([, n]) => n > 0);
  return (
    <>
      <p className="font-semibold">
        {day.count} {day.count === 1 ? 'activity' : 'activities'} on {day.label}
      </p>
      {entries.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-white/80">
          {entries.map(([type, n]) => (
            <li key={type}>
              {n} × {EVENT_LABELS[type] ?? type}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export interface AetherStreakCalendarProps {
  days: StreakDay[];
  summary: StreakSummary | null;
  loading?: boolean;
}

export function AetherStreakCalendar({ days, summary, loading = false }: AetherStreakCalendarProps) {
  const [hovered, setHovered] = useState<StreakDay | null>(null);
  const columns = useMemo(() => toWeekColumns(days), [days]);
  const monthLabels = useMemo(() => monthLabelsForColumns(columns), [columns]);
  const hasActivity = days.some(d => d.count > 0);

  if (loading) {
    return (
      <div className="h-32 animate-pulse rounded-lg bg-muted" aria-label="Loading streak" />
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5" aria-label="AETHER streak">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-foreground">
            AETHER STREAK
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Learning &amp; placement activity, counted in your local timezone.
          </p>
        </div>
        {summary && (
          <dl className="flex gap-5 text-right">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Current</dt>
              <dd className="flex items-center justify-end gap-1 text-lg font-bold text-foreground">
                {summary.currentStreak}
                {summary.currentStreak > 0 && <Flame className="h-4 w-4 text-orange-500" aria-hidden />}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Longest</dt>
              <dd className="text-lg font-bold text-foreground">{summary.longestStreak}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Active days</dt>
              <dd className="text-lg font-bold text-foreground">{summary.activeDays}</dd>
            </div>
          </dl>
        )}
      </header>

      {!hasActivity ? (
        // Honest empty state. A new account shows an empty grid rather than a
        // generated pattern of "activity" (spec §13, §87).
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
          <Info className="h-4 w-4 shrink-0" />
          <span>
            No qualifying activity yet. Finish a lesson, submit a coding solution, complete an
            assessment or run an interview and your streak starts today.
          </span>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto pb-1">
            <div className="inline-flex gap-2">
              {/* Weekday labels */}
              <div className="grid grid-rows-7 gap-[3px] pt-[18px] text-[10px] leading-none text-muted-foreground">
                {WEEKDAY_LABELS.map((label, i) => (
                  <span key={i} className="h-[11px] leading-none">
                    {label}
                  </span>
                ))}
              </div>

              <div>
                {/* Month labels */}
                <div className="flex gap-[3px] pb-1 text-[10px] leading-none text-muted-foreground">
                  {columns.map((_, i) => (
                    <span key={i} className="w-[11px] shrink-0">
                      {monthLabels[i]}
                    </span>
                  ))}
                </div>

                {/* Heatmap */}
                <div className="flex gap-[3px]">
                  {columns.map((column, i) => (
                    <div key={i} className="grid grid-rows-7 gap-[3px]">
                      {column.map((day, j) =>
                        day ? (
                          <div
                            key={day.date}
                            className={`h-[11px] w-[11px] cursor-default rounded-[2px] border transition-transform hover:scale-125 ${
                              LEVEL_CLASSES[day.level] ?? LEVEL_CLASSES[0]
                            } ${day.isToday ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}`}
                            onMouseEnter={() => setHovered(day)}
                            onMouseLeave={() => setHovered(null)}
                            onFocus={() => setHovered(day)}
                            onBlur={() => setHovered(null)}
                            tabIndex={0}
                            role="img"
                            aria-label={`${day.count} activities on ${day.label}`}
                          />
                        ) : (
                          <div key={`pad-${j}`} className="h-[11px] w-[11px]" />
                        ),
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-4">
            <p className="min-h-[2.5rem] text-xs text-muted-foreground">
              {hovered ? <TooltipContent day={hovered} /> : 'Hover a day for detail.'}
            </p>
            {/* Legend: Less → More */}
            <div className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>Less</span>
              {LEVEL_CLASSES.map((cls, i) => (
                <span key={i} className={`h-[11px] w-[11px] rounded-[2px] border ${cls}`} />
              ))}
              <span>More</span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
