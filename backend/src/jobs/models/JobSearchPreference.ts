import mongoose, { Document, Schema, Model } from 'mongoose';
import {
  EXPERIENCE_LEVELS,
  JOB_TYPES,
  WORK_MODES,
  type ExperienceLevel,
  type JobType,
  type WorkMode,
} from './JobPosting';

/**
 * Job search preferences (spec §D).
 *
 * This is JOB-SEARCH state, not career state. It records how a candidate likes
 * to browse postings — which locations, work modes, job types and seniority they
 * are looking at right now.
 *
 * It is deliberately a separate model from UserRoleGoal:
 *
 *   UserRoleGoal         → career identity. "I am targeting Backend Developer."
 *                          Never written by the Jobs page.
 *   JobSearchPreference  → browsing taste.  "Right now I am looking at hybrid
 *                          entry-level backend roles in Mumbai."
 *
 * Changing a search filter therefore NEVER overwrites the candidate's primary
 * role or their career goals (spec §D1). The two only ever meet when the
 * ranking service reads target roles to decide what to surface.
 */
export interface IJobSearchPreference extends Document {
  userId: mongoose.Types.ObjectId;
  /** Which of the candidate's roles these preferences apply to. */
  roleSlug: string;

  /** Free-text keywords, lowercased. Never auto-filled from a transient search. */
  keywords: string[];
  locations: string[];
  workModes: WorkMode[];
  jobTypes: JobType[];
  experienceLevels: ExperienceLevel[];

  /** Null means "no remote-only restriction". */
  remoteOnly: boolean;
  /** Null means "any time". Otherwise 1/3/7/30 days. */
  datePostedWindow: number | null;

  /**
   * When this candidate last looked at jobs for this role. Read BEFORE the
   * "new jobs since last visit" count is calculated and written afterwards, so
   * the count is never computed against a timestamp it just moved (spec §F2).
   */
  lastViewedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const jobSearchPreferenceSchema = new Schema<IJobSearchPreference>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  roleSlug: { type: String, required: true, lowercase: true, trim: true, index: true },

  keywords: { type: [{ type: String, lowercase: true, trim: true }], default: [] },
  locations: { type: [{ type: String, lowercase: true, trim: true }], default: [] },
  workModes: { type: [{ type: String, enum: WORK_MODES }], default: [] },
  jobTypes: { type: [{ type: String, enum: JOB_TYPES }], default: [] },
  experienceLevels: { type: [{ type: String, enum: EXPERIENCE_LEVELS }], default: [] },

  remoteOnly: { type: Boolean, default: false },
  datePostedWindow: { type: Number, default: null, min: 1, max: 365 },

  lastViewedAt: { type: Date, default: null },
}, { timestamps: true });

// One preference set per (user, role): saving for Backend Developer must never
// overwrite the Data Analyst preference set.
jobSearchPreferenceSchema.index({ userId: 1, roleSlug: 1 }, { unique: true });

export const JobSearchPreference = mongoose.model<IJobSearchPreference>('JobSearchPreference', jobSearchPreferenceSchema);

export type { ExperienceLevel, JobType, WorkMode };
export default JobSearchPreference;