import mongoose, { Schema, Document } from 'mongoose';

export interface ICodingProgress extends Document {
  user: mongoose.Types.ObjectId;
  solvedProblems: Array<{ problemId: mongoose.Types.ObjectId; solvedAt: Date }>;
  attemptedProblems: Array<{ problemId: mongoose.Types.ObjectId; lastAttemptAt: Date; attemptCount: number }>;
  topicStats: Array<{
    topic: string;
    solved: number;
    attempted: number;
    averageScore: number;
    lastPracticedAt?: Date;
  }>;
  difficultyStats: Array<{
    difficulty: 'Easy' | 'Medium' | 'Hard';
    solved: number;
    attempted: number;
  }>;
  streak: { current: number; longest: number; lastActiveDate?: Date };
  totalSubmissions: number;
  acceptedSubmissions: number;
  averageCodingScore: number;
  languageUsage: Array<{ language: string; count: number }>;
  recentActivity: Array<{ date: Date; submissions: number }>;
  /**
   * Complexity-optimization analytics (AETHER Part A, spec §11).
   * Every value is a count of real stored submissions that carried a
   * deterministic complexity comparison — no estimates, no randomness.
   */
  complexityStats: {
    tracked: number;
    efficient: number;
    optimizable: number;
    clearOpportunities: number;
    unknown: number;
    byTopic: Array<{
      topic: string;
      tracked: number;
      efficient: number;
      optimizable: number;
      unknown: number;
    }>;
  };
}

const codingProgressSchema = new Schema<ICodingProgress>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    solvedProblems: [
      { problemId: { type: Schema.Types.ObjectId, ref: 'CodingProblem' }, solvedAt: Date, _id: false },
    ],
    attemptedProblems: [
      {
        problemId: { type: Schema.Types.ObjectId, ref: 'CodingProblem' },
        lastAttemptAt: Date,
        attemptCount: { type: Number, default: 1 },
        _id: false,
      },
    ],
    topicStats: [
      {
        topic: String,
        solved: { type: Number, default: 0 },
        attempted: { type: Number, default: 0 },
        averageScore: { type: Number, default: 0 },
        lastPracticedAt: Date,
        _id: false,
      },
    ],
    difficultyStats: [
      {
        difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'] },
        solved: { type: Number, default: 0 },
        attempted: { type: Number, default: 0 },
        _id: false,
      },
    ],
    streak: {
      current: { type: Number, default: 0 },
      longest: { type: Number, default: 0 },
      lastActiveDate: Date,
    },
    totalSubmissions: { type: Number, default: 0 },
    acceptedSubmissions: { type: Number, default: 0 },
    averageCodingScore: { type: Number, default: 0 },
    languageUsage: [{ language: String, count: { type: Number, default: 0 }, _id: false }],
    recentActivity: [{ date: Date, submissions: Number, _id: false }],
    complexityStats: {
      type: {
        tracked: { type: Number, default: 0 },
        efficient: { type: Number, default: 0 },
        optimizable: { type: Number, default: 0 },
        clearOpportunities: { type: Number, default: 0 },
        unknown: { type: Number, default: 0 },
        byTopic: [
          {
            topic: String,
            tracked: { type: Number, default: 0 },
            efficient: { type: Number, default: 0 },
            optimizable: { type: Number, default: 0 },
            unknown: { type: Number, default: 0 },
            _id: false,
          },
        ],
      },
      default: () => ({ tracked: 0, efficient: 0, optimizable: 0, clearOpportunities: 0, unknown: 0, byTopic: [] }),
    },
  },
  { timestamps: true }
);

export default mongoose.model<ICodingProgress>('CodingProgress', codingProgressSchema);
