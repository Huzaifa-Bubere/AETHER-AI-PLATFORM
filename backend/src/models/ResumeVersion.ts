import mongoose, { Document, Schema, Model } from 'mongoose';
import type { IResumeData } from '../services/atsEngine';

/**
 * AETHER Resume — versioned resumes for the builder (spec §63).
 * Candidates keep General / Backend / Java / company-specific versions.
 * The ATS snapshot is deterministic (recomputed server-side on save).
 */

export type ATS_TEMPLATE = 'ats-classic' | 'modern-professional' | 'minimal' | 'graduate-fresher';

export interface IResumeVersion extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  /** optional anchor to a target career role */
  targetRoleSlug?: string;
  template: ATS_TEMPLATE;
  data: IResumeData;
  /** last deterministic ATS score computed server-side */
  atsScore?: number;
  atsSnapshot?: { score: number; grade: string; computedAt: Date };
  createdAt: Date;
  updatedAt: Date;
}

const resumeDataSchema = new Schema({
  name: String,
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
}, { _id: false });

const resumeVersionSchema = new Schema<IResumeVersion>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, default: 'My Resume' },
    targetRoleSlug: { type: String, default: '', trim: true },
    template: {
      type: String,
      enum: ['ats-classic', 'modern-professional', 'minimal', 'graduate-fresher'],
      default: 'ats-classic',
    },
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
