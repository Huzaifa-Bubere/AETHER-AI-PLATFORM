import mongoose, { Schema, Document } from 'mongoose';

export interface ICodingSubmission extends Document {
  user: mongoose.Types.ObjectId;
  problem: mongoose.Types.ObjectId;
  language: string;
  sourceCode: string;
  status: string;
  tests: Array<{
    index: number;
    input: string;
    expectedOutput: string;
    actualOutput: string;
    passed: boolean;
    executionTimeMs?: number;
    error?: string;
    hidden: boolean;
  }>;
  passedTests: number;
  totalTests: number;
  runtimeMs: number;
  memoryKb: number | null;
  executor: string;
  compileOutput?: string;
  stderr?: string;
  astAnalysis: unknown | null;
  scoreBreakdown: unknown | null;
  overallScore: number | null;
  explanation: unknown | null;
  submittedAt: Date;
}

const codingSubmissionSchema = new Schema<ICodingSubmission>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    problem: { type: Schema.Types.ObjectId, ref: 'CodingProblem', required: true, index: true },
    language: { type: String, required: true },
    sourceCode: { type: String, required: true },
    status: { type: String, required: true, index: true },
    tests: [
      {
        index: Number,
        input: String,
        expectedOutput: String,
        actualOutput: String,
        passed: Boolean,
        executionTimeMs: Number,
        error: String,
        hidden: Boolean,
        _id: false,
      },
    ],
    passedTests: { type: Number, default: 0 },
    totalTests: { type: Number, default: 0 },
    runtimeMs: { type: Number, default: 0 },
    memoryKb: { type: Number, default: null },
    executor: { type: String, default: 'judge0' },
    compileOutput: { type: String },
    stderr: { type: String },
    astAnalysis: { type: Schema.Types.Mixed, default: null },
    scoreBreakdown: { type: Schema.Types.Mixed, default: null },
    overallScore: { type: Number, default: null },
    explanation: { type: Schema.Types.Mixed, default: null },
    submittedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// Latest submissions per user
codingSubmissionSchema.index({ user: 1, submittedAt: -1 });
// One submission per user/problem/language for progress lookups
codingSubmissionSchema.index({ user: 1, problem: 1, language: 1 });

export default mongoose.model<ICodingSubmission>('CodingSubmission', codingSubmissionSchema);
