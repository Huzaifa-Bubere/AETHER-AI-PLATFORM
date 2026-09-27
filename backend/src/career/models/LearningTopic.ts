import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * AETHER Career Learning — database-backed topic content (spec §37–§38).
 *
 * A topic is the actual lesson page a candidate lands on when they click a
 * roadmap node (e.g. "Python"). EVERYTHING on that page comes from here:
 * overview, learning objectives, structured content blocks, multiple worked
 * examples, common mistakes, interview relevance, practice, resources, video
 * references, prerequisites and related/next topics.
 *
 * The page never depends on AI: Gemini is only the supplementary "Ask AETHER"
 * layer (spec §55–§56).
 */

export type TopicLevel = 'beginner' | 'intermediate' | 'advanced';
export type TopicStatus = 'draft' | 'review' | 'published' | 'archived';
export type TopicSource = 'ORIGINAL' | 'CURATED' | 'IMPORTED';

/** Reusable content blocks — the frontend renders these dynamically (§38). */
export type TopicBlockType =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'code'
  | 'tip'
  | 'warning'
  | 'note'
  | 'table'
  | 'steps'
  | 'compare';

export interface ITopicBlock {
  type: TopicBlockType;
  /** heading / paragraph / tip / warning / note text */
  content?: string;
  /** list / steps items */
  items?: string[];
  /** table header */
  columns?: string[];
  /** table rows, aligned to `columns` */
  rows?: string[][];
  /** compare blocks: title + 2 or more columns of pros/cons text */
  leftTitle?: string;
  rightTitle?: string;
  leftItems?: string[];
  rightItems?: string[];
  /** code blocks */
  language?: string;
  code?: string;
  output?: string;
  caption?: string;
}

export interface ITopicExample {
  title: string;
  /** e.g. "Simple", "User input", "Real world", "Interview style" */
  kind: string;
  explanation: string;
  language: string;
  code: string;
  output?: string;
}

export interface ITopicCommonMistake {
  title: string;
  wrong: string;
  wrongLanguage?: string;
  why: string;
  fix?: string;
  fixLanguage?: string;
}

export interface ITopicInterviewTip {
  question: string;
  answer: string;
  difficulty?: TopicLevel;
}

export interface ITopicPractice {
  level: 'EASY' | 'MEDIUM' | 'CHALLENGE';
  prompt: string;
  hint?: string;
  /** deterministic hint-only grading keywords (never auto-graded as correct) */
  expectedKeywords?: string[];
}

export interface ITopicQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: TopicLevel;
  /** fine-grained topic for wrong-answer recommendations (§58) */
  topicTag: string;
}

export interface ITopicResource {
  title: string;
  url: string;
  provider: string;
  type: 'DOCUMENTATION' | 'ARTICLE' | 'VIDEO' | 'PRACTICE' | 'BOOK';
}

