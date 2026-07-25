import { Schema, model, Document, Types } from 'mongoose';
import { OptionKey } from './AptitudeQuestion';

export type ResponseStatus =
  | 'not-visited'
  | 'not-answered'
  | 'answered'
  | 'marked-for-review'
  | 'answered-marked-for-review';

export interface IResponse {
  question: Types.ObjectId;
  selectedOption: OptionKey | null;
  status: ResponseStatus;
  timeSpentSeconds: number;
}

export interface IAIAnalysis {
  strongTopics: string[];
  weakTopics: string[];
  categoryPerformance: { category: string; accuracy: number }[];
  difficultyPerformance: { difficulty: string; accuracy: number }[];
  speedAnalysis: string;
  timeManagement: string;
  guessingBehaviorNote: string;
  recommendedPracticeAreas: string[];
  studyPlan: string[];
  placementReadinessScore: number; // 0-100
  motivationalFeedback: string;
  generatedAt: Date;
}

export interface IAptitudeAttempt extends Document {
  user: Types.ObjectId;
  test: Types.ObjectId;
  roundType: string;
  questions: Types.ObjectId[]; // fixed order, generated once at start
  responses: IResponse[];
  durationMinutes: number;
  startedAt: Date;
  submittedAt: Date | null;
  autoSubmitted: boolean;
  status: 'in-progress' | 'completed';

  // Scoring, filled in on submit
  score: number;
  totalMarks: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  accuracyPercent: number; // correct / attempted
  scorePercent: number; // score / totalMarks
  passStatus: 'pass' | 'fail' | null;

  aiAnalysis: IAIAnalysis | null;
}

const ResponseSchema = new Schema<IResponse>(
  {
    question: { type: Schema.Types.ObjectId, ref: 'AptitudeQuestion', required: true },
    selectedOption: { type: String, enum: ['A', 'B', 'C', 'D', null], default: null },
    status: {
      type: String,
      enum: ['not-visited', 'not-answered', 'answered', 'marked-for-review', 'answered-marked-for-review'],
      default: 'not-visited',
    },
    timeSpentSeconds: { type: Number, default: 0 },
  },
  { _id: false }
);

const AIAnalysisSchema = new Schema<IAIAnalysis>(
  {
    strongTopics: [String],
    weakTopics: [String],
    categoryPerformance: [{ category: String, accuracy: Number }],
    difficultyPerformance: [{ difficulty: String, accuracy: Number }],
    speedAnalysis: String,
    timeManagement: String,
    guessingBehaviorNote: String,
    recommendedPracticeAreas: [String],
    studyPlan: [String],
    placementReadinessScore: Number,
    motivationalFeedback: String,
    generatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const AptitudeAttemptSchema = new Schema<IAptitudeAttempt>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    test: { type: Schema.Types.ObjectId, ref: 'AptitudeTest', required: true },
    roundType: { type: String, required: true },
    questions: [{ type: Schema.Types.ObjectId, ref: 'AptitudeQuestion' }],
    responses: [ResponseSchema],
    durationMinutes: { type: Number, required: true },
    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: null },
    autoSubmitted: { type: Boolean, default: false },
    status: { type: String, enum: ['in-progress', 'completed'], default: 'in-progress', index: true },

    score: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    incorrectCount: { type: Number, default: 0 },
    unansweredCount: { type: Number, default: 0 },
    accuracyPercent: { type: Number, default: 0 },
    scorePercent: { type: Number, default: 0 },
    passStatus: { type: String, enum: ['pass', 'fail', null], default: null },

    aiAnalysis: { type: AIAnalysisSchema, default: null },
  },
  { timestamps: true }
);

AptitudeAttemptSchema.index({ user: 1, test: 1, status: 1 });

export default model<IAptitudeAttempt>('AptitudeAttempt', AptitudeAttemptSchema);
