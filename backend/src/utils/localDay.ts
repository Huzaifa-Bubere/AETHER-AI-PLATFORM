/**
 * Timezone-safe calendar-day helpers (spec §23).
 *
 * Timestamps are stored in UTC everywhere. Anything that groups events into
 * "days" — the AETHER streak, the activity heatmap, the Recent Activity
 * timeline — must bucket them in the CANDIDATE's timezone, otherwise a streak
 * silently breaks for anyone east or west of UTC at the wrong hour.
 *
 * A day key is a plain 'YYYY-MM-DD' string in the user's local zone.
 */

const DEFAULT_TIMEZONE = 'UTC';

/** True when the runtime recognises `timeZone` as an IANA identifier. */
export function isValidTimezone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== 'string' || timeZone.trim() === '') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimezone(timeZone: unknown): string {
  return isValidTimezone(timeZone) ? (timeZone as string).trim() : DEFAULT_TIMEZONE;
}

/**
 * The local calendar day an instant falls on, as 'YYYY-MM-DD'.
 * `en-CA` formats as YYYY-MM-DD, which is exactly the key shape we want.
 */
export function toLocalDayKey(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: normalizeTimezone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * The UTC instant at which a local calendar day starts.
 *
 * Built by formatting a guess and measuring the offset, then correcting once —
 * this is the standard two-pass approach and is exact except within a few
 * seconds of a DST transition, where it is correct on the safe side.
 */
export function startOfLocalDayUtc(dayKey: string, timeZone: string): Date {
  const [year, month, day] = dayKey.split('-').map(Number);
  const tz = normalizeTimezone(timeZone);

  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offsetOf = (instant: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(new Date(instant));
    const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? '0');
    // hour '24' is returned at midnight by some ICU builds; normalise to 0.
    const asUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour') % 24,
      get('minute'),
      get('second'),
    );
    return asUtc - instant;
  };

  const firstPass = utcGuess - offsetOf(utcGuess);
  return new Date(utcGuess - offsetOf(firstPass));
}

/** Add `days` to a 'YYYY-MM-DD' key, staying in calendar space. */
export function addDaysToDayKey(dayKey: string, days: number): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/** Today's local day key for the given zone. */
export function todayLocalDayKey(timeZone: string, now: Date = new Date()): string {
  return toLocalDayKey(now, timeZone);
}

/** Inclusive list of day keys covering the last `days` days, oldest first. */
export function recentDayKeys(timeZone: string, days: number, now: Date = new Date()): string[] {
  const last = todayLocalDayKey(timeZone, now);
  return Array.from({ length: days }, (_, i) => addDaysToDayKey(last, -(days - 1 - i)));
}

/**
 * '2026-09-27' → '27 Sep 2026', for tooltips and the timeline.
 *
 * Formatted by hand rather than via Intl because the short month name is
 * ICU-version dependent (some builds render September as "Sept"), and a
 * tooltip that changes text between environments is a real inconsistency.
 */
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDayKey(dayKey: string): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  const name = MONTH_SHORT[month - 1];
  if (!name) return dayKey;
  return `${day} ${name} ${year}`;
}
