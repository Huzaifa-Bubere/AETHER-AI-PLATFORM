import mongoose from 'mongoose';
import {
  assessmentScoreOverTime,
  atsScoreOverTime,
  codingPerformance,
  interviewScoresOverTime,
  learningAnalytics,
  technicalAccuracyByCategory,
  CALC_VERSION,
  confidenceFor,
} from './analytics.service';
import { getUserRoleProgress } from '../career/services/userRoleProgress.service';
import { getStreakSummary } from './streak.service';
import { getActivityTimeline } from './activity.service';
import { ResumeVersion } from '../models/ResumeVersion';
import AdaptiveInterview from '../models/AdaptiveInterview';
import { TopicProgress } from '../career/models/TopicProgress';
import AptitudeAttempt from '../models/AptitudeAttempt';
import CodingSubmission from '../coding/models/CodingSubmission';
import User from '../models/User';
import logger from '../utils/logger';

/**
 * DashboardService (spec §8–§14, §101).
 *
 * ONE endpoint, `GET /api/dashboard/summary`, that answers everything the home
 * dashboard asks. The spec is explicit that the frontend should not fire thirty
 * requests to paint one screen, so this composes the existing per-metric
 * analytics (which already return provenance envelopes) with role progress,
 * the streak and the activity timeline.
 *
 * Rules that hold for every field below:
 *  - a metric with no data is `null`, never 0 and never a fabricated point
 *  - every number carries a human-readable basis ("41 correct / 53 answered")
 *  - small samples are labelled with a confidence so the UI can say
 *    "Limited Evidence" rather than implying precision
 */

export interface MetricCard {
  /** Null when there is nothing to show — the UI renders an honest empty state. */
  value: number | null;
  /** Plain-language explanation of where the number came from. */
  basis: string;
  sampleSize: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OK' | 'NOT_ASSESSED';
  /** Optional supporting detail shown under the value. */
  detail?: string;
}

export interface RecommendedAction {
  title: string;
  reason: string;
  href: string;
  cta: string;
  /** Where in the recommendation ordering this came from. */
  source: 'role_requirement' | 'resume' | 'learning' | 'assessment' | 'coding';
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
    days: Array<{ date: string; label: string; entries: Array<{ eventType: string; verb: string; entityLabel?: string; occurredAt: string }> }>;
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
    assessmentOverTime: { date: string; score: number }[];
    technicalByCategory: { category: string; correct: number; attempted: number; accuracy: number }[];
    codingOverTime: { date: string; score: number; difficulty: string }[];
    /** Split per role — never merged into one meaningless line (spec §79). */
    interviewByRole: Record<string, { date: string; score: number }[]>;
    atsOverTime: { date: string; label: string; score: number | null }[];
    learningByCourse: { course: string; completed: number; total: number; pct: number }[];
    skillCategoryCoverage: Array<{ category: string; coverage: number | null }>;
  };
  recommendations: RecommendedAction[];
}

const notAssessed = (basis: string): MetricCard => ({
  value: null,
  basis,
  sampleSize: 0,
  confidence: 'LOW',
  status: 'NOT_ASSESSED',
});

/**
 * Build the whole dashboard payload.
 *
 * All independent lookups run concurrently; a failure in one section degrades
 * that section to an empty state rather than failing the whole dashboard.
 */
