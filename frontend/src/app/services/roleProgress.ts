import { apiService } from './api';

/**
 * Multi-role goals, requirement matrix and skill evidence (spec §29–§41, §90).
 *
 * Thin client over the backend services that own the calculations. The
 * dashboard, the profile and the career pages all read through this, so the
 * same "Backend Developer 74%" is never computed twice in React (spec §93).
 */

export type RequirementStatus = 'MET' | 'BELOW_REQUIRED' | 'NOT_ASSESSED';

export interface EvidenceDetail {
  /** Null when this source said nothing — never 0 (spec §87). */
  score: number | null;
  note?: string;
}

export interface EvidenceSummary {
  resume: EvidenceDetail | null;
  technical: EvidenceDetail | null;
  coding: EvidenceDetail | null;
  interview: EvidenceDetail | null;
  learning: EvidenceDetail | null;
  project: EvidenceDetail | null;
  selfDeclared: EvidenceDetail | null;
}

export interface RequirementProgress {
  skillSlug: string;
  name: string;
  category: string;
  priority: 'ESSENTIAL' | 'RECOMMENDED' | 'BONUS' | 'OPTIONAL';
  weight: number;
  requiredLevel: number;
  requiredLevelLabel: string;
  currentLevel: number | null;
  currentLevelLabel: string | null;
  status: RequirementStatus;
  coverage: number | null;
  learningTopicSlug: string | null;
  evidence: EvidenceSummary;
}

export interface CategoryRollup {
  category: string;
  coverage: number | null;
  requirementCount: number;
  metCount: number;
  notAssessedCount: number;
}

export interface RoleProgress {
  roleSlug: string;
  roleName: string;
  /** Null when nothing has been assessed — not 0. */
  readiness: number | null;
  requirements: RequirementProgress[];
  categoryRollup: CategoryRollup[];
  totals: { requirements: number; met: number; belowRequired: number; notAssessed: number };
  nextActions: Array<{ skillSlug: string; name: string; reason: string; learningTopicSlug: string | null }>;
  goal: {
    isPrimary: boolean;
    priority: number;
    targetLevel: string;
    status: string;
    roadmapProgress: number;
  } | null;
  calculationVersion: string;
  computedAt: string;
}

export interface RoleGoal {
  roleSlug: string;
  roleName: string;
  isPrimary: boolean;
  priority: number;
  targetLevel: string;
  status: string;
  roadmapProgress: number;
  hoursPerWeek: number;
  experienceLevel: string;
  requirementCount: number;
}

export interface RoleProgressSummary {
  roleSlug: string;
  roleName: string;
  isPrimary: boolean;
  priority: number;
  readiness: number | null;
  met: number;
  belowRequired: number;
  notAssessed: number;
  requirementCount: number;
  nextActions: RoleProgress['nextActions'];
}

export interface UserRoleProgress {
  primaryRole: string | null;
  roles: RoleProgressSummary[];
  detail: Record<string, RoleProgress>;
}

export interface SkillLevelDetail {
  skillSlug: string;
  level: number;
  levelLabel: string;
  confidence: number;
  bestEvidence: string;
  evidence: EvidenceSummary;
}

function unwrap<T>(response: { success: boolean; data?: T; message?: string; error?: string }): T {
  if (!response.success || response.data === undefined) {
    throw new Error(response.message || response.error || 'Request failed');
  }
  return response.data;
}

export async function fetchRoleGoals(): Promise<RoleGoal[]> {
  return unwrap(await apiService.get<RoleGoal[]>('/careers/me/goals'));
}

export async function addRoleGoal(input: {
  roleSlug: string;
  isPrimary?: boolean;
  targetLevel?: string;
  hoursPerWeek?: number;
}): Promise<RoleGoal> {
  return unwrap(await apiService.post<RoleGoal>('/careers/me/goals', input));
}

export async function updateRoleGoal(roleSlug: string, input: Record<string, unknown>): Promise<RoleGoal> {
  return unwrap(await apiService.patch<RoleGoal>(`/careers/me/goals/${roleSlug}`, input));
}

export async function setPrimaryRole(roleSlug: string): Promise<RoleGoal[]> {
  return unwrap(await apiService.post<RoleGoal[]>(`/careers/me/goals/${roleSlug}/primary`));
}

export async function archiveRoleGoal(roleSlug: string): Promise<RoleGoal[]> {
  return unwrap(await apiService.delete<RoleGoal[]>(`/careers/me/goals/${roleSlug}`));
}

export async function fetchUserRoleProgress(): Promise<UserRoleProgress> {
  return unwrap(await apiService.get<UserRoleProgress>('/careers/me/progress'));
}

export async function fetchRoleRequirements(roleSlug: string): Promise<RoleProgress> {
  return unwrap(await apiService.get<RoleProgress>(`/careers/roles/${roleSlug}/requirements`));
}

export async function fetchResumeVersionsForFit(): Promise<Array<{ id: string; name: string; targetRoleSlug?: string }>> {
  return unwrap(await apiService.get<Array<{ id: string; name: string; targetRoleSlug?: string }>>('/resume/versions'));
}

export async function fetchSkillProfile(rebuild = false): Promise<{ skills: SkillLevelDetail[]; totalEvidenced: number }> {
  return unwrap(
    await apiService.get<{ skills: SkillLevelDetail[]; totalEvidenced: number }>('/careers/me/skills', {
      rebuild: rebuild ? 'true' : undefined,
    }),
  );
}
