import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * AETHER user activity (spec §15/§16).
 *
 * Only QUALIFYING events are stored. Page views, hovers and login requests are
 * deliberately absent — they are not evidence of work and would inflate the
 * streak. Every stored event represents something the candidate actually did.
 */

/**
 * The closed set of qualifying activities. Adding a member here is a schema
 * change, so the list is kept small and explicit rather than free-form.
 */
export const ACTIVITY_TYPES = [
  'APTITUDE_COMPLETED',
  'TECHNICAL_COMPLETED',
  'CODING_SUBMITTED',
  'CODING_ACCEPTED',
  'INTERVIEW_COMPLETED',
  'RESUME_ANALYZED',
  'RESUME_UPDATED',
  'COURSE_STARTED',
  'LESSON_COMPLETED',
  'QUIZ_COMPLETED',
  'PROJECT_COMPLETED',
  'JOB_SAVED',
  'JOB_APPLIED',
  'PROFILE_UPDATED',
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** What the event is about — lets the UI render "Scored: 80% Technical DBMS test". */
export const ACTIVITY_ENTITY_TYPES = [
  'APTITUDE_ATTEMPT',
  'CODING_PROBLEM',
  'CODING_SUBMISSION',
  'INTERVIEW_SESSION',
  'RESUME',
  'RESUME_VERSION',
  'TOPIC',
  'COURSE',
  'JOB',
  'PROFILE',
] as const;

export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

/**
 * Short, human sentence fragments used by the Recent Activity timeline.
 * Deterministic — never generated, so the timeline never invents wording.
 */
export const ACTIVITY_VERBS: Record<ActivityType, { past: string; icon: string }> = {
  APTITUDE_COMPLETED: { past: 'Completed an aptitude test', icon: 'brain' },
  TECHNICAL_COMPLETED: { past: 'Scored a technical test', icon: 'code' },
  CODING_SUBMITTED: { past: 'Submitted a coding solution', icon: 'terminal' },
  CODING_ACCEPTED: { past: 'Got a coding solution accepted', icon: 'check' },
  INTERVIEW_COMPLETED: { past: 'Completed an interview', icon: 'mic' },
  RESUME_ANALYZED: { past: 'Analysed a resume', icon: 'file' },
  RESUME_UPDATED: { past: 'Updated a resume', icon: 'file' },
  COURSE_STARTED: { past: 'Started a course', icon: 'book' },
  LESSON_COMPLETED: { past: 'Completed a lesson', icon: 'book' },
  QUIZ_COMPLETED: { past: 'Scored a quiz', icon: 'list' },
  PROJECT_COMPLETED: { past: 'Completed a project', icon: 'layers' },
  JOB_SAVED: { past: 'Saved a job', icon: 'bookmark' },
  JOB_APPLIED: { past: 'Applied to a job', icon: 'send' },
  PROFILE_UPDATED: { past: 'Updated their profile', icon: 'user' },
};

export interface IUserActivityEvent extends Document {
  userId: mongoose.Types.ObjectId;
  eventType: ActivityType;
  entityType: ActivityEntityType;
  /** ObjectId string of the thing acted upon, when there is one. */
  entityId?: string;
  /** Short display label, e.g. "Python Functions" or "Backend Developer". */
  entityLabel?: string;
  /**
   * Career role this activity is evidence FOR. This is what keeps a Backend
   * interview from counting as Data Analyst evidence (spec §33). Omitted for
   * role-agnostic activity such as a profile edit.
   */
  roleId?: string;
  /** Deterministic facts, e.g. { scorePercent: 80, category: 'DBMS' }. */
  metadata?: Record<string, unknown>;
  /** UTC. Day bucketing into the user's timezone happens in StreakService. */
  occurredAt: Date;
}

export interface IUserActivityEventModel extends Model<IUserActivityEvent> {
  record(input: {
    userId: string;
    eventType: ActivityType;
    entityType: ActivityEntityType;
    entityId?: string;
    entityLabel?: string;
    roleId?: string;
    metadata?: Record<string, unknown>;
    occurredAt?: Date;
  }): Promise<IUserActivityEvent | null>;
}

const userActivityEventSchema = new Schema<IUserActivityEvent, IUserActivityEventModel>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  eventType: { type: String, enum: ACTIVITY_TYPES, required: true },
  entityType: { type: String, enum: ACTIVITY_ENTITY_TYPES, required: true },
  entityId: { type: String },
  entityLabel: { type: String, trim: true, maxlength: 200 },
  roleId: { type: String, trim: true, lowercase: true, index: true },
  metadata: { type: Schema.Types.Mixed, default: {} },
  occurredAt: { type: Date, default: Date.now },
});

// Spec §100: the streak and the timeline both read "this user's events,
// newest first", and the heatmap reads them scoped to a date range.
userActivityEventSchema.index({ userId: 1, occurredAt: -1 });
userActivityEventSchema.index({ userId: 1, roleId: 1, occurredAt: -1 });
userActivityEventSchema.index({ userId: 1, eventType: 1, occurredAt: -1 });

/**
 * Fire-and-forget recorder. Activity tracking must never break the action the
 * candidate was actually performing, so a write failure is logged and swallowed
 * rather than propagated to the caller.
 */
userActivityEventSchema.statics.record = async function (input) {
  try {
    return await this.create({
      userId: new mongoose.Types.ObjectId(input.userId),
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      entityLabel: input.entityLabel,
      roleId: input.roleId,
      metadata: input.metadata ?? {},
      occurredAt: input.occurredAt ?? new Date(),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[activity] failed to record event', input.eventType, error);
    return null;
  }
};

export const UserActivityEvent = mongoose.model<IUserActivityEvent, IUserActivityEventModel>(
  'UserActivityEvent',
  userActivityEventSchema,
);
