import { runIngestion, sweepExpiredPostings, getFreshness, takeNewlyCreatedPostings } from './ingestion.service';
import { generateAlertsForPostings } from './jobAlert.service';
import logger from '../../utils/logger';

/**
 * Scheduled job refresh (spec §63).
 *
 * Postings are refreshed on an interval, NOT on page load — a candidate opening
 * /jobs must never trigger a call to every external provider. The interval is
 * configurable via JOB_REFRESH_INTERVAL_MINUTES and defaults to 6 hours.
 */

const DEFAULT_INTERVAL_MINUTES = 360;

export function refreshIntervalMinutes(): number {
  const raw = Number.parseInt(String(process.env.JOB_REFRESH_INTERVAL_MINUTES ?? ''), 10);
  if (!Number.isFinite(raw) || raw < 5) return DEFAULT_INTERVAL_MINUTES;
  return raw;
}

let timer: NodeJS.Timeout | null = null;
let lastRunAt: Date | null = null;
let running = false;

/** One refresh cycle: fetch from every configured provider, then age out stale postings. */
export async function refreshJobsOnce(): Promise<{
  ranAt: string;
  reports: unknown[];
  deactivated: number;
  alerts: { created: number; skipped: number; threshold: number } | null;
}> {
  if (running) {
    // Guard against overlapping cycles when ingestion is slower than the interval.
    logger.info('[jobs] refresh already running, skipping this tick');
    return { ranAt: new Date().toISOString(), reports: [], deactivated: 0, alerts: null };
  }
  running = true;
  try {
    const reports = await runIngestion({ limit: 50 });
    const deactivated = await sweepExpiredPostings(30);

    // Alerts are raised ONLY for postings this run actually created, so an
    // unchanged provider re-run produces no new notifications (spec §G1).
    let alerts: { created: number; skipped: number; threshold: number } | null = null;
    const created = takeNewlyCreatedPostings();
    if (created.length > 0) {
      try {
        const report = await generateAlertsForPostings(created);
        alerts = { created: report.created, skipped: report.skipped, threshold: report.threshold };
      } catch (error) {
        // Alerting is best-effort and must never fail a successful ingestion.
        logger.warn('[jobs] alert generation failed', { err: (error as Error).message });
      }
    }

    lastRunAt = new Date();
    return { ranAt: lastRunAt.toISOString(), reports, deactivated, alerts };
  } finally {
    running = false;
  }
}

/** Start the interval timer. Safe to call more than once. */
export function startJobRefreshScheduler(): void {
  if (timer) return;
  const minutes = refreshIntervalMinutes();
  const ms = minutes * 60_000;

  logger.info(`[jobs] scheduler started — refreshing every ${minutes} minutes`);
  timer = setInterval(() => {
    void refreshJobsOnce().catch(error => logger.warn('[jobs] scheduled refresh failed', { err: (error as Error).message }));
  }, ms);

  // Do not hold the process open purely for this timer.
  timer.unref?.();
}

export function stopJobRefreshScheduler(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

export function schedulerStatus() {
  return {
    intervalMinutes: refreshIntervalMinutes(),
    lastRunAt: lastRunAt?.toISOString() ?? null,
    running,
  };
}

export { getFreshness };