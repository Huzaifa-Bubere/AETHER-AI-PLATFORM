import mongoose, { Document, Schema, Model } from 'mongoose';

export type SkillType = 'LANGUAGE' | 'FRAMEWORK' | 'DATABASE' | 'CLOUD' | 'DEVOPS' | 'TOOL' | 'CONCEPT' | 'SOFT_SKILL';

export interface ISkill extends Document {
  slug: string;
  name: string;
  aliases: string[];
  category: string;
  description?: string;
  skillType: SkillType;
  officialResource?: { label: string; url: string };
  tags: string[];
}

export interface ISkillModel extends Model<ISkill> {
  findBySlug(slug: string): Promise<ISkill | null>;
}

const skillSchema = new Schema<ISkill, ISkillModel>({
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  aliases: [{ type: String, lowercase: true, trim: true }],
  category: { type: String, required: true, trim: true, index: true },
  description: { type: String, trim: true },
  skillType: {
    type: String,
    enum: ['LANGUAGE', 'FRAMEWORK', 'DATABASE', 'CLOUD', 'DEVOPS', 'TOOL', 'CONCEPT', 'SOFT_SKILL'],
    required: true,
    index: true,
  },
  officialResource: {
    label: { type: String, trim: true },
    url: { type: String, trim: true },
  },
  tags: [{ type: String, lowercase: true, trim: true }],
}, { timestamps: true });

// Alias lookup is the hot path for extraction — index it.
skillSchema.index({ aliases: 1 });

skillSchema.statics.findBySlug = function (slug: string) {
  return this.findOne({ slug: slug.toLowerCase() });
};

export const Skill = mongoose.model<ISkill, ISkillModel>('Skill', skillSchema);
