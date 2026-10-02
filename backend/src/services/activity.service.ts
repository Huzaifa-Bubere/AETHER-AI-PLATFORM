import mongoose from 'mongoose';
import {
  ACTIVITY_VERBS,
  ActivityEntityType,
  ActivityType,
  IUserActivityEvent,
  UserActivityEvent,
} from '../models/UserActivityEvent';
import { normalizeTimezone, toLocalDayKey } from '../utils/localDay';
import logger from '../utils/logger';

/**
 * ActivityService (spec §15/§16, §101).
 *
 * Single write path for everything that counts as AETHER activity. Existing
 * flows call `recordActivity(...)` at the moment the candidate actually does the
 * thing — never on a page view, a hover or a login request, which are not
 * evidence of work.
 *
 * Reads are timezone-aware: events are bucketed into the candidate's local
 * calendar days so the timeline and the streak agree on what "today" means.
 */

export interface RecordActivityInput {
  userId: string;
  eventType: ActivityType;
  entityType: ActivityEntityType;
  entityId?: string;
  entityLabel?: string;
  /** Career role slug this is evidence for. Keep role-specific evidence separate. */
  roleId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Is Mongo actually connected?
 *
 * Activity tracking is strictly secondary to the action the candidate was
 * performing. When the connection is down, Mongoose would buffer the write and
 * retry it, which both grows unboundedly and stalls the request that triggered
 * it — so we skip instead. Nothing is lost that matters: the streak and the
 * timeline both read the database, and a write that never landed would not be
 * visible in either.
 */
function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Record one qualifying activity. Never throws — a failure here must not take
 * down the assessment, submission or interview the candidate was completing.
 */
export async function recordActivity(input: RecordActivityInput): Promise<void> {
  if (!input.userId || !mongoose.isValidObjectId(input.userId)) {
    logger.warn('[activity] skipped: invalid userId');
    return;
  }
  if (!isDatabaseReady()) {
    logger.warn(`[activity] skipped ${input.eventType}: database not connected`);
    return;
  }
  await UserActivityEvent.record(input);
}

export async function recordActivities(inputs: RecordActivityInput[]): Promise<void> {
  await Promise.all(inputs.map(recordActivity));
}

/**
 * Emit INTERVIEW_COMPLETED at most once per session.
 *
 * An adaptive session can reach 'completed' by running out of planned questions
 * or via POST /:id/end, and the final report may be generated lazily on first
 * read. A compare-and-set on the session's `activityRecorded` flag makes the
 * write exactly-once no matter which path the candidate took.
 *
 * Returns true when this call was the one that recorded it.
 */
export async function recordInterviewCompletedOnce(params: {
  sessionId: string;
  userId: string;
  roleSlug?: string;
  domain?: string;
  role?: string;
  difficulty?: string;
  overallScore?: number | null;
  domainReadiness?: string;
  questionCount?: number;
}): Promise<boolean> {
  if (!mongoose.isValidObjectId(params.sessionId) || !mongoose.isValidObjectId(params.userId)) {
    return false;
  }
  if (!isDatabaseReady()) {
    logger.warn('[activity] interview completion skipped: database not connected');
    return false;
  }
  try {
    const { default: AdaptiveInterview } = await import('../models/AdaptiveInterview');
    const claimed = await AdaptiveInterview.findOneAndUpdate(
      { _id: params.sessionId, activityRecorded: { $ne: true } },
      { $set: { activityRecorded: true } },
      { new: true },
    ).select('userId role roleSlug domain difficulty report activityRecorded');
    if (!claimed) return false;

    await recordActivity({
      userId: String(claimed.userId ?? params.userId),
      eventType: 'INTERVIEW_COMPLETED',
      entityType: 'INTERVIEW_SESSION',
      entityId: params.sessionId,
      entityLabel: claimed.role || claimed.domain || 'Mock interview',
      // Prefer the role stored on the session so the event is attributed to the
      // role the candidate actually sat for (spec §33/§78).
      roleId: params.roleSlug || (claimed as { roleSlug?: string }).roleSlug || undefined,
      metadata: {
        domain: claimed.domain,
        role: claimed.role,
        roleSlug: (claimed as { roleSlug?: string }).roleSlug || params.roleSlug || null,
        difficulty: claimed.difficulty,
        overallScore: params.overallScore ?? claimed.report?.overallScore ?? null,
        domainReadiness: params.domainReadiness ?? claimed.report?.domainReadiness ?? null,
        questionCount: params.questionCount,
      },
    });
    return true;
  } catch (error) {
    logger.warn('[activity] interview completion not recorded', error);
    return false;
  }
}

/** Resolve the candidate's configured timezone, defaulting to UTC. */
export async function getUserTimezone(userId: string): Promise<string> {
  try {
    const user = await mongoose.connection.collection('users').findOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { projection: { 'preferences.timezone': 1 } },
    );
    return normalizeTimezone(user?.preferences?.timezone);
  } catch (error) {
    logger.warn('[activity] timezone lookup failed, defaulting to UTC', error);
    return 'UTC';
  }
}

