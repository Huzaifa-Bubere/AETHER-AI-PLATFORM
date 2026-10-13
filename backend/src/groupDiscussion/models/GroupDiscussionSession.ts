import mongoose, { Schema } from 'mongoose';

const turn = new Schema({
  speakerType: { type: String, enum: ['CANDIDATE', 'AI'], required: true },
  speakerId: String,
  speakerName: String,
  text: { type: String, required: true, maxlength: 6000 },
  startedAt: Date,
  endedAt: Date,
  durationSeconds: { type: Number, default: 0 },
  source: { type: String, enum: ['VOICE', 'TEXT'], required: true },
  sequence: { type: Number, required: true },
}, { _id: false });

/**
 * Real captured audio only. `storageKey` is the durable local storage id
 * (`videos/recording_<session>_<ts>.webm`), never a client-invented string.
 */
const recordingSnapshot = new Schema({
  storageKey: String,
  contentType: String,
  durationSeconds: Number,
  sizeBytes: Number,
  consentedAt: Date,
  uploadedAt: Date,
}, { _id: false, timestamps: false });

const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  topicId: { type: Schema.Types.ObjectId, ref: 'GroupDiscussionTopic', required: true },
  topicSnapshot: Schema.Types.Mixed,
  roleSlug: String,
  difficulty: String,
  durationMinutes: Number,
  mode: { type: String, enum: ['AI'], default: 'AI' },
  status: { type: String, enum: ['CREATED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED'], default: 'CREATED', index: true },
  participants: { type: [Schema.Types.Mixed], default: [] },
  turns: { type: [turn], default: [] },
  startedAt: Date,
  endedAt: Date,
  candidateMetrics: { type: Schema.Types.Mixed, default: {} },
  scoreBreakdown: { type: Schema.Types.Mixed, default: {} },
  overallScore: Number,
  feedback: { type: Schema.Types.Mixed, default: null },
  recording: recordingSnapshot,
  recordingConsent: { type: Boolean, default: false },
  calculationVersion: { type: String, default: 'gd-v1' },
  activityRecorded: { type: Boolean, default: false },
}, { timestamps: true });

schema.index({ userId: 1, createdAt: -1 });
schema.index({ userId: 1, status: 1, createdAt: -1 });
schema.index({ topicId: 1 });

export const GroupDiscussionSession = mongoose.model('GroupDiscussionSession', schema);
