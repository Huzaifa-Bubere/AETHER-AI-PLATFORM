import {
  CareerRole,
  ICareerRole,
  IMPORTANCE_WEIGHTS,
  IRoleSkill,
  REQUIRED_LEVEL_LABELS,
  type RequiredLevel,
  type SkillPriority,
} from '../models/CareerRole';

export type { RequiredLevel, SkillPriority } from '../models/CareerRole';
import { UserCareerGoal, IUserCareerGoal } from '../models/UserCareerGoal';

/**
 * RoleProgressService (spec §32, §34–§41, §93, §101).
 *
 * The SINGLE implementation of "how ready is this candidate for this role".
 * The dashboard, the profile, the career pages and the job-fit breakdown all
 * call in here, which is what stops three React pages from each inventing their
 * own percentage.
 *
 * Everything here is derived from stored evidence. A requirement the candidate
 * has never been assessed on is reported as NOT_ASSESSED with a null level —
 * never as 0, because "not assessed" and "assessed and failed" are different
 * facts (spec §87).
 */

export type EvidenceStatus = 'MET' | 'BELOW_REQUIRED' | 'NOT_ASSESSED';

export interface RequirementProgress {
  skillSlug: string;
  name: string;
  category: string;
  priority: SkillPriority;
  weight: number;
  requiredLevel: RequiredLevel;
  requiredLevelLabel: string;
  /** Null when there is no evidence — NOT_ASSESSED, not zero. */
  currentLevel: RequiredLevel | null;
  currentLevelLabel: string | null;
  status: EvidenceStatus;
  /** min(currentLevel / requiredLevel, 1), or null when not assessed. */
  coverage: number | null;
  /** Where the candidate can close this gap. Null when nothing maps to it. */
  learningTopicSlug: string | null;
  /** Which evidence sources produced currentLevel, for the "shows evidence" UI. */
  evidence: EvidenceSummary;
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

export interface EvidenceDetail {
  /** 0–100 within this source, or null when this source said nothing. */
  score: number | null;
  /** Optional free-text backing, e.g. the topic title that was completed. */
  note?: string;
}

/** Injected so the service stays pure and testable without a database. */
export interface SkillEvidenceLookup {
  /** Best evidenced level 1–4 for a skill, or null when unassessed. */
  levelFor(skillSlug: string): Promise<{ level: RequiredLevel; evidence: EvidenceSummary } | null>;
}

const DEFAULT_EVIDENCE: EvidenceSummary = {
  resume: null,
  technical: null,
  coding: null,
  interview: null,
  learning: null,
  project: null,
  selfDeclared: null,
};

export interface RoleRequirementCategoryRollup {
  category: string;
  /** 0–100 across that category's requirements, or null if none assessed. */
  coverage: number | null;
  requirementCount: number;
  metCount: number;
  notAssessedCount: number;
}

export interface RoleProgress {
  roleSlug: string;
  roleName: string;
  /** Overall weighted coverage, 0–100. Null when nothing is assessed yet. */
  readiness: number | null;
  requirements: RequirementProgress[];
  categoryRollup: RoleRequirementCategoryRollup[];
  totals: {
    requirements: number;
    met: number;
    belowRequired: number;
    notAssessed: number;
  };
  /** Highest-weight unmet requirements, best learning targets first. */
  nextActions: Array<{ skillSlug: string; name: string; reason: string; learningTopicSlug: string | null }>;
  /** Set when a goal exists for this role, so the UI can show priority/target. */
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

/**
 * Version of the coverage formula. Bump this if IMPORTANCE_WEIGHTS or the
 * coverage maths ever change, so stored numbers remain interpretable.
 */
export const ROLE_PROGRESS_CALCULATION_VERSION = '1.0';

/**
 * The documented formula (spec §39):
 *
 *   coverage(requirement) = min(userEvidenceLevel / requiredLevel, 1)
 *   roleReadiness         = Σ(weight × coverage) / Σ(weight) × 100
 *
 * A requirement with no evidence contributes 0 to the NUMERATOR but still
 * counts in the DENOMINATOR — an unassessed essential skill genuinely is an
 * unmet requirement, and hiding it would overstate readiness.
 */
export function computeRoleReadiness(requirements: RequirementProgress[]): number | null {
  if (requirements.length === 0) return null;
  let earned = 0;
  let total = 0;
  for (const r of requirements) {
    total += r.weight;
    earned += r.weight * (r.coverage ?? 0);
  }
  if (total === 0) return null;
  return round1((earned / total) * 100);
}

export function buildRequirementProgress(
  requirement: IRoleSkill,
  evidenced: { level: RequiredLevel; evidence: EvidenceSummary } | null,
): RequirementProgress {
  const weight = IMPORTANCE_WEIGHTS[requirement.priority] ?? 1;
  const requiredLevel = requirement.requiredLevel ?? 2;

  if (!evidenced) {
    return {
      skillSlug: requirement.skillSlug,
      name: requirement.name,
      category: requirement.category,
      priority: requirement.priority,
      weight,
      requiredLevel,
      requiredLevelLabel: REQUIRED_LEVEL_LABELS[requiredLevel],
      currentLevel: null,
      currentLevelLabel: null,
      status: 'NOT_ASSESSED',
      coverage: null,
      learningTopicSlug: requirement.learningTopicSlug ?? null,
      evidence: DEFAULT_EVIDENCE,
    };
  }

  const currentLevel = evidenced.level;
  const coverage = Math.min(currentLevel / requiredLevel, 1);

  return {
    skillSlug: requirement.skillSlug,
    name: requirement.name,
    category: requirement.category,
    priority: requirement.priority,
    weight,
    requiredLevel,
    requiredLevelLabel: REQUIRED_LEVEL_LABELS[requiredLevel],
    currentLevel,
    currentLevelLabel: REQUIRED_LEVEL_LABELS[currentLevel],
    status: currentLevel >= requiredLevel ? 'MET' : 'BELOW_REQUIRED',
    // Kept at full precision on purpose: rounding here would bias the weighted
    // sum in computeRoleReadiness (1/3 → 0.33 loses ~1% of the score). Rounding
    // happens once, at the edges, in the display values.
    coverage,
    learningTopicSlug: requirement.learningTopicSlug ?? null,
    evidence: evidenced.evidence ?? DEFAULT_EVIDENCE,
  };
}

/** Requirements worth attacking next: unmet, heaviest weight first. */
export function pickNextActions(requirements: RequirementProgress[], limit = 4): RoleProgress['nextActions'] {
  return requirements
    .filter(r => r.status !== 'MET')
    .sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      // Bigger shortfall first within the same importance band.
      const aGap = a.coverage ?? 0;
      const bGap = b.coverage ?? 0;
      if (aGap !== bGap) return aGap - bGap;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit)
    .map(r => ({
      skillSlug: r.skillSlug,
      name: r.name,
      reason:
        r.status === 'NOT_ASSESSED'
          ? `${r.priority} requirement at ${r.requiredLevelLabel} — not assessed yet`
          : `${r.priority} requirement: ${r.currentLevelLabel} today, needs ${r.requiredLevelLabel}`,
      learningTopicSlug: r.learningTopicSlug,
    }));
}

function rollupByCategory(requirements: RequirementProgress[]): RoleRequirementCategoryRollup[] {
  const byCategory = new Map<string, RequirementProgress[]>();
  for (const r of requirements) {
    const bucket = byCategory.get(r.category);
    if (bucket) bucket.push(r);
    else byCategory.set(r.category, [r]);
  }
  return [...byCategory.entries()].map(([category, items]) => {
    // Same rule as a whole role (spec §87): if nothing in this category has
    // been assessed, its coverage is unknown, not zero. Reporting 0% would
    // claim the candidate failed skills nobody has tested them on.
    const anyAssessed = items.some(r => r.coverage !== null);
    const total = items.reduce((sum, r) => sum + r.weight, 0);
    const earned = items.reduce((sum, r) => sum + r.weight * (r.coverage ?? 0), 0);
    return {
      category,
      coverage: !anyAssessed || total === 0 ? null : round1((earned / total) * 100),
      requirementCount: items.length,
      metCount: items.filter(r => r.status === 'MET').length,
      notAssessedCount: items.filter(r => r.status === 'NOT_ASSESSED').length,
    };
  });
}

/**
 * Compute role progress from an already-loaded role + evidence lookup.
 * Split out from the DB access so the formula is directly unit-testable.
 */
export async function computeRoleProgress(params: {
  role: Pick<ICareerRole, 'slug' | 'name' | 'skills'>;
  lookup: SkillEvidenceLookup;
  goal?: Pick<IUserCareerGoal, 'isPrimary' | 'priority' | 'targetLevel' | 'status' | 'roadmapProgress'> | null;
}): Promise<RoleProgress> {
  const roleSkills = params.role.skills ?? [];
  // Resolved in parallel — the lookup is evidence-backed, so this is real IO.
  const evidenced = await Promise.all(
    roleSkills.map(skill => params.lookup.levelFor(skill.skillSlug).catch(() => null)),
  );
  const requirements = roleSkills.map((skill, i) => buildRequirementProgress(skill, evidenced[i]));

  return {
    roleSlug: params.role.slug,
    roleName: params.role.name,
    readiness: computeRoleReadiness(requirements),
    requirements,
    categoryRollup: rollupByCategory(requirements),
    totals: {
      requirements: requirements.length,
      met: requirements.filter(r => r.status === 'MET').length,
      belowRequired: requirements.filter(r => r.status === 'BELOW_REQUIRED').length,
      notAssessed: requirements.filter(r => r.status === 'NOT_ASSESSED').length,
    },
    nextActions: pickNextActions(requirements),
    goal: params.goal
      ? {
          isPrimary: params.goal.isPrimary,
          priority: params.goal.priority,
          targetLevel: params.goal.targetLevel,
          status: params.goal.status,
          roadmapProgress: params.goal.roadmapProgress,
        }
      : null,
    calculationVersion: ROLE_PROGRESS_CALCULATION_VERSION,
    computedAt: new Date().toISOString(),
  };
}

/** Load every goal a user holds, keyed by role slug. */
export async function loadGoalsByRole(userId: string): Promise<Map<string, IUserCareerGoal>> {
  const goals = await UserCareerGoal.findAllByUser(userId);
  return new Map(goals.map(g => [g.roleSlug, g]));
}

export async function loadRoleBySlug(roleSlug: string): Promise<ICareerRole | null> {
  return CareerRole.findBySlug(String(roleSlug).toLowerCase());
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Display-only rounding for a single requirement's coverage. */
export function roundCoverage(coverage: number | null): number | null {
  return coverage === null ? null : Math.round(coverage * 1000) / 10;
}

export function isValidRoleSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && /^[a-z0-9-]{2,64}$/.test(slug);
}
