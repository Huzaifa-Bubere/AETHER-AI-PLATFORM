import { apiService } from './api';

/**
 * Dashboard client (spec §14).
 *
 * One request returns the whole home screen. The payload types mirror the
 * DashboardService contract so the UI renders exactly what was computed
 * server-side — nothing is recalculated in the browser.
 */

export interface MetricCard {
  value: number | null;
  basis: string;
  sampleSize: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OK' | 'NOT_ASSESSED';
  detail?: string;
}

export interface RecommendedAction {
  title: string;
  reason: string;
  href: string;
  cta: string;
  source: string;
}

export interface DashboardSummary {
  generatedAt: string;
  calculationVersion: string;
  user: { firstName: string; lastName: string; timezone: string };
  primaryRole: { slug: string; name: string; isPrimary: boolean } | null;
  roleProgress: {
    readiness: number | null;
    roles: Array<{ slug: string; name: string; readiness: number | null; isPrimary: boolean }>;
  };
  streak: {
    currentStreak: number;
    longestStreak: number;
    activeDays: number;
    timezone: string;
  } | null;
  activity: {
    timezone: string;
    days: Array<{
      date: string;
      label: string;
      entries: Array<{ eventType: string; verb: string; entityLabel?: string; occurredAt: string }>;
    }>;
    totalQualifyingEvents: number;
  };
  metricCards: {
    technicalAccuracy: MetricCard;
    codingPerformance: MetricCard;
    interviewScore: MetricCard;
    resumeQuality: MetricCard;
    learning: MetricCard;
  };
  charts: {
    assessmentOverTime: Array<{ date: string; score: number }>;
    technicalByCategory: Array<{ category: string; correct: number; attempted: number; accuracy: number }>;
    codingOverTime: Array<{ date: string; score: number; difficulty: string }>;
    interviewByRole: Record<string, Array<{ date: string; score: number }>>;
    atsOverTime: Array<{ date: string; label: string; score: number | null }>;
    learningByCourse: Array<{ course: string; completed: number; total: number; pct: number }>;
    skillCategoryCoverage: Array<{ category: string; coverage: number | null }>;
  };
  recommendations: RecommendedAction[];
}

export async function fetchDashboardSummary(roleSlug?: string): Promise<DashboardSummary> {
  const response = await apiService.get<DashboardSummary>('/dashboard/summary', {
    role: roleSlug || undefined,
  });
  if (!response.success || !response.data) {
    throw new Error(response.message || 'Could not load your dashboard.');
  }
  return response.data;
}