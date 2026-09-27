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

const resumeDataSchema = new Schema({
  name: String,
  title: String,
  email: String,
  phone: String,
  location: String,
  links: [String],
  summary: String,
  education: [Schema.Types.Mixed],
  experience: [Schema.Types.Mixed],
  projects: [Schema.Types.Mixed],
  skills: [String],
  certifications: [String],
  achievements: [String],
  languages: [{ name: String, level: String, _id: false }],
  customSections: [{ title: String, items: [String], _id: false }],
  sectionOrder: [String],
  pageSize: { type: String, enum: ['A4', 'LETTER'], default: 'A4' },
  typography: {
    type: { fontFamily: String, fontSize: Number, lineHeight: Number, margin: Number, _id: false },
    default: undefined,
  },
  targetJobDescription: String,
}, { _id: false });

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
    data: { type: resumeDataSchema, required: true },
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

export interface IResumeVersionModel extends Model<IResumeVersion> {
  listByUser(userId: string): Promise<IResumeVersion[]>;
}

resumeVersionSchema.statics.listByUser = function (userId: string) {
  return this.find({ userId: new mongoose.Types.ObjectId(userId) }).sort({ updatedAt: -1 });
};

export const ResumeVersion = mongoose.model<IResumeVersion, IResumeVersionModel>('ResumeVersion', resumeVersionSchema);
