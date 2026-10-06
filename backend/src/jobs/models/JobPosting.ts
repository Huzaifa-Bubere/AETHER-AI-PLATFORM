import mongoose, { Document, Schema, Model } from 'mongoose';
import { jobFingerprint } from '../services/jobFingerprint.service';

/**
 * Job postings (spec §60).
 *
 * A posting is only ever created from a real provider response or a real admin
 * import. There is no seeding of sample postings and no synthetic fallback: if a
 * provider does not supply a salary, `salary` stays null and the UI says
 * "Salary not listed" (spec §61).
 *
 * Field paths deliberately mirror what providers actually return, so
 * normalisation is a rename rather than a guess.
 */

export const WORK_MODES = ['REMOTE', 'HYBRID', 'ONSITE', 'UNSPECIFIED'] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const JOB_TYPES = ['FULL_TIME', 'PART_TIME', 'INTERNSHIP', 'CONTRACT', 'TEMPORARY', 'UNSPECIFIED'] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const EXPERIENCE_LEVELS = ['INTERN', 'ENTRY', 'MID', 'SENIOR', 'LEAD', 'UNSPECIFIED'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export interface ISalary {
  /** Numeric only. Null when the posting does not state one. */
  min?: number | null;
  max?: number | null;
  currency?: string | null;
  /** Verbatim source text, kept so the UI can show what was actually written. */
  raw?: string | null;
  period?: 'YEAR' | 'MONTH' | 'HOUR' | null;
}

export interface IJobPosting extends Document {
  /** Which adapter produced this record. */
  provider: string;
  /** The provider's own identifier, used for deduplication. */
  externalId: string;
  /** Canonical URL a recruiter can actually open (spec §66). */
  sourceUrl: string;

  title: string;
  company: string;
  companyLogo?: string | null;
  /** Lowercased title used for dedup fallback and search. */
  normalizedTitle: string;
  normalizedCompany: string;

  description: string;
  /** Raw provider text before any truncation, for skill extraction. */
  rawDescription?: string;

  location?: string | null;
  city?: string | null;
  country?: string | null;
  region?: string | null;

  workMode: WorkMode;
  jobType: JobType;
  experienceLevel: ExperienceLevel;

  salary?: ISalary;

  /** Career role slugs this posting maps to, via title + skill matching. */
  roleIds: string[];
  /** Canonical skill slugs extracted deterministically from the description. */
  extractedSkills: string[];

  datePosted?: Date | null;
  /** When AETHER last fetched this posting. */
  fetchedAt: Date;
  /** Optional provider expiry; also used to age out stale postings. */
  expiresAt?: Date | null;

  /** False once the posting ages out or a provider reports it closed. */
  active: boolean;
  /** Short verbatim requirement/responsibility bullets, when extractable. */
  requirements: string[];

  /**
   * Cross-provider canonical group (spec §C). Several providers can list the
   * same vacancy; this fingerprint lets the UI show one card while keeping
   * every source. It never replaces (provider, externalId), which remains the
   * primary identity.
   */
  canonicalGroupId?: string | null;
  /** Every provider the vacancy was seen on. Provenance is never discarded. */
  sources: Array<{
    provider: string;
    externalId: string;
    sourceUrl: string;
    datePosted: Date | null;
  }>;
}

export interface IJobPostingModel extends Model<IJobPosting> {
  /** Upsert keyed on the provider's own identity (spec §62). */
  upsertFromProvider(
    provider: string,
    externalId: string,
    doc: Partial<IJobPosting>,
  ): Promise<{ posting: IJobPosting; created: boolean }>;
}

const salarySchema = new Schema<ISalary>({
  min: { type: Number, default: null },
  max: { type: Number, default: null },
  currency: { type: String, default: null, trim: true },
  raw: { type: String, default: null, trim: true },
  period: { type: String, enum: ['YEAR', 'MONTH', 'HOUR', null], default: null },
}, { _id: false });

const jobPostingSchema = new Schema<IJobPosting, IJobPostingModel>({
  provider: { type: String, required: true, trim: true, lowercase: true },
  externalId: { type: String, required: true, trim: true },
  sourceUrl: { type: String, required: true, trim: true },

  title: { type: String, required: true, trim: true },
  company: { type: String, required: true, trim: true },
  companyLogo: { type: String, default: null, trim: true },
  normalizedTitle: { type: String, required: true, lowercase: true, trim: true },
  normalizedCompany: { type: String, required: true, lowercase: true, trim: true },

  description: { type: String, default: '', trim: true },
  rawDescription: { type: String, default: '' },

  location: { type: String, default: null, trim: true },
  city: { type: String, default: null, trim: true, index: true },
  country: { type: String, default: null, trim: true, index: true },
  region: { type: String, default: null, trim: true, index: true },

  workMode: { type: String, enum: WORK_MODES, default: 'UNSPECIFIED', index: true },
  jobType: { type: String, enum: JOB_TYPES, default: 'UNSPECIFIED', index: true },
  experienceLevel: { type: String, enum: EXPERIENCE_LEVELS, default: 'UNSPECIFIED', index: true },

  salary: { type: salarySchema, default: () => ({ min: null, max: null, currency: null, raw: null, period: null }) },

  roleIds: [{ type: String, lowercase: true, trim: true, index: true }],
  extractedSkills: [{ type: String, lowercase: true, trim: true }],

  datePosted: { type: Date, default: null },
  fetchedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null },

  active: { type: Boolean, default: true, index: true },
  requirements: [{ type: String, trim: true }],

  canonicalGroupId: { type: String, default: null, lowercase: true, trim: true, index: true },
  sources: {
    type: [{
      _id: false,
      provider: { type: String, trim: true, lowercase: true },
      externalId: { type: String, trim: true },
      sourceUrl: { type: String, trim: true },
      datePosted: { type: Date, default: null },
    }],
    default: [],
  },
});

