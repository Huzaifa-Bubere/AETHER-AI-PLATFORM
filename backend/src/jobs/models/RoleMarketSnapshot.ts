import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * Role market snapshots (spec §I6).
 *
 * A snapshot is a POINT-IN-TIME aggregate computed from real stored postings —
 * never from generated data. Snapshots exist so that "trending" can eventually be
 * answered honestly: a trend needs at least two comparable periods.
 *
 * Until more than one snapshot exists for a (role, region, period), AETHER must
 * report a skill as POPULAR (high current occurrence) and must NOT call it
 * trending (spec §I5).
 */
export interface ISkillCount {
  skillSlug: string;
  /** Postings in the sample whose skill list mentions this skill. */
  mentionCount: number;
  /** mentionCount / sampleSize * 100, rounded to one decimal. */
  percentage: number;
}

export interface IDistributionEntry {
  key: string;
  count: number;
}

export interface IRoleMarketSnapshot extends Document {
  roleSlug: string;
  /** Lowercased region/country scope. "global" when postings were not country-scoped. */
  region: string;

  periodStart: Date;
  periodEnd: Date;
  /** The denominator of every percentage on this snapshot. */
  sampleSize: number;

  topSkills: ISkillCount[];
  workModeDistribution: IDistributionEntry[];
  jobTypeDistribution: IDistributionEntry[];
  experienceDistribution: IDistributionEntry[];
  locationDistribution: IDistributionEntry[];

  /** Which providers contributed to this sample. */
  providers: string[];
  /** Bumped when the aggregation logic changes, so history stays comparable. */
  calculationVersion: string;
  generatedAt: Date;
}

const skillCountSchema = new Schema<ISkillCount>({
  skillSlug: { type: String, required: true, lowercase: true, trim: true },
  mentionCount: { type: Number, required: true, min: 0 },
  percentage: { type: Number, required: true, min: 0, max: 100 },
}, { _id: false });

const distributionSchema = new Schema<IDistributionEntry>({
  key: { type: String, required: true, trim: true },
  count: { type: Number, required: true, min: 0 },
}, { _id: false });

const roleMarketSnapshotSchema = new Schema<IRoleMarketSnapshot>({
  roleSlug: { type: String, required: true, lowercase: true, trim: true, index: true },
  region: { type: String, default: 'global', lowercase: true, trim: true, index: true },

  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  sampleSize: { type: Number, required: true, min: 0 },

  topSkills: { type: [skillCountSchema], default: [] },
  workModeDistribution: { type: [distributionSchema], default: [] },
  jobTypeDistribution: { type: [distributionSchema], default: [] },
  experienceDistribution: { type: [distributionSchema], default: [] },
  locationDistribution: { type: [distributionSchema], default: [] },

  providers: { type: [{ type: String, lowercase: true, trim: true }], default: [] },
  calculationVersion: { type: String, default: '1.0' },
  generatedAt: { type: Date, default: Date.now },
});

// One snapshot per role/region/period, so re-running the aggregation updates
// rather than appending a duplicate for the same window.
roleMarketSnapshotSchema.index(
  { roleSlug: 1, region: 1, periodStart: 1, periodEnd: 1 },
  { unique: true },
);
roleMarketSnapshotSchema.index({ roleSlug: 1, generatedAt: -1 });

export const RoleMarketSnapshot = mongoose.model<IRoleMarketSnapshot>(
  'RoleMarketSnapshot',
  roleMarketSnapshotSchema,
);
export default RoleMarketSnapshot;