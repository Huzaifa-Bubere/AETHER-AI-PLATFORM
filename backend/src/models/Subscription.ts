import mongoose, { Document, Schema, Model } from 'mongoose';
import type { PlanId, BillingInterval } from '../config/plans';

/**
 * AETHER Subscription (spec §52-53).
 *
 * Provider state is authoritative; `User.subscription.plan` remains a denormalized
 * mirror for cheap reads. Status follows the standard lifecycle rather than a
 * boolean premium flag.
 */

export type SubscriptionStatus = 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED' | 'INCOMPLETE';

export interface ISubscription extends Document {
  userId: mongoose.Types.ObjectId;
  planId: PlanId;
  provider: 'stripe' | 'manual' | 'none';
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  status: SubscriptionStatus;
  billingInterval?: BillingInterval;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  /** access truly ends here when canceled at period end */
  accessEndsAt?: Date;
  history: Array<{
    at: Date;
    event: string;
    detail?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    planId: { type: String, enum: ['free', 'pro', 'campus'], default: 'free' },
    provider: { type: String, enum: ['stripe', 'manual', 'none'], default: 'none' },
    providerCustomerId: { type: String },
    providerSubscriptionId: { type: String, index: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'EXPIRED', 'INCOMPLETE'],
      default: 'ACTIVE',
    },
    billingInterval: { type: String, enum: ['monthly', 'halfyear', 'yearly'], default: undefined },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    accessEndsAt: { type: Date },
    history: [{
      at: { type: Date, default: Date.now },
      event: String,
      detail: String,
    }],
  },
  { timestamps: true },
);

subscriptionSchema.index({ status: 1, planId: 1 });

export interface ISubscriptionModel extends Model<ISubscription> {
  getOrCreateForUser(userId: string): Promise<ISubscription>;
}

subscriptionSchema.statics.getOrCreateForUser = async function (userId: string): Promise<ISubscription> {
  let doc = await this.findOne({ userId: new mongoose.Types.ObjectId(userId) });
  if (!doc) {
    doc = await this.create({ userId: new mongoose.Types.ObjectId(userId), planId: 'free', status: 'ACTIVE' });
  }
  return doc;
};

export const Subscription = mongoose.model<ISubscription, ISubscriptionModel>('Subscription', subscriptionSchema);
