import { apiService } from './api';
import type { StreakSummary } from './activity';
import type { RoleProgress, RoleProgressSummary, SkillLevelDetail } from './roleProgress';
import type { ActivityTimeline } from './activity';

/** Professional profile client (spec §24–§28). One request, shared services. */

export interface CompletenessField {
  key: string;
  label: string;
  filled: boolean;
  href?: string;
}

export interface ProfileCompleteness {
  score: number;
  filledFields: number;
  totalFields: number;
  missing: string[];
  fields: CompletenessField[];
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
    experience: Array<{
      title: string; company: string; location?: string; employmentType?: string;
      startDate?: string; endDate?: string; current?: boolean; description?: string;
    }>;
    education: Array<{
      degree: string; institution: string; startYear?: number; endYear?: number;
      grade?: string; description?: string;
    }>;
    projects: Array<{ name: string; description?: string; link?: string; technologies?: string[] }>;
    certifications: Array<{ name: string; issuer?: string; issuedOn?: string; credentialId?: string }>;
    achievements: string[];
  };
  completeness: ProfileCompleteness;
  targetRoles: RoleProgressSummary[];
  roleProgress: { primaryRole: string | null; roles: RoleProgressSummary[]; detail: Record<string, RoleProgress> };
  skills: { skills: SkillLevelDetail[]; totalEvidenced: number };
  streak: StreakSummary | null;
  heatmap: StreakSummary | null;
  activity: ActivityTimeline;
  resumes: Array<{ id: string; name: string; atsScore: number | null; targetRoleSlug?: string; isDefault: boolean; updatedAt: string }>;
}

export async function fetchProfessionalProfile(): Promise<ProfessionalProfile> {
  const response = await apiService.get<ProfessionalProfile>('/profile/me');
  if (!response.success || !response.data) {
    // `error` is the field apiService populates for a failed response; `message`
    // is only present on some server errors. Reading `message` alone discarded
    // the real reason (e.g. "Insufficient permissions") behind a generic string.
    throw new Error(response.error || response.message || 'Could not load your profile.');
  }
  return response.data;
}