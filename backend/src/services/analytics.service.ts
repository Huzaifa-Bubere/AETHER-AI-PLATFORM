/**
 * AETHER — Deterministic analytics service (spec §10-§27).
 *
 * REAL DATA → DETERMINISTIC CALCULATION → VERIFIED METRIC → CHART.
 * Every payload carries provenance (metricId, calculationVersion, source,
 * sampleSize, dateRange) and honours:
 *   - zero data  → data: [] + status EMPTY (no fake 0%)
 *   - small data → confidence LOW/MEDIUM/HIGH by deterministic thresholds
 *   - not assessed → score: null + status NOT_ASSESSED (never 0)
 */

import mongoose from 'mongoose';

// Analytics resolves models by name, so every model it reads must be registered.
// These side-effect imports guarantee registration regardless of mount order
// (and make a wrong model name a startup-time failure instead of a silent empty
// chart). `CourseProgress` was exactly that bug — the real model is
// `LearningProgress`.
import '../models/AptitudeAttempt';
import '../models/AdaptiveInterview';
import '../models/ResumeVersion';
import '../coding/models/CodingSubmission';
import '../career/models/Course';
import '../career/models/UserSkillProfile';
import '../career/models/UserCareerGoal';

export const CALC_VERSION = '1.0';

/** Model names this service is allowed to read — asserted by analytics.test.js. */
export const ANALYTICS_MODELS = [
  'AptitudeAttempt',
  'AdaptiveInterview',
  'ResumeVersion',
  'CodingSubmission',
  'LearningProgress',
  'UserSkillProfile',
  'UserCareerGoal',
] as const;

export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface MetricEnvelope<T> {
  metricId: string;
  calculationVersion: string;
  generatedAt: string;
  source: string[];
  filters: Record<string, unknown>;
  sampleSize: number;
  dateRange: string;
  confidence?: Confidence;
  status?: 'OK' | 'EMPTY' | 'NOT_ASSESSED';
  data: T[];
}

const EMPTY = <T>(metricId: string, source: string[], dateRange: string): MetricEnvelope<T> => ({
  metricId, calculationVersion: CALC_VERSION, generatedAt: new Date().toISOString(),
  source, filters: {}, sampleSize: 0, dateRange, status: 'EMPTY', data: [],
});

export function confidenceFor(n: number): Confidence {
  if (n >= 30) return 'HIGH';
  if (n >= 10) return 'MEDIUM';
  return 'LOW';
}

