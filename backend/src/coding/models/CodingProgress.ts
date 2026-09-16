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
  },
  { timestamps: true }
);

export default mongoose.model<ICodingProgress>('CodingProgress', codingProgressSchema);