// Spec §62: one posting per provider identity. This is the deduplication
// guarantee — re-ingesting the same posting updates rather than duplicates.
jobPostingSchema.index({ provider: 1, externalId: 1 }, { unique: true });

// Role-filtered listing (spec §70) and freshness display (spec §63).
jobPostingSchema.index({ roleIds: 1, active: 1, datePosted: -1 });
jobPostingSchema.index({ active: 1, fetchedAt: -1 });
// Fallback dedup for providers without a stable id, and free-text search.
jobPostingSchema.index({ normalizedTitle: 1, normalizedCompany: 1 });
// Cross-provider grouping (spec §C): postings sharing a canonical group are the
// same real-world vacancy listed by more than one provider.
jobPostingSchema.index({ canonicalGroupId: 1, active: 1, datePosted: -1 });
jobPostingSchema.index({ title: 'text', company: 'text', description: 'text' });

jobPostingSchema.statics.upsertFromProvider = async function (provider, externalId, doc) {
  const filter = { provider, externalId };
  const existing = await this.findOne(filter).select('_id');
  const update = {
    $set: {
      ...doc,
      fetchedAt: new Date(),
      active: doc.active ?? true,
      // Cross-provider fingerprint, recomputed on every ingest so a corrected
      // title or date moves the posting to the right group (spec §C).
      canonicalGroupId: jobFingerprint({
        title: doc.title,
        company: doc.company,
        location: doc.location,
        datePosted: doc.datePosted ?? null,
      }),
    },
    // Provenance is appended, never replaced: a posting that later appears on
    // another provider keeps its original record here too (spec §C3).
    $addToSet: {
      sources: {
        provider,
        externalId,
        sourceUrl: doc.sourceUrl ?? '',
        datePosted: doc.datePosted ?? null,
      },
    },
  };
  const result = await this.findOneAndUpdate(filter, update, { upsert: true, new: true, setDefaultsOnInsert: true });
  return { posting: result as IJobPosting, created: !existing };
};

export const JobPosting = mongoose.model<IJobPosting, IJobPostingModel>('JobPosting', jobPostingSchema);