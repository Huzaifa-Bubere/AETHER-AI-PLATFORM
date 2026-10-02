import mongoose from 'mongoose';
import {
  UserCareerGoal,
  ROLE_GOAL_STATUSES,
  ROLE_TARGET_LEVELS,
  type IUserCareerGoal,
  type RoleGoalStatus,
  type RoleTargetLevel,
} from '../models/UserCareerGoal';
import { CareerRole } from '../models/CareerRole';
import { RoadmapProgress } from '../models/RoadmapProgress';

/**
 * RoleGoalsService (spec §29–§31, §83).
 *
 * Owns the invariant that matters for multi-role: a candidate has several target
 * roles but EXACTLY ONE of them is primary, and the dashboard opens on it.
 * Every write that can change isPrimary routes through `setPrimaryGoal`, so the
 * invariant cannot be broken by adding a role, editing one, or reordering.
 */

export interface RoleGoalView {
  roleSlug: string;
  roleName: string;
  isPrimary: boolean;
  priority: number;
  targetLevel: RoleTargetLevel;
  status: RoleGoalStatus;
  roadmapProgress: number;
  hoursPerWeek: number;
  experienceLevel: string;
  targetTimelineWeeks?: number;
  startedAt: Date;
  lastActivityAt: Date;
  requirementCount: number;
}

/** Structural view of a goal document — avoids depending on Mongoose's Document generic. */
type GoalDoc = Pick<
  IUserCareerGoal,
  | 'roleSlug' | 'isPrimary' | 'priority' | 'targetLevel' | 'status' | 'roadmapProgress'
  | 'hoursPerWeek' | 'experienceLevel' | 'targetTimelineWeeks' | 'startedAt' | 'updatedAt' | 'lastActivityAt'
>;

function toView(goal: GoalDoc, roleName: string, requirementCount: number): RoleGoalView {
  return {
    roleSlug: goal.roleSlug,
    roleName,
    isPrimary: goal.isPrimary,
    priority: goal.priority,
    targetLevel: goal.targetLevel,
    status: goal.status,
    roadmapProgress: goal.roadmapProgress ?? 0,
    hoursPerWeek: goal.hoursPerWeek,
    experienceLevel: goal.experienceLevel,
    targetTimelineWeeks: goal.targetTimelineWeeks,
    startedAt: goal.startedAt,
    lastActivityAt: goal.lastActivityAt ?? goal.updatedAt,
    requirementCount,
  };
}

/** Every non-archived goal, joined to its role, primary first. */
export async function listRoleGoals(userId: string): Promise<RoleGoalView[]> {
  const goals = await UserCareerGoal.findAllByUser(userId);
  if (goals.length === 0) return [];

  const roles = await CareerRole.find({ slug: { $in: goals.map(g => g.roleSlug) } })
    .select('slug name skills')
    .lean();
  const bySlug = new Map(roles.map(r => [r.slug, r]));

  return goals
    .map(goal => toView(goal, bySlug.get(goal.roleSlug)?.name ?? goal.roleSlug, bySlug.get(goal.roleSlug)?.skills?.length ?? 0))
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.priority - b.priority || a.roleName.localeCompare(b.roleName));
}

/**
 * Make `roleSlug` the candidate's primary role, demoting whichever role held it.
 * No-op (returns false) if the role is not a current goal.
 */
export async function setPrimaryGoal(userId: string, roleSlug: string): Promise<boolean> {
  const oid = new mongoose.Types.ObjectId(userId);
  const target = await UserCareerGoal.findOne({ userId: oid, roleSlug, status: { $ne: 'ARCHIVED' } })
    .select('_id');
  if (!target) return false;

  await UserCareerGoal.updateMany({ userId: oid, _id: { $ne: target._id } }, { $set: { isPrimary: false } });
  await UserCareerGoal.updateOne({ _id: target._id }, { $set: { isPrimary: true, lastActivityAt: new Date() } });
  return true;
}

export interface AddRoleGoalInput {
  roleSlug: string;
  isPrimary?: boolean;
  priority?: number;
  targetLevel?: RoleTargetLevel;
  hoursPerWeek?: number;
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
  targetTimelineWeeks?: number;
}

export class RoleGoalError extends Error {
  constructor(message: string, readonly code: 'ROLE_NOT_FOUND' | 'DUPLICATE_GOAL' | 'INVALID_INPUT') {
    super(message);
    this.name = 'RoleGoalError';
  }
}

/**
 * Add a target role. The first role a candidate picks becomes primary
 * automatically, so a new user is never left with no dashboard focus.
 */
