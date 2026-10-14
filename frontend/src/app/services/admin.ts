import api from './api';
import { APIResponse } from '../types';

/**
 * Admin API client.
 *
 * The dashboard renders ONLY what the server measured. Types below mirror the
 * backend payloads exactly — including the fields that can be `null` because no
 * data exists yet (a delta with no prior period, a metric with no sample).
 * Nothing here has a fallback percentage: an unknown value must reach the UI as
 * unknown so it renders "no data" instead of a plausible-looking number.
 */

export interface PlatformStats {
  users: {
    total: number;
    active: number;
    newThisMonth: number;
    newLastMonth: number;
    growth: Array<{ _id: { year: number; month: number }; count: number }>;
    subscriptions: Array<{ _id: string; count: number }>;
  };
  interviews: {
    total: number;
    completed: number;
    inProgress: number;
    avgSuccessRate: number;
    avgSuccessRateSample: number;
    successRateLast30Days: number | null;
    last30Days: number;
    previous30Days: number;
    byType: Array<{ _id: string; count: number }>;
  };
  needsReview: {
    total: number;
    integritySessions: number;
    staleInProgress: number;
    warningLimit: number;
  };
  deltas: {
    usersPercent: number | null;
    interviewsPercent: number | null;
    successRatePoints: number | null;
  };
  timestamp: Date;
}

export interface SystemSample {
  at: string;
  cpu: number | null;
  memory: number;
  requests: number;
}

export interface SystemMetrics {
  cpu: number | null;
  cpuMeasured: boolean;
  memory: number;
  uptime: number;
  platform: string;
  nodeVersion: string;
  cores: number;
  totalMemoryBytes: number;
  freeMemoryBytes: number;
  samplingIntervalMs: number;
  maxSamples: number;
  requests: { total: number; sinceLastSample: number };
  history: SystemSample[];
  database: { size: number; collections: number; indexes: number } | null;
  timestamp: Date;
}

export interface AIMetricValue {
  key: string;
  label: string;
  /** null when nothing has been analysed yet. */
  value: number | null;
  unit: string;
  max: number;
  sampleSize: number;
}

export interface AIMetrics {
  totalAnalyzed: number;
  accuracy: number;
  avgRelevanceScore: number;
  avgClarityScore: number;
  metrics: AIMetricValue[];
  note: string;
}

export interface Activity {
  user: string;
  action: string;
  time: Date;
  score: number | null;
}

/**
 * One distinct error, with the real number of times it was logged.
 * Timestamps are null when the stored line carried no readable one — the panel
 * says "time not recorded" rather than guessing.
 */
export interface ErrorLogEntry {
  level: string;
  message: string;
  count: number;
  firstAt: string | null;
  lastAt: string | null;
  stack: string | null;
}

export interface ErrorLogMeta {
  /** Every rotated file that was read, oldest first. */
  files: string[];
  scanned: number;
  unreadable: number;
  distinct: number;
  hasUndatedEntries: boolean;
}

export interface ErrorLogPayload {
  entries: ErrorLogEntry[];
  meta: ErrorLogMeta;
}

/**
 * Unwrap an API envelope, throwing on failure so sections can be isolated with
 * Promise.allSettled: one failing panel must not blank the whole dashboard, and
 * must never be papered over with placeholder data.
 */
function unwrap<T>(response: APIResponse<T>): T {
  if (!response.success || response.data === undefined || response.data === null) {
    throw new Error(response.error || response.message || 'Request failed');
  }
  return response.data;
}

export const adminService = {
  async getStats(): Promise<PlatformStats> {
    return unwrap(await api.get<PlatformStats>('/admin/stats'));
  },

  async getSystemMetrics(): Promise<SystemMetrics> {
    return unwrap(await api.get<SystemMetrics>('/admin/system-metrics'));
  },

  async getAIMetrics(): Promise<AIMetrics> {
    return unwrap(await api.get<AIMetrics>('/admin/ai-metrics'));
  },

  async getActivity(limit: number = 20): Promise<Activity[]> {
    const data = unwrap(await api.get<Activity[]>(`/admin/activity?limit=${limit}`));
    return Array.isArray(data) ? data : [];
  },

  /**
   * Real error log, read across every rotated file. Empty when nothing has been
   * logged at error level; `meta` records which files were actually scanned.
   */
  async getErrorLogs(limit: number = 20): Promise<ErrorLogPayload> {
    const payload = unwrap(await api.get<ErrorLogPayload>(`/admin/error-logs?limit=${limit}`));
    return {
      entries: Array.isArray(payload?.entries) ? payload.entries : [],
      meta: payload?.meta ?? { files: [], scanned: 0, unreadable: 0, distinct: 0, hasUndatedEntries: false },
    };
  },

  async getUsers(page: number = 1, limit: number = 20, search?: string, plan?: string) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (search) params.append('search', search);
    if (plan) params.append('plan', plan);

    const response = await api.get(`/admin/users?${params.toString()}`);
    return response.data;
  },

  async getInterviews(page: number = 1, limit: number = 20, status?: string, type?: string) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (status) params.append('status', status);
    if (type) params.append('type', type);

    const response = await api.get(`/admin/interviews?${params.toString()}`);
    return response.data;
  },

  async updateUser(userId: string, updates: any) {
    const response = await api.put(`/admin/users/${userId}`, updates);
    return response.data;
  },

  async deleteUser(userId: string) {
    const response = await api.delete(`/admin/users/${userId}`);
    return response.data;
  },
};

export default adminService;
