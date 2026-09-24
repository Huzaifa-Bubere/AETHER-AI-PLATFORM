import mongoose, { Document, Schema, Model } from 'mongoose';

/** One user's target career goal (one active goal per user). */
export interface IUserCareerGoal extends Document {
  userId: mongoose.Types.ObjectId;
  roleSlug: string;
  hoursPerWeek: number;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  targetTimelineWeeks?: number;
  startedAt: Date;
  updatedAt: Date;
}

export interface IUserCareerGoalModel extends Model<IUserCareerGoal> {
  findActiveByUser(userId: string): Promise<IUserCareerGoal | null>;
}

const goalSchema = new Schema<IUserCareerGoal, IUserCareerGoalModel>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  roleSlug: { type: String, required: true, lowercase: true, trim: true, index: true },
  hoursPerWeek: { type: Number, default: 10, min: 1, max: 80 },
  experienceLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
  targetTimelineWeeks: { type: Number, min: 1, max: 104 },
  startedAt: { type: Date, default: Date.now },
}, { timestamps: true });

goalSchema.statics.findActiveByUser = function (userId: string) {
  return this.findOne({ userId: new mongoose.Types.ObjectId(userId) });
};

export const UserCareerGoal = mongoose.model<IUserCareerGoal, IUserCareerGoalModel>('UserCareerGoal', goalSchema);
