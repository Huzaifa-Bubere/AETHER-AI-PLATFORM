import mongoose, { Document, Schema } from 'mongoose';

/**
 * AETHER — shared Assessment Integrity event log.
 * ONE collection backing Aptitude, Technical MCQ, Coding and AI Interview.
 * Stores observable events only — never media, never inferences.
 * Warning limit: 5 — reaching it auto-submits the assessment.
 */

export type IntegrityModule = 'APTITUDE' | 'TECHNICAL_MCQ' | 'CODING' | 'INTERVIEW';

export type IntegrityEventType =
  | 'TAB_SWITCH'
  | 'WINDOW_BLUR'
  | 'FULLSCREEN_EXIT'
  | 'COPY_ATTEMPT'
  | 'PASTE_ATTEMPT'
  | 'CONTEXT_MENU'
  | 'CAMERA_DISABLED'
  | 'CAMERA_PERMISSION_REVOKED'
  | 'FACE_NOT_VISIBLE'
  | 'MULTIPLE_FACES'
  | 'MICROPHONE_DISABLED'
  | 'PAGE_RELOAD_ATTEMPT';

export interface IIntegrityEvent extends Document {
  userId: mongoose.Types.ObjectId;
  module: IntegrityModule;
  attemptId: string;          // module-specific id (aptitude attempt / interview session / coding session)
  type: IntegrityEventType;
  timestamp: Date;
  warningNumber: number;      // authoritative backend count (1-based)
  metadata?: Record<string, unknown>;
}

const MAX_WARNINGS = 5;

const integrityEventSchema = new Schema<IIntegrityEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    module: { type: String, enum: ['APTITUDE', 'TECHNICAL_MCQ', 'CODING', 'INTERVIEW'], required: true },
    attemptId: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'TAB_SWITCH', 'WINDOW_BLUR', 'FULLSCREEN_EXIT', 'COPY_ATTEMPT', 'PASTE_ATTEMPT',
        'CONTEXT_MENU', 'CAMERA_DISABLED', 'CAMERA_PERMISSION_REVOKED', 'FACE_NOT_VISIBLE',
        'MULTIPLE_FACES', 'MICROPHONE_DISABLED', 'PAGE_RELOAD_ATTEMPT',
      ],
      required: true,
    },
    timestamp: { type: Date, default: Date.now },
    warningNumber: { type: Number, required: true, min: 1 },   // authoritative backend count (1-based)
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: false }
);

// Fast lookups: attempt history + per-user admin views
integrityEventSchema.index({ module: 1, attemptId: 1, timestamp: 1 });
integrityEventSchema.index({ userId: 1, createdAt: -1 });

export const MAX_INTEGRITY_WARNINGS = MAX_WARNINGS;
export default mongoose.model<IIntegrityEvent>('IntegrityEvent', integrityEventSchema);
