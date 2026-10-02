import mongoose, { Document, Schema, Model } from 'mongoose';
import type { SkillType } from './Skill';

export type SkillPriority = 'ESSENTIAL' | 'RECOMMENDED' | 'BONUS' | 'OPTIONAL';

/**
 * How much this requirement counts toward role readiness (spec §39).
 * The weights are fixed and documented, not tunable per role — a role that
 * weighted its own skills could always declare itself fully met.
 */
export const IMPORTANCE_WEIGHTS: Record<SkillPriority, number> = {
  ESSENTIAL: 3,
  RECOMMENDED: 2,
  BONUS: 1,
  /** Legacy value for the pre-multi-role seed data; treated as BONUS. */
  OPTIONAL: 1,
};

/** Structured requirement categories (spec §35). */
export const REQUIREMENT_CATEGORIES = [
  'PROGRAMMING_LANGUAGES',
  'FRAMEWORKS_LIBRARIES',
  'DATABASES',
  'CS_FUNDAMENTALS',
  'APIS',
  'CLOUD',
  'DEVOPS',
  'TESTING',
  'TOOLS',
  'SYSTEM_DESIGN',
  'DATA_AI',
  'PROFESSIONAL_SKILLS',
] as const;

export type RequirementCategory = (typeof REQUIREMENT_CATEGORIES)[number];

/** How deep the candidate must be in a requirement (spec §37). */
export const REQUIRED_LEVELS = [1, 2, 3, 4] as const;
export type RequiredLevel = (typeof REQUIRED_LEVELS)[number];

export const REQUIRED_LEVEL_LABELS: Record<RequiredLevel, string> = {
  1: 'Foundation',
  2: 'Working Knowledge',
  3: 'Job Ready',
  4: 'Advanced',
};

export function isValidRequiredLevel(value: unknown): value is RequiredLevel {
  return typeof value === 'number' && (REQUIRED_LEVELS as readonly number[]).includes(value);
}

export interface IRoleSkill {
  skillSlug: string;
  name: string;
  priority: SkillPriority;
  skillType: SkillType;
  /**
   * Grouping used by the requirements UI and the coverage rollup. Optional in
   * TypeScript so pre-matrix seed data still compiles; Mongoose defaults it.
   */
  category?: RequirementCategory;
  /**
   * Depth the role demands. Optional in TypeScript for the same reason;
   * Mongoose defaults it to 2 (Working Knowledge).
   */
  requiredLevel?: RequiredLevel;
  /**
   * LearningTopic slug that closes this gap, so a missing requirement can link
   * straight to a real lesson instead of a dead end.
   */
  learningTopicSlug?: string;
  stageId?: string;
}

export interface IRoadmapNode {
  id: string;
  title: string;
  description?: string;
  whyItMatters?: string;
  whatYouWillLearn: string[];
  keyConcepts: string[];
  skillSlugs: string[];
  prerequisites: string[];
  estimatedHours?: number;
  resourceIds: string[];
  quiz?: Array<{ question: string; options: string[]; correctIndex: number; explanation?: string }>;
  project?: { title: string; description: string; deliverables: string[] };
  interviewQuestions: string[];
}

export interface IRoadmapStage {
  id: string;
  title: string;
  description?: string;
  order: number;
  nodeIds: string[];
}

export interface ILearningResource {
  id: string;
  title: string;
  type: 'DOCUMENTATION' | 'ARTICLE' | 'VIDEO' | 'COURSE' | 'PRACTICE' | 'PROJECT';
  provider: string;
  url: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime?: string;
}

export interface IProjectSuggestion {
  title: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: string;
  description: string;
  deliverables: string[];
  skillSlugs: string[];
}

export interface ICareerRole extends Document {
  slug: string;
  name: string;
  description: string;
  category: string;
  responsibilities: string[];
  skills: IRoleSkill[];
  tools: string[];
  frameworks: string[];
  databases: string[];
  cloudTechnologies: string[];
  softSkills: string[];
  roadmapStages: IRoadmapStage[];
  roadmapNodes: IRoadmapNode[];
  resources: ILearningResource[];
  projects: IProjectSuggestion[];
  marketAliases: string[];
  /** Set when an admin last reviewed the requirement matrix for this role. */
  requirementsReviewedAt?: Date;
  experienceExpectations?: string;
  portfolioExpectations?: string;
  isActive: boolean;
  lastReviewedAt?: Date;
}

