import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * A candidate's target roles (spec §29/§30).
 *
 * Originally this collection held ONE goal per user (`userId` was unique),
 * which made multi-role preparation impossible. It now holds many: a candidate
 * can be targeting Backend Developer, Data Analyst and AI/ML Engineer at once,
 * each with its own progress, and the dashboard/profile read them separately.
 *
 * `isPrimary` marks the role the dashboard opens on. Exactly one goal per user
 * is primary; `findActiveByUser` returns it, so every pre-multi-role caller
 * keeps its previous meaning without changes.
 */

/** How far the candidate intends to take a role. */
export const ROLE_TARGET_LEVELS = ['FOUNDATION', 'JOB_READY', 'ADVANCED'] as const;
export type RoleTargetLevel = (typeof ROLE_TARGET_LEVELS)[number];

/** Lifecycle of a target role. `ARCHIVED` keeps history but drops it from the UI. */
export const ROLE_GOAL_STATUSES = ['ACTIVE', 'PAUSED', 'ARCHIVED'] as const;
export type RoleGoalStatus = (typeof ROLE_GOAL_STATUSES)[number];

export interface IUserCareerGoal extends Document {
  userId: mongoose.Types.ObjectId;
  roleSlug: string;
  /** Exactly one goal per user has isPrimary = true. */
  isPrimary: boolean;
  /** Lower number = higher priority when several roles are active. */
  priority: number;
  targetLevel: RoleTargetLevel;
  status: RoleGoalStatus;
  hoursPerWeek: number;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  targetTimelineWeeks?: number;
  /** 0–100, maintained by RoleProgressService from real evidence. */
  roadmapProgress: number;
  startedAt: Date;
  lastActivityAt: Date;
  updatedAt: Date;
}

export interface IUserCareerGoalModel extends Model<IUserCareerGoal> {
  /** The primary goal — what the dashboard opens on. Backward compatible. */
  findActiveByUser(userId: string): Promise<IUserCareerGoal | null>;
  /** Every non-archived goal, primary first, then by priority. */
  findAllByUser(userId: string): Promise<IUserCareerGoal[]>;
}

const goalSchema = new Schema<IUserCareerGoal, IUserCareerGoalModel>({
  // No longer unique: a candidate may target several roles at once.
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  roleSlug: { type: String, required: true, lowercase: true, trim: true, index: true },
  isPrimary: { type: Boolean, default: false, index: true },
  priority: { type: Number, default: 0, min: 0, max: 100 },
  targetLevel: { type: String, enum: ROLE_TARGET_LEVELS, default: 'JOB_READY' },
  status: { type: String, enum: ROLE_GOAL_STATUSES, default: 'ACTIVE', index: true },
  hoursPerWeek: { type: Number, default: 10, min: 1, max: 80 },
  experienceLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
  targetTimelineWeeks: { type: Number, min: 1, max: 104 },
  roadmapProgress: { type: Number, default: 0, min: 0, max: 100 },
  startedAt: { type: Date, default: Date.now },
  lastActivityAt: { type: Date, default: Date.now },
}, { timestamps: true });

// One goal per (user, role) — the same role cannot be targeted twice.
goalSchema.index({ userId: 1, roleSlug: 1 }, { unique: true });
// Dashboard reads: this user's active roles, primary first.
goalSchema.index({ userId: 1, status: 1, isPrimary: -1, priority: 1 });

goalSchema.statics.findActiveByUser = function (userId: string) {
  return this.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    status: { $ne: 'ARCHIVED' },
  }).sort({ isPrimary: -1, priority: 1, updatedAt: -1 });
};

goalSchema.statics.findAllByUser = function (userId: string) {
  return this.find({
    userId: new mongoose.Types.ObjectId(userId),
    status: { $ne: 'ARCHIVED' },
  }).sort({ isPrimary: -1, priority: 1, updatedAt: -1 });
};

export const UserCareerGoal = mongoose.model<IUserCareerGoal, IUserCareerGoalModel>('UserCareerGoal', goalSchema);
