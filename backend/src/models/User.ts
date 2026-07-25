import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password: string;
  profile: {
    firstName: string;
    lastName: string;
    avatar?: string;
    phone?: string;
    location?: string;
  };
  preferences: {
    role: string;
    experienceLevel: 'entry' | 'mid' | 'senior' | 'executive';
    industries: string[];
    interviewTypes: ('behavioral' | 'technical' | 'coding' | 'system-design')[];
  };
  subscription: {
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'inactive' | 'cancelled';
    expiresAt?: Date;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  };
  auth: {
    isVerified: boolean;
    verificationToken?: string;
    resetPasswordToken?: string;
    resetPasswordExpires?: Date;
    lastLogin?: Date;
    loginAttempts: number;
    lockUntil?: Date;
    role?: 'user' | 'admin';
  };
  stats: {
    totalInterviews: number;
    averageScore: number;
    improvementRate: number;
    lastInterviewDate?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  isAccountLocked(): boolean;
  incLoginAttempts(): Promise<void>;
}

const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false, // Don't include password in queries by default
  },
  profile: {
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    avatar: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      default: null,
      match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number'],
    },
    location: {
      type: String,
      default: null,
      maxlength: 100,
    },
  },
  preferences: {
    role: {
      type: String,
      required: false,
      trim: true,
      default: '',
    },
    experienceLevel: {
      type: String,
      enum: ['entry', 'mid', 'senior', 'executive'],
      required: true,
      default: 'entry',
    },
    industries: [{
      type: String,
      trim: true,
    }],
    interviewTypes: [{
      type: String,
      enum: ['behavioral', 'technical', 'coding', 'system-design'],
    }],
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free',
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'cancelled'],
      default: 'active',
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    stripeCustomerId: {
      type: String,
      default: null,
    },
    stripeSubscriptionId: {
      type: String,
      default: null,
    },
  },
  auth: {
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
      default: null,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
  },
  stats: {
    totalInterviews: {
      type: Number,
      default: 0,
    },
    averageScore: {
      type: Number,
      default: 0,
    },
    improvementRate: {
      type: Number,
      default: 0,
    },
    lastInterviewDate: {
      type: Date,
      default: null,
    },
  },
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete (ret as any).password;
      delete (ret as any).auth?.verificationToken;
      delete (ret as any).auth?.resetPasswordToken;
      return ret;
    },
  },
});

// Indexes
userSchema.index({ 'preferences.role': 1 });
userSchema.index({ 'subscription.plan': 1 });
userSchema.index({ createdAt: -1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to check if account is locked
userSchema.methods.isAccountLocked = function(): boolean {
  return !!(this.auth.lockUntil && this.auth.lockUntil > new Date());
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = async function(): Promise<void> {
  // If we have a previous lock that has expired, restart at 1
  if (this.auth.lockUntil && this.auth.lockUntil < new Date()) {
    return this.updateOne({
      $unset: { 'auth.lockUntil': 1 },
      $set: { 'auth.loginAttempts': 1 },
    });
  }

  const updates: any = { $inc: { 'auth.loginAttempts': 1 } };

  // Lock account after 5 failed attempts for 2 hours
  if (this.auth.loginAttempts + 1 >= 5 && !this.isAccountLocked()) {
    updates.$set = { 'auth.lockUntil': new Date(Date.now() + 2 * 60 * 60 * 1000) }; // 2 hours
  }

  return this.updateOne(updates);
};

// Static method to find user for authentication
userSchema.statics.findForAuth = function(email: string) {
  return this.findOne({ email }).select('+password');
};

export default mongoose.model<IUser>('User', userSchema);