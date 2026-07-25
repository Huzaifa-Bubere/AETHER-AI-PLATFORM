import mongoose, { Document, Schema } from 'mongoose';

export interface IInterview extends Document {
  userId: mongoose.Types.ObjectId;
  resumeId?: mongoose.Types.ObjectId;
  type: 'behavioral' | 'technical' | 'coding' | 'system-design' | 'skill-based';
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  scheduledTime?: Date;
  settings: {
    role: string;
    difficulty: 'easy' | 'medium' | 'hard';
    duration: number; // in minutes
    includeVideo: boolean;
    includeAudio: boolean;
    includeCoding: boolean;
  };
  questions: Array<{
    id: string;
    text: string;
    type: 'behavioral' | 'technical' | 'coding' | 'skill-based';
    difficulty: string;
    expectedDuration: number;
    followUpQuestions?: string[];
    category?: string;
  }>;
  responses: Array<{
    questionId: string;
    answer: string;
    audioUrl?: string;
    videoUrl?: string;
    codeSubmission?: {
      language: string;
      code: string;
      testResults?: Array<{
        input: string;
        expectedOutput: string;
        actualOutput: string;
        passed: boolean;
      }>;
    };
    duration: number;
    timestamp: Date;
  }>;
  analysis?: {
    videoMetrics: {
      eyeContactPercentage: number;
      emotionAnalysis: Array<{
        timestamp: number;
        emotions: {
          happy: number;
          confident: number;
          nervous: number;
          focused: number;
        };
      }>;
      postureScore: number;
      gestureAnalysis: Array<{
        timestamp: number;
        gestures: string[];
        appropriateness: number;
      }>;
      confidenceLevel: number;
    };
    audioMetrics: {
      speechRate: number; // words per minute
      pauseAnalysis: Array<{
        timestamp: number;
        duration: number;
        type: 'natural' | 'hesitation' | 'thinking';
      }>;
      fillerWords: Array<{
        word: string;
        count: number;
        timestamps: number[];
      }>;
      toneAnalysis: Array<{
        timestamp: number;
        tone: 'confident' | 'uncertain' | 'enthusiastic' | 'monotone';
        intensity: number;
      }>;
      clarityScore: number;
    };
    contentMetrics: {
      relevanceScore: number;
      technicalAccuracy: number;
      communicationClarity: number;
      structureScore: number;
      keywordMatches: string[];
    };
    overallScore: number;
  };
  feedback?: {
    overallRating: number;
    strengths: string[];
    improvements: string[];
    recommendations: string[];
    detailedFeedback: string;
    skillAssessment: Array<{
      skill: string;
      currentLevel: number;
      targetLevel: number;
      feedback: string;
    }>;
    nextSteps: string[];
  };
  session: {
    startTime?: Date;
    endTime?: Date;
    actualDuration?: number; // in minutes
    recordingUrls?: {
      video?: string;
      audio?: string;
    };
    metadata?: {
      browserInfo?: string;
      deviceInfo?: string;
      networkQuality?: string;
      reminderEnabled?: boolean;
      reminderSent?: boolean;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const interviewSchema = new Schema<IInterview>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  resumeId: {
    type: Schema.Types.ObjectId,
    ref: 'Resume',
    default: null,
  },
  type: {
  type: String,
  enum: [
    'behavioral',
    'technical',
    'coding',
    'system-design',
    'skill-based' // ⭐ ADD THIS
  ],
  required: true,
},
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
    default: 'scheduled',
    index: true,
  },
  scheduledTime: {
    type: Date,
    default: null,
    index: true,
  },
  settings: {
    role: {
      type: String,
      required: true,
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      required: true,
    },
    duration: {
      type: Number,
      required: true,
      min: 15,
      max: 120,
    },
    includeVideo: {
      type: Boolean,
      default: true,
    },
    includeAudio: {
      type: Boolean,
      default: true,
    },
    includeCoding: {
      type: Boolean,
      default: false,
    },
  },
  questions: [{
    id: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: null,
    },
    type: {
      type: String,
      enum: [
        'behavioral',
        'technical',
        'coding',
        'skill-based'
      ],
    },
    difficulty: {
      type: String,
      required: true,
    },
    expectedDuration: {
      type: Number,
      required: true,
    },
    followUpQuestions: [{
      type: String,
    }],
    category: {
      type: String,
      default: null,
    },
    examples: [{
      input: { type: Schema.Types.Mixed, default: null },
      output: { type: Schema.Types.Mixed, default: null },
      explanation: { type: String, default: null },
    }],
    constraints: [{
      type: String,
    }],
    testCases: [{
      input: { type: Schema.Types.Mixed, default: null },
      expectedOutput: { type: Schema.Types.Mixed, default: null },
    }],
  }],
  responses: [{
    questionId: {
      type: String,
      required: true,
    },
    answer: {
      type: String,
      default: '',
    },
    audioUrl: {
      type: String,
      default: null,
    },
    videoUrl: {
      type: String,
      default: null,
    },
    codeSubmission: {
      language: {
        type: String,
        default: null,
      },
      code: {
        type: String,
        default: null,
      },
      testResults: [{
        input: { type: Schema.Types.Mixed, default: null },
        expectedOutput: { type: Schema.Types.Mixed, default: null },
        actualOutput: { type: Schema.Types.Mixed, default: null },
        passed: Boolean,
      }],
    },
    duration: {
      type: Number,
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
    },
  }],
  analysis: {
    videoMetrics: {
      eyeContactPercentage: Number,
      emotionAnalysis: [{
        timestamp: Number,
        emotions: {
          happy: Number,
          confident: Number,
          nervous: Number,
          focused: Number,
        },
      }],
      postureScore: Number,
      gestureAnalysis: [{
        timestamp: Number,
        gestures: [String],
        appropriateness: Number,
      }],
      confidenceLevel: Number,
    },
    audioMetrics: {
      speechRate: Number,
      pauseAnalysis: [{
        timestamp: Number,
        duration: Number,
        type: {
          type: String,
          enum: ['natural', 'hesitation', 'thinking'],
        },
      }],
      fillerWords: [{
        word: String,
        count: Number,
        timestamps: [Number],
      }],
      toneAnalysis: [{
        timestamp: Number,
        tone: {
          type: String,
          enum: ['confident', 'uncertain', 'enthusiastic', 'monotone'],
        },
        intensity: Number,
      }],
      clarityScore: Number,
    },
    contentMetrics: {
      relevanceScore: Number,
      technicalAccuracy: Number,
      communicationClarity: Number,
      structureScore: Number,
      keywordMatches: [String],
    },
    overallScore: Number,
  },
  feedback: {
    overallRating: Number,
    strengths: [String],
    improvements: [String],
    recommendations: [String],
    detailedFeedback: String,
    skillAssessment: [{
      skill: String,
      currentLevel: Number,
      targetLevel: Number,
      feedback: String,
    }],
    nextSteps: [String],
  },
  session: {
    startTime: {
      type: Date,
      default: null,
    },
    endTime: {
      type: Date,
      default: null,
    },
    actualDuration: {
      type: Number,
      default: null,
    },
    recordingUrls: {
      video: {
        type: String,
        default: null,
      },
      audio: {
        type: String,
        default: null,
      },
    },
    metadata: {
      browserInfo: {
        type: String,
        default: null,
      },
      deviceInfo: {
        type: String,
        default: null,
      },
      networkQuality: {
        type: String,
        default: null,
      },
    },
  },
}, {
  timestamps: true,
});

