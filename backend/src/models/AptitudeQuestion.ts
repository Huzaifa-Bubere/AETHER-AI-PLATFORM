import { Schema, model, Document, Types } from 'mongoose';
import { fingerprintQuestion, normalizeQuestion } from '../services/questions/identity';

/** Questions contain either a complete image or a statement with four text options. */
export const CATEGORIES = ['quantitative-aptitude', 'logical-reasoning', 'verbal-ability',
  'data-interpretation', 'puzzle-solving', 'technical-quiz'] as const;

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
  questionText?: string;
  fingerprint?: string;
  generation?: {
    key: string; topic: string; model: string; generatedAt: Date; expiresAt: Date;
    evidence: unknown; sources: { chunkId: string; sourceId: string; revision: string; quote: string; title: string; url: string; retrievedAt: Date }[];
  };
  options?: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  imageUrl?: string;
  imagePublicId?: string; // cloudinary public_id, needed to delete/replace the asset
  correctOption: OptionKey;
  marks: number;
  explanation: string;
  status: QuestionStatus;
  seedId?: string;
  createdBy?: Types.ObjectId;
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
    questionText: { type: String, default: '' },
    fingerprint: { type: String, index: true },
    generation: {
      type: new Schema({ key: String, topic: String, model: String, generatedAt: Date, expiresAt: Date,
        evidence: Schema.Types.Mixed, sources: [{ chunkId: String, sourceId: String, revision: String, quote: String, title: String, url: String, retrievedAt: Date }] }, { _id: false }),
      default: undefined,
    },
    options: {
      A: { type: String, default: '' },
      B: { type: String, default: '' },
      C: { type: String, default: '' },
      D: { type: String, default: '' },
    },
    imageUrl: { type: String, default: '' },
    imagePublicId: { type: String, default: '' },
    correctOption: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
    marks: { type: Number, required: true, default: 1, min: 0.0001, max: 1000 },
    explanation: { type: String, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    // Set only for seeded default questions; unique-sparse makes re-seeding idempotent.
    seedId: { type: String, index: { unique: true, sparse: true } },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: false },
    timesUsed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Compound index used heavily by the random-question picker
AptitudeQuestionSchema.pre('validate', function (next) {
  this.fingerprint = fingerprintQuestion(this);
  if (!this.imageUrl?.trim()) {
    if (!this.questionText?.trim()) this.invalidate('questionText', 'Provide a question statement or a complete question image.');
    if (['A', 'B', 'C', 'D'].some(key => !this.options?.[key as OptionKey]?.trim())) {
      this.invalidate('options', 'Text questions require all four options.');
    }
    const options = ['A', 'B', 'C', 'D'].map(key => normalizeQuestion(this.options?.[key as OptionKey] || ''));
    if (new Set(options).size !== 4) this.invalidate('options', 'Answer options must be distinct.');
  }
  next();
});
AptitudeQuestionSchema.index({ roundType: 1, category: 1, difficulty: 1, status: 1 });
AptitudeQuestionSchema.index({ 'generation.key': 1 }, { unique: true, sparse: true });

export default model<IAptitudeQuestion>('AptitudeQuestion', AptitudeQuestionSchema);