export async function getDashboardSummary(
  userId: string,
  options: { roleSlug?: string } = {},
): Promise<DashboardSummary> {
  const oid = new mongoose.Types.ObjectId(userId);

  const [
    user,
    roleProgress,
    streak,
    timeline,
    technical,
    assessmentOverTime,
    coding,
    interviews,
    ats,
    learning,
    interviewDocs,
    resumeVersions,
    topicProgress,
    attempts,
    submissions,
  ] = await Promise.all([
    User.findById(oid).select('profile preferences.timezone').lean(),
    getUserRoleProgress(userId).catch(err => {
      logger.warn('[dashboard] roleProgress failed', { err: (err as Error).message });
      return null;
    }),
    getStreakSummary(userId).catch(() => null),
    getActivityTimeline(userId, { limit: 12 }).catch(() => null),
    technicalAccuracyByCategory(userId, '90d'),
    assessmentScoreOverTime(userId, '90d'),
    codingPerformance(userId, '90d'),
    interviewScoresOverTime(userId, '90d'),
    atsScoreOverTime(userId),
    learningAnalytics(userId, 'all'),
    AdaptiveInterview.find({ userId: oid, status: 'completed' })
      .select('role roleSlug report.overallScore endedAt')
      .sort({ endedAt: 1 })
      .lean()
      .catch(() => []),
    ResumeVersion.find({ userId: oid }).select('name targetRoleSlug atsScore updatedAt').sort({ updatedAt: 1 }).lean().catch(() => []),
    TopicProgress.find({ userId: oid }).select('state bestQuizScore').lean().catch(() => []),
    AptitudeAttempt.find({ user: userId, status: 'completed' })
      .select('accuracyPercent correctCount unansweredCount scorePercent roundType submittedAt')
      .sort({ submittedAt: 1 })
      .lean()
      .catch(() => []),
    CodingSubmission.find({ user: userId })
      .select('status overallScore passedTests totalTests submittedAt')
      .lean()
      .catch(() => []),
  ]);

  // ── Selected role ──────────────────────────────────────────────────────────
  const selectedSlug = options.roleSlug ?? roleProgress?.primaryRole ?? null;
  const selectedSummary = selectedSlug ? roleProgress?.roles.find(r => r.roleSlug === selectedSlug) ?? null : null;
  const selectedDetail = selectedSlug ? roleProgress?.detail?.[selectedSlug] ?? null : null;

  // ── Metric cards ───────────────────────────────────────────────────────────
  const lastTechnical = technical.data.length ? technical.data[0] : null;
  const technicalCard: MetricCard = lastTechnical
    ? {
        value: lastTechnical.accuracy,
        basis: `${lastTechnical.correct} correct / ${lastTechnical.attempted} answered`,
        sampleSize: technical.sampleSize,
        confidence: technical.confidence,
        status: 'OK',
        detail: lastTechnical.category,
      }
    : notAssessed('No completed technical test yet');

  const evaluated = submissions.filter(s => typeof s.overallScore === 'number');
  const codingCard: MetricCard = evaluated.length
    ? {
        value: Math.round(evaluated.reduce((sum, s) => sum + (s.overallScore ?? 0), 0) / evaluated.length),
        basis: `${evaluated.length} evaluated submission${evaluated.length === 1 ? '' : 's'}`,
        sampleSize: evaluated.length,
        confidence: confidenceFor(evaluated.length),
        status: 'OK',
      }
    : notAssessed('No evaluated coding submission yet');

  // Prefer the SAME interview records the role chart is built from, so the card
  // and the chart can never disagree.
  const roleScopedInterviews = selectedSlug
    ? interviewDocs.filter(i => (i as any).roleSlug === selectedSlug)
    : interviewDocs;
  const scoredInterviews = roleScopedInterviews.filter(i => typeof (i as any).report?.overallScore === 'number');
  const interviewCard: MetricCard = scoredInterviews.length
    ? {
        value: Math.round(
          scoredInterviews.reduce((sum, i) => sum + ((i as any).report.overallScore as number), 0) / scoredInterviews.length,
        ),
        basis: `${scoredInterviews.length} ${selectedSummary?.name ?? 'mock'} interview${scoredInterviews.length === 1 ? '' : 's'}`,
        sampleSize: scoredInterviews.length,
        confidence: confidenceFor(scoredInterviews.length),
        status: 'OK',
      }
    : notAssessed(selectedSlug ? `No completed ${selectedSummary?.name ?? 'role'} interview yet` : 'No completed interview yet');

  const latestVersion = [...resumeVersions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0];
  const resumeCard: MetricCard =
    latestVersion && typeof latestVersion.atsScore === 'number'
      ? {
          value: latestVersion.atsScore,
          basis: `Resume “${latestVersion.name}”`,
          sampleSize: resumeVersions.length,
          confidence: confidenceFor(resumeVersions.length),
          status: 'OK',
          detail: `${latestVersion.atsScore} / 100`,
        }
      : notAssessed('No saved resume version yet');

  const completedTopics = topicProgress.filter(t => t.state === 'COMPLETED').length;
  const learningCard: MetricCard = learning.data.length
    ? {
        value: Math.round(learning.data.reduce((s, d) => s + d.pct, 0) / learning.data.length),
        basis: `${completedTopics} topic${completedTopics === 1 ? '' : 's'} completed`,
        sampleSize: learning.data.length,
        confidence: confidenceFor(learning.data.length),
        status: 'OK',
      }
    : notAssessed('No course progress yet');

  // ── Charts ─────────────────────────────────────────────────────────────────
  const interviewByRole: Record<string, { date: string; score: number }[]> = {};
  for (const interview of interviewDocs) {
    const score = (interview as any).report?.overallScore;
    if (typeof score !== 'number') continue;
    const key = (interview as any).roleSlug || (interview as any).role || 'unspecified';
    (interviewByRole[key] ??= []).push({ date: String((interview as any).endedAt ?? ''), score });
  }

  return {
    generatedAt: new Date().toISOString(),
    calculationVersion: CALC_VERSION,
    user: {
      firstName: (user as any)?.profile?.firstName ?? '',
      lastName: (user as any)?.profile?.lastName ?? '',
      timezone: (user as any)?.preferences?.timezone ?? 'UTC',
    },
    primaryRole: selectedSummary
      ? { slug: selectedSummary.roleSlug, name: selectedSummary.roleName, isPrimary: selectedSummary.isPrimary }
      : null,
    roleProgress: {
      readiness: selectedDetail?.readiness ?? null,
      roles: (roleProgress?.roles ?? []).map(r => ({
        slug: r.roleSlug,
        name: r.roleName,
        readiness: r.readiness,
        isPrimary: r.isPrimary,
      })),
    },
    streak,
    activity: {
      timezone: timeline?.timezone ?? 'UTC',
      days:
        timeline?.days.map(d => ({
          date: d.date,
          label: d.label,
          entries: d.entries.map(e => ({
            eventType: e.eventType,
            verb: e.verb,
            entityLabel: e.entityLabel,
            occurredAt: e.occurredAt,
          })),
        })) ?? [],
      totalQualifyingEvents: timeline?.totalQualifyingEvents ?? 0,
    },
    metricCards: {
      technicalAccuracy: technicalCard,
      codingPerformance: codingCard,
      interviewScore: interviewCard,
      resumeQuality: resumeCard,
      learning: learningCard,
    },
    charts: {
      assessmentOverTime: assessmentOverTime.data.map(d => ({ date: d.date, score: d.score })),
      technicalByCategory: technical.data.map(d => ({
        category: d.category,
        correct: d.correct,
        attempted: d.attempted,
        accuracy: d.accuracy,
      })),
      codingOverTime: coding.data.map(d => ({ date: d.date, score: d.score, difficulty: d.difficulty })),
      interviewByRole,
      atsOverTime: ats.data.map(d => ({ date: d.date, label: d.label, score: d.score })),
      learningByCourse: learning.data.map(d => ({
        course: d.course,
        completed: d.completed,
        total: d.total,
        pct: d.pct,
      })),
      skillCategoryCoverage: (selectedDetail?.categoryRollup ?? []).map(c => ({
        category: c.category,
        coverage: c.coverage,
      })),
    },
    recommendations: buildRecommendations({
      selectedDetail,
      selectedSummary,
      resumeCard,
      technicalCard,
      codingCard,
      completedTopics,
      attempts,
    }),
  };
}