export interface ICareerRoleModel extends Model<ICareerRole> {
  findBySlug(slug: string): Promise<ICareerRole | null>;
}

const roleSkillSchema = new Schema<IRoleSkill>({
  skillSlug: { type: String, required: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  priority: { type: String, enum: ['ESSENTIAL', 'RECOMMENDED', 'BONUS', 'OPTIONAL'], required: true },
  skillType: { type: String, required: true },
  // Defaults keep pre-matrix seed documents valid: legacy rows are treated as
  // CS_FUNDAMENTALS at "Working Knowledge" until an admin reviews them.
  category: { type: String, enum: REQUIREMENT_CATEGORIES, default: 'CS_FUNDAMENTALS' },
  requiredLevel: { type: Number, enum: REQUIRED_LEVELS, default: 2, min: 1, max: 4 },
  learningTopicSlug: { type: String, lowercase: true, trim: true },
  stageId: { type: String, trim: true },
}, { _id: false });

const roadmapNodeSchema = new Schema<IRoadmapNode>({
  id: { type: String, required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  whyItMatters: { type: String, trim: true },
  whatYouWillLearn: [{ type: String, trim: true }],
  keyConcepts: [{ type: String, trim: true }],
  skillSlugs: [{ type: String, lowercase: true, trim: true }],
  prerequisites: [{ type: String }],
  estimatedHours: { type: Number, min: 0 },
  resourceIds: [{ type: String }],
  quiz: [{
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    explanation: { type: String },
  }],
  project: {
    title: { type: String },
    description: { type: String },
    deliverables: [{ type: String }],
  },
  interviewQuestions: [{ type: String }],
}, { _id: false });

const roadmapStageSchema = new Schema<IRoadmapStage>({
  id: { type: String, required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  order: { type: Number, required: true },
  nodeIds: [{ type: String }],
}, { _id: false });

const resourceSchema = new Schema<ILearningResource>({
  id: { type: String, required: true },
  title: { type: String, required: true, trim: true },
  type: { type: String, enum: ['DOCUMENTATION', 'ARTICLE', 'VIDEO', 'COURSE', 'PRACTICE', 'PROJECT'], required: true },
  provider: { type: String, required: true, trim: true },
  url: { type: String, required: true },
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
  estimatedTime: { type: String },
}, { _id: false });

const projectSchema = new Schema<IProjectSuggestion>({
  title: { type: String, required: true, trim: true },
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], required: true },
  estimatedDuration: { type: String },
  description: { type: String, required: true },
  deliverables: [{ type: String }],
  skillSlugs: [{ type: String, lowercase: true, trim: true }],
}, { _id: false });

const careerRoleSchema = new Schema<ICareerRole, ICareerRoleModel>({
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  category: { type: String, required: true, index: true },
  responsibilities: [{ type: String }],
  skills: { type: [roleSkillSchema], default: [] },
  tools: [{ type: String }],
  frameworks: [{ type: String }],
  databases: [{ type: String }],
  cloudTechnologies: [{ type: String }],
  softSkills: [{ type: String }],
  roadmapStages: { type: [roadmapStageSchema], default: [] },
  roadmapNodes: { type: [roadmapNodeSchema], default: [] },
  resources: { type: [resourceSchema], default: [] },
  projects: { type: [projectSchema], default: [] },
  marketAliases: [{ type: String, lowercase: true, trim: true }],
  /** Set when an admin last reviewed the requirement matrix for this role. */
  requirementsReviewedAt: { type: Date },
  experienceExpectations: { type: String },
  portfolioExpectations: { type: String },
  isActive: { type: Boolean, default: true, index: true },
  lastReviewedAt: { type: Date },
}, { timestamps: true });

careerRoleSchema.index({ category: 1, isActive: 1 });
careerRoleSchema.index({ marketAliases: 1 });
careerRoleSchema.index({ 'skills.category': 1 });
careerRoleSchema.index({ 'skills.skillSlug': 1 });

careerRoleSchema.statics.findBySlug = function (slug: string) {
  return this.findOne({ slug: slug.toLowerCase() });
};

export const CareerRole = mongoose.model<ICareerRole, ICareerRoleModel>('CareerRole', careerRoleSchema);
