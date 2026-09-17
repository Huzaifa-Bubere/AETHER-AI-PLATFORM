import mongoose, { Document, Schema } from 'mongoose';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type Verdict = 'poor' | 'below-average' | 'average' | 'good' | 'excellent';

export interface IPlanItem {
  topic: string;
  planned: number;
  asked: number;
  avgScore?: number;
}

export interface IAdaptiveQuestion {
  id: string;
  text: string;
  topic: string;
  difficulty: Difficulty;
  depth: 'starter' | 'follow-up' | 'deep-dive' | 'scenario';
  expectedKeywords: string[];
  basedOn?: string; // questionId whose answer produced this question
  askedAt: Date;
}

export interface IAdaptiveResponse {
  questionId: string;
  questionText: string;
  topic: string;
  answer: string;
  durationSeconds: number;
  scores: {
    correctness: number;
    depth: number;
    communication: number;
    confidence: number;
  };
  overallScore: number;
  verdict: Verdict;
  strengths: string[];
  improvements: string[];
  matchedKeywords: string[];
  missingKeywords: string[];
  aiSummary: string;
  nextFocus: string | null;
  timestamp: Date;
}

export type ProctorEventType =
  | 'tab-switch'
  | 'window-blur'
  | 'copy-attempt'
  | 'paste-attempt'
  | 'screenshot-key'
  | 'devtools-shortcut'
  | 'fullscreen-exit'
  | 'camera-off'
  | 'mic-off'
  | 'face-missing'
  | 'no-face-long';

export interface IProctorEvent {
  type: ProctorEventType;
  at: Date;
  detail?: string;
}

export interface ITopicPerformance {
  topic: string;
  questionsAsked: number;
  avgScore: number;
  verdict: Verdict;
}