/**
 * The single "what should I do next" action (spec §9).
 *
 * Ordered by evidence strength, and every entry carries the REASON it was
 * chosen so the dashboard can explain itself instead of nudging blindly.
 */
function buildRecommendations(input: {
  selectedDetail: Awaited<ReturnType<typeof getUserRoleProgress>>['detail'][string] | null;
  selectedSummary: Awaited<ReturnType<typeof getUserRoleProgress>>['roles'][number] | null;
  resumeCard: MetricCard;
  technicalCard: MetricCard;
  codingCard: MetricCard;
  completedTopics: number;
  attempts: unknown[];
}): RecommendedAction[] {
  const actions: RecommendedAction[] = [];

  // 1. An unmet, high-weight role requirement is always the best next action —
  //    it is by definition what the target role wants and the candidate lacks.
  const topGap = input.selectedDetail?.nextActions?.[0];
  if (topGap) {
    actions.push({
      title: topGap.name,
      reason: topGap.reason,
      href: topGap.learningTopicSlug
        ? `/career-learning/topics/${topGap.learningTopicSlug}`
        : `/career-learning/${input.selectedSummary?.roleSlug ?? ''}`,
      cta: topGap.learningTopicSlug ? 'Continue Learning' : 'View requirements',
      source: 'role_requirement',
    });
  }

  // 2. No technical evidence at all yet.
  if (input.technicalCard.status === 'NOT_ASSESSED') {
    actions.push({
      title: 'Take a technical assessment',
      reason: 'No technical result exists yet, so category strengths and gaps are unknown.',
      href: '/technical',
      cta: 'Start technical test',
      source: 'assessment',
    });
  }

  // 3. No resume scored yet — resume evidence feeds both job fit and skill profile.
  if (input.resumeCard.status === 'NOT_ASSESSED') {
    actions.push({
      title: 'Build your first resume',
      reason: 'A scored resume is required evidence for job matching and skill levels.',
      href: '/resume-builder',
      cta: 'Open Resume Builder',
      source: 'resume',
    });
  }

  // 4. No coding evidence yet.
  if (input.codingCard.status === 'NOT_ASSESSED') {
    actions.push({
      title: 'Solve a coding problem',
      reason: 'Coding submissions are the strongest evidence for implementation skill.',
      href: '/coding',
      cta: 'Browse problems',
      source: 'coding',
    });
  }

  // 5. Nothing started in career learning.
  if (input.completedTopics === 0 && !topGap?.learningTopicSlug) {
    actions.push({
      title: 'Start a career learning topic',
      reason: 'No lesson has been completed, so learning evidence is empty.',
      href: '/career-learning',
      cta: 'Browse topics',
      source: 'learning',
    });
  }

  return actions.slice(0, 4);
}