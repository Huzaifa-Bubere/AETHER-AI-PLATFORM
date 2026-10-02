import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

const VALID_PLANS = ['free', 'pro', 'enterprise'] as const;

/**
 * Coerce any incoming plan value to a valid one.
 *
 * Case and common aliases are mapped; anything unrecognised falls back to
 * 'free' rather than throwing. A malformed plan string must never be able to
 * block authentication or access checks.
 */
export function normalizePlanValue(value: unknown): (typeof VALID_PLANS)[number] {
  if (typeof value !== 'string') return 'free';
  const lowered = value.trim().toLowerCase();
  if ((VALID_PLANS as readonly string[]).includes(lowered)) return lowered as (typeof VALID_PLANS)[number];
  // Aliases seen in older records and in Stripe metadata.
  if (['pro', 'professional', 'aether pro', 'premium', 'paid'].includes(lowered)) return 'pro';
  if (['enterprise', 'team', 'business'].includes(lowered)) return 'enterprise';
  return 'free';
}

export interface IUser extends Document {
  email: string;
  password: string;
  profile: {
    firstName: string;
    lastName: string;
    avatar?: string;
    phone?: string;
    location?: string;
    headline?: string;
    about?: string;
    coverImage?: string;
    links?: { github?: string; linkedin?: string; portfolio?: string };
    openToWork?: boolean;
    openToWorkRoles?: string[];
    experience?: Array<{
      title: string; company: string; location?: string; employmentType?: string;
      startDate?: Date; endDate?: Date; current?: boolean; description?: string;
    }>;
    education?: Array<{
      degree: string; institution: string; startYear?: number; endYear?: number;
      grade?: string; description?: string;
    }>;
    projects?: Array<{ name: string; description?: string; link?: string; technologies?: string[] }>;
    certifications?: Array<{ name: string; issuer?: string; issuedOn?: Date; credentialId?: string }>;
    achievements?: string[];
  };
  preferences: {
    role: string;
    experienceLevel: 'entry' | 'mid' | 'senior' | 'executive';
    industries: string[];
    interviewTypes: ('behavioral' | 'technical' | 'coding' | 'system-design')[];
    /**
     * IANA timezone (e.g. 'Asia/Kolkata'). All daily aggregation — the AETHER
     * streak, activity heatmap and "today" boundaries — is bucketed in this zone
     * while timestamps stay in UTC, so a streak never breaks at UTC midnight.
     */
    timezone: string;
  };
  subscription: {
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'inactive' | 'cancelled';
    expiresAt?: Date;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  };
  auth: {
    tokenVersion: number;
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
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email'],
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
    /**
     * Professional profile (spec §24–§28). Kept on the User document because a
     * candidate has exactly one profile and it is read on nearly every page.
     * Every list is optional — the profile renders honest empty states and a
     * deterministic completeness score rather than placeholder content.
     */
    headline: { type: String, default: '', trim: true, maxlength: 160 },
    about: { type: String, default: '', trim: true, maxlength: 2600 },
    coverImage: { type: String, default: '', trim: true },
    links: {
      github: { type: String, default: '', trim: true },
      linkedin: { type: String, default: '', trim: true },
      portfolio: { type: String, default: '', trim: true },
    },
    /** Public "open to work" signals shown as badges. */
    openToWork: { type: Boolean, default: false },
    openToWorkRoles: [{ type: String, trim: true }],
    experience: [{
      title: { type: String, required: true, trim: true },
      company: { type: String, required: true, trim: true },
      location: { type: String, trim: true },
      employmentType: { type: String, trim: true },
      startDate: { type: Date },
      endDate: { type: Date },
      current: { type: Boolean, default: false },
      description: { type: String, default: '', trim: true, maxlength: 2000 },
    }],
    education: [{
      degree: { type: String, required: true, trim: true },
      institution: { type: String, required: true, trim: true },
      startYear: { type: Number, min: 1950, max: 2200 },
      endYear: { type: Number, min: 1950, max: 2200 },
      grade: { type: String, trim: true },
      description: { type: String, default: '', trim: true, maxlength: 1000 },
    }],
    projects: [{
      name: { type: String, required: true, trim: true },
      description: { type: String, default: '', trim: true, maxlength: 2000 },
      link: { type: String, trim: true },
      technologies: [{ type: String, trim: true }],
    }],
    certifications: [{
      name: { type: String, required: true, trim: true },
      issuer: { type: String, trim: true },
      issuedOn: { type: Date },
      credentialId: { type: String, trim: true },
    }],
    achievements: [{ type: String, trim: true, maxlength: 300 }],
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
    timezone: {
      type: String,
      default: 'UTC',
      trim: true,
      maxlength: 64,
    },
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free',
      // Normalise on the way IN. Legacy rows written before this setter existed
      // hold values like 'Pro'; without this, any later `user.save()` fails enum
      // validation and locks the account out of login entirely.
      set: (value: unknown) => normalizePlanValue(value),
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
    tokenVersion: { type: Number, default: 0, min: 0 },
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

/**
 * Normalize an email for LOOKUP.
 *
 * The schema stores email lowercased and trimmed, but Mongoose does NOT apply
 * those transforms to query values. Without this, signing in as
 * `User@Example.com` queried for that exact string while the stored value was
 * `user@example.com`, the lookup missed, and the user got "Invalid
 * credentials" despite a correct password.
 */
export function normalizeEmailForLookup(email: unknown): string {
  return String(email ?? '').trim().toLowerCase();
}

// Static method to find user for authentication
userSchema.statics.findForAuth = function(email: string) {
  return this.findOne({ email: normalizeEmailForLookup(email) }).select('+password');
};

export default mongoose.model<IUser>('User', userSchema);
