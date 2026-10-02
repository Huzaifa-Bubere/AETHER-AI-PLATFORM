import mongoose from 'mongoose';
import {
  FIT_WEIGHTS,
  matchLabelFor,
  TOTAL_FIT_WEIGHT,
  type IJobFitAnalysis,
  type IJobRequirement,
  JobFitAnalysis,
} from '../models/JobFitAnalysis';
import { extractSkills } from '../../career/services/skillExtraction';
import { getSkillProfileSnapshot, type SkillLevelDetail } from '../../career/services/skillEvidence.service';
import { CareerRole, type RequiredLevel } from '../../career/models/CareerRole';
import { ResumeVersion } from '../../models/ResumeVersion';
import AptitudeAttempt from '../../models/AptitudeAttempt';
import AdaptiveInterview from '../../models/AdaptiveInterview';
import { matchJobDescription } from '../../services/atsEngine';
import logger from '../../utils/logger';

/**
 * JobFitService (spec §49–§56).
 *
 * Computes AETHER's JOB REQUIREMENT MATCH for a job description. It is a
 * deterministic weighted score describing alignment between the posting's
 * requirements and the candidate's stored evidence.
 *
 * It is NOT a hiring probability. AETHER has no way to know whether an employer
 * will hire anyone, so no output here is phrased as a chance of being hired.
 *
 * Every component is returned with its basis string, so each point of the score
 * is traceable back to real evidence (spec §56).
 */

export const JOB_FIT_CALCULATION_VERSION = '1.0';

interface ParsedRequirements {
  requirements: IJobRequirement[];
  requiredSkills: string[];
  preferredSkills: string[];
}

const REQUIRED_HINTS = /\b(required|must have|must be|you have|we require|essential|minimum)\b/i;
const PREFERRED_HINTS = /\b(preferred|nice to have|bonus|plus|desirable|ideally|good to have)\b/i;

/**
 * Split a job description into required vs preferred requirements, using the
 * surrounding sentence for context. Deterministic — no AI decides what is
 * required.
 */
