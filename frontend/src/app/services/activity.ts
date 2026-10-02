import { apiService } from './api';

/**
 * Activity + streak client (spec §5, §18–§22).
 *
 * Thin wrapper over the two read endpoints. Every field is computed
 * server-side so the dashboard, the profile and the streak calendar can never
 * disagree about the same number.
 */

export interface StreakDay {
  date: string;
  count: number;
  level: number;
  label: string;
  isToday: boolean;
  breakdown: Record<string, number>;
}

export interface StreakSummary {
  timezone: string;
  currentStreak: number;
  longestStreak: number;
  activeDays: number;
  activitiesThisMonth: number;
  totalQualifyingActivities: number;
  days: StreakDay[];
  generatedAt: string;
  qualifyingEventTypes: string[];
}

export interface TimelineEntry {
  eventId: string;
  eventType: string;
  verb: string;
  icon: string;
  entityType: string;
  entityId?: string;
  entityLabel?: string;
  roleId?: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface TimelineDay {
  date: string;
  label: string;
  entries: TimelineEntry[];
}

export interface ActivityTimeline {
  timezone: string;
  days: TimelineDay[];
  totalQualifyingEvents: number;
}

export async function fetchStreak(options: { roleId?: string; days?: number } = {}): Promise<StreakSummary> {
  const response = await apiService.get<StreakSummary>('/activity/streak', {
    roleId: options.roleId,
    days: options.days,
  });
  if (!response.success || !response.data) {
    throw new Error(response.message || 'Could not load your streak.');
  }
  return response.data;
}

export async function fetchActivityTimeline(
  options: { roleId?: string; limit?: number } = {},
): Promise<ActivityTimeline> {
  const response = await apiService.get<ActivityTimeline>('/activity/timeline', {
    roleId: options.roleId,
    limit: options.limit,
  });
  if (!response.success || !response.data) {
    throw new Error(response.message || 'Could not load your activity.');
  }
  return response.data;
}
