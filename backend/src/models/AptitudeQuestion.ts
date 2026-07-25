import { Schema, model, Document, Types } from 'mongoose';

/**
 * A question is a single image containing the statement + all four options.
 * No question text is ever stored — matches the "image only" spec.
 */

export type RoundType = 'aptitude' | 'technical' | 'coding';
export type Category =
  | 'quantitative-aptitude'
  | 'logical-reasoning'
  | 'verbal-ability'
  | 'data-interpretation'
  | 'puzzle-solving'
  | 'technical-quiz';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type OptionKey = 'A' | 'B' | 'C' | 'D';
export type QuestionStatus = 'active' | 'inactive';

export interface IAptitudeQuestion extends Document {
  roundType: RoundType;
  category: Category;
  difficulty: Difficulty;
  imageUrl: string;
  imagePublicId: string; // cloudinary public_id, needed to delete/replace the asset
  correctOption: OptionKey;
  marks: number;
  explanation: string;
  status: QuestionStatus;
  createdBy: Types.ObjectId;
  timesUsed: number; // how many attempts have included this question (for rotation)
  createdAt: Date;
  updatedAt: Date;
}

const AptitudeQuestionSchema = new Schema<IAptitudeQuestion>(
  {
    roundType: {
      type: String,
      enum: ['aptitude', 'technical', 'coding'],
      required: true,
      default: 'aptitude',
      index: true,
    },
    category: {
      type: String,
      enum: [
        'quantitative-aptitude',
        'logical-reasoning',
        'verbal-ability',
        'data-interpretation',
        'puzzle-solving',
        'technical-quiz',
      ],
      required: true,
      index: true,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      required: true,
      index: true,
    },
    imageUrl: { type: String, required: true },
    imagePublicId: { type: String, required: true },
    correctOption: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
    marks: { type: Number, required: true, default: 1, min: 0 },
    explanation: { type: String, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    timesUsed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Compound index used heavily by the random-question picker
AptitudeQuestionSchema.index({ roundType: 1, category: 1, difficulty: 1, status: 1 });

export default model<IAptitudeQuestion>('AptitudeQuestion', AptitudeQuestionSchema);
