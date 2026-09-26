/**
 * AETHER Interview — recording behavior analysis orchestrator.
 *
 * Sends the stored webcam recording to the AI server (OpenCV frame sampling)
 * and stores an OBSERVABLE presence/engagement profile on the session:
 * eye contact, on-camera presence, posture and motion energy, plus a
 * per-answer confidence trend.
 *
 * Hard rules:
 *  - Analysis NEVER blocks the report or the upload response.
 *  - Failure is non-fatal: the report simply shows no behavior section.
 *  - Only observable signals are stored (presence, gaze direction, motion).
 *    No personality traits, honesty, or emotion labels are claimed.
 */

import fs from 'fs';
import path from 'path';
import AdaptiveInterview from '../models/AdaptiveInterview';
import localStorageService from './localStorage';
import pythonAI from './pythonAI';
import logger from '../utils/logger';

const MAX_UPLOAD_BYTES = 40 * 1024 * 1024; // guard the AI-server hop

/** Build YYYY-MM-DD date string for the AI-server multipart contract. */
function toDateSeconds(d: Date): number {
  return Math.max(1, Math.round(d.getTime() / 1000));
}

/** Map a 0-100 signal to a short neutral note. */
function presenceNote(v: number): string {
  if (v >= 80) return 'Consistently visible and centered in the frame.';
  if (v >= 55) return 'Mostly visible; occasional movement out of frame.';
  if (v >= 30) return 'Frequently away from the camera frame.';
  return 'Rarely visible — camera may have been off or pointed away.';
}

function engagementNote(v: number): string {
  if (v >= 75) return 'Active posture and frequent natural gestures.';
  if (v >= 45) return 'Engaged posture with moderate movement.';
  return 'Very little movement — posture appears static or the frame is empty.';
}

/**
 * Run behavior analysis for a session that has a locally-stored recording.
 * Idempotent: re-running replaces the stored analysis.
 */
export async function runBehaviorAnalysis(sessionId: string): Promise<void> {
  const session = await AdaptiveInterview.findOne({ _id: sessionId });
  if (!session) return;
  if (!session.recording?.publicId) {
    logger.info(`Behavior analysis skipped — no recording for ${sessionId}`);
    return;
  }

  let filePath: string;
  try {
    filePath = localStorageService.getFilePath(session.recording.publicId);
  } catch {
    logger.warn(`Behavior analysis skipped — invalid recording path for ${sessionId}`);
    return;
  }
  if (!fs.existsSync(filePath)) {
    logger.warn(`Behavior analysis skipped — recording file missing: ${filePath}`);
    return;
  }
  const stat = fs.statSync(filePath);
  if (stat.size > MAX_UPLOAD_BYTES) {
    logger.warn(`Behavior analysis skipped — recording too large (${stat.size} bytes) for the analyzer`);
    return;
  }

  logger.info(`Behavior analysis started for ${sessionId} (${stat.size} bytes)`);
  const started = Date.now();

  // The AI-server batch analyzer accepts a multipart video upload.
  const FormData = (globalThis as any).FormData ?? (await import('form-data')).default;
  const BlobCtor = (globalThis as any).Blob;
  let form: any;
  if (FormData && BlobCtor) {
    const blob = new BlobCtor([fs.readFileSync(filePath)], { type: 'video/webm' });
    form = new FormData();
    form.append('video_file', blob, path.basename(filePath));
  } else {
    // Node 18 form-data fallback
    const FD = (await import('form-data')).default;
    form = new FD();
    form.append('video_file', fs.createReadStream(filePath), {
      filename: path.basename(filePath),
      contentType: 'video/webm',
    });
  }

  const raw = await pythonAI.post<Record<string, any>>(
    '/api/video/interview-behavior',
    form,
    {
      headers: form.getHeaders ? form.getHeaders() : undefined,
      timeout: 120_000,
    } as any,
  );

  // ── Normalize the AI-server payload into IBehaviorAnalysis ──
  const sampleCount = Number(raw?.frames_sampled) || 0;
  const presenceScore = Math.round(Number(raw?.presence_percentage) || 0);
  const eyeContactRaw = raw?.eye_contact_percentage;
  const engagementRaw = raw?.engagement_percentage;
  const confidenceRaw = raw?.confidence_index;
  const engagementScore = typeof engagementRaw === 'number' ? Math.round(engagementRaw) : null;
  const confidenceIndex = typeof confidenceRaw === 'number' ? Math.round(confidenceRaw) : null;
  const eyeContactScore = typeof eyeContactRaw === 'number' ? Math.round(eyeContactRaw) : null;
  const dominantExpression: string | null = null; // expression labels are optional; analyzer v1 is expression-free

  // Build segments aligned to answers when timing is available.
  const responses = (session.responses || []).slice().sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const durationSec = session.recording?.durationSeconds
    ?? (session.endedAt ? Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 1000) : 0);
  const segments = buildSegments(responses, durationSec, presenceScore, engagementScore);

  session.behaviorAnalysis = {
    available: raw?.available !== false && sampleCount > 0,
    engine: String(raw?.engine || 'ai-server/opencv-frame-sampling'),
    framesAnalyzed: sampleCount,
    presenceScore,
    eyeContactScore,
    postureScore: typeof raw?.centeredness_percentage === 'number' ? Math.round(raw.centeredness_percentage) : null,
    engagementScore,
    confidenceIndex,
    segments,
    summary: sampleCount > 0
      ? summarize(presenceScore, engagementScore, confidenceIndex, sampleCount)
      : 'Recording could not be analyzed — no frames were sampleable.',
    notes: buildNotes(presenceScore, engagementScore, dominantExpression),
    analyzedAt: new Date(),
  };
  session.markModified('behaviorAnalysis');
  await session.save();
  logger.info(`Behavior analysis stored for ${sessionId} in ${Date.now() - started}ms`);
}

