import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * AETHER Career Learning — structured course content (spec §45–47).
 *
 * Hierarchy: CareerRole → Roadmap Stage → Skill → Course → Module → Lesson →
 *            Quiz → Practice → Project.
 * The roadmap nodes (CareerRole.roadmapNodes) remain the skill graph; Courses
 * attach to roles+skills and provide structured lesson content, quizzes and
 * projects. Existing quiz/progress patterns (RoadmapProgress) are reused —
 * no duplicate quiz engine.
 */

// ── Course ───────────────────────────────────────────────────────────────────

export type CourseDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type CourseStatus = 'draft' | 'published' | 'archived';

export interface ILessonResource {
  title: string;
  url: string;
  provider: string;
  /** official docs / open resources only — never copyrighted course copies */
  type: 'DOCUMENTATION' | 'ARTICLE' | 'VIDEO' | 'PRACTICE';
  estimatedTime?: string;
}

export interface ILessonExercise {
  prompt: string;
  hint?: string;
  expectedKeywords: string[];
}

export interface ILesson {
  id: string;
  title: string;
  /** Markdown text explanation */
  content: string;
  codeExamples: Array<{ language: string; code: string; caption?: string }>;
  resources: ILessonResource[];
  exercises: ILessonExercise[];
  estimatedMinutes: number;
  order: number;
}

export interface IQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  /** topic mastery tag, e.g. "http-methods" */
  topicTag: string;
}

export interface ICourseModule {
  id: string;
  title: string;
  description: string;
  order: number;
  lessons: ILesson[];
  quiz: IQuizQuestion[];
  /** module-level mini project */
  project?: {
    title: string;
    description: string;
    deliverables: string[];
    skillsDemonstrated: string[];
  } | null;
}

export interface ICourse extends Document {
  title: string;
  slug: string;
  description: string;
  roleSlugs: string[];
  skillSlugs: string[];
  /** roadmap node this course belongs to (drawer integration) */
  roadmapNodeId?: string;
  difficulty: CourseDifficulty;
  estimatedHours: number;
  prerequisites: string[]; // course slugs
  modules: ICourseModule[];
  status: CourseStatus;
  createdAt: Date;
  updatedAt: Date;
}

const courseSchema = new Schema<ICourse>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, required: true },
    roleSlugs: { type: [String], default: [], index: true },
    skillSlugs: { type: [String], default: [], index: true },
    roadmapNodeId: { type: String, default: undefined },
    difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], required: true },
    estimatedHours: { type: Number, required: true, min: 0.5, max: 200 },
    prerequisites: { type: [String], default: [] },
    modules: { type: Schema.Types.Mixed, default: [] },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'published', index: true },
  },
  { timestamps: true }
);

courseSchema.index({ roleSlugs: 1, skillSlugs: 1 });

// ── Learning progress (server-side persisted, spec §50) ─────────────────────

export type LessonState = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface ILessonProgress {
  lessonId: string;
  state: LessonState;
  completedAt?: Date;
  updatedAt: Date;
}

export interface IModuleQuizScore {
  moduleId: string;
  score: number; // 0-100
  attempts: number;
  lastAttemptAt: Date;
}

export interface ILearningProgress extends Document {
  userId: mongoose.Types.ObjectId;
  courseSlug: string;
  roleSlug: string;
  lessons: ILessonProgress[];
  quizScores: IModuleQuizScore[];
  projectsCompleted: string[];
  startedAt: Date;
  updatedAt: Date;
}

export interface ILearningProgressModel extends Model<ILearningProgress> {
  findByUserAndCourse(userId: string, courseSlug: string): Promise<ILearningProgress | null>;
}

const learningProgressSchema = new Schema<ILearningProgress, ILearningProgressModel>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseSlug: { type: String, required: true, lowercase: true, trim: true, index: true },
    roleSlug: { type: String, default: '', index: true },
    lessons: {
      type: [{
        lessonId: { type: String, required: true },
        state: { type: String, enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'], default: 'NOT_STARTED' },
        completedAt: { type: Date },
        updatedAt: { type: Date, default: Date.now },
      }],
      default: [],
    },
    quizScores: {
      type: [{
        moduleId: { type: String, required: true },
        score: { type: Number, min: 0, max: 100, default: 0 },
        attempts: { type: Number, default: 0 },
        lastAttemptAt: { type: Date, default: Date.now },
      }],
      default: [],
    },
    projectsCompleted: { type: [String], default: [] },
    startedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One progress doc per user+course — upsert target.
learningProgressSchema.index({ userId: 1, courseSlug: 1 }, { unique: true });

learningProgressSchema.statics.findByUserAndCourse = function (userId: string, courseSlug: string) {
  return this.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    courseSlug: courseSlug.toLowerCase(),
  });
};

export const Course = mongoose.model<ICourse, Model<ICourse>>('Course', courseSchema);
export const LearningProgress = mongoose.model<ILearningProgress, ILearningProgressModel>('LearningProgress', learningProgressSchema);