export interface TimelineEntry {
  eventId: string;
  eventType: ActivityType;
  /** Deterministic past-tense phrase, e.g. "Scored a technical test". */
  verb: string;
  icon: string;
  entityType: ActivityEntityType;
  entityId?: string;
  entityLabel?: string;
  roleId?: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface TimelineDay {
  /** Local calendar day, 'YYYY-MM-DD'. */
  date: string;
  /** 'Today' | 'Yesterday' | formatted date. */
  label: string;
  entries: TimelineEntry[];
}

export interface TimelineResult {
  timezone: string;
  days: TimelineDay[];
  totalQualifyingEvents: number;
}

function toEntry(event: {
  _id: unknown;
  eventType: ActivityType;
  entityType: ActivityEntityType;
  entityId?: string;
  entityLabel?: string;
  roleId?: string;
  metadata?: unknown;
  occurredAt: Date;
}): TimelineEntry {
  const verb = ACTIVITY_VERBS[event.eventType];
  return {
    eventId: String(event._id),
    eventType: event.eventType,
    verb: verb?.past ?? event.eventType,
    icon: verb?.icon ?? 'activity',
    entityType: event.entityType,
    entityId: event.entityId,
    entityLabel: event.entityLabel,
    roleId: event.roleId,
    metadata: (event.metadata as Record<string, unknown>) ?? {},
    occurredAt: new Date(event.occurredAt).toISOString(),
  };
}

/**
 * Recent activity grouped by local calendar day (spec §5 dashboard "RECENT
 * ACTIVITY"). Grouping happens here rather than in the browser so the dashboard
 * and the profile page always agree on the day boundaries.
 */
export async function getActivityTimeline(
  userId: string,
  options: { limit?: number; roleId?: string; timezone?: string } = {},
): Promise<TimelineResult> {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 200);
  const timezone = options.timezone ?? (await getUserTimezone(userId));

  const filter: Record<string, unknown> = { userId: new mongoose.Types.ObjectId(userId) };
  if (options.roleId) filter.roleId = options.roleId;

  const events = await UserActivityEvent.find(filter)
    .sort({ occurredAt: -1 })
    .limit(limit)
    .lean();

  const byDay = new Map<string, TimelineEntry[]>();
  for (const event of events) {
    const key = toLocalDayKey(new Date(event.occurredAt), timezone);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(toEntry(event));
    else byDay.set(key, [toEntry(event)]);
  }

  const todayKey = toLocalDayKey(new Date(), timezone);
  const yesterdayKey = toLocalDayKey(new Date(Date.now() - 86_400_000), timezone);

  const days: TimelineDay[] = [...byDay.entries()].map(([date, entries]) => ({
    date,
    label: date === todayKey ? 'Today' : date === yesterdayKey ? 'Yesterday' : date,
    entries,
  }));

  return {
    timezone,
    days,
    totalQualifyingEvents: await UserActivityEvent.countDocuments(filter),
  };
}

/** All qualifying events for a user in a UTC window — the input to the heatmap. */
export async function getActivityInRange(
  userId: string,
  from: Date,
  to: Date,
  roleId?: string,
): Promise<Pick<IUserActivityEvent, 'eventType' | 'occurredAt' | 'roleId' | 'entityLabel'>[]> {
  const filter: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(userId),
    occurredAt: { $gte: from, $lt: to },
  };
  if (roleId) filter.roleId = roleId;

  return UserActivityEvent.find(filter)
    .select('eventType occurredAt roleId entityLabel')
    .sort({ occurredAt: 1 })
    .lean();
}
