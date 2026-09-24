import { Course, LearningProgress } from '../models/Course';
import { UserCareerGoal } from '../models/UserCareerGoal';
import { confidenceMap } from './skillProfile.service';
import { GAP_THRESHOLD } from './readiness.service';
import logger from '../../utils/logger';

/**
 * AETHER Career Learning — explainable course recommender (spec §49, §67).
 *
 * Deterministic pipeline: goal role → skill gaps (evidence-based confidence) →
 * matching published courses → prerequisite check → ranked recommendations.
 * Every recommendation carries explicit, data-derived REASONS. No AI scores.
 */

export interface ICourseRecommendation {
  courseSlug: string;
  title: string;
  description: string;
  difficulty: string;
  estimatedHours: number;
  matchedSkillSlugs: string[];
  /** skillSlugs of this course where the user is below the gap threshold */
  gapSkillSlugs: string[];
  prereqsComplete: boolean;
  missingPrereqTitles: string[];
  reasons: string[];
  /** highest = learn sooner (documented formula below) */
  priorityScore: number;
}

export async function buildCourseRecommendations(userId: string): Promise<{
  roleSlug: string | null;
  recommendations: ICourseRecommendation[];
  note: string;
}> {
  const goal = await UserCareerGoal.findActiveByUser(userId);
  if (!goal) {
    return {
      roleSlug: null,
      recommendations: [],
      note: 'Set a target role in Career Learning to get personalized recommendations.',
    };
  }

  const roleSlug = goal.roleSlug;
  const conf = await confidenceMap(userId);

  // All published courses for this role.
  const courses = await Course.find({ roleSlugs: roleSlug, status: 'published' }).lean();
  if (courses.length === 0) {
    return { roleSlug, recommendations: [], note: 'No courses published for this role yet.' };
  }

  // Prerequisite lookup by course slug.
  const bySlug = new Map(courses.map((c: any) => [c.slug, c]));
  const completedCourses = new Set(
    (await LearningProgress.find({ userId }).lean())
      .filter((p: any) => p.lessons.some((l: any) => l.state === 'COMPLETED'))
      .map((p: any) => p.courseSlug)
  );

  const recommendations: ICourseRecommendation[] = [];
  for (const c of courses as any[]) {
    const gapSkills = (c.skillSlugs || []).filter((s: string) => (conf.get(s)?.confidence ?? 0) < GAP_THRESHOLD);
    const matchedSkills = (c.skillSlugs || []).filter((s: string) => (conf.get(s)?.confidence ?? 0) >= GAP_THRESHOLD);
    const missingPrereqs = (c.prerequisites || []).filter((p: string) => !completedCourses.has(p));

    // Reasons (spec §67 — explainable recommendations).
    const reasons: string[] = [];
    if (gapSkills.length > 0) {
      reasons.push(`Your ${roleSlug.replace(/-/g, ' ')} target role requires ${c.skillSlugs.join(', ')}; ${gapSkills.join(', ')} ${gapSkills.length === 1 ? 'is' : 'are'} below the readiness threshold.`);
    }
    if (!matchedSkills.length && (c.skillSlugs || []).length) {
      reasons.push('None of the skills in this course have assessment evidence yet — a good first course.');
    }
    if (reasons.length === 0) {
      reasons.push('Reinforces skills for your target role — review to strengthen mastery.');
    }
    if (missingPrereqs.length > 0) {
      reasons.push(`Prerequisite not finished: ${missingPrereqs.join(', ')}.`);
    }

    // Priority score (deterministic, documented):
    //   gapWeight = (# gap skills / # skills) × 3
    //   prereqReady = 1.0 when complete, else 0.4
    //   priorityScore = gapWeight × prereqReady
    const skillsTotal = (c.skillSlugs || []).length || 1;
    const gapWeight = (gapSkills.length / skillsTotal) * 3;
    const prereqReady = missingPrereqs.length === 0 ? 1 : 0.4;
    recommendations.push({
      courseSlug: c.slug,
      title: c.title,
      description: c.description,
      difficulty: c.difficulty,
      estimatedHours: c.estimatedHours,
      matchedSkillSlugs: c.skillSlugs || [],
      gapSkillSlugs: gapSkills,
      prereqsComplete: missingPrereqs.length === 0,
      missingPrereqTitles: missingPrereqs,
      reasons,
      priorityScore: Math.round(gapWeight * prereqReady * 100) / 100,
    });
  }

  recommendations.sort((a, b) => b.priorityScore - a.priorityScore || a.estimatedHours - b.estimatedHours);

  logger.debug(`courseRecommendations: user=${userId} role=${roleSlug} count=${recommendations.length}`);
  return {
    roleSlug,
    recommendations: recommendations.slice(0, 6),
    note: 'Recommendations come from your skill profile evidence (resume, assessments, coding, interview, learning) and your target role requirements.',
  };
}