export interface ILearningTopic extends Document {
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  whyItMatters: string;
  interviewRelevance: string;
  /** taxonomy links — all optional so a topic can exist standalone */
  skillSlugs: string[];
  roleSlugs: string[];
  roadmapNodeIds: string[];
  courseSlugs: string[];
  moduleId?: string;
  stageId?: string;
  /** display grouping in the course navigation column */
  group: string;
  order: number;
  level: TopicLevel;
  estimatedMinutes: number;
  /** topic slugs that should be learned first */
  prerequisites: string[];
  learningObjectives: string[];
  /** optional prerequisite that is explicitly fine to skip */
  optionalPrerequisites: string[];
  sections: ITopicBlock[];
  examples: ITopicExample[];
  commonMistakes: ITopicCommonMistake[];
  interviewTips: ITopicInterviewTip[];
  practice: ITopicPractice[];
  quiz: ITopicQuizQuestion[];
  resources: ITopicResource[];
  nextTopicSlugs: string[];
  relatedTopicSlugs: string[];
  status: TopicStatus;
  contentVersion: number;
  source: TopicSource;
  reviewedBy?: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILearningTopicModel extends Model<ILearningTopic> {
  findPublishedBySlug(slug: string): Promise<ILearningTopic | null>;
}

// ── Sub-schemas ──────────────────────────────────────────────────────────────

const blockSchema = new Schema<ITopicBlock>({
  type: {
    type: String,
    enum: ['heading', 'paragraph', 'list', 'code', 'tip', 'warning', 'note', 'table', 'steps', 'compare'],
    required: true,
  },
  content: String,
  items: [String],
  columns: [String],
  rows: [[String]],
  leftTitle: String,
  rightTitle: String,
  leftItems: [String],
  rightItems: [String],
  language: String,
  code: String,
  output: String,
  caption: String,
}, { _id: false });

const exampleSchema = new Schema<ITopicExample>({
  title: { type: String, required: true },
  kind: { type: String, required: true },
  explanation: { type: String, default: '' },
  language: { type: String, required: true },
  code: { type: String, required: true },
  output: String,
}, { _id: false });

const commonMistakeSchema = new Schema<ITopicCommonMistake>({
  title: { type: String, required: true },
  wrong: { type: String, required: true },
  wrongLanguage: String,
  why: { type: String, required: true },
  fix: String,
  fixLanguage: String,
}, { _id: false });

const interviewTipSchema = new Schema<ITopicInterviewTip>({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
}, { _id: false });

const practiceSchema = new Schema<ITopicPractice>({
  level: { type: String, enum: ['EASY', 'MEDIUM', 'CHALLENGE'], required: true },
  prompt: { type: String, required: true },
  hint: String,
  expectedKeywords: [String],
}, { _id: false });

const quizQuestionSchema = new Schema<ITopicQuizQuestion>({
  id: { type: String, required: true },
  question: { type: String, required: true },
  options: { type: [String], required: true },
  correctIndex: { type: Number, required: true, min: 0 },
  explanation: { type: String, default: '' },
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
  topicTag: { type: String, default: 'general' },
}, { _id: false });

const resourceSchema = new Schema<ITopicResource>({
  title: { type: String, required: true },
  url: { type: String, required: true },
  provider: { type: String, required: true },
  type: { type: String, enum: ['DOCUMENTATION', 'ARTICLE', 'VIDEO', 'PRACTICE', 'BOOK'], default: 'DOCUMENTATION' },
}, { _id: false });

// ── Main schema ──────────────────────────────────────────────────────────────

const learningTopicSchema = new Schema<ILearningTopic, ILearningTopicModel>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    shortDescription: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    whyItMatters: { type: String, default: '' },
    interviewRelevance: { type: String, default: '' },

    skillSlugs: { type: [String], default: [], index: true },
    roleSlugs: { type: [String], default: [], index: true },
    roadmapNodeIds: { type: [String], default: [], index: true },
    courseSlugs: { type: [String], default: [], index: true },
    moduleId: { type: String },
    stageId: { type: String },

    group: { type: String, default: 'General', index: true },
    order: { type: Number, default: 0 },
    level: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner', index: true },
    estimatedMinutes: { type: Number, default: 30, min: 1, max: 600 },

    prerequisites: { type: [String], default: [] },
    optionalPrerequisites: { type: [String], default: [] },
    learningObjectives: { type: [String], default: [] },

    sections: { type: [blockSchema], default: [] },
    examples: { type: [exampleSchema], default: [] },
    commonMistakes: { type: [commonMistakeSchema], default: [] },
    interviewTips: { type: [interviewTipSchema], default: [] },
    practice: { type: [practiceSchema], default: [] },
    quiz: { type: [quizQuestionSchema], default: [] },
    resources: { type: [resourceSchema], default: [] },

    nextTopicSlugs: { type: [String], default: [] },
    relatedTopicSlugs: { type: [String], default: [] },

    status: { type: String, enum: ['draft', 'review', 'published', 'archived'], default: 'draft', index: true },
    contentVersion: { type: Number, default: 1 },
    source: { type: String, enum: ['ORIGINAL', 'CURATED', 'IMPORTED'], default: 'ORIGINAL' },
    reviewedBy: String,
    publishedAt: Date,
  },
  { timestamps: true }
);

learningTopicSchema.index({ status: 1, group: 1, order: 1 });
learningTopicSchema.index({ title: 'text', shortDescription: 'text', description: 'text' });

learningTopicSchema.statics.findPublishedBySlug = function (slug: string) {
  return this.findOne({ slug: String(slug).toLowerCase(), status: 'published' });
};

export const LearningTopic = mongoose.model<ILearningTopic, ILearningTopicModel>('LearningTopic', learningTopicSchema);
