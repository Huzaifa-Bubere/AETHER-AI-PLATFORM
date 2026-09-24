import mongoose, { Document, Schema, Model } from 'mongoose';

export type NodeState = 'LOCKED' | 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

export interface INodeProgress {
  nodeId: string;
  state: NodeState;
  quizScores: number[];
  completedAt?: Date;
  updatedAt: Date;
}

export interface IRoadmapProgress extends Document {
  userId: mongoose.Types.ObjectId;
  roleSlug: string;
  nodes: INodeProgress[];
  currentStageId?: string;
  startedAt: Date;
  updatedAt: Date;
}

export interface IRoadmapProgressModel extends Model<IRoadmapProgress> {
  findByUserAndRole(userId: string, roleSlug: string): Promise<IRoadmapProgress | null>;
}

const nodeProgressSchema = new Schema<INodeProgress>({
  nodeId: { type: String, required: true },
  state: { type: String, enum: ['LOCKED', 'READY', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'], default: 'READY' },
  quizScores: [{ type: Number, min: 0, max: 100 }],
  completedAt: { type: Date },
  updatedAt: { type: Date, default: Date.now },
}, { _id: false });

const progressSchema = new Schema<IRoadmapProgress, IRoadmapProgressModel>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  roleSlug: { type: String, required: true, lowercase: true, trim: true, index: true },
  nodes: { type: [nodeProgressSchema], default: [] },
  currentStageId: { type: String },
  startedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// One progress doc per user+role — upsert target.
progressSchema.index({ userId: 1, roleSlug: 1 }, { unique: true });

progressSchema.statics.findByUserAndRole = function (userId: string, roleSlug: string) {
  return this.findOne({ userId: new mongoose.Types.ObjectId(userId), roleSlug: roleSlug.toLowerCase() });
};

export const RoadmapProgress = mongoose.model<IRoadmapProgress, IRoadmapProgressModel>('RoadmapProgress', progressSchema);
