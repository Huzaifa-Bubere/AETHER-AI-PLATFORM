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
 * Saved searches (spec §E).
 *
 * A saved search is a REUSABLE SET OF FILTERS — "Backend Developer · Mumbai ·
 * Hybrid · Entry · last 7 days". It is not a saved job.
 *
 *   SavedJob       → one real vacancy the candidate is tracking (spec §67).
 *   SavedJobSearch → a query they can re-run later          (spec §E).
 *
 * These are deliberately separate models and separate routes so the candidate
 * never confuses "jobs I am applying to" with "searches I like to run".
 */
export interface ISavedJobSearch extends Document {
  userId: mongoose.Types.ObjectId;
  /** Candidate-supplied label, e.g. "Backend Developer — Mumbai Hybrid". */
  name: string;

  roleSlug?: string | null;
  query?: string | null;
  locations: string[];
  workModes: WorkMode[];
  jobTypes: JobType[];
  experienceLevels: ExperienceLevel[];
  /** Null means no date restriction. */
  postedWithinDays: number | null;

  /** Last time this search was actually executed by the candidate. */
  lastRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const savedJobSearchSchema = new Schema<ISavedJobSearch>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },

  roleSlug: { type: String, default: null, lowercase: true, trim: true },
  query: { type: String, default: null, trim: true, maxlength: 200 },
  locations: { type: [{ type: String, lowercase: true, trim: true }], default: [] },
  workModes: { type: [{ type: String, enum: WORK_MODES }], default: [] },
  jobTypes: { type: [{ type: String, enum: JOB_TYPES }], default: [] },
  experienceLevels: { type: [{ type: String, enum: EXPERIENCE_LEVELS }], default: [] },
  postedWithinDays: { type: Number, default: null, min: 1, max: 365 },

  lastRunAt: { type: Date, default: null },
}, { timestamps: true });

savedJobSearchSchema.index({ userId: 1, updatedAt: -1 });
savedJobSearchSchema.index({ userId: 1, roleSlug: 1 });

export const SavedJobSearch = mongoose.model<ISavedJobSearch>('SavedJobSearch', savedJobSearchSchema);
export default SavedJobSearch;