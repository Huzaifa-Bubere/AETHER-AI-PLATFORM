import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * AETHER Career Learning — YouTube learning videos (spec §41–§47).
 *
 * Video metadata is fetched from the YouTube Data API v3 by a refresh job and
 * stored here; the frontend reads ONLY this collection, so opening a lesson
 * never triggers a search API call. Every numeric field is real API metadata —
 * nothing is fabricated. When no API key is configured, fields stay null and
 * the UI honestly reports that video refresh is not configured.
 */

export interface ILearningVideo extends Document {
  topicId: mongoose.Types.ObjectId;
  topicSlug: string;
  youtubeVideoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  thumbnail: string;
  /** ISO-8601 duration from contentDetails (e.g. "PT18M42S") */
  duration: string;
  /** duration in seconds, parsed from `duration` */
  durationSeconds: number | null;
  /** nullable — never invented when the API did not return it */
  viewCount: number | null;
  likeCount: number | null;
  publishedAt: Date | null;
  language: string;
  /** deterministic ranking inputs (see youtube.service) */
  relevanceScore: number;
  rankingScore: number;
  /** human-readable explanation of why this video ranked first */
  rankingReasons: string[];
  searchQuery: string;
  fetchedAt: Date;
  active: boolean;
  /** set when a periodic refresh discovers the video is gone/private */
  inactiveReason?: string;
}

const learningVideoSchema = new Schema<ILearningVideo>(
  {
    topicId: { type: Schema.Types.ObjectId, ref: 'LearningTopic', required: true, index: true },
    topicSlug: { type: String, required: true, lowercase: true, trim: true, index: true },
    youtubeVideoId: { type: String, required: true, trim: true },
    title: { type: String, required: true },
    channelId: { type: String, default: '' },
    channelTitle: { type: String, default: '' },
    thumbnail: { type: String, default: '' },
    duration: { type: String, default: '' },
    durationSeconds: { type: Number, default: null },
    viewCount: { type: Number, default: null },
    likeCount: { type: Number, default: null },
    publishedAt: { type: Date, default: null },
    language: { type: String, default: 'en' },
    relevanceScore: { type: Number, default: 0 },
    rankingScore: { type: Number, default: 0 },
    rankingReasons: { type: [String], default: [] },
    searchQuery: { type: String, default: '' },
    fetchedAt: { type: Date, default: Date.now },
    active: { type: Boolean, default: true, index: true },
    inactiveReason: { type: String },
  },
  { timestamps: true }
);

// One active record per topic+video; a refresh upserts rather than duplicates.
learningVideoSchema.index({ topicSlug: 1, youtubeVideoId: 1 }, { unique: true });
learningVideoSchema.index({ topicSlug: 1, active: 1, rankingScore: -1 });

export interface ILearningVideoModel extends Model<ILearningVideo> {
  findBestForTopic(topicSlug: string, limit?: number): Promise<ILearningVideo[]>;
}

learningVideoSchema.statics.findBestForTopic = function (topicSlug: string, limit = 4) {
  return this.find({ topicSlug: String(topicSlug).toLowerCase(), active: true })
    .sort({ rankingScore: -1 })
    .limit(limit);
};

export const LearningVideo = mongoose.model<ILearningVideo, ILearningVideoModel>('LearningVideo', learningVideoSchema);
