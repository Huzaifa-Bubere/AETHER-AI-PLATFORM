import {
  computeRoleProgress,
  isValidRoleSlug,
  loadGoalsByRole,
  loadRoleBySlug,
  type RoleProgress,
} from './roleProgress.service';
import { createSkillEvidenceLookup } from './skillEvidence.service';
import { CareerRole } from '../models/CareerRole';
import { UserCareerGoal } from '../models/UserCareerGoal';
import logger from '../../utils/logger';

/**
 * UserRoleProgressService (spec §29, §32, §93, §101).
 *
 * The one entry point every surface uses to answer "how ready is this candidate
 * for role X". It joins three things that otherwise drift apart:
 *
 *   target goals (which roles, which is primary)
 *   × role definition (the requirement matrix)
 *   × live evidence (the skill profile)
 *
 * The dashboard, the profile, the career pages and the job-fit breakdown all
 * call in here, so they cannot each invent a different percentage.
 */

export interface UserRoleProgressSummary {
  roleSlug: string;
  roleName: string;
  isPrimary: boolean;
  priority: number;
  targetLevel: string;
  status: string;
  /** Null when nothing has been assessed — never 0 for an unassessed role. */
  readiness: number | null;
  met: number;
  belowRequired: number;
  notAssessed: number;
  requirementCount: number;
  nextActions: RoleProgress['nextActions'];
}

export interface UserRoleProgressResult {
  primaryRole: string | null;
  roles: UserRoleProgressSummary[];
  /** Full detail (requirements, category rollup) for one role. */
  detail: Record<string, RoleProgress>;
}

/**
 * Progress for every role the candidate is targeting, primary first.
 * Computes full detail once per role and then projects the summary from it.
 */
export async function getUserRoleProgress(
  userId: string,
  options: { roleSlugs?: string[] } = {},
): Promise<UserRoleProgressResult> {
  const goals = await loadGoalsByRole(userId);

  // No goals yet: fall back to the primary goal query so pre-multi-role
  // documents (which have no isPrimary flag yet) still resolve.
  const targetSlugs =
    options.roleSlugs?.filter(isValidRoleSlug) ??
    [...goals.keys()];

  if (targetSlugs.length === 0) {
    const anyGoal = await UserCareerGoal.findActiveByUser(userId);
    if (anyGoal) targetSlugs.push(anyGoal.roleSlug);
  }

  if (targetSlugs.length === 0) {
    return { primaryRole: null, roles: [], detail: {} };
  }

  const roles = await CareerRole.find({ slug: { $in: targetSlugs }, isActive: { $ne: false } })
    .select('slug name skills')
    .lean();

  // One evidence fetch serves every role — see createSkillEvidenceLookup.
  const lookup = createSkillEvidenceLookup(userId);

  const detail: Record<string, RoleProgress> = {};
  for (const role of roles) {
    try {
      detail[role.slug] = await computeRoleProgress({ role, lookup, goal: goals.get(role.slug) ?? null });
    } catch (error) {
      logger.warn('[roleProgress] failed for role', { role: role.slug, err: (error as Error).message });
    }
  }

  const summaries: UserRoleProgressSummary[] = roles
    .filter(role => detail[role.slug])
    .map(role => {
      const d = detail[role.slug];
      const goal = goals.get(role.slug);
      return {
        roleSlug: d.roleSlug,
        roleName: d.roleName,
        isPrimary: goal?.isPrimary ?? false,
        priority: goal?.priority ?? 0,
        targetLevel: goal?.targetLevel ?? 'JOB_READY',
        status: goal?.status ?? 'ACTIVE',
        readiness: d.readiness,
        met: d.totals.met,
        belowRequired: d.totals.belowRequired,
        notAssessed: d.totals.notAssessed,
        requirementCount: d.totals.requirements,
        nextActions: d.nextActions,
      };
    })
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.priority - b.priority || a.roleName.localeCompare(b.roleName));

  return {
    primaryRole: summaries.find(r => r.isPrimary)?.roleSlug ?? summaries[0]?.roleSlug ?? null,
    roles: summaries,
    detail,
  };
}

/** Full requirement detail for a single role, with live evidence applied. */
export async function getRoleProgress(
  userId: string,
  roleSlug: string,
): Promise<RoleProgress | null> {
  if (!isValidRoleSlug(roleSlug)) return null;
  const role = await loadRoleBySlug(roleSlug);
  if (!role) return null;
  const goals = await loadGoalsByRole(userId);
  const lookup = createSkillEvidenceLookup(userId);
  return computeRoleProgress({
    role: { slug: role.slug, name: role.name, skills: role.skills },
    lookup,
    goal: goals.get(role.slug) ?? null,
  });
}
