import mongoose, { Document, Schema } from 'mongoose';

export interface IPayment extends Document {
  userId: mongoose.Types.ObjectId;
  stripeSessionId: string;
  stripePaymentIntentId?: string;
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  amount: number;
  currency: string;
  plan: 'pro' | 'enterprise';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentMethod?: string;
  receiptUrl?: string;
  invoiceUrl?: string;
  metadata?: {
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  stripeSessionId: {
    type: String,
    required: true,
    unique: true,
  },
  stripePaymentIntentId: {
    type: String,
    default: null,
  },
  stripeCustomerId: {
    type: String,
    required: true,
  },
  stripeSubscriptionId: {
    type: String,
    default: null,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    required: true,
    uppercase: true,
    default: 'INR',
  },
  plan: {
    type: String,
    enum: ['pro', 'enterprise'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
  },
  paymentMethod: {
    type: String,
    default: null,
  },
  receiptUrl: {
    type: String,
    default: null,
  },
  invoiceUrl: {
    type: String,
    default: null,
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

// Indexes for efficient queries
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ stripeCustomerId: 1 });

export default mongoose.model<IPayment>('Payment', paymentSchema);
