import mongoose, { Document, Schema, Model } from 'mongoose';

/** Evidence provenance — confidence strength ordering (strongest first). */
export type EvidenceKind = 'ASSESSMENT_EVIDENCE' | 'PROJECT_EVIDENCE' | 'COMPLETED_LEARNING' | 'RESUME_EVIDENCE' | 'SELF_DECLARED';

export const EVIDENCE_WEIGHTS: Record<EvidenceKind, number> = {
  ASSESSMENT_EVIDENCE: 1.0,
  PROJECT_EVIDENCE: 0.9,
  COMPLETED_LEARNING: 0.8,
  RESUME_EVIDENCE: 0.6,
  SELF_DECLARED: 0.35,
};

export interface ISkillEvidence {
  kind: EvidenceKind;
  /** 0–100 performance associated with this evidence (assessments/quizzes), if any. */
  score?: number;
  source?: string;
  at: Date;
}

export interface IUserSkillSkill {
  skillSlug: string;
  /** Deterministic 0–100 confidence from weighted evidence. Not AI-generated. */
  confidence: number;
  bestEvidence: EvidenceKind;
  evidences: ISkillEvidence[];
  updatedAt: Date;
}

export interface IUserSkillProfile extends Document {
  userId: mongoose.Types.ObjectId;
  skills: IUserSkillSkill[];
  updatedAt: Date;
}

export interface IUserSkillProfileModel extends Model<IUserSkillProfile> {
  findByUser(userId: string): Promise<IUserSkillProfile | null>;
}

const evidenceSchema = new Schema<ISkillEvidence>({
  kind: { type: String, enum: ['ASSESSMENT_EVIDENCE', 'PROJECT_EVIDENCE', 'COMPLETED_LEARNING', 'RESUME_EVIDENCE', 'SELF_DECLARED'], required: true },
  score: { type: Number, min: 0, max: 100 },
  source: { type: String, trim: true },
  at: { type: Date, default: Date.now },
}, { _id: false });

const skillEntrySchema = new Schema<IUserSkillSkill>({
  skillSlug: { type: String, required: true, lowercase: true, trim: true },
  confidence: { type: Number, min: 0, max: 100, default: 0 },
  bestEvidence: { type: String, enum: ['ASSESSMENT_EVIDENCE', 'PROJECT_EVIDENCE', 'COMPLETED_LEARNING', 'RESUME_EVIDENCE', 'SELF_DECLARED'], default: 'SELF_DECLARED' },
  evidences: { type: [evidenceSchema], default: [] },
  updatedAt: { type: Date, default: Date.now },
}, { _id: false });

const profileSchema = new Schema<IUserSkillProfile, IUserSkillProfileModel>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  skills: { type: [skillEntrySchema], default: [] },
}, { timestamps: true });

profileSchema.index({ 'skills.skillSlug': 1 });

profileSchema.statics.findByUser = function (userId: string) {
  return this.findOne({ userId: new mongoose.Types.ObjectId(userId) });
};

export const UserSkillProfile = mongoose.model<IUserSkillProfile, IUserSkillProfileModel>('UserSkillProfile', profileSchema);

// ── AI explanation cache (identical requests never re-call Gemini) ──────────
export interface IExplanationCache extends Document {
  cacheKey: string;
  kind: 'SKILL' | 'ROADMAP_NODE' | 'RECOMMENDATION' | 'ADVISOR';
  payload: Record<string, unknown>;
  createdAt: Date;
}

const explanationCacheSchema = new Schema<IExplanationCache>({
  cacheKey: { type: String, required: true, unique: true },
  kind: { type: String, enum: ['SKILL', 'ROADMAP_NODE', 'RECOMMENDATION', 'ADVISOR'], required: true, index: true },
  payload: { type: Schema.Types.Mixed, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

export const ExplanationCache = mongoose.model<IExplanationCache>('ExplanationCache', explanationCacheSchema);
