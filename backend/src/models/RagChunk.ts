import { Schema, model } from 'mongoose';

const schema = new Schema({
  sourceId: { type: Schema.Types.ObjectId, ref: 'RagSource', required: true },
  revision: { type: String, required: true },
  topic: { type: String, required: true },
  ordinal: { type: Number, required: true },
  text: { type: String, required: true },
  hash: { type: String, required: true },
  embeddingModel: { type: String, required: true },
  embedding: { type: [Number], required: true, select: false },
  retrievedAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ sourceId: 1, revision: 1, ordinal: 1 }, { unique: true });
schema.index({ topic: 1, embeddingModel: 1 });
export default model('RagChunk', schema);
