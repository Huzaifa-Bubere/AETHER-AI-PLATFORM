import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * AETHER UsageLedger (spec §48/§51/§65).
 *
 * One row per consumed unit (AI credit, interview session, resume version…).
 * Monthly quotas are computed by counting rows in the current period — no
 * counters to drift, and every deduction is auditable.
 */

export interface IUsageLedger extends Document {
  userId: mongoose.Types.ObjectId;
  feature: string;            // e.g. 'aiCredits', 'aiInterviews', 'resumeVersions'
  operation?: string;         // e.g. 'resume.aiRewrite'
  amount: number;             // credits consumed (int)
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const usageLedgerSchema = new Schema<IUsageLedger>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    feature: { type: String, required: true, index: true },
    operation: { type: String },
    amount: { type: Number, required: true, min: 1 },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

usageLedgerSchema.index({ userId: 1, feature: 1, createdAt: -1 });

export interface IUsageLedgerModel extends Model<IUsageLedger> {
  sumForPeriod(userId: string, feature: string, since: Date): Promise<number>;
}

usageLedgerSchema.statics.sumForPeriod = async function (
  userId: string, feature: string, since: Date,
): Promise<number> {
  const result = await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        feature,
        createdAt: { $gte: since },
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return result[0]?.total || 0;
};

export const UsageLedger = mongoose.model<IUsageLedger, IUsageLedgerModel>('UsageLedger', usageLedgerSchema);