export async function addRoleGoal(userId: string, input: AddRoleGoalInput): Promise<RoleGoalView> {
  const slug = String(input.roleSlug ?? '').toLowerCase().trim();
  if (!slug) throw new RoleGoalError('roleSlug is required', 'INVALID_INPUT');
  if (input.targetLevel && !(ROLE_TARGET_LEVELS as readonly string[]).includes(input.targetLevel)) {
    throw new RoleGoalError('Invalid targetLevel', 'INVALID_INPUT');
  }

  const role = await CareerRole.findOne({ slug, isActive: true }).select('slug name skills').lean();
  if (!role) throw new RoleGoalError('Career role not found', 'ROLE_NOT_FOUND');

  const oid = new mongoose.Types.ObjectId(userId);
  const existing = await UserCareerGoal.findOne({ userId: oid, roleSlug: slug });
  if (existing) {
    // Re-adding an archived goal revives it rather than failing.
    if (existing.status === 'ARCHIVED') {
      existing.status = 'ACTIVE';
      existing.lastActivityAt = new Date();
      await existing.save();
      return toView(existing, role.name, role.skills?.length ?? 0);
    }
    throw new RoleGoalError('You are already targeting this role', 'DUPLICATE_GOAL');
  }

  const goalCount = await UserCareerGoal.countDocuments({ userId: oid, status: { $ne: 'ARCHIVED' } });
  const becomePrimary = input.isPrimary === true || goalCount === 0;

  const goal = await UserCareerGoal.create({
    userId: oid,
    roleSlug: role.slug,
    isPrimary: becomePrimary,
    priority: input.priority ?? goalCount,
    targetLevel: input.targetLevel ?? 'JOB_READY',
    status: 'ACTIVE',
    hoursPerWeek: input.hoursPerWeek ?? 10,
    experienceLevel: input.experienceLevel ?? 'beginner',
    targetTimelineWeeks: input.targetTimelineWeeks,
    roadmapProgress: 0,
    lastActivityAt: new Date(),
  });

  if (becomePrimary) await setPrimaryGoal(userId, role.slug);
  await RoadmapProgress.updateOne(
    { userId: oid, roleSlug: role.slug },
    { $setOnInsert: { nodes: [] } },
    { upsert: true },
  );

  return toView(goal, role.name, role.skills?.length ?? 0);
}

export interface UpdateRoleGoalInput {
  priority?: number;
  targetLevel?: RoleTargetLevel;
  status?: RoleGoalStatus;
  hoursPerWeek?: number;
  targetTimelineWeeks?: number;
}

/** Edit a goal's plan settings. Archiving never deletes history. */
export async function updateRoleGoal(
  userId: string,
  roleSlug: string,
  input: UpdateRoleGoalInput,
): Promise<RoleGoalView | null> {
  if (input.targetLevel && !(ROLE_TARGET_LEVELS as readonly string[]).includes(input.targetLevel)) {
    throw new RoleGoalError('Invalid targetLevel', 'INVALID_INPUT');
  }
  if (input.status && !(ROLE_GOAL_STATUSES as readonly string[]).includes(input.status)) {
    throw new RoleGoalError('Invalid status', 'INVALID_INPUT');
  }

  const goal = await UserCareerGoal.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    roleSlug: String(roleSlug).toLowerCase(),
  });
  if (!goal) return null;

  if (input.priority !== undefined) goal.priority = input.priority;
  if (input.targetLevel !== undefined) goal.targetLevel = input.targetLevel;
  if (input.status !== undefined) goal.status = input.status;
  if (input.hoursPerWeek !== undefined) goal.hoursPerWeek = input.hoursPerWeek;
  if (input.targetTimelineWeeks !== undefined) goal.targetTimelineWeeks = input.targetTimelineWeeks;
  goal.lastActivityAt = new Date();
  await goal.save();

  // Never leave a candidate with zero active roles.
  if (input.status === 'ARCHIVED' && goal.isPrimary) {
    const next = await UserCareerGoal.findOne({
      userId: goal.userId,
      status: 'ACTIVE',
      _id: { $ne: goal._id },
    }).sort({ priority: 1 });
    if (next) await setPrimaryGoal(userId, next.roleSlug);
  }

  const role = await CareerRole.findOne({ slug: goal.roleSlug }).select('name skills').lean();
  return toView(goal, role?.name ?? goal.roleSlug, role?.skills?.length ?? 0);
}

/** Archive a role goal. History (progress, activity, evidence) is kept. */
export async function removeRoleGoal(userId: string, roleSlug: string): Promise<boolean> {
  return updateRoleGoal(userId, roleSlug, { status: 'ARCHIVED' }).then(result => result !== null);
}
