import { Schema, model, Document, Types } from 'mongoose';
import { RoundType, Category } from './AptitudeQuestion';

/** How many questions of each difficulty this test should pull, and the per-level time budget.
 *  Defaults mirror the spec: 15 easy / 15 medium / 15 hard, 45 min total for aptitude+technical,
 *  and 5 easy (1hr) / 3 medium (1hr) / 2 hard (1hr) for coding.
 */
interface DifficultyPlan {
  count: number;
  marksPerQuestion: number;
}

export interface IAptitudeTest extends Document {
  title: string;
  roundType: RoundType;
  categories: Category[];
  difficultyPlan: {
    easy: DifficultyPlan;
    medium: DifficultyPlan;
    hard: DifficultyPlan;
  };
  durationMinutes: number;
  totalMarks: number;
  isPublished: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DifficultyPlanSchema = new Schema<DifficultyPlan>(
  {
    count: { type: Number, required: true, min: 0, max: 100, validate: Number.isInteger },
    marksPerQuestion: { type: Number, required: true, default: 1, min: 0.0001 },
  },
  { _id: false }
);

const AptitudeTestSchema = new Schema<IAptitudeTest>(
  {
    title: { type: String, required: true, trim: true },
    roundType: { type: String, enum: ['aptitude', 'technical', 'coding'], required: true },
    categories: [{ type: String, required: true }],
    difficultyPlan: {
      easy: { type: DifficultyPlanSchema, required: true },
      medium: { type: DifficultyPlanSchema, required: true },
      hard: { type: DifficultyPlanSchema, required: true },
    },
    durationMinutes: { type: Number, required: true, default: 45, min: 1, max: 1440, validate: Number.isInteger },
    totalMarks: { type: Number, required: true, default: 0 },
    isPublished: { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

AptitudeTestSchema.pre('validate', function (next) {
  const plan = this.difficultyPlan;
  if (plan?.easy && plan?.medium && plan?.hard) {
    const count = plan.easy.count + plan.medium.count + plan.hard.count;
    if (count < 1 || count > 100) this.invalidate('difficultyPlan', 'A test must contain between 1 and 100 questions.');
    this.totalMarks =
      plan.easy.count * plan.easy.marksPerQuestion +
      plan.medium.count * plan.medium.marksPerQuestion +
      plan.hard.count * plan.hard.marksPerQuestion;
  }
  if (!this.categories?.length) this.invalidate('categories', 'Select at least one category.');
  next();
});

export default model<IAptitudeTest>('AptitudeTest', AptitudeTestSchema);
