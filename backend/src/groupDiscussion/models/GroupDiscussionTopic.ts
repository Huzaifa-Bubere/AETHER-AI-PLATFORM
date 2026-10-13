import mongoose, { Schema } from 'mongoose';

const schema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 240 },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  category: { type: String, required: true, enum: ['TECHNOLOGY', 'BUSINESS', 'WORKPLACE', 'SOCIAL', 'ABSTRACT', 'ROLE_SPECIFIC'] },
  difficulty: { type: String, required: true, enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] },
  roleSlugs: { type: [String], default: [] },
  keywords: { type: [String], default: [] },
  openingContext: { type: String, default: '' },
  keyPoints: { type: [String], default: [] },
  isPublished: { type: Boolean, default: false, index: true },
  usageCount: { type: Number, default: 0 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  brandingNote: { type: String, default: '', trim: true, maxlength: 300 },
}, { timestamps: true });

schema.index({ isPublished: 1, category: 1, difficulty: 1 });
schema.index({ isPublished: 1, roleSlugs: 1 });
schema.index({ createdAt: -1 });

export const GroupDiscussionTopic = mongoose.model('GroupDiscussionTopic', schema);
