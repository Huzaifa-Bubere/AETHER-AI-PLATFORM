import mongoose, { Schema, Document } from 'mongoose';
import { AlgorithmApproachId } from '../types/coding.types';

export interface ICodingProblem extends Document {
  title: string;
  slug: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: string;
  tags: string[];
  companies?: string[];
  examples: Array<{ input: string; output: string; explanation?: string }>;
  constraints: string[];
  starterCode: Record<string, string>;
  sampleTests: Array<{ input: string; expectedOutput: string }>;
  hiddenTests: Array<{ input: string; expectedOutput: string }>;
  functionNames: Record<string, string>;
  knownApproaches: Array<{
    name: string;
    approachId: AlgorithmApproachId;
    timeComplexity: string;
    spaceComplexity: string;
    outline: string;
    optimal: boolean;
  }>;
  expectedTimeComplexity: string;
  expectedSpaceComplexity: string;
  /**
   * Validated complexity guidance (AETHER Part A).
   * Only `verified: true` guidance can justify a RED optimization warning.
   * Supplied by seed/admin data — never decided by Gemini.
   */
  complexityGuidance?: {
    expectedTime: string;
    expectedSpace: string;
    acceptedTimeClasses: string[];
    explanation: string;
    optimizationHint?: string;
    source: string;
    verified: boolean;
  } | null;
  /**
   * Reference optimized solution, shown only behind "Show Optimized Approach".
   * Never overwrites the candidate's submission.
   */
  referenceApproach?: {
    title: string;
    approachId: string;
    explanation: string;
    timeComplexity: string;
    spaceComplexity: string;
    code: Record<string, string>;
  } | null;
  points: number;
  hints: string[];
  solutionOutline?: string;
  isPublished: boolean;
  archived?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const testCaseSchema = new Schema(
  {
    input: { type: String, required: true },
    expectedOutput: { type: String, required: true },
  },
  { _id: false }
);

const codingProblemSchema = new Schema<ICodingProblem>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, required: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true, index: true },
    category: { type: String, required: true, index: true },
    tags: [{ type: String, trim: true }],
    companies: [{ type: String, trim: true }],
    examples: [
      {
        input: { type: String, required: true },
        output: { type: String, required: true },
        explanation: { type: String },
      },
    ],
    constraints: [{ type: String }],
    starterCode: { type: Map, of: String, default: {} },
    sampleTests: { type: [testCaseSchema], default: [] },
    hiddenTests: { type: [testCaseSchema], default: [] },
    functionNames: { type: Map, of: String, default: {} },
    knownApproaches: [
      {
        name: String,
        approachId: String,
        timeComplexity: String,
        spaceComplexity: String,
        outline: String,
        optimal: Boolean,
        _id: false,
      },
    ],
    expectedTimeComplexity: { type: String, default: 'O(n)' },
    expectedSpaceComplexity: { type: String, default: 'O(1)' },
    complexityGuidance: {
      type: {
        expectedTime: { type: String, default: '' },
        expectedSpace: { type: String, default: '' },
        acceptedTimeClasses: { type: [String], default: [] },
        explanation: { type: String, default: '' },
        optimizationHint: { type: String, default: '' },
        source: { type: String, default: 'CURATED' },
        verified: { type: Boolean, default: false },
      },
      default: null,
    },
    referenceApproach: {
      type: {
        title: { type: String, default: '' },
        approachId: { type: String, default: '' },
        explanation: { type: String, default: '' },
        timeComplexity: { type: String, default: '' },
        spaceComplexity: { type: String, default: '' },
        code: { type: Map, of: String, default: {} },
      },
      default: null,
    },
    points: { type: Number, default: 10 },
    hints: [{ type: String }],
    solutionOutline: { type: String, select: false }, // never sent to candidates
    isPublished: { type: Boolean, default: false, index: true },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

codingProblemSchema.index({ title: 'text', tags: 'text' });

export default mongoose.model<ICodingProblem>('CodingProblem', codingProblemSchema);
