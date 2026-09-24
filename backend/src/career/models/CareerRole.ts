import mongoose, { Document, Schema, Model } from 'mongoose';
import type { SkillType } from './Skill';

export type SkillPriority = 'ESSENTIAL' | 'RECOMMENDED' | 'OPTIONAL';

export interface IRoleSkill {
  skillSlug: string;
  name: string;
  priority: SkillPriority;
  skillType: SkillType;
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
  priority: { type: String, enum: ['ESSENTIAL', 'RECOMMENDED', 'OPTIONAL'], required: true },
  skillType: { type: String, required: true },
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
  experienceExpectations: { type: String },
  portfolioExpectations: { type: String },
  isActive: { type: Boolean, default: true, index: true },
  lastReviewedAt: { type: Date },
}, { timestamps: true });

careerRoleSchema.index({ category: 1, isActive: 1 });
careerRoleSchema.index({ marketAliases: 1 });

careerRoleSchema.statics.findBySlug = function (slug: string) {
  return this.findOne({ slug: slug.toLowerCase() });
};

export const CareerRole = mongoose.model<ICareerRole, ICareerRoleModel>('CareerRole', careerRoleSchema);
