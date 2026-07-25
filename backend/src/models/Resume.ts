import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IResume extends Document {
  userId: mongoose.Types.ObjectId;
  filename: string;
  fileUrl: string;
  publicId?: string;
  localFilePath?: string;
  fileSize: number;
  mimeType: string;
  storageType?: 'cloudinary' | 'local';
  analysis: {
    skills: string[];
    experience: number;
    education: Array<{
      degree: string;
      institution: string;
      year: number;
      gpa?: number;
    }>;
    certifications: string[];
    achievements: string[];
    industries: string[];
    leadership: string[];
    summary: string;
    score?: number;
    matchScore?: number;
    recommendations: Array<{
      title: string;
      description: string;
      priority: string;
    } | string>;
  };
  metadata: {
    uploadedAt: Date;
    lastAnalyzedAt?: Date;
    analysisVersion?: string;
    processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
    errorMessage?: string;
    parsedData?: any;
  };
  createdAt: Date;
  updatedAt: Date;
  // Virtual
  fileExtension?: string;
  // Methods
  isAnalysisComplete(): boolean;
  getAnalysisAge(): number | null;
}

// Model interface with static methods
export interface IResumeModel extends Model<IResume> {
  getLatestByUser(userId: mongoose.Types.ObjectId): Promise<IResume | null>;
  getPendingAnalysis(): Promise<IResume[]>;
}

const resumeSchema = new Schema<IResume>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  filename: {
    type: String,
    required: true,
    trim: true,
  },
  fileUrl: {
    type: String,
    required: true,
  },
  publicId: {
    type: String,
    default: null,
  },
  fileSize: {
    type: Number,
    required: true,
  },
  mimeType: {
    type: String,
    required: true,
  },
  storageType: {
    type: String,
    enum: ['cloudinary', 'local'],
    default: 'local',
  },
  analysis: {
    skills: [{
      type: String,
      trim: true,
    }],
    experience: {
      type: Number,
      default: 0,
    },
    education: [{
      degree: {
        type: String,
        default: 'Not specified',
      },
      institution: {
        type: String,
        default: 'Not specified',
      },
      year: {
        type: Number,
        default: new Date().getFullYear(),
      },
      gpa: {
        type: Number,
        default: null,
      },
    }],
    certifications: [{
      type: String,
      trim: true,
    }],
    achievements: [{
      type: String,
      trim: true,
    }],
    industries: [{
      type: String,
      trim: true,
    }],
    leadership: [{
      type: String,
      trim: true,
    }],
    summary: {
      type: String,
      default: '',
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    matchScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    recommendations: [{
      type: Schema.Types.Mixed,
    }],
  },
  metadata: {
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    lastAnalyzedAt: {
      type: Date,
      default: null,
    },
    analysisVersion: {
      type: String,
      default: '1.0.0',
    },
    processingStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    errorMessage: {
      type: String,
      default: null,
    },
    parsedData: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
}, {
  timestamps: true,
});

// Indexes
resumeSchema.index({ userId: 1, createdAt: -1 });
resumeSchema.index({ 'metadata.processingStatus': 1 });
resumeSchema.index({ 'analysis.matchScore': -1 });

// Virtual for file extension
resumeSchema.virtual('fileExtension').get(function() {
  return this.filename.split('.').pop()?.toLowerCase();
});

// Method to check if analysis is complete
resumeSchema.methods.isAnalysisComplete = function(): boolean {
  return this.metadata.processingStatus === 'completed';
};

// Method to get analysis age in days
resumeSchema.methods.getAnalysisAge = function(): number | null {
  if (!this.metadata.lastAnalyzedAt) return null;
  const now = new Date();
  const diff = now.getTime() - this.metadata.lastAnalyzedAt.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

// Static method to get user's latest resume
resumeSchema.statics.getLatestByUser = function(userId: mongoose.Types.ObjectId) {
  return this.findOne({ userId }).sort({ createdAt: -1 });
};

// Static method to get resumes needing analysis
resumeSchema.statics.getPendingAnalysis = function() {
  return this.find({
    'metadata.processingStatus': 'pending',
  }).sort({ createdAt: 1 });
};

export default mongoose.model<IResume, IResumeModel>('Resume', resumeSchema);