function daysAgoStart(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function rangeStart(dateRange: string): Date {
  if (dateRange === '7d') return daysAgoStart(7);
  if (dateRange === '30d') return daysAgoStart(30);
  if (dateRange === '90d') return daysAgoStart(90);
  return new Date(0); // all-time
}

// ── Technical (aptitude) accuracy by category (§16/§17) ─────────────────────

export async function technicalAccuracyByCategory(userId: string, dateRange = '90d') {
  const metricId = 'technical_accuracy_by_category';
  const since = rangeStart(dateRange);
  const AptitudeAttempt = mongoose.model('AptitudeAttempt');
  // NOTE: AptitudeAttempt keys the owner as `user` (not `userId`) and only has
  // per-question category data inside immutable `questionSnapshots`.
  const attempts = await (AptitudeAttempt as any).find({
    user: new mongoose.Types.ObjectId(userId),
    createdAt: { $gte: since },
  }).select('questionSnapshots responses').lean();

  const byCat = new Map<string, { attempted: number; correct: number }>();
  let sampleSize = 0;

  for (const attempt of attempts) {
    const snapshots: any[] = Array.isArray(attempt.questionSnapshots) ? attempt.questionSnapshots : [];
    const responses: any[] = Array.isArray(attempt.responses) ? attempt.responses : [];
    snapshots.forEach((snap, i) => {
      const selected = responses[i]?.selectedOption ?? null;
      if (!selected) return; // unanswered questions are not accuracy evidence
      const category = snap?.category || 'General';
      const entry = byCat.get(category) || { attempted: 0, correct: 0 };
      entry.attempted += 1;
      if (String(selected) === String(snap?.correctOption)) entry.correct += 1;
      byCat.set(category, entry);
      sampleSize += 1;
    });
  }

  if (sampleSize === 0) return EMPTY<{ category: string; attempted: number; correct: number; accuracy: number }>(metricId, ['aptitude_attempts'], dateRange);

  const data = [...byCat.entries()]
    .map(([category, v]) => ({
      category,
      attempted: v.attempted,
      correct: v.correct,
      accuracy: v.attempted ? Math.round((v.correct / v.attempted) * 100) : 0,
    }))
    .sort((a, b) => b.accuracy - a.accuracy);

  return { metricId, calculationVersion: CALC_VERSION, generatedAt: new Date().toISOString(), source: ['aptitude_attempts'], filters: { userId, dateRange }, sampleSize, dateRange, confidence: confidenceFor(sampleSize), status: 'OK', data };
}

// ── Assessment score over time (§15) — real dated records only ──────────────

export async function assessmentScoreOverTime(userId: string, dateRange = '90d') {
  const metricId = 'assessment_score_over_time';
  const since = rangeStart(dateRange);
  const AptitudeAttempt = mongoose.model('AptitudeAttempt');
  const attempts = await (AptitudeAttempt as any).find({
    user: new mongoose.Types.ObjectId(userId),
    createdAt: { $gte: since },
    status: 'completed',
  }).select('createdAt submittedAt scorePercent accuracyPercent testTitle').sort({ createdAt: 1 }).lean();

  if (attempts.length === 0) return EMPTY<{ date: string; score: number; testId?: string }>(metricId, ['aptitude_attempts'], dateRange);

  const data = attempts.map((a: any) => ({
    date: new Date(a.submittedAt || a.createdAt).toISOString().slice(0, 10),
    label: a.testTitle || 'Assessment',
    // scorePercent = score / totalMarks — the same figure the results page shows.
    score: Math.round(Number(a.scorePercent ?? a.accuracyPercent ?? 0)),
  }));

  return { metricId, calculationVersion: CALC_VERSION, generatedAt: new Date().toISOString(), source: ['aptitude_attempts'], filters: { userId, dateRange }, sampleSize: attempts.length, dateRange, confidence: confidenceFor(attempts.length), status: 'OK', data };
}

// ── Coding performance ───────────────────────────────────────────────────────

export async function codingPerformance(userId: string, dateRange = '90d') {
  const metricId = 'coding_performance';
  const since = rangeStart(dateRange);
  const CodingSubmission = mongoose.model('CodingSubmission');
  // NOTE: CodingSubmission keys the owner as `user`; difficulty lives on the
  // populated problem, not on the submission itself.
  const subs = await (CodingSubmission as any).find({
    user: new mongoose.Types.ObjectId(userId),
    submittedAt: { $gte: since },
  }).select('submittedAt status overallScore passedTests totalTests problem')
    .populate('problem', 'title difficulty category')
    .sort({ submittedAt: 1 })
    .lean();

  if (subs.length === 0) return EMPTY<{ date: string; score: number; difficulty: string }>(metricId, ['coding_submissions'], dateRange);

  const data = subs.map((s: any) => ({
    date: new Date(s.submittedAt).toISOString().slice(0, 10),
    score: typeof s.overallScore === 'number' ? Math.round(s.overallScore)
      : s.totalTests ? Math.round((s.passedTests / s.totalTests) * 100) : 0,
    difficulty: s.problem?.difficulty || '—',
    problem: s.problem?.title || '—',
  }));

  return { metricId, calculationVersion: CALC_VERSION, generatedAt: new Date().toISOString(), source: ['coding_submissions'], filters: { userId, dateRange }, sampleSize: subs.length, dateRange, confidence: confidenceFor(subs.length), status: 'OK', data };
}

// ── Interview scores over time ───────────────────────────────────────────────

export async function interviewScoresOverTime(userId: string, dateRange = '90d') {
  const metricId = 'interview_scores_over_time';
  const since = rangeStart(dateRange);
  const AdaptiveInterview = mongoose.model('AdaptiveInterview');
  const sessions = await (AdaptiveInterview as any).find({
    userId: new mongoose.Types.ObjectId(userId),
    status: 'completed',
    startedAt: { $gte: since },
  }).select('startedAt report.overallScore domain').lean();

  if (sessions.length === 0) return EMPTY<{ date: string; score: number; domain: string }>(metricId, ['adaptive_interviews'], dateRange);

  const data = sessions.map((s: any) => ({
    date: new Date(s.startedAt).toISOString().slice(0, 10),
    score: Math.round(s.report?.overallScore ?? 0),
    domain: s.domain || '—',
  }));

  return { metricId, calculationVersion: CALC_VERSION, generatedAt: new Date().toISOString(), source: ['adaptive_interviews'], filters: { userId, dateRange }, sampleSize: sessions.length, dateRange, confidence: confidenceFor(sessions.length), status: 'OK', data };
}

// ── Learning progress (§25/§26) ──────────────────────────────────────────────

export async function learningAnalytics(userId: string, dateRange = '90d') {
  const metricId = 'learning_progress';
  // NOTE: the registered model is `LearningProgress` (career/models/Course.ts).
  // `CourseProgress` never existed, which made this metric throw/return empty.
  const LearningProgress = mongoose.model('LearningProgress');
  const progress = await (LearningProgress as any).find({ userId: new mongoose.Types.ObjectId(userId) })
    .select('courseSlug roleSlug lessons quizScores updatedAt').lean();

  let lessonsTotal = 0, lessonsDone = 0;
  const perCourse: Array<{ course: string; completed: number; total: number; pct: number }> = [];
  for (const p of progress) {
    const lessons: any[] = Array.isArray(p.lessons) ? p.lessons : [];
    const total = lessons.length;
    const done = lessons.filter((l) => l.state === 'COMPLETED').length;
    lessonsTotal += total; lessonsDone += done;
    perCourse.push({ course: p.courseSlug, completed: done, total, pct: total ? Math.round((done / total) * 100) : 0 });
  }
  if (lessonsTotal === 0) return EMPTY<{ course: string; completed: number; total: number; pct: number }>(metricId, ['learning_progress'], dateRange);

  return {
    metricId, calculationVersion: CALC_VERSION, generatedAt: new Date().toISOString(),
    source: ['learning_progress'], filters: { userId, dateRange },
    sampleSize: lessonsDone, dateRange,
    confidence: confidenceFor(lessonsDone),
    status: 'OK',
    data: perCourse.sort((a, b) => b.pct - a.pct),
  };
}

// ── ATS score over time (§24) — from ResumeVersion ATS snapshots ────────────

export async function atsScoreOverTime(userId: string) {
  const metricId = 'ats_score_over_time';
  const ResumeVersion = mongoose.model('ResumeVersion');
  const versions = await (ResumeVersion as any).find({ userId: new mongoose.Types.ObjectId(userId) })
    .select('name updatedAt atsSnapshot atsScore').sort({ updatedAt: 1 }).lean();

  if (versions.length === 0) return EMPTY<{ date: string; label: string; score: number | null; scoringVersion: string }>(metricId, ['resume_versions'], 'all');

  const data = versions.map((v: any) => ({
    date: new Date(v.updatedAt).toISOString().slice(0, 10),
    label: v.name,
    score: v.atsSnapshot?.score ?? v.atsScore ?? null,
    scoringVersion: '1.0',
  }));

  return { metricId, calculationVersion: CALC_VERSION, generatedAt: new Date().toISOString(), source: ['resume_versions'], filters: { userId }, sampleSize: versions.length, dateRange: 'all', status: 'OK', data };
}

// ── Skill profile with evidence (§20/§21) ────────────────────────────────────

export async function skillProfile(userId: string) {
  const metricId = 'skill_profile';
  const UserSkillProfile = mongoose.model('UserSkillProfile');
  const profile = await (UserSkillProfile as any).findOne({ userId: new mongoose.Types.ObjectId(userId) }).lean();

  if (!profile || !Array.isArray(profile.skills) || profile.skills.length === 0) {
    return EMPTY<{ skill: string; score: number | null; status: 'ASSESSED' | 'NOT_ASSESSED'; evidence: unknown[] }>(metricId, ['user_skill_profiles'], 'all');
  }

  const data = profile.skills.map((s: any) => {
    const evidence = Array.isArray(s.evidence) ? s.evidence : [];
    const assessed = typeof s.score === 'number' && evidence.length > 0;
    return {
      skill: s.name || s.skill || String(s.slug || ''),
      score: assessed ? Math.round(s.score) : null,
      status: assessed ? 'ASSESSED' : 'NOT_ASSESSED',
      evidence,
    };
  });

  return { metricId, calculationVersion: CALC_VERSION, generatedAt: new Date().toISOString(), source: ['user_skill_profiles'], filters: { userId }, sampleSize: data.filter(d => d.score !== null).length, dateRange: 'all', status: 'OK', data };
}

// ── Career readiness (§27) — delegates to the existing deterministic service ─

export async function careerReadiness(userId: string) {
  // Reuse the existing career readiness endpoint over HTTP-free in-process call:
  // it already computes deterministically (readiness.service). We call the route
  // service layer by loading the role + confidence map exactly like the route does.
  const UserCareerGoal = mongoose.model('UserCareerGoal');
  const goal = await (UserCareerGoal as any).findOne({ userId: new mongoose.Types.ObjectId(userId) }).sort({ updatedAt: -1 }).lean();
  if (!goal?.roleSlug) return EMPTY<Record<string, unknown>>('career_readiness', ['user_career_goals', 'role_skills'], 'all');

  try {
    const { CareerRole } = await import('../career/models/CareerRole');
    const { computeReadiness } = await import('../career/services/readiness.service');
    const role = await (CareerRole as any).findBySlug(goal.roleSlug);
    if (!role) return EMPTY<Record<string, unknown>>('career_readiness', ['user_career_goals', 'career_roles'], 'all');

    const UserSkillProfile = mongoose.model('UserSkillProfile');
    const profile = await (UserSkillProfile as any).findOne({ userId: new mongoose.Types.ObjectId(userId) }).lean();
    const confidence = new Map<string, number>();
    for (const s of (profile?.skills || [])) {
      confidence.set(String(s.slug || s.name || ''), Math.round(Number(s.confidence ?? s.score ?? 0)));
    }

    const readiness = computeReadiness(role, confidence);
    return {
      metricId: 'career_readiness',
      calculationVersion: CALC_VERSION,
      generatedAt: new Date().toISOString(),
      source: ['user_career_goals', 'user_skill_profiles', 'career_roles'],
      filters: { userId, roleSlug: goal.roleSlug },
      sampleSize: readiness.gaps?.length ?? 0,
      dateRange: 'all',
      status: 'OK',
      data: [{
        roleSlug: goal.roleSlug,
        readiness: readiness.readiness,
        gaps: ((readiness.gaps || []) as unknown[]).slice(0, 8),
      }],
    };
  } catch {
    return EMPTY<Record<string, unknown>>('career_readiness', ['user_career_goals', 'career_roles'], 'all');
  }
}

/** Aggregate dashboard payload — one call for the dashboard hero (§6-§8). */
export async function dashboardAnalytics(userId: string) {
  const [tech, coding, interview, learning, ats, readiness] = await Promise.all([
    technicalAccuracyByCategory(userId, '90d'),
    codingPerformance(userId, '90d'),
    interviewScoresOverTime(userId, '90d'),
    learningAnalytics(userId, 'all'),
    atsScoreOverTime(userId),
    careerReadiness(userId),
  ]);

  const lastTech = tech.data.length ? tech.data[0] : null;
  const codingAvg = coding.data.length
    ? Math.round(coding.data.reduce((s, d) => s + d.score, 0) / coding.data.length)
    : null;
  const interviewAvg = interview.data.length
    ? Math.round(interview.data.reduce((s, d) => s + d.score, 0) / interview.data.length)
    : null;
  const atsLatest = ats.data.length ? ats.data[ats.data.length - 1] : null;
  const learningPct = learning.data.length
    ? Math.round(learning.data.reduce((s, d) => s + d.pct, 0) / learning.data.length)
    : null;
  const readinessVal = readiness.data[0]?.readiness ?? null;

  return {
    generatedAt: new Date().toISOString(),
    calculationVersion: CALC_VERSION,
    metrics: {
      technicalAccuracy: lastTech ? {
        value: lastTech.accuracy,
        basis: `${lastTech.correct} correct of ${lastTech.attempted} attempted questions`,
        confidence: tech.confidence, sampleSize: tech.sampleSize,
        topCategory: lastTech.category,
      } : null,
      codingScore: codingAvg !== null ? {
        value: codingAvg,
        basis: `${coding.data.length} submitted problems`,
        confidence: coding.confidence, sampleSize: coding.sampleSize,
      } : null,
      interviewCommunication: interviewAvg !== null ? {
        value: interviewAvg,
        basis: `${interview.data.length} completed interview${interview.data.length === 1 ? '' : 's'}`,
        confidence: interview.confidence, sampleSize: interview.sampleSize,
      } : null,
      resumeQuality: atsLatest ? {
        value: atsLatest.score,
        basis: `Resume “${atsLatest.label}” · last updated ${atsLatest.date}`,
        sampleSize: ats.sampleSize,
      } : null,
      learningProgress: learningPct !== null ? {
        value: learningPct,
        basis: learning.data.map(d => `${d.completed}/${d.total} lessons in ${d.course}`).slice(0, 2).join(', '),
        confidence: learning.confidence, sampleSize: learning.sampleSize,
      } : null,
      careerReadiness: readinessVal !== null ? {
        value: readinessVal,
        basis: readiness.data[0]?.roleSlug
          ? `Skills for target role: ${readiness.data[0].roleSlug}`
          : 'Set a target role to compute readiness',
        sampleSize: readiness.sampleSize,
        gaps: (readiness.data[0]?.gaps as unknown[] | undefined)?.slice(0, 3) ?? [],
      } : null,
    },
    envelopes: { tech, coding, interview, learning, ats, readiness },
  };
}
