import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * Job requirement match (spec §50–§56, §113).
 *
 * IMPORTANT: this is NOT a hiring probability. AETHER cannot know whether an
 * employer will hire anyone, so nothing here predicts that. The score measures
 * alignment between a job description's requirements and the candidate's
 * evidence — and every component is stored so the number is fully traceable.
 */

/** Component weights (spec §53). These sum to 100 and are the documented formula. */
export const FIT_WEIGHTS = {
  REQUIRED_SKILL_COVERAGE: 30,
  SEMANTIC_RESUME_JD_MATCH: 15,
  EXPERIENCE_PROJECT_EVIDENCE: 15,
  SKILL_PROFILE_ALIGNMENT: 15,
  ASSESSMENT_EVIDENCE: 10,
  INTERVIEW_ROLE_EVIDENCE: 5,
  EDUCATION_CERTIFICATION: 5,
  ELIGIBILITY_WORK_PREFERENCE: 5,
} as const;

export const TOTAL_FIT_WEIGHT = Object.values(FIT_WEIGHTS).reduce((sum, w) => sum + w, 0);

/**
 * Match bands (spec §55). They describe JD alignment only and are explicitly
 * NOT predictions of an employer's decision.
 */
export const MATCH_LABELS: Array<{ min: number; label: string }> = [
  { min: 85, label: 'Strong Requirement Match' },
  { min: 70, label: 'Good Requirement Match' },
  { min: 50, label: 'Partial Match' },
  { min: 0, label: 'Significant Gaps' },
];

export function matchLabelFor(score: number): string {
  return (MATCH_LABELS.find(band => score >= band.min) ?? MATCH_LABELS[MATCH_LABELS.length - 1]).label;
}

/** One requirement extracted from the job description. */
export interface IJobRequirement {
  /** Canonical skill slug when it matched the dictionary. */
  skillSlug: string | null;
  /** Exactly what the posting said. */
  label: string;
  /** REQUIRED / PREFERRED, as stated or as inferred from section context. */
  importance: 'REQUIRED' | 'PREFERRED';
  /** Whether any candidate evidence exists at all. */
  evidenceStatus: 'EVIDENCED' | 'NOT_EVIDENCED';
  /** Highest evidenced level 1–4, or null when nothing evidences it. */
  currentLevel: number | null;
  currentLevelLabel: string | null;
  learningTopicSlug: string | null;
}

export interface IJobFitComponent {
  key: keyof typeof FIT_WEIGHTS;
  label: string;
  weight: number;
  /** 0–weight. Null when the component could not be evaluated. */
  earned: number | null;
  /** Why this number — shown verbatim in the UI. */
  basis: string;
  sampleSize: number;
}

export interface IJobFitAnalysis extends Document {
  userId: mongoose.Types.ObjectId;
  /** Null when the analysis was run against a pasted description. */
  jobId?: mongoose.Types.ObjectId | null;
  /** Stored so a re-analysis of the same text is reproducible. */
  jobDescriptionText: string;
  roleSlug?: string | null;
  resumeVersionId?: mongoose.Types.ObjectId | null;

  /** 0–100. Requirement match only — never a hiring probability. */
  score: number | null;
  label: string | null;
  components: IJobFitComponent[];

  requirements: IJobRequirement[];
  matchedRequirements: string[];
  /** Requirements with no evidence. Never "skills the candidate lacks". */
  missingRequirements: string[];

  nextActions: Array<{ title: string; reason: string; learningTopicSlug: string | null }>;

  /** Which resume version best matches this posting (spec §84). */
  recommendedResumeVersionId?: mongoose.Types.ObjectId | null;
  recommendedResumeReason: string | null;

  /** Bumped when FIT_WEIGHTS change, so stored scores stay interpretable. */
  calculationVersion: string;
  computedAt: Date;
}

export interface IJobFitAnalysisModel extends Model<IJobFitAnalysis> {
  findLatestFor(userId: string, jobId?: string | null): Promise<IJobFitAnalysis | null>;
}

const requirementSchema = new Schema<IJobRequirement>({
  skillSlug: { type: String, default: null, lowercase: true, trim: true },
  label: { type: String, required: true, trim: true },
  importance: { type: String, enum: ['REQUIRED', 'PREFERRED'], default: 'REQUIRED' },
  evidenceStatus: { type: String, enum: ['EVIDENCED', 'NOT_EVIDENCED'], default: 'NOT_EVIDENCED' },
  currentLevel: { type: Number, default: null, min: 1, max: 4 },
  currentLevelLabel: { type: String, default: null },
  learningTopicSlug: { type: String, default: null, lowercase: true, trim: true },
}, { _id: false });

const componentSchema = new Schema<IJobFitComponent>({
  key: { type: String, required: true },
  label: { type: String, required: true },
  weight: { type: Number, required: true },
  earned: { type: Number, default: null },
  basis: { type: String, default: '' },
  sampleSize: { type: Number, default: 0 },
}, { _id: false });

const jobFitAnalysisSchema = new Schema<IJobFitAnalysis, IJobFitAnalysisModel>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  jobId: { type: Schema.Types.ObjectId, ref: 'JobPosting', default: null, index: true },
  jobDescriptionText: { type: String, required: true },
  roleSlug: { type: String, default: null, lowercase: true, trim: true, index: true },
  resumeVersionId: { type: Schema.Types.ObjectId, ref: 'ResumeVersion', default: null },

  score: { type: Number, default: null, min: 0, max: 100 },
  label: { type: String, default: null },
  components: { type: [componentSchema], default: [] },

  requirements: { type: [requirementSchema], default: [] },
  matchedRequirements: [{ type: String }],
  missingRequirements: [{ type: String }],

  nextActions: {
    type: [{ _id: false, title: String, reason: String, learningTopicSlug: String }],
    default: [],
  },

  recommendedResumeVersionId: { type: Schema.Types.ObjectId, ref: 'ResumeVersion', default: null },
  recommendedResumeReason: { type: String, default: null },

  calculationVersion: { type: String, default: '1.0' },
  computedAt: { type: Date, default: Date.now },
});

jobFitAnalysisSchema.index({ userId: 1, jobId: 1, computedAt: -1 });
jobFitAnalysisSchema.index({ userId: 1, roleSlug: 1, computedAt: -1 });

jobFitAnalysisSchema.statics.findLatestFor = function (userId: string, jobId?: string | null) {
  const filter: Record<string, unknown> = { userId: new mongoose.Types.ObjectId(userId) };
  if (jobId) filter.jobId = new mongoose.Types.ObjectId(jobId);
  return this.findOne(filter).sort({ computedAt: -1 });
};

export const JobFitAnalysis = mongoose.model<IJobFitAnalysis, IJobFitAnalysisModel>(
  'JobFitAnalysis',
  jobFitAnalysisSchema,
);