export async function parseJobRequirements(text: string, roleSlug?: string | null): Promise<ParsedRequirements> {
  const haystack = String(text ?? '');
  const lines = haystack
    .split(/\r?\n/)
    .map(l => l.replace(/^\s*[-*•·‣▪●]\s*/, '').replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(l => l.length >= 3 && l.length <= 300);

  // Section headers tell us how to read the bullets that follow them.
  let section: 'required' | 'preferred' | 'unknown' = 'unknown';
  const candidates: Array<{ label: string; importance: 'REQUIRED' | 'PREFERRED' }> = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/^(requirements?|must haves?|required qualifications?|minimum qualifications|what you.ll need)\b/.test(lower)) {
      section = 'required';
      continue;
    }
    if (/^(preferred|nice to haves?|bonus|good to have|desirable)\b/.test(lower)) {
      section = 'preferred';
      continue;
    }
    if (/^(responsibilities|about the role|what you.ll do|job description)\b/.test(lower)) {
      section = 'unknown';
      continue;
    }
    if (line.length < 4) continue;

    let importance: 'REQUIRED' | 'PREFERRED';
    if (REQUIRED_HINTS.test(line)) importance = 'REQUIRED';
    else if (PREFERRED_HINTS.test(line)) importance = 'PREFERRED';
    else if (section !== 'unknown') importance = section === 'preferred' ? 'PREFERRED' : 'REQUIRED';
    else continue; // no signal → not a requirement

    candidates.push({ label: line, importance });
  }

  // Deterministic skill dictionary extraction across the whole description.
  const { skills } = extractSkills(haystack);

  // Map canonical skills onto their most specific stated requirement line.
  const requirements: IJobRequirement[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const { skills: lineSkills } = extractSkills(candidate.label);
    const skillSlug = lineSkills[0] ?? null;
    // Skip duplicates of the same skill; keep the most important occurrence.
    const dedupeKey = skillSlug ?? candidate.label.toLowerCase();
    if (seen.has(dedupeKey)) {
      const existing = requirements.find(r => (r.skillSlug ?? r.label.toLowerCase()) === dedupeKey);
      if (existing && existing.importance === 'PREFERRED' && candidate.importance === 'REQUIRED') {
        existing.importance = 'REQUIRED';
      }
      continue;
    }
    seen.add(dedupeKey);
    requirements.push({
      skillSlug,
      label: candidate.label,
      importance: candidate.importance,
      evidenceStatus: 'NOT_EVIDENCED',
      currentLevel: null,
      currentLevelLabel: null,
      learningTopicSlug: null,
    });
  }

  // Any canonical skill mentioned in the description but not in a bullet still
  // counts as a requirement of the role.
  for (const slug of skills) {
    if (requirements.some(r => r.skillSlug === slug)) continue;
    requirements.push({
      skillSlug: slug,
      label: slug,
      importance: 'REQUIRED',
      evidenceStatus: 'NOT_EVIDENCED',
      currentLevel: null,
      currentLevelLabel: null,
      learningTopicSlug: null,
    });
  }

  // Attach the learning link from the target role's requirement matrix, so a
  // missing skill can route to a real lesson (spec §41, §76).
  if (roleSlug) {
    const role = await CareerRole.findOne({ slug: roleSlug.toLowerCase() }).select('skills').lean();
    const bySlug = new Map<string, { learningTopicSlug?: string }>(
      ((role as any)?.skills ?? []).map((s: any) => [s.skillSlug, s]),
    );
    for (const requirement of requirements) {
      const match = requirement.skillSlug ? bySlug.get(requirement.skillSlug) : undefined;
      if (match?.learningTopicSlug) requirement.learningTopicSlug = match.learningTopicSlug;
    }
  }

  return {
    requirements,
    requiredSkills: requirements.filter(r => r.importance === 'REQUIRED' && r.skillSlug).map(r => r.skillSlug!),
    preferredSkills: requirements.filter(r => r.importance === 'PREFERRED' && r.skillSlug).map(r => r.skillSlug!),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface AnalyzeJobFitInput {
  userId: string;
  jobDescriptionText: string;
  jobId?: string | null;
  roleSlug?: string | null;
  resumeVersionId?: string | null;
}

/**
 * Run the full analysis and persist it so the same JD can be re-scored later
 * without re-running every lookup.
 */
export async function analyzeJobFit(input: AnalyzeJobFitInput): Promise<IJobFitAnalysis> {
  const userId = input.userId;
  const parsed = await parseJobRequirements(input.jobDescriptionText, input.roleSlug);

  const [skillsSnapshot, resumeVersions, attempts, interviews] = await Promise.all([
    getSkillProfileSnapshot(userId).catch(() => ({ userId, skills: [] as SkillLevelDetail[], calculatedFrom: 'user_skill_profile', totalEvidenced: 0 })),
    ResumeVersion.find({ userId: new mongoose.Types.ObjectId(userId) })
      .select('name data targetRoleSlug atsScore isDefault')
      .lean()
      .catch(() => []),
    AptitudeAttempt.find({ user: userId, status: 'completed' })
      .select('scorePercent accuracyPercent roundType')
      .lean()
      .catch(() => []),
    AdaptiveInterview.find({ userId, status: 'completed' })
      .select('roleSlug report.overallScore')
      .lean()
      .catch(() => []),
  ]);

  const skillBySlug = new Map(skillsSnapshot.skills.map(s => [s.skillSlug, s]));

  // ── Mark each requirement evidenced or not ─────────────────────────────────
  for (const requirement of parsed.requirements) {
    const detail = requirement.skillSlug ? skillBySlug.get(requirement.skillSlug) : undefined;
    if (detail) {
      requirement.evidenceStatus = 'EVIDENCED';
      requirement.currentLevel = detail.level;
      requirement.currentLevelLabel = detail.levelLabel;
    } else {
      // NOT_ASSESSED / no evidence — deliberately NOT "the candidate lacks it".
      requirement.evidenceStatus = 'NOT_EVIDENCED';
      requirement.currentLevel = null;
      requirement.currentLevelLabel = null;
    }
  }

  const matched = parsed.requirements.filter(r => r.evidenceStatus === 'EVIDENCED');
  const missing = parsed.requirements.filter(r => r.evidenceStatus === 'NOT_EVIDENCED');

  // ── Component 1: required skill coverage (weight 30) ───────────────────────
  const requiredList = parsed.requirements.filter(r => r.importance === 'REQUIRED');
  let requiredCoverage: number | null = null;
  let requiredBasis = 'No required skills could be extracted from this description.';
  if (requiredList.length > 0) {
    // Depth-aware: an evidenced skill at level 4 counts for more than one at 1.
    const depth = requiredList.reduce((sum, r) => sum + (r.currentLevel ?? 0) / REQUIRED_LEVEL_TARGET, 0);
    requiredCoverage = clamp(depth / requiredList.length, 0, 1) * FIT_WEIGHTS.REQUIRED_SKILL_COVERAGE;
    requiredBasis = `${matched.filter(r => r.importance === 'REQUIRED').length} of ${requiredList.length} required skills evidenced`;
  }

  // ── Component 2: semantic resume ↔ JD match (weight 15) ───────────────────
  const chosenResume = input.resumeVersionId
    ? resumeVersions.find((v: any) => String(v._id) === input.resumeVersionId)
    : resumeVersions.find((v: any) => v.isDefault) ?? resumeVersions[0];

  let resumeEarned: number | null = null;
  let resumeBasis = 'No resume version saved, so no document comparison was possible.';
  if (chosenResume) {
    // Reuse the existing deterministic ATS ↔ JD matcher.
    const match = matchJobDescription((chosenResume as any).data ?? {}, input.jobDescriptionText);
    const score01 = typeof match?.matchScore === 'number' ? clamp(match.matchScore, 0, 1) : null;
    if (score01 !== null) {
      resumeEarned = score01 * FIT_WEIGHTS.SEMANTIC_RESUME_JD_MATCH;
      resumeBasis =
        `Resume “${(chosenResume as any).name}” matched ${match.matchedKeywords?.length ?? 0} JD keyword(s)` +
        (match.missingKeywords?.length ? `, missed ${match.missingKeywords.length}` : '');
    } else {
      resumeEarned = 0;
      resumeBasis = `Resume “${(chosenResume as any).name}” could not be compared`;
    }
  }

  // ── Component 3: experience / project evidence (weight 15) ─────────────────
  const projectSkills = skillsSnapshot.skills.filter(s => s.evidence.project !== null).length;
  const experienceEarned = skillsSnapshot.totalEvidenced === 0
    ? null
    : clamp((projectSkills / Math.max(parsed.requirements.length, 1)), 0, 1) * FIT_WEIGHTS.EXPERIENCE_PROJECT_EVIDENCE;
  const experienceBasis =
    skillsSnapshot.totalEvidenced === 0
      ? 'No skill has any project or resume evidence yet.'
      : `${projectSkills} evidenced skill(s) backed by project or resume evidence`;

  // ── Component 4: skill profile alignment (weight 15) ───────────────────────
  const alignment = requiredList.length
    ? clamp(matched.length / requiredList.length, 0, 1) * FIT_WEIGHTS.SKILL_PROFILE_ALIGNMENT
    : null;
  const alignmentBasis = requiredList.length
    ? `${matched.length} of ${requiredList.length} required skills present in your skill profile`
    : 'No required skills could be extracted.';

  // ── Component 5: assessment evidence (weight 10) ───────────────────────────
  const assessed = attempts.filter(a => typeof a.scorePercent === 'number');
  const assessmentEarned = assessed.length
    ? clamp(assessed.reduce((s, a) => s + (a.scorePercent ?? 0), 0) / assessed.length / 100, 0, 1) *
      FIT_WEIGHTS.ASSESSMENT_EVIDENCE
    : null;
  const assessmentBasis = assessed.length
    ? `Average ${Math.round(assessed.reduce((s, a) => s + (a.scorePercent ?? 0), 0) / assessed.length)}% across ${assessed.length} completed assessment(s)`
    : 'No completed assessment to draw on.';

  // ── Component 6: interview role evidence (weight 5) ────────────────────────
  const roleInterviews = input.roleSlug ? interviews.filter((i: any) => i.roleSlug === input.roleSlug) : interviews;
  const scored = roleInterviews.filter((i: any) => typeof i.report?.overallScore === 'number');
  const interviewEarned = scored.length
    ? clamp(scored.reduce((s, i) => s + (i.report.overallScore as number), 0) / scored.length / 100, 0, 1) *
      FIT_WEIGHTS.INTERVIEW_ROLE_EVIDENCE
    : null;
  const interviewBasis = scored.length
    ? `Average interview score ${Math.round(scored.reduce((s, i) => s + (i.report.overallScore as number), 0) / scored.length)}% across ${scored.length} interview(s)`
    : 'No completed interview for this role.';

  // ── Components 7 & 8 are deliberately conservative ─────────────────────────
  // Education and work preference are only credited when actually stated, so
  // these never inflate a score on the candidate's behalf.
  const educationEarned: number | null = null;
  const educationBasis = 'Not evaluated — AETHER does not infer qualifications from a job description.';
  const eligibilityEarned: number | null = null;
  const eligibilityBasis = 'Not evaluated — location and work-mode eligibility are shown for you to check.';

  const components = [
    { key: 'REQUIRED_SKILL_COVERAGE' as const, label: 'Required skill coverage', weight: FIT_WEIGHTS.REQUIRED_SKILL_COVERAGE, earned: requiredCoverage, basis: requiredBasis, sampleSize: requiredList.length },
    { key: 'SEMANTIC_RESUME_JD_MATCH' as const, label: 'Resume ↔ job description match', weight: FIT_WEIGHTS.SEMANTIC_RESUME_JD_MATCH, earned: resumeEarned, basis: resumeBasis, sampleSize: chosenResume ? 1 : 0 },
    { key: 'EXPERIENCE_PROJECT_EVIDENCE' as const, label: 'Experience & project evidence', weight: FIT_WEIGHTS.EXPERIENCE_PROJECT_EVIDENCE, earned: experienceEarned, basis: experienceBasis, sampleSize: skillsSnapshot.totalEvidenced },
    { key: 'SKILL_PROFILE_ALIGNMENT' as const, label: 'Skill profile alignment', weight: FIT_WEIGHTS.SKILL_PROFILE_ALIGNMENT, earned: alignment, basis: alignmentBasis, sampleSize: requiredList.length },
    { key: 'ASSESSMENT_EVIDENCE' as const, label: 'Assessment evidence', weight: FIT_WEIGHTS.ASSESSMENT_EVIDENCE, earned: assessmentEarned, basis: assessmentBasis, sampleSize: assessed.length },
    { key: 'INTERVIEW_ROLE_EVIDENCE' as const, label: 'Interview role evidence', weight: FIT_WEIGHTS.INTERVIEW_ROLE_EVIDENCE, earned: interviewEarned, basis: interviewBasis, sampleSize: scored.length },
    { key: 'EDUCATION_CERTIFICATION' as const, label: 'Education & certification', weight: FIT_WEIGHTS.EDUCATION_CERTIFICATION, earned: educationEarned, basis: educationBasis, sampleSize: 0 },
    { key: 'ELIGIBILITY_WORK_PREFERENCE' as const, label: 'Eligibility & work preference', weight: FIT_WEIGHTS.ELIGIBILITY_WORK_PREFERENCE, earned: eligibilityEarned, basis: eligibilityBasis, sampleSize: 0 },
  ];

  // Components that could not be evaluated earn nothing and are excluded from
  // the denominator — scoring 0/5 for "we have no data" would understate a
  // candidate whose profile is simply incomplete in an unrelated area.
  const evaluable = components.filter(c => c.earned !== null);
  const earnedTotal = evaluable.reduce((sum, c) => sum + (c.earned as number), 0);
  const weightTotal = evaluable.reduce((sum, c) => sum + c.weight, 0);
  const score = weightTotal > 0 ? clamp(Math.round((earnedTotal / weightTotal) * TOTAL_FIT_WEIGHT), 0, 100) : null;

  // ── Next actions ───────────────────────────────────────────────────────────
  const nextActions = missing
    .slice(0, 5)
    .map(requirement => ({
      title: requirement.skillSlug ? `Learn ${requirement.label}` : `Evidence ${requirement.label}`,
      reason: requirement.importance === 'REQUIRED'
        ? 'Listed as required by this job, with no evidence on your profile yet.'
        : 'Preferred by this job, with no evidence on your profile yet.',
      learningTopicSlug: requirement.learningTopicSlug,
    }));

  // ── Recommended resume version (spec §84) ──────────────────────────────────
  // Highest ATS score among versions, preferring one already aimed at this role.
  let recommendedResumeVersionId: mongoose.Types.ObjectId | null = null;
  let recommendedResumeReason: string | null = null;
  if (resumeVersions.length > 0) {
    const scored2 = [...resumeVersions]
      .filter((v: any) => typeof v.atsScore === 'number')
      .sort((a: any, b: any) => {
        const aRoleMatch = a.targetRoleSlug && a.targetRoleSlug === input.roleSlug ? 1 : 0;
        const bRoleMatch = b.targetRoleSlug && b.targetRoleSlug === input.roleSlug ? 1 : 0;
        if (aRoleMatch !== bRoleMatch) return bRoleMatch - aRoleMatch;
        return (b.atsScore ?? 0) - (a.atsScore ?? 0);
      });
    const best = scored2[0] ?? resumeVersions[0];
    recommendedResumeVersionId = (best as any)._id;
    recommendedResumeReason =
      (best as any).targetRoleSlug && (best as any).targetRoleSlug === input.roleSlug
        ? `“${(best as any).name}” is already targeted at this role.`
        : `“${(best as any).name}” has your highest ATS score (${(best as any).atsScore ?? 'unscored'}/100).`;
  }

  const analysis = await JobFitAnalysis.create({
    userId: new mongoose.Types.ObjectId(userId),
    jobId: input.jobId ? new mongoose.Types.ObjectId(input.jobId) : null,
    jobDescriptionText: input.jobDescriptionText,
    roleSlug: input.roleSlug ?? null,
    resumeVersionId: input.resumeVersionId ? new mongoose.Types.ObjectId(input.resumeVersionId) : null,
    score,
    label: score === null ? null : matchLabelFor(score),
    components,
    requirements: parsed.requirements,
    matchedRequirements: matched.map(r => r.label),
    missingRequirements: missing.map(r => r.label),
    nextActions,
    recommendedResumeVersionId,
    recommendedResumeReason,
    calculationVersion: JOB_FIT_CALCULATION_VERSION,
    computedAt: new Date(),
  });

  logger.info(`[jobFit] analysed for user ${userId}: ${score ?? 'n/a'}`);
  return analysis;
}

/**
 * Score against a stored posting, using the posting's own description.
 * Returns null when the posting no longer exists.
 */
export async function analyzeStoredJob(
  userId: string,
  jobId: string,
  roleSlug?: string | null,
): Promise<IJobFitAnalysis | null> {
  const { JobPosting } = await import('../models/JobPosting');
  const posting = await JobPosting.findById(jobId).select('description roleIds');
  if (!posting) return null;

  return analyzeJobFit({
    userId,
    jobDescriptionText: [posting.description, ...(posting.requirements ?? [])].join('\n'),
    jobId,
    // Use the posting's own classification when the caller did not pick a role.
    roleSlug: roleSlug ?? posting.roleIds?.[0] ?? null,
  });
}

/** How well a posting matches the candidate, for the optional match badge. */
export async function previewFitForJob(
  userId: string,
  jobId: string,
): Promise<{ score: number | null; label: string | null } | null> {
  const latest = await JobFitAnalysis.findLatestFor(userId, jobId);
  if (!latest) return null;
  return { score: latest.score, label: latest.label };
}

const REQUIRED_LEVEL_TARGET: RequiredLevel = 3; // Job-ready depth for a required skill.