// Indexes
interviewSchema.index({ userId: 1, createdAt: -1 });
// status index is defined inline on the field — no duplicate needed
interviewSchema.index({ type: 1 });
interviewSchema.index({ 'settings.role': 1 });
interviewSchema.index({ 'analysis.overallScore': -1 });

// Virtual for duration in minutes
interviewSchema.virtual('durationInMinutes').get(function() {
  if (this.session.startTime && this.session.endTime) {
    return Math.round((this.session.endTime.getTime() - this.session.startTime.getTime()) / (1000 * 60));
  }
  return null;
});

// Method to calculate completion percentage
interviewSchema.methods.getCompletionPercentage = function(): number {
  if (this.questions.length === 0) return 0;
  return Math.round((this.responses.length / this.questions.length) * 100);
};

// Method to get average response time
interviewSchema.methods.getAverageResponseTime = function(): number {
  if (this.responses.length === 0) return 0;
  const totalDuration = this.responses.reduce((sum: number, response: any) => sum + response.duration, 0);
  return Math.round(totalDuration / this.responses.length);
};

// Static method to get user statistics
interviewSchema.statics.getUserStats = function(userId: mongoose.Types.ObjectId) {
  return this.aggregate([
    { $match: { userId, status: 'completed' } },
    {
      $group: {
        _id: null,
        totalInterviews: { $sum: 1 },
        averageScore: { $avg: '$analysis.overallScore' },
        totalDuration: { $sum: '$session.actualDuration' },
        lastInterview: { $max: '$createdAt' },
      },
    },
  ]);
};

export default mongoose.model<IInterview>('Interview', interviewSchema);