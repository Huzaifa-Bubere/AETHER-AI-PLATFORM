import mongoose from 'mongoose';
import { getActivityInRange, getUserTimezone } from './activity.service';
import { ACTIVITY_TYPES, ActivityType } from '../models/UserActivityEvent';
import {
  addDaysToDayKey,
  formatDayKey,
  recentDayKeys,
  startOfLocalDayUtc,
  toLocalDayKey,
  todayLocalDayKey,
} from '../utils/localDay';

/**
 * StreakService (spec §18–§23).
 *
 * The AETHER streak is a real count of real qualifying activity days. There is
 * no seed data, no synthetic history and no AI involvement: every cell in the
 * heatmap is derived from stored UserActivityEvent documents.
 *
 * All day boundaries come from the candidate's configured timezone, so a streak
 * is not silently reset by UTC midnight for someone in Asia/Kolkata.
 */

/** Number of days shown in the heatmap. */
export const HEATMAP_DAYS = 365;

/**
 * Activity-count → colour level (spec §20). Level 0 means "no activity" and is
 * rendered as an empty cell, never as a zero score.
 */
export const LEVEL_THRESHOLDS = [1, 2, 3, 5] as const;

/**
 * Minimum sample size before a percentage is shown as a number. Below this the
 * UI says "Limited Evidence" rather than implying precision (spec §88).
 */
export const MIN_SAMPLE_SIZE = 5;

export function levelForCount(count: number): number {
  if (count <= 0) return 0;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (count < LEVEL_THRESHOLDS[i]) return i;
  }
  return LEVEL_THRESHOLDS.length;
}

export interface HeatmapDay {
  /** Local calendar day, 'YYYY-MM-DD'. */
  date: string;
  /** Real number of qualifying activities that day. */
  count: number;
  /** 0–4, derived from `count` via LEVEL_THRESHOLDS. */
  level: number;
  /** '27 Sep 2026' */
  label: string;
  isToday: boolean;
  /** Deterministic breakdown for the tooltip, e.g. { CODING_ACCEPTED: 1 }. */
  breakdown: Partial<Record<ActivityType, number>>;
}

export interface StreakResult {
  timezone: string;
  /** Consecutive active days ending today (or yesterday, if today is still open). */
  currentStreak: number;
  longestStreak: number;
  activeDays: number;
  totalQualifyingActivities: number;
  activitiesThisMonth: number;
  days: HeatmapDay[];
  generatedAt: string;
  /** Which event types are counted, so the UI can explain itself. */
  qualifyingEventTypes: readonly ActivityType[];
}

const ACTIVE = new Set(ACTIVITY_TYPES);

export async function getStreak(
  userId: string,
  options: { days?: number; roleId?: string; timezone?: string; now?: Date } = {},
): Promise<StreakResult> {
  const days = Math.min(Math.max(options.days ?? HEATMAP_DAYS, 1), 730);
  const now = options.now ?? new Date();
  const timezone = options.timezone ?? (await getUserTimezone(userId));

  const todayKey = todayLocalDayKey(timezone, now);
  // One extra day of slack on the front so an event exactly at the local
  // midnight boundary is not clipped out of the range.
  const firstKey = addDaysToDayKey(todayKey, -(days - 1));
  const rangeStart = startOfLocalDayUtc(firstKey, timezone);
  const rangeEnd = new Date(startOfLocalDayUtc(addDaysToDayKey(todayKey, 1), timezone).getTime() + 1);

  const events = await getActivityInRange(userId, rangeStart, rangeEnd, options.roleId);

  const byDay = new Map<string, { count: number; breakdown: Partial<Record<ActivityType, number>> }>();
  for (const event of events) {
    if (!ACTIVE.has(event.eventType)) continue;
    const key = toLocalDayKey(new Date(event.occurredAt), timezone);
    const bucket = byDay.get(key) ?? { count: 0, breakdown: {} };
    bucket.count += 1;
    bucket.breakdown[event.eventType] = (bucket.breakdown[event.eventType] ?? 0) + 1;
    byDay.set(key, bucket);
  }

  const allDays: HeatmapDay[] = recentDayKeys(timezone, days, now).map(date => {
    const bucket = byDay.get(date);
    const count = bucket?.count ?? 0;
    return {
      date,
      count,
      level: levelForCount(count),
      label: formatDayKey(date),
      isToday: date === todayKey,
      breakdown: bucket?.breakdown ?? {},
    };
  });

  // ── Current streak ─────────────────────────────────────────────────────────
  // A streak stays alive on the current day even if nothing has happened yet
  // today: the candidate has not broken it, they have not finished it. Only a
  // fully empty yesterday ends it.
  const activeFlags = allDays.map(d => d.count > 0);
  let currentStreak = 0;
  let cursor = allDays.length - 1;
  if (cursor >= 0 && !activeFlags[cursor] && allDays[cursor].isToday) cursor -= 1;
  while (cursor >= 0 && activeFlags[cursor]) {
    currentStreak += 1;
    cursor -= 1;
  }

  // ── Longest streak ─────────────────────────────────────────────────────────
  let longestStreak = 0;
  let run = 0;
  for (const active of activeFlags) {
    if (active) {
      run += 1;
      if (run > longestStreak) longestStreak = run;
    } else {
      run = 0;
    }
  }

  const monthPrefix = todayKey.slice(0, 7); // 'YYYY-MM'

  return {
    timezone,
    currentStreak,
    longestStreak,
    activeDays: activeFlags.filter(Boolean).length,
    totalQualifyingActivities: allDays.reduce((sum, d) => sum + d.count, 0),
    activitiesThisMonth: allDays.filter(d => d.date.startsWith(monthPrefix)).reduce((sum, d) => sum + d.count, 0),
    days: allDays,
    generatedAt: now.toISOString(),
    qualifyingEventTypes: ACTIVITY_TYPES,
  };
}

/**
 * Compact streak header used on the dashboard and the profile hero. Returns null
 * when the user has no activity at all so callers can show an honest empty
 * state instead of a row of zeroes.
 */
export async function getStreakSummary(
  userId: string,
  options: { roleId?: string } = {},
): Promise<Pick<StreakResult, 'currentStreak' | 'longestStreak' | 'activeDays' | 'timezone'> | null> {
  const streak = await getStreak(userId, { roleId: options.roleId });
  if (streak.totalQualifyingActivities === 0) return null;
  return {
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    activeDays: streak.activeDays,
    timezone: streak.timezone,
  };
}

/** Guard used by the routes so a malformed id never reaches a query. */
export function isValidUserId(userId: unknown): userId is string {
  return typeof userId === 'string' && mongoose.isValidObjectId(userId);
}
