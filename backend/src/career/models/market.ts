import mongoose, { Document, Schema, Model } from 'mongoose';

/** Raw ingested job posting (from admin import or permitted provider). */
export interface IMarketJob extends Document {
  provider: string;
  externalId?: string;
  title: string;
  normalizedRole: string;
  company?: string;
  country?: string;
  city?: string;
  experienceLevel?: 'internship' | 'entry' | 'mid' | 'senior';
  description: string;
  extractedSkills: string[];
  postedAt?: Date;
  ingestedAt: Date;
  batchId: string;
}

const jobSchema = new Schema<IMarketJob>({
  provider: { type: String, required: true, trim: true },
  externalId: { type: String, trim: true },
  title: { type: String, required: true, trim: true },
  normalizedRole: { type: String, required: true, lowercase: true, trim: true, index: true },
  company: { type: String, trim: true },
  country: { type: String, trim: true },
  city: { type: String, trim: true, index: true },
  experienceLevel: { type: String, enum: ['internship', 'entry', 'mid', 'senior'] },
  description: { type: String, required: true },
  extractedSkills: [{ type: String, lowercase: true, trim: true }],
  postedAt: { type: Date },
  ingestedAt: { type: Date, default: Date.now },
  batchId: { type: String, required: true, index: true },
}, { timestamps: true });

jobSchema.index({ provider: 1, externalId: 1 }, { unique: true, sparse: true });
jobSchema.index({ normalizedRole: 1, ingestedAt: -1 });

export const MarketJob = mongoose.model<IMarketJob>('MarketJob', jobSchema);

/** Precomputed per-role market aggregate — UI reads ONLY this, never raw jobs. */
export interface ISkillStat {
  skill: string;
  count: number;
  percentage: number;
  previousPercentage?: number;
  /** POPULAR | TRENDING_UP | STABLE | TRENDING_DOWN | NEW_SIGNAL */
  trend: string;
}

export interface IRoleTrendSnapshot extends Document {
  role: string;
  region: string;
  periodStart: Date;
  periodEnd: Date;
  totalPostings: number;
  topSkills: ISkillStat[];
  topTools: string[];
  topFrameworks: string[];
  topDatabases: string[];
  topCloud: string[];
  skillPairs: Array<{ skills: [string, string]; count: number; percentage: number }>;
  experienceDistribution: Record<string, number>;
  sourceMetadata: {
    sourceName: string;
    sourceType: string;
    previousSnapshotId?: string;
  };
  generatedAt: Date;
}

export interface IRoleTrendSnapshotModel extends Model<IRoleTrendSnapshot> {
  latestForRole(role: string, region?: string): Promise<IRoleTrendSnapshot | null>;
  previousForRole(role: string, region: string, before: Date): Promise<IRoleTrendSnapshot | null>;
}

const snapshotSchema = new Schema<IRoleTrendSnapshot, IRoleTrendSnapshotModel>({
  role: { type: String, required: true, lowercase: true, trim: true, index: true },
  region: { type: String, required: true, trim: true, index: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  totalPostings: { type: Number, required: true, min: 0 },
  topSkills: [{
    skill: { type: String, required: true },
    count: { type: Number, required: true },
    percentage: { type: Number, required: true },
    previousPercentage: { type: Number },
    trend: { type: String, required: true },
  }],
  topTools: [{ type: String }],
  topFrameworks: [{ type: String }],
  topDatabases: [{ type: String }],
  topCloud: [{ type: String }],
  skillPairs: [{
    skills: { type: [String], required: true },
    count: { type: Number, required: true },
    percentage: { type: Number, required: true },
  }],
  experienceDistribution: { type: Schema.Types.Mixed, default: {} },
  sourceMetadata: {
    sourceName: { type: String, default: 'Market snapshot' },
    sourceType: { type: String, default: 'import' },
    previousSnapshotId: { type: String },
  },
  generatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

snapshotSchema.index({ role: 1, region: 1, periodEnd: -1 });

snapshotSchema.statics.latestForRole = function (role: string, region?: string) {
  const q: Record<string, unknown> = { role: role.toLowerCase() };
  if (region) q.region = region;
  return this.findOne(q).sort({ periodEnd: -1 });
};

snapshotSchema.statics.previousForRole = function (role: string, region: string, before: Date) {
  return this.findOne({ role: role.toLowerCase(), region, periodEnd: { $lt: before } }).sort({ periodEnd: -1 });
};

export const RoleTrendSnapshot = mongoose.model<IRoleTrendSnapshot, IRoleTrendSnapshotModel>('RoleTrendSnapshot', snapshotSchema);

/** Audit trail of market data imports. */
export interface IMarketDataSource extends Document {
  batchId: string;
  sourceName: string;
  sourceType: string;
  region: string;
  periodStart?: Date;
  periodEnd?: Date;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  rolesMapped: Record<string, number>;
  importedBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const sourceSchema = new Schema<IMarketDataSource>({
  batchId: { type: String, required: true, unique: true },
  sourceName: { type: String, required: true, trim: true },
  sourceType: { type: String, default: 'import' },
  region: { type: String, default: 'India' },
  periodStart: { type: Date },
  periodEnd: { type: Date },
  totalRows: { type: Number, default: 0 },
  acceptedRows: { type: Number, default: 0 },
  rejectedRows: { type: Number, default: 0 },
  rolesMapped: { type: Schema.Types.Mixed, default: {} },
  importedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

export const MarketDataSource = mongoose.model<IMarketDataSource>('MarketDataSource', sourceSchema);

/** Admin-managed extraction dictionary overrides (merge over the builtin dictionary). */
export interface IDictionaryEntry extends Document {
  canonical: string;
  aliases: string[];
  skillType: string;
  updatedAt: Date;
}

const dictionarySchema = new Schema<IDictionaryEntry>({
  canonical: { type: String, required: true, unique: true, trim: true },
  aliases: [{ type: String, lowercase: true, trim: true }],
  skillType: { type: String, default: 'TOOL' },
}, { timestamps: true });

export const SkillDictionaryEntry = mongoose.model<IDictionaryEntry>('SkillDictionaryEntry', dictionarySchema);