function buildSegments(
  responses: Array<{ timestamp: Date; questionText: string; questionId: string }>,
  durationSec: number,
  presenceScore: number,
  engagementScore: number | null,
) {
  const segs: Array<{ label: string; startSec: number; endSec: number; presence: number; engagement: number | null; note: string }> = [];
  const startEpoch = toDateSeconds(new Date());
  if (responses.length === 0) {
    segs.push({
      label: 'Full session',
      startSec: 0,
      endSec: durationSec || 0,
      presence: presenceScore,
      engagement: engagementScore,
      note: presenceNote(presenceScore),
    });
    return segs;
  }
  // Approximate per-answer windows from response timestamps when the recording
  // duration is known. Segment boundaries use the next answer's start.
  const times = responses.map(r => toDateSeconds(r.timestamp));
  responses.forEach((r, i) => {
    const start = Math.max(0, times[i] - times[0]);
    const end = i + 1 < responses.length ? Math.max(start + 1, times[i + 1] - times[0]) : (durationSec || start + 30);
    segs.push({
      label: `Answer ${i + 1}: ${(r.questionText || '').slice(0, 48)}${(r.questionText || '').length > 48 ? '…' : ''}`,
      startSec: start,
      endSec: Math.min(end, startEpoch),
      presence: presenceScore, // frame-level refinement arrives with the segment analyzer
      engagement: engagementScore,
      note: i === 0 ? 'Opening answer — camera presence established.' : 'Delivery segment.',
    });
  });
  return segs;
}

function summarize(presence: number, engagement: number | null, confidence: number, frames: number): string {
  if (frames === 0) return 'No frames could be sampled from this recording — analysis unavailable.';
  const bits: string[] = [];
  bits.push(`Camera presence ${presence}% across ${frames} sampled frames`);
  if (engagement !== null) bits.push(`posture/motion engagement ${engagement}%`);
  bits.push(`overall confidence index ${confidence}/100`);
  return `${bits.join(', ')}. Signals are observable delivery cues, not personality judgements.`;
}

function buildNotes(presence: number, engagement: number | null, dominant: string | null): string[] {
  const notes: string[] = [];
  notes.push(presenceNote(presence));
  if (engagement !== null) notes.push(engagementNote(engagement));
  if (dominant && ['neutral', 'calm'].includes(dominant)) {
    notes.push('Predominantly neutral facial expression — steady and composed on camera.');
  } else if (dominant === 'happy') {
    notes.push('Frequently positive expression — friendly, approachable delivery.');
  } else if (dominant && ['sad', 'angry', 'fear'].includes(dominant)) {
    notes.push('Extended tense expressions detected — consider relaxing pace and posture.');
  }
  notes.push('Confidence here means observable steadiness on camera — it is one input, not a verdict.');
  return notes;
}
