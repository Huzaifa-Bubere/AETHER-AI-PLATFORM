import mongoose, { Document, Schema } from 'mongoose';

export interface IPracticeSession extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'behavioral' | 'technical' | 'coding' | 'system-design';
  difficulty: 'easy' | 'medium' | 'hard';
  role: string;
  status: 'active' | 'completed';
  questions: Array<{
    id: string;
    text: string;
    type: string;
    difficulty: string;
    expectedDuration: number;
    category?: string;
    followUpQuestions?: string[];
  }>;
  responses: Array<{
    questionId: string;
    answer: string;
    analysis?: {
      scores?: Record<string, number>;
      overallScore?: number;
      strengths?: string[];
      improvements?: string[];
      feedback?: string;
    };
    timestamp: Date;
  }>;
  summary?: {
    totalQuestions: number;
    answeredQuestions: number;
    averageScore: number;
    duration: number; // minutes
  };
  startTime: Date;
  endTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PracticeSessionSchema = new Schema<IPracticeSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['behavioral', 'technical', 'coding', 'system-design'],
      required: true,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      required: true,
    },
    role: { type: String, default: 'Software Engineer' },
    status: { type: String, enum: ['active', 'completed'], default: 'active' },
    questions: [
      {
        id: String,
        text: String,
        type: String,
        difficulty: String,
        expectedDuration: Number,
        category: String,
        followUpQuestions: [String],
      },
    ],
    responses: [
      {
        questionId: String,
        answer: String,
        analysis: {
          scores: { type: Map, of: Number },
          overallScore: Number,
          strengths: [String],
          improvements: [String],
          feedback: String,
        },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    summary: {
      totalQuestions: Number,
      answeredQuestions: Number,
      averageScore: Number,
      duration: Number,
    },
    startTime: { type: Date, default: Date.now },
    endTime: Date,
  },
  { timestamps: true }
);

export default mongoose.model<IPracticeSession>('PracticeSession', PracticeSessionSchema);
