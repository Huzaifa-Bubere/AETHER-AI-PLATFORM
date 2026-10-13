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
  | 'PAGE_RELOAD_ATTEMPT'
  // Interview camera integrity (spec §15). GAZE_AWAY/HEAD_AWAY describe a
  // sustained screen-attention deviation — never an inference about honesty.
  | 'GAZE_AWAY'
  | 'HEAD_AWAY'
  | 'MEDIA_TRACK_ENDED';

/**
 * Severity of an observable event (spec §16).
 *
 * Only WARNING and CRITICAL consume one of the limited warnings; an OBSERVATION
 * is shown to the candidate but must not increment the counter (spec §21).
 */
export type IntegritySeverity = 'OBSERVATION' | 'WARNING' | 'CRITICAL';

export interface IIntegrityEvent extends Document {
  userId: mongoose.Types.ObjectId;
  module: IntegrityModule;
  attemptId: string;          // module-specific id (aptitude attempt / interview session / coding session)
  type: IntegrityEventType;
  timestamp: Date;
  warningNumber: number;      // authoritative backend count (1-based)
  metadata?: Record<string, unknown>;
  /**
   * Incident timing (spec §16). Optional so every pre-existing row stays valid:
   * an older event is simply an instantaneous point event. A sustained incident
   * records how long the condition actually lasted, which is the difference
   * between "glanced away" and "looked away for 8 seconds".
   */
  startedAt?: Date;
  endedAt?: Date | null;
  durationMs?: number;
  severity?: IntegritySeverity;
  /** True when the candidate was actually shown a warning for this event. */
  warningIssued?: boolean;
}

const MAX_WARNINGS = 5;

const EVENT_TYPE_VALUES = [
  'TAB_SWITCH', 'WINDOW_BLUR', 'FULLSCREEN_EXIT', 'COPY_ATTEMPT', 'PASTE_ATTEMPT',
  'CONTEXT_MENU', 'CAMERA_DISABLED', 'CAMERA_PERMISSION_REVOKED', 'FACE_NOT_VISIBLE',
  'MULTIPLE_FACES', 'MICROPHONE_DISABLED', 'PAGE_RELOAD_ATTEMPT',
  'GAZE_AWAY', 'HEAD_AWAY', 'MEDIA_TRACK_ENDED',
];

const integrityEventSchema = new Schema<IIntegrityEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    module: { type: String, enum: ['APTITUDE', 'TECHNICAL_MCQ', 'CODING', 'INTERVIEW'], required: true },
    attemptId: { type: String, required: true },
    type: { type: String, enum: EVENT_TYPE_VALUES, required: true },
    timestamp: { type: Date, default: Date.now },
    warningNumber: { type: Number, required: true, min: 1 },   // authoritative backend count (1-based)
    metadata: { type: Schema.Types.Mixed, default: {} },
    // Defaults keep pre-existing rows meaningful without a migration.
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    durationMs: { type: Number, default: 0, min: 0 },
    severity: { type: String, enum: ['OBSERVATION', 'WARNING', 'CRITICAL'], default: 'WARNING' },
    warningIssued: { type: Boolean, default: true },
  },
  { timestamps: false }
);

// Fast lookups: attempt history + per-user admin views
integrityEventSchema.index({ module: 1, attemptId: 1, timestamp: 1 });
integrityEventSchema.index({ userId: 1, createdAt: -1 });

export const MAX_INTEGRITY_WARNINGS = MAX_WARNINGS;
export default mongoose.model<IIntegrityEvent>('IntegrityEvent', integrityEventSchema);
