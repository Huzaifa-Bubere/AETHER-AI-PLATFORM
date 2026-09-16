import { Schema, model } from 'mongoose';

const schema = new Schema({
  title: { type: String, required: true, maxlength: 160 },
  url: { type: String, required: true, unique: true },
  topic: { type: String, required: true, index: true },
  license: { type: String, required: true, maxlength: 500 },
  enabled: { type: Boolean, default: true },
  status: { type: String, enum: ['pending', 'ingesting', 'ready', 'failed'], default: 'pending' },
  revision: String,
  embeddingModel: String,
  chunkCount: { type: Number, default: 0 },
  refreshedAt: Date,
  leaseUntil: Date,
  leaseOwner: { type: String, select: false },
  lastError: String,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
export default model('RagSource', schema);