export interface IAdaptiveReport {
  overallScore: number;
  domainReadiness: 'needs-work' | 'developing' | 'competent' | 'strong' | 'placement-ready';
  topicPerformance: ITopicPerformance[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  suggestedLearningPath: string[];
  summary: string;
  integrity: {
    score: number;
    eventCounts: Record<string, number>;
    note: string;
  };
  generatedAt: Date;
  source: 'ai' | 'computed';
}

export interface IAdaptiveInterview extends Document {
  userId: mongoose.Types.ObjectId;
  domain: string;
  role: string;
  difficulty: Difficulty;
  plannedQuestions: number;
  status: 'in-progress' | 'completed' | 'abandoned';
  plan: IPlanItem[];
  questions: IAdaptiveQuestion[];
  responses: IAdaptiveResponse[];
  proctorEvents: IProctorEvent[];
  integrityScore: number;
  /** Set when the session was force-ended by the shared integrity system (5 warnings). */
  terminationReason?: 'INTEGRITY_WARNING_LIMIT' | 'USER_ENDED' | 'COMPLETED' | null;
  report: IAdaptiveReport | null;
  startedAt: Date;
  endedAt?: Date;
  recording?: {
    url: string;
    publicId: string;
    storageType: 'cloudinary' | 'local';
    mimeType: string;
    sizeBytes: number;
    durationSeconds?: number;
    uploadedAt: Date;
  } | null;
}

const planItemSchema = new Schema<IPlanItem>(
  {
    topic: { type: String, required: true, trim: true },
    planned: { type: Number, required: true, min: 1 },
    asked: { type: Number, default: 0 },
    avgScore: { type: Number, default: undefined },
  },
  { _id: false },
);

const questionSchema = new Schema<IAdaptiveQuestion>(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    topic: { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    depth: { type: String, enum: ['starter', 'follow-up', 'deep-dive', 'scenario'], default: 'starter' },
    expectedKeywords: { type: [String], default: [] },
    basedOn: { type: String, default: null },
    askedAt: { type: Date, required: true },
  },
  { _id: false },
);

const responseSchema = new Schema<IAdaptiveResponse>(
  {
    questionId: { type: String, required: true },
    questionText: { type: String, default: '' },
    topic: { type: String, default: '' },
    answer: { type: String, default: '' },
    durationSeconds: { type: Number, default: 0 },
    scores: {
      correctness: { type: Number, default: 0 },
      depth: { type: Number, default: 0 },
      communication: { type: Number, default: 0 },
      confidence: { type: Number, default: 0 },
    },
    overallScore: { type: Number, default: 0 },
    verdict: { type: String, enum: ['poor', 'below-average', 'average', 'good', 'excellent'], default: 'average' },
    strengths: { type: [String], default: [] },
    improvements: { type: [String], default: [] },
    matchedKeywords: { type: [String], default: [] },
    missingKeywords: { type: [String], default: [] },
    aiSummary: { type: String, default: '' },
    nextFocus: { type: String, default: null },
    timestamp: { type: Date, required: true },
  },
  { _id: false },
);

const proctorEventSchema = new Schema<IProctorEvent>(
  {
    type: {
      type: String,
      enum: [
        'tab-switch', 'window-blur', 'copy-attempt', 'paste-attempt', 'screenshot-key',
        'devtools-shortcut', 'fullscreen-exit', 'camera-off', 'mic-off', 'face-missing', 'no-face-long',
      ],
      required: true,
    },
    at: { type: Date, required: true },
    detail: { type: String, default: '' },
  },
  { _id: false },
);

const reportSchema = new Schema<IAdaptiveReport>(
  {
    overallScore: { type: Number, required: true },
    domainReadiness: { type: String, enum: ['needs-work', 'developing', 'competent', 'strong', 'placement-ready'], required: true },
    topicPerformance: [{
      topic: String,
      questionsAsked: Number,
      avgScore: Number,
      verdict: String,
    }],
    strengths: [String],
    weaknesses: [String],
    recommendations: [String],
    suggestedLearningPath: [String],
    summary: String,
    integrity: {
      score: Number,
      eventCounts: Schema.Types.Mixed,
      note: String,
    },
    generatedAt: { type: Date, default: Date.now },
    source: { type: String, enum: ['ai', 'computed'], default: 'computed' },
  },
  { _id: false },
);

const adaptiveInterviewSchema = new Schema<IAdaptiveInterview>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    domain: { type: String, required: true, trim: true },
    role: { type: String, default: '', trim: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    plannedQuestions: { type: Number, required: true, min: 3, max: 15 },
    status: { type: String, enum: ['in-progress', 'completed', 'abandoned'], default: 'in-progress', index: true },
    plan: { type: [planItemSchema], default: [] },
    questions: { type: [questionSchema], default: [] },
    responses: { type: [responseSchema], default: [] },
    proctorEvents: { type: [proctorEventSchema], default: [] },
    integrityScore: { type: Number, default: 100 },
    terminationReason: { type: String, enum: ['INTEGRITY_WARNING_LIMIT', 'USER_ENDED', 'COMPLETED', null], default: null },
    report: { type: reportSchema, default: null },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    recording: {
      type: {
        url: { type: String, default: null },
        publicId: { type: String, default: null },
        storageType: { type: String, enum: ['cloudinary', 'local'], default: 'local' },
        mimeType: { type: String, default: 'video/webm' },
        sizeBytes: { type: Number, default: 0 },
        durationSeconds: { type: Number, default: undefined },
        uploadedAt: { type: Date, default: Date.now },
      },
      default: null,
    },
  },
  { timestamps: true },
);

adaptiveInterviewSchema.index({ userId: 1, createdAt: -1 });
adaptiveInterviewSchema.index({ domain: 1 });

// ── Integrity scoring: deterministic deduction per proctor event ─────────────
export const PROCTOR_DEDUCTIONS: Record<ProctorEventType, number> = {
  'tab-switch': 8,
  'window-blur': 4,
  'copy-attempt': 6,
  'paste-attempt': 10,
  'screenshot-key': 3,
  'devtools-shortcut': 5,
  'fullscreen-exit': 5,
  'camera-off': 7,
  'mic-off': 4,
  'face-missing': 3,
  'no-face-long': 8,
};

export function computeIntegrityScore(events: IProctorEvent[]): number {
  const totals = new Map<string, number>();
  for (const e of events) totals.set(e.type, (totals.get(e.type) || 0) + 1);
  let score = 100;
  for (const [type, count] of totals) {
    const d = PROCTOR_DEDUCTIONS[type as ProctorEventType] ?? 2;
    // First occurrence full deduction, repeats at half weight to avoid single bad-network run nuking the score.
    score -= d + Math.max(0, count - 1) * d * 0.5;
  }
  return Math.max(0, Math.round(score));
}

export default mongoose.model<IAdaptiveInterview>('AdaptiveInterview', adaptiveInterviewSchema);
