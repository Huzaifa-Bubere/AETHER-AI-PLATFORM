import mongoose, { Document, Schema, Model } from 'mongoose';
import type { IResumeData } from '../services/atsEngine';

/**
 * AETHER Resume — versioned resumes for the builder (spec §63).
 * Candidates keep General / Backend / Java / company-specific versions.
 * The ATS snapshot is deterministic (recomputed server-side on save).
 */

/**
 * Template ids shared with the frontend PDF renderer (spec §18–§19).
 * 'minimal' is a legacy alias kept only so resumes saved before the template
 * set was expanded keep loading — new saves use 'minimal-professional'.
 */
export const ATS_TEMPLATES = [
  'ats-classic',
  'graduate-fresher',
  'minimal-professional',
  'technical-professional',
  'modern-professional',
] as const;

/** Values accepted by the schema (includes the legacy alias). */
export const ATS_TEMPLATE_VALUES = [...ATS_TEMPLATES, 'minimal'] as const;

export type ATS_TEMPLATE = (typeof ATS_TEMPLATE_VALUES)[number];

/** Map any stored value onto a current template id. */
export function normalizeTemplate(value: unknown): ATS_TEMPLATE {
  const v = String(value || '');
  if (v === 'minimal') return 'minimal-professional';
  return (ATS_TEMPLATES as readonly string[]).includes(v) ? (v as ATS_TEMPLATE) : 'ats-classic';
}

export interface IResumeVersion extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  /** optional anchor to a target career role */
  targetRoleSlug?: string;
  template: ATS_TEMPLATE;
  /** the default version the builder opens first (spec §26) */
  isDefault: boolean;
  data: IResumeData;
  /** last deterministic ATS score computed server-side */
  atsScore?: number;
  atsSnapshot?: { score: number; grade: string; computedAt: Date };
  createdAt: Date;
  updatedAt: Date;
}

// Every collection field carries an explicit default so a document written by
// an older app version (or a partial update) always reads back as an array,
// never `undefined`. This is what caused the builder's `undefined.length` crash
// on legacy records (spec §5B).
const resumeDataSchema = new Schema({
  name: { type: String, default: '' },
  title: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  location: { type: String, default: '' },
  links: { type: [String], default: [] },
  summary: { type: String, default: '' },
  education: { type: [Schema.Types.Mixed], default: [] },
  experience: { type: [Schema.Types.Mixed], default: [] },
  projects: { type: [Schema.Types.Mixed], default: [] },
  skills: { type: [String], default: [] },
  certifications: { type: [String], default: [] },
  achievements: { type: [String], default: [] },
  languages: { type: [{ name: String, level: String, _id: false }], default: [] },
  customSections: { type: [{ title: String, items: [String], _id: false }], default: [] },
  sectionOrder: { type: [String], default: [] },
  pageSize: { type: String, enum: ['A4', 'LETTER'], default: 'A4' },
  typography: {
    type: { fontFamily: String, fontSize: Number, lineHeight: Number, margin: Number, _id: false },
    default: undefined,
  },
  targetJobDescription: { type: String, default: '' },
}, { _id: false });

/**
 * Normalise a stored document in place on read (spec §5C) — fills ONLY missing
 * structural defaults and never overwrites user text.
 */
export function normalizeStoredResumeData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const arrays = ['links', 'education', 'experience', 'projects', 'skills', 'certifications', 'achievements', 'languages', 'customSections', 'sectionOrder'] as const;
  for (const key of arrays) {
    if (!Array.isArray(data[key])) data[key] = [];
  }
  for (const key of ['name', 'title', 'email', 'phone', 'location', 'summary', 'targetJobDescription'] as const) {
    if (typeof data[key] !== 'string') data[key] = '';
  }
  return data;
}

const resumeVersionSchema = new Schema<IResumeVersion>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, default: 'My Resume' },
    targetRoleSlug: { type: String, default: '', trim: true },
    template: {
      type: String,
      enum: ATS_TEMPLATE_VALUES,
      default: 'ats-classic',
    },
    isDefault: { type: Boolean, default: false, index: true },
    // `default: () => ({})` makes Mongoose materialize the subdocument even for a
    // document created/found without `data` (legacy or hand-built records).
    // Without it `doc.data` is undefined and reading `doc.data.experience.length`
    // is exactly the crash this schema is meant to prevent.
    data: { type: resumeDataSchema, required: true, default: () => ({}) },
    atsScore: { type: Number, min: 0, max: 100 },
    atsSnapshot: {
      type: {
        score: { type: Number },
        grade: { type: String },
        computedAt: { type: Date, default: Date.now },
      },
      default: null,
    },
  },
  { timestamps: true }
);

resumeVersionSchema.index({ userId: 1, createdAt: -1 });

// Legacy/incomplete records are repaired on load rather than rejected.
resumeVersionSchema.post('init', function (doc: IResumeVersion) {
  normalizeStoredResumeData(doc.data);
});

export interface IResumeVersionModel extends Model<IResumeVersion> {
  listByUser(userId: string): Promise<IResumeVersion[]>;
}

resumeVersionSchema.statics.listByUser = function (userId: string) {
  return this.find({ userId: new mongoose.Types.ObjectId(userId) }).sort({ updatedAt: -1 });
};

export const ResumeVersion = mongoose.model<IResumeVersion, IResumeVersionModel>('ResumeVersion', resumeVersionSchema);
