import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * Saved jobs and the application tracker (spec §67, §68).
 *
 * AETHER records that the candidate is interested in or has applied to a job.
 * It never records that an application was SUBMITTED to an employer — AETHER
 * has no provider integration that does that, and the Apply button opens the
 * original verified source instead (spec §66).
 */

export const APPLICATION_STATUSES = [
  'SAVED',
  'APPLIED',
  'SCREENING',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
  'WITHDRAWN',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface ISavedJob extends Document {
  userId: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  status: ApplicationStatus;
  /** Timestamps per status so the tracker can show a real timeline. */
  savedAt: Date;
  appliedAt?: Date | null;
  /** Which resume version the candidate intends to send (spec §84). */
  resumeVersionId?: mongoose.Types.ObjectId | null;
  /** The candidate's own notes. Never generated. */
  notes?: string;
  /** Free-text location/contact the candidate noted while applying. */
  appliedVia?: string | null;
  updatedAt: Date;
}

export interface ISavedJobModel extends Model<ISavedJob> {
  findForUser(userId: string, jobId: string): Promise<ISavedJob | null>;
}

const savedJobSchema = new Schema<ISavedJob, ISavedJobModel>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  jobId: { type: Schema.Types.ObjectId, ref: 'JobPosting', required: true, index: true },
  status: { type: String, enum: APPLICATION_STATUSES, default: 'SAVED', index: true },
  savedAt: { type: Date, default: Date.now },
  appliedAt: { type: Date, default: null },
  resumeVersionId: { type: Schema.Types.ObjectId, ref: 'ResumeVersion', default: null },
  notes: { type: String, default: '', trim: true, maxlength: 2000 },
  appliedVia: { type: String, default: null, trim: true, maxlength: 200 },
}, { timestamps: true });

// Spec §100: one save per (user, job) — saving twice updates rather than clones.
savedJobSchema.index({ userId: 1, jobId: 1 }, { unique: true });
// The tracker list, newest first.
savedJobSchema.index({ userId: 1, status: 1, updatedAt: -1 });

savedJobSchema.statics.findForUser = function (userId: string, jobId: string) {
  return this.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    jobId: new mongoose.Types.ObjectId(jobId),
  });
};

export const SavedJob = mongoose.model<ISavedJob, ISavedJobModel>('SavedJob', savedJobSchema);