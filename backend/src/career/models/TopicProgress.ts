import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * AETHER Career Learning — per-user topic progress (spec §50–§51).
 *
 * States are persisted server-side so a refresh always restores the same state:
 *   NOT_STARTED · IN_PROGRESS · COMPLETED · REVIEW_NEEDED
 *
 * Bookmarks, notes and quiz attempts live here too, so the learning tools
 * column is real persisted data rather than component state.
 */

export type TopicState = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'REVIEW_NEEDED';

export interface IQuizAttempt {
  score: number;         // 0-100
  correct: number;
  total: number;
  /** topicTags the candidate answered incorrectly — drives recommendations */
  weakTags: string[];
  answers: number[];
  attemptedAt: Date;
}

export interface ITopicProgress extends Document {
  userId: mongoose.Types.ObjectId;
  topicSlug: string;
  state: TopicState;
  bookmarked: boolean;
  notes: string;
  /** last visited block index for "continue learning" */
  lastBlockIndex: number;
  quizAttempts: IQuizAttempt[];
  bestQuizScore: number | null;
  startedAt: Date;
  completedAt?: Date;
  updatedAt: Date;
}

export interface ITopicProgressModel extends Model<ITopicProgress> {
  findByUserAndTopic(userId: string, topicSlug: string): Promise<ITopicProgress | null>;
}

const quizAttemptSchema = new Schema<IQuizAttempt>({
  score: { type: Number, required: true, min: 0, max: 100 },
  correct: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  weakTags: { type: [String], default: [] },
  answers: { type: [Number], default: [] },
  attemptedAt: { type: Date, default: Date.now },
}, { _id: false });

const topicProgressSchema = new Schema<ITopicProgress, ITopicProgressModel>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    topicSlug: { type: String, required: true, lowercase: true, trim: true, index: true },
    state: {
      type: String,
      enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'REVIEW_NEEDED'],
      default: 'IN_PROGRESS',
      index: true,
    },
    bookmarked: { type: Boolean, default: false },
    notes: { type: String, default: '' },
    lastBlockIndex: { type: Number, default: 0 },
    quizAttempts: { type: [quizAttemptSchema], default: [] },
    bestQuizScore: { type: Number, default: null },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

// One progress document per user+topic.
topicProgressSchema.index({ userId: 1, topicSlug: 1 }, { unique: true });
topicProgressSchema.index({ userId: 1, updatedAt: -1 });

topicProgressSchema.statics.findByUserAndTopic = function (userId: string, topicSlug: string) {
  return this.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    topicSlug: String(topicSlug).toLowerCase(),
  });
};

export const TopicProgress = mongoose.model<ITopicProgress, ITopicProgressModel>('TopicProgress', topicProgressSchema);
