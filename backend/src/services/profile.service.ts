import mongoose from 'mongoose';
import User from '../models/User';
import { getUserRoleProgress } from '../career/services/userRoleProgress.service';
import { getSkillProfileSnapshot } from '../career/services/skillEvidence.service';
import { getStreak, getStreakSummary, type StreakResult } from './streak.service';
import { getActivityTimeline } from './activity.service';
import { ResumeVersion } from '../models/ResumeVersion';
import logger from '../utils/logger';

/**
 * ProfileService (spec §24–§28, §93).
 *
 * Assembles the professional profile from the SAME services the dashboard uses,
 * so "Backend Developer 74%" and the evidenced skill levels are identical on
 * both pages rather than recomputed in React.
 *
 * Completeness is DETERMINISTIC: it counts which fields are filled in and
 * lists exactly what is missing. It is never inferred or generated.
 */

/**
 * Each field contributes one point. Completeness is the share that is filled.
 * Weighting is uniform on purpose — a score that quietly favours a field the
 * candidate has not heard of is not an honest measure.
 */
export interface CompletenessField {
  key: string;
  label: string;
  filled: boolean;
  href?: string;
}

export interface ProfileCompleteness {
  /** 0–100, an integer. */
  score: number;
  filledFields: number;
  totalFields: number;
  /** Fields the candidate still needs to fill in, as actionable labels. */
  missing: string[];
  fields: CompletenessField[];
}

export async function getProfileCompleteness(
  userId: string,
  profile: Record<string, any> | undefined,
): Promise<ProfileCompleteness> {
  const hasResumeVersion = (await ResumeVersion.countDocuments({ userId })) > 0;

  const fields: CompletenessField[] = [
    { key: 'headline', label: 'Professional headline', filled: Boolean(profile?.headline?.trim()) },
    { key: 'about', label: 'Professional summary', filled: Boolean(profile?.about?.trim()) },
    { key: 'location', label: 'Location', filled: Boolean(profile?.location?.trim()) },
    { key: 'experience', label: 'Work experience', filled: (profile?.experience?.length ?? 0) > 0, href: '/profile' },
    { key: 'education', label: 'Education', filled: (profile?.education?.length ?? 0) > 0, href: '/profile' },
    { key: 'projects', label: 'Projects', filled: (profile?.projects?.length ?? 0) > 0, href: '/profile' },
    { key: 'certifications', label: 'Certifications', filled: (profile?.certifications?.length ?? 0) > 0, href: '/profile' },
    { key: 'links', label: 'GitHub or portfolio link', filled: Boolean(profile?.links?.github?.trim() || profile?.links?.portfolio?.trim()) },
    { key: 'resume', label: 'Saved resume version', filled: hasResumeVersion, href: '/resume-builder' },
  ];

  const filledFields = fields.filter(f => f.filled).length;
  return {
    score: Math.round((filledFields / fields.length) * 100),
    filledFields,
    totalFields: fields.length,
    missing: fields.filter(f => !f.filled).map(f => f.label),
    fields,
  };
}

export interface ProfessionalProfile {
  user: {
    firstName: string;
    lastName: string;
    fullName: string;
    headline: string;
    about: string;
    avatar: string;
    coverImage: string;
    location: string;
    phone: string;
    email: string;
    openToWork: boolean;
    openToWorkRoles: string[];
    links: { github: string; linkedin: string; portfolio: string };
    experience: any[];
    education: any[];
    projects: any[];
    certifications: any[];
    achievements: string[];
  };
  completeness: ProfileCompleteness;
  targetRoles: Awaited<ReturnType<typeof getUserRoleProgress>>['roles'];
  roleProgress: Awaited<ReturnType<typeof getUserRoleProgress>>;
  skills: Awaited<ReturnType<typeof getSkillProfileSnapshot>>;
  streak: Pick<StreakResult, 'currentStreak' | 'longestStreak' | 'activeDays' | 'timezone'> | null;
  heatmap: Awaited<ReturnType<typeof getStreak>> | null;
  activity: Awaited<ReturnType<typeof getActivityTimeline>>;
  resumes: Array<{ id: string; name: string; atsScore: number | null; targetRoleSlug?: string; isDefault: boolean; updatedAt: string }>;
}

/**
 * Everything the /profile page renders, in one call — the same one-request
 * discipline the dashboard follows (spec §14).
 */
export async function getProfessionalProfile(userId: string): Promise<ProfessionalProfile> {
  const oid = new mongoose.Types.ObjectId(userId);

  const [user, roleProgress, skills, streak, heatmap, activity, resumeVersions] = await Promise.all([
    User.findById(oid).select('email profile').lean(),
    getUserRoleProgress(userId).catch(err => {
      logger.warn('[profile] roleProgress failed', { err: (err as Error).message });
      return { primaryRole: null, roles: [], detail: {} };
    }),
    getSkillProfileSnapshot(userId).catch(() => ({ userId, skills: [], calculatedFrom: 'user_skill_profile', totalEvidenced: 0 })),
    getStreakSummary(userId).catch(() => null),
    getStreak(userId).catch(() => null),
    getActivityTimeline(userId, { limit: 15 }).catch(() => null),
    ResumeVersion.find({ userId: oid })
      .select('name atsScore targetRoleSlug isDefault updatedAt')
      .sort({ isDefault: -1, updatedAt: -1 })
      .lean()
      .catch(() => []),
  ]);

  const p = (user as any)?.profile ?? {};
  const completeness = await getProfileCompleteness(userId, p);

  return {
    user: {
      firstName: p.firstName ?? '',
      lastName: p.lastName ?? '',
      fullName: [p.firstName, p.lastName].filter(Boolean).join(' ').trim(),
      headline: p.headline ?? '',
      about: p.about ?? '',
      avatar: p.avatar ?? '',
      coverImage: p.coverImage ?? '',
      location: p.location ?? '',
      phone: p.phone ?? '',
      email: (user as any)?.email ?? '',
      openToWork: Boolean(p.openToWork),
      openToWorkRoles: p.openToWorkRoles ?? [],
      links: {
        github: p.links?.github ?? '',
        linkedin: p.links?.linkedin ?? '',
        portfolio: p.links?.portfolio ?? '',
      },
      experience: p.experience ?? [],
      education: p.education ?? [],
      projects: p.projects ?? [],
      certifications: p.certifications ?? [],
      achievements: p.achievements ?? [],
    },
    completeness,
    targetRoles: roleProgress.roles,
    roleProgress,
    skills,
    streak,
    heatmap,
    activity,
    resumes: resumeVersions.map((v: any) => ({
      id: String(v._id),
      name: v.name,
      atsScore: typeof v.atsScore === 'number' ? v.atsScore : null,
      targetRoleSlug: v.targetRoleSlug || undefined,
      isDefault: Boolean(v.isDefault),
      updatedAt: new Date(v.updatedAt).toISOString(),
    })),
  };
}