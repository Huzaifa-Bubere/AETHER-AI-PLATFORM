import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * In-app job alerts (spec §G).
 *
 * AETHER records that a NEW posting appeared which looks relevant to a
 * candidate. It is displayed IN the app. It is NOT an email, not a push
 * notification, and nothing here claims any message was ever delivered —
 * because no delivery channel exists yet (spec §56).
 *
 * The relevance threshold is read from JOB_ALERT_MIN_RELEVANCE so it is
 * configurable in exactly one place rather than hardcoded per call site.
 */
export const JOB_ALERT_TYPES = ['NEW_JOB_MATCH'] as const;
export type JobAlertType = (typeof JOB_ALERT_TYPES)[number];

export const DEFAULT_ALERT_MIN_RELEVANCE = 70;

/** The single place the threshold is defined (spec §G2). */
export function alertMinRelevance(): number {
  const raw = Number.parseInt(String(process.env.JOB_ALERT_MIN_RELEVANCE ?? ''), 10);
  if (!Number.isFinite(raw) || raw < 0 || raw > 100) return DEFAULT_ALERT_MIN_RELEVANCE;
  return raw;
}

export interface IJobAlert extends Document {
  userId: mongoose.Types.ObjectId;
  type: JobAlertType;
  /** The role or saved search the posting matched against. */
  roleSlug?: string | null;
  savedSearchId?: mongoose.Types.ObjectId | null;
  jobId: mongoose.Types.ObjectId;

  title: string;
  company: string;
  /** The recommendation relevance at the time the alert was raised. */
  recommendationScore: number;
  recommendationLabel: string | null;

  /** Null until the candidate opens it. Never auto-marked read. */
  readAt: Date | null;
  createdAt: Date;
}

const jobAlertSchema = new Schema<IJobAlert>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: JOB_ALERT_TYPES, default: 'NEW_JOB_MATCH' },

  roleSlug: { type: String, default: null, lowercase: true, trim: true },
  savedSearchId: { type: Schema.Types.ObjectId, ref: 'SavedJobSearch', default: null },

  jobId: { type: Schema.Types.ObjectId, ref: 'JobPosting', required: true },

  title: { type: String, default: '', trim: true },
  company: { type: String, default: '', trim: true },
  recommendationScore: { type: Number, default: 0, min: 0, max: 100 },
  recommendationLabel: { type: String, default: null },

  readAt: { type: Date, default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });

// One alert per (user, job, type) — repeated ingestion must not spam the
// candidate (spec §G3).
jobAlertSchema.index({ userId: 1, jobId: 1, type: 1 }, { unique: true });
jobAlertSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

export const JobAlert = mongoose.model<IJobAlert>('JobAlert', jobAlertSchema);
export default JobAlert;