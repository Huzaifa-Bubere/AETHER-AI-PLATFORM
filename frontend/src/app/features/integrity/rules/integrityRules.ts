/**
 * AETHER — Interview Integrity Rules Engine.
 *
 * THE CONTRACT (spec FINAL RULE): MediaPipe only produces *observations*.
 * This module is what decides whether an integrity warning is warranted, and it
 * is deliberately:
 *   - PURE: no DOM, no React, no camera, no timers of its own. Time is passed in
 *     as `at`, so a whole interview can be replayed deterministically in a test.
 *   - CENTRALISED: every threshold lives in DEFAULT_INTEGRITY_CONFIG. Nothing is
 *     scattered through UI components (spec §7/§38).
 *   - OBSERVATION LANGUAGE ONLY: it reports "sustained screen-attention
 *     deviation", never "cheating" (spec §8/§14/§27). It cannot see intent, so it
 *     never claims to.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: raise technical/communication/answer scores
 * (spec §28) or count warnings. Counting is the backend's job — it is
 * authoritative (spec §29) and this engine never trusts itself as the record.
 */

/** Every integrity event type in one place — never a string literal at a call site (spec §15). */
export const INTEGRITY_EVENT_TYPES = [
  'FACE_MISSING',
  'MULTIPLE_FACES',
  'GAZE_AWAY',
  'HEAD_AWAY',
  'CAMERA_DISABLED',
  'MEDIA_TRACK_ENDED',
  'TAB_SWITCH',
  'WINDOW_BLUR',
  'FULLSCREEN_EXIT',
] as const;
export type IntegrityEventType = (typeof INTEGRITY_EVENT_TYPES)[number];

export type IntegritySeverity = 'OBSERVATION' | 'WARNING' | 'CRITICAL';

/**
 * Session-level classification. Note there is no CHEATER state and there never
 * will be: gaze direction cannot establish intent (spec §1/§41).
 */
export type IntegrityClass =
  | 'NORMAL'
  | 'OBSERVATION'
  | 'WARNING'
  | 'REPEATED_WARNING'
  | 'SESSION_REVIEW_REQUIRED';

/** Internal gaze classification, relative to the calibrated baseline (spec §6). */
export type GazeDirection = 'CENTER' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN' | 'UNKNOWN';

export interface IntegrityConfig {
  /** Sampling rate the caller is expected to drive this at (spec §24: 5–10 FPS). */
  sampleFps: number;
  /** Rolling window for temporal smoothing (spec §7). */
  smoothingWindowMs: number;
  /** A glance shorter than this is human and ignored entirely (spec §7/§22 CASE A/F). */
  ignoreAwayMs: number;
  /** Sustained away at or beyond this becomes a WARNING (spec §8). */
  warningAwayMs: number;
  /** Relative yaw beyond which the head is considered turned away (spec §9). */
  headYawThresholdDeg: number;
  /** Relative pitch beyond which the head is considered looking up/down (spec §9). */
  headPitchThresholdDeg: number;
  /**
   * Iris displacement (normalised, relative to the calibrated neutral) beyond
   * which the EYES are considered off-screen. Separate from head pose because a
   * candidate can look sideways with a straight head — the spec asks for both
   * signals, and head-only detection misses this entirely (spec §9).
   */
  eyeOffsetThreshold: number;
  /**
   * Landmark/tracking confidence below this yields UNKNOWN and never a warning
   * (spec §23) — low confidence means we do not know, not that something happened.
   */
  minConfidence: number;
  /** Minimum time between two warnings of the same kind (spec §18). */
  gazeCooldownMs: number;
  faceMissingCooldownMs: number;
  multipleFacesCooldownMs: number;
  /** Tracking loss below this is ignored as noise (spec §10). */
  faceMissingIgnoreMs: number;
  /** Tracking loss at or beyond this warrants a warning (spec §10). */
  faceMissingWarningMs: number;
  /** More than one face for less than this is ignored (spec §11). */
  multipleFacesIgnoreMs: number;
  /** More than one face at or beyond this warrants a warning (spec §11). */
  multipleFacesWarningMs: number;
  /** Warning budget; the backend owns the canonical count (spec §21/§29). */
  maxWarnings: number;
}

export const DEFAULT_INTEGRITY_CONFIG: IntegrityConfig = {
  sampleFps: 8,
  smoothingWindowMs: 800,
  ignoreAwayMs: 2000,
  warningAwayMs: 4000,
  headYawThresholdDeg: 30,
  headPitchThresholdDeg: 20,
  eyeOffsetThreshold: 0.12,
  minConfidence: 0.5,
  gazeCooldownMs: 10000,
  faceMissingCooldownMs: 30000,
  multipleFacesCooldownMs: 30000,
  faceMissingIgnoreMs: 2000,
  faceMissingWarningMs: 5000,
  multipleFacesIgnoreMs: 1500,
  multipleFacesWarningMs: 2000,
  maxWarnings: 5,
};

/** One MediaPipe observation for one sampled frame. */
export interface FaceObservation {
  /** Monotonic timestamp in ms. Supplied by the caller so tests are deterministic. */
  at: number;
  facePresent: boolean;
  faceCount: number;
  /** Tracker/landmark confidence 0..1. */
  confidence: number;
  /** Absolute head pose in degrees, if available. */
  yawDeg?: number | null;
  pitchDeg?: number | null;
  /**
   * Iris offset from the eye corners, normalised to the eye width (-1..1), from
   * MediaPipe iris landmarks (468/473). Optional: not all trackers provide it.
   */
  eyeOffsetX?: number | null;
  eyeOffsetY?: number | null;
  /** Camera may be gone entirely. */
  mediaTrackEnded?: boolean;
}

export interface CalibrationSample {
  yawDeg?: number | null;
  pitchDeg?: number | null;
  eyeOffsetX?: number | null;
  eyeOffsetY?: number | null;
}

/** Neutral pose captured before the interview; all movement is relative to this (spec §5). */
export interface CalibrationBaseline {
  yawDeg: number;
  pitchDeg: number;
  eyeOffsetX: number;
  eyeOffsetY: number;
  sampleCount: number;
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Build the neutral baseline from calibration samples using the MEDIAN rather
 * than the mean: one bad frame (a blink, a tracking jump) must not skew the
 * baseline the entire interview is measured against.
 */
export function buildCalibrationBaseline(samples: CalibrationSample[]): CalibrationBaseline {
  const finite = (values: Array<number | null | undefined>): number[] =>
    values.map(v => Number(v)).filter(Number.isFinite);
  const yaws = finite(samples.map(s => s.yawDeg));
  return {
    yawDeg: median(yaws),
    pitchDeg: median(finite(samples.map(s => s.pitchDeg))),
    eyeOffsetX: median(finite(samples.map(s => s.eyeOffsetX))),
    eyeOffsetY: median(finite(samples.map(s => s.eyeOffsetY))),
    sampleCount: yaws.length,
  };
}

export interface EmittedIntegrityEvent {
  type: IntegrityEventType;
  severity: IntegritySeverity;
  startedAt: number;
  endedAt: number | null;
  durationMs: number;
  /** True when this incident has been reported to the backend. */
  warningIssued: boolean;
  metadata: {
    faceCount?: number;
    gazeDirection?: GazeDirection;
    relativeYaw?: number;
    relativePitch?: number;
    confidence?: number;
  };
}

export interface IntegrityDecision {
  /** NORMAL unless something worth showing the candidate is happening now. */
  classification: IntegrityClass;
  /** Non-null exactly ONCE per incident — this is what stops frame-by-frame spam (spec §18). */
  event: EmittedIntegrityEvent | null;
  /** Incident currently in progress, if any. */
  activeIncidentType: IntegrityEventType | null;
  /** Subtle indicator copy for the candidate, e.g. "Face visibility lost" (spec §10). */
  indicator: string | null;
  /** Why nothing was emitted. Useful for the debug overlay and for tests. */
  suppressed:
    | 'BELOW_DURATION'
    | 'COOLDOWN'
    | 'LOW_CONFIDENCE'
    | 'WITHIN_IGNORE_WINDOW'
    | 'NO_CALIBRATION'
    | null;
  debug: {
    gaze: GazeDirection;
    relativeYaw: number | null;
    relativePitch: number | null;
    smoothedYaw: number | null;
    smoothedPitch: number | null;
    awayMs: number;
    faceMissingMs: number;
    multipleFacesMs: number;
    incidentsEmitted: number;
  };
}

interface Incident {
  type: IntegrityEventType;
  startedAt: number;
  lastSeenAt: number;
  warningIssued: boolean;
}

type Scalars = { yaw: number; pitch: number; eyeX: number; eyeY: number; at: number };

/**
 * Frame-by-frame state machine.
 *
 * One instance per interview session. Feed it observations in timestamp order;
 * it returns a decision per observation. Everything it emits is one event per
 * incident (never per frame) and rate-limited by per-type cooldowns.
 */
export class IntegrityRulesEngine {
  private config: IntegrityConfig;
  private baseline: CalibrationBaseline | null;
  private window: Scalars[] = [];
  private incidents = new Map<IntegrityEventType, Incident>();
  private lastWarningAt = new Map<IntegrityEventType, number>();
  private lastEmittedType: IntegrityEventType | null = null;
  private gazeIncidentsClosed = 0;
  private emittedCount = 0;

  constructor(config: Partial<IntegrityConfig> = {}, baseline: CalibrationBaseline | null = null) {
    this.config = { ...DEFAULT_INTEGRITY_CONFIG, ...config };
    this.baseline = baseline && baseline.sampleCount > 0 ? baseline : null;
  }

  /** Set/replace the calibrated neutral pose (spec §5). */
  setBaseline(baseline: CalibrationBaseline | null): void {
    this.baseline = baseline && baseline.sampleCount > 0 ? baseline : null;
  }

  getConfig(): Readonly<IntegrityConfig> {
    return this.config;
  }

  /** Clear all incidents — used when monitoring is (re)started after a gap. */
  reset(): void {
    this.window = [];
    this.incidents.clear();
    this.lastWarningAt.clear();
    this.lastEmittedType = null;
    this.gazeIncidentsClosed = 0;
  }

  private smoothed(at: number): { yaw: number | null; pitch: number | null; eyeX: number | null; eyeY: number | null } {
    const cutoff = at - this.config.smoothingWindowMs;
    this.window = this.window.filter(w => w.at >= cutoff);
    const med = (pick: (w: Scalars) => number): number | null =>
      this.window.length ? median(this.window.map(pick)) : null;
    return { yaw: med(w => w.yaw), pitch: med(w => w.pitch), eyeX: med(w => w.eyeX), eyeY: med(w => w.eyeY) };
  }

  /**
   * Direction from BOTH signals. Head pose is used when the head is clearly
   * turned; otherwise iris offset decides — so "eyes right with a straight head"
   * is detected rather than missed (spec §9).
   */
  private classifyGaze(input: {
    relYaw: number | null;
    relPitch: number | null;
    relEyeX: number | null;
    relEyeY: number | null;
    confident: boolean;
  }): GazeDirection {
    if (!input.confident) return 'UNKNOWN';
    const { relYaw, relPitch, relEyeX, relEyeY } = input;
    if (relYaw !== null && Math.abs(relYaw) > this.config.headYawThresholdDeg) {
      return relYaw > 0 ? 'RIGHT' : 'LEFT';
    }
    if (relPitch !== null && Math.abs(relPitch) > this.config.headPitchThresholdDeg) {
      return relPitch > 0 ? 'DOWN' : 'UP';
    }
    if (relEyeX !== null && Math.abs(relEyeX) > this.config.eyeOffsetThreshold) {
      return relEyeX > 0 ? 'RIGHT' : 'LEFT';
    }
    if (relEyeY !== null && Math.abs(relEyeY) > this.config.eyeOffsetThreshold) {
      return relEyeY > 0 ? 'DOWN' : 'UP';
    }
    return 'CENTER';
  }

  /**
   * Open or extend an incident and decide whether to emit.
   * Emits at most ONE event per incident, and only once the duration tier for
   * that incident type is reached (spec §7/§18).
   */
  private advanceIncident(
    type: IntegrityEventType,
    at: number,
    severity: IntegritySeverity,
    warningAfterMs: number,
    cooldownMs: number,
    metadata: EmittedIntegrityEvent['metadata'],
  ): { event: EmittedIntegrityEvent | null; durationMs: number; suppressed: IntegrityDecision['suppressed'] } {
    let incident = this.incidents.get(type);
    if (!incident) {
      incident = { type, startedAt: at, lastSeenAt: at, warningIssued: false };
      this.incidents.set(type, incident);
    }
    incident.lastSeenAt = at;
    const durationMs = at - incident.startedAt;

    if (incident.warningIssued) return { event: null, durationMs, suppressed: null };
    if (durationMs < warningAfterMs) {
      return { event: null, durationMs, suppressed: 'BELOW_DURATION' };
    }
    // A repeat of the same behaviour after a cooldown is a separate incident; a
    // new one inside the cooldown must not silently create warning spam (§18).
    const lastWarnedAt = this.lastWarningAt.get(type);
    if (lastWarnedAt !== undefined && at - lastWarnedAt < cooldownMs) {
      return { event: null, durationMs, suppressed: 'COOLDOWN' };
    }

    incident.warningIssued = true;
    this.lastWarningAt.set(type, at);
    this.lastEmittedType = type;
    this.emittedCount += 1;
    return {
      event: {
        type,
        severity,
        startedAt: incident.startedAt,
        endedAt: null,
        durationMs,
        warningIssued: true,
        metadata,
      },
      durationMs,
      suppressed: null,
    };
  }

  /** Close an in-progress incident when the observable condition ends (§18). */
  private closeIncident(type: IntegrityEventType): void {
    if (this.incidents.delete(type)) this.gazeIncidentsClosed += 1;
  }

  push(obs: FaceObservation): IntegrityDecision {
    const at = obs.at;
    const cfg = this.config;

    // ── Camera gone: the strongest, unambiguous signal (spec §12) ────────────
    if (obs.mediaTrackEnded) {
      const { event, durationMs } = this.advanceIncident(
        'MEDIA_TRACK_ENDED', at, 'CRITICAL', 0, 0, {},
      );
      return this.decision('SESSION_REVIEW_REQUIRED', event, 'MEDIA_TRACK_ENDED', null, durationMs, 0, 0, 'UNKNOWN', null, null, null, null);
    }

    const multipleFaces = obs.facePresent && obs.faceCount > 1;
    const faceMissing = !obs.facePresent;

    let event: EmittedIntegrityEvent | null = null;
    let suppressed: IntegrityDecision['suppressed'] = null;
    let classification: IntegrityClass = 'NORMAL';
    let indicator: string | null = null;
    let activeIncidentType: IntegrityEventType | null = null;
    let faceMissingMs = 0;
    let multipleFacesMs = 0;

    // ── More than one face (spec §11) ────────────────────────────────────────
    if (multipleFaces) {
      const r = this.advanceIncident(
        'MULTIPLE_FACES', at, 'WARNING', cfg.multipleFacesWarningMs, cfg.multipleFacesCooldownMs,
        { faceCount: obs.faceCount },
      );
      event = r.event; suppressed = r.suppressed;
      multipleFacesMs = r.durationMs;
      activeIncidentType = 'MULTIPLE_FACES';
      if (r.durationMs >= cfg.multipleFacesIgnoreMs) classification = event ? 'WARNING' : 'OBSERVATION';
    } else {
      this.closeIncident('MULTIPLE_FACES');
    }

    // ── Face missing (spec §10) ──────────────────────────────────────────────
    if (faceMissing) {
      const r = this.advanceIncident(
        'FACE_MISSING', at, 'WARNING', cfg.faceMissingWarningMs, cfg.faceMissingCooldownMs, {},
      );
      faceMissingMs = r.durationMs;
      // 0–2s: tracking noise, say nothing. 2–5s: subtle indicator only.
      if (r.durationMs < cfg.faceMissingIgnoreMs) {
        suppressed = suppressed ?? 'WITHIN_IGNORE_WINDOW';
      } else {
        indicator = 'Face visibility lost';
        activeIncidentType = activeIncidentType ?? 'FACE_MISSING';
        if (event || r.event) { event = r.event ?? event; classification = 'WARNING'; }
        else classification = classification === 'WARNING' ? 'WARNING' : 'OBSERVATION';
        if (suppressed === null) suppressed = r.suppressed;
      }
    } else {
      this.closeIncident('FACE_MISSING');
    }

    // ── Gaze / head away (spec §6–§9, §22) ───────────────────────────────────
    let gaze: GazeDirection = 'UNKNOWN';
    let relYaw: number | null = null;
    let relPitch: number | null = null;
    let smoothedYaw: number | null = null;
    let smoothedPitch: number | null = null;
    let awayMs = 0;

    if (obs.facePresent && !multipleFaces) {
      const confident = Number.isFinite(obs.confidence) && obs.confidence >= cfg.minConfidence;
      const hasPose = Number.isFinite(obs.yawDeg) && Number.isFinite(obs.pitchDeg);
      const hasEyes = Number.isFinite(obs.eyeOffsetX);

      if (!confident) {
        // We do not know where they are looking. Never warn on a guess (§23).
        gaze = 'UNKNOWN';
        this.closeIncident('GAZE_AWAY');
        this.closeIncident('HEAD_AWAY');
        suppressed = suppressed ?? 'LOW_CONFIDENCE';
      } else if (!hasPose && !hasEyes) {
        // Landmarks absent for an otherwise present face: still unknown.
        gaze = 'UNKNOWN';
        this.window = [];
        suppressed = suppressed ?? 'LOW_CONFIDENCE';
      } else {
        this.window.push({
          yaw: Number(obs.yawDeg),
          pitch: Number(obs.pitchDeg),
          eyeX: hasEyes ? Number(obs.eyeOffsetX) : 0,
          eyeY: Number.isFinite(obs.eyeOffsetY) ? Number(obs.eyeOffsetY) : 0,
          at,
        });
        const s = this.smoothed(at);
        smoothedYaw = s.yaw;
        smoothedPitch = s.pitch;

        if (!this.baseline) {
          // Without calibration we cannot know what "center" means for THIS
          // camera and face, so we refuse to judge rather than assume (§5/§23).
          gaze = 'UNKNOWN';
          suppressed = suppressed ?? 'NO_CALIBRATION';
        } else {
          relYaw = s.yaw === null ? null : s.yaw - this.baseline.yawDeg;
          relPitch = s.pitch === null ? null : s.pitch - this.baseline.pitchDeg;
          const relEyeX = s.eyeX === null || !hasEyes ? null : s.eyeX - this.baseline.eyeOffsetX;
          const relEyeY = !hasEyes ? null : (s.eyeY ?? 0) - this.baseline.eyeOffsetY;
          gaze = this.classifyGaze({ relYaw, relPitch, relEyeX, relEyeY, confident: true });

          if (gaze === 'CENTER') {
            this.closeIncident('GAZE_AWAY');
            this.closeIncident('HEAD_AWAY');
          } else {
            const headAway = (relYaw !== null && Math.abs(relYaw) > cfg.headYawThresholdDeg)
              || (relPitch !== null && Math.abs(relPitch) > cfg.headPitchThresholdDeg);
            const type: IntegrityEventType = headAway ? 'HEAD_AWAY' : 'GAZE_AWAY';
            // Only one of the two is tracked at a time: they describe the same
            // behaviour once, and the spec wants ONE warning per incident (§18/§22).
            this.closeIncident(type === 'GAZE_AWAY' ? 'HEAD_AWAY' : 'GAZE_AWAY');

            const r = this.advanceIncident(type, at, 'WARNING', cfg.warningAwayMs, cfg.gazeCooldownMs, {
              gazeDirection: gaze,
              relativeYaw: relYaw === null ? undefined : Math.round(relYaw * 10) / 10,
              relativePitch: relPitch === null ? undefined : Math.round(relPitch * 10) / 10,
              confidence: obs.confidence,
            });
            awayMs = r.durationMs;
            activeIncidentType = type;

            // 2–4s is an observation; past 4s it becomes a warning (§7/§8).
            if (r.durationMs < cfg.ignoreAwayMs) {
              suppressed = suppressed ?? 'BELOW_DURATION';
            } else if (r.event) {
              event = r.event;
              classification = 'WARNING';
            } else {
              if (classification !== 'WARNING') classification = 'OBSERVATION';
              suppressed = suppressed ?? r.suppressed;
            }
          }
        }
      }
    }

    if (event === null && classification === 'WARNING') classification = 'WARNING';
    if (event === null && classification !== 'WARNING' && activeIncidentType === null) {
      classification = suppressed === 'COOLDOWN' ? 'NORMAL' : classification;
    }

    return {
      classification,
      event,
      activeIncidentType,
      indicator,
      suppressed,
      debug: {
        gaze,
        relativeYaw: relYaw,
        relativePitch: relPitch,
        smoothedYaw,
        smoothedPitch,
        awayMs,
        faceMissingMs,
        multipleFacesMs,
        incidentsEmitted: this.emittedCount,
      },
    };
  }

  private decision(
    classification: IntegrityClass,
    event: EmittedIntegrityEvent | null,
    activeIncidentType: IntegrityEventType | null,
    indicator: string | null,
    awayMs: number,
    faceMissingMs: number,
    multipleFacesMs: number,
    gaze: GazeDirection,
    relYaw: number | null,
    relPitch: number | null,
    smoothYaw: number | null,
    smoothPitch: number | null,
  ): IntegrityDecision {
    return {
      classification,
      event,
      activeIncidentType,
      indicator,
      suppressed: null,
      debug: {
        gaze,
        relativeYaw: relYaw,
        relativePitch: relPitch,
        smoothedYaw: smoothYaw,
        smoothedPitch: smoothPitch,
        awayMs,
        faceMissingMs,
        multipleFacesMs,
        incidentsEmitted: this.emittedCount,
      },
    };
  }
}

/**
 * Session-level classification from the AUTHORITATIVE warning count.
 *
 * Takes the count as an argument rather than trusting the engine's own tally:
 * the backend owns warning numbers (spec §29) and a frontend that reconnects
 * mid-interview must not restart its own count (spec §31).
 */
export function classifySession(warningCount: number, maxWarnings: number = DEFAULT_INTEGRITY_CONFIG.maxWarnings): IntegrityClass {
  const max = Number.isFinite(maxWarnings) && maxWarnings > 0 ? maxWarnings : DEFAULT_INTEGRITY_CONFIG.maxWarnings;
  const count = Number.isFinite(warningCount) && warningCount > 0 ? Math.floor(warningCount) : 0;
  if (count >= max) return 'SESSION_REVIEW_REQUIRED';
  if (count >= 2) return 'REPEATED_WARNING';
  if (count === 1) return 'WARNING';
  return 'NORMAL';
}

/** Whether a severity consumes one of the limited warnings (spec §21). */
export function severityConsumesWarning(severity: IntegritySeverity): boolean {
  return severity === 'WARNING' || severity === 'CRITICAL';
}

/**
 * Candidate-facing copy. Never says "cheating", "dishonest" or "you were caught" —
 * the system observes events, it cannot establish intent (spec §1/§8/§41).
 */
export const INTEGRITY_EVENT_COPY: Record<IntegrityEventType, { title: string; message: string }> = {
  FACE_MISSING: {
    title: 'Face Not Visible',
    message: 'Please remain visible to the camera during the interview.',
  },
  MULTIPLE_FACES: {
    title: 'Multiple People Detected',
    message: 'Only the interview candidate should remain visible during this assessment. Please ensure no other person is in the camera frame.',
  },
  GAZE_AWAY: {
    title: 'Interview Integrity Warning',
    message: 'You appear to have been looking away from the interview screen for an extended period. Please keep your attention on the interview.',
  },
  HEAD_AWAY: {
    title: 'Interview Integrity Warning',
    message: 'You appear to have been looking away from the interview screen for an extended period. Please keep your attention on the interview.',
  },
  CAMERA_DISABLED: {
    title: 'Camera Required',
    message: 'Your camera feed is no longer available. Please enable your camera to continue the interview.',
  },
  MEDIA_TRACK_ENDED: {
    title: 'Camera Required',
    message: 'Your camera feed has stopped. Please re-enable your camera to continue the interview.',
  },
  TAB_SWITCH: {
    title: 'Interview Integrity Warning',
    message: 'You left the interview tab. Please remain on the interview screen throughout the assessment.',
  },
  WINDOW_BLUR: {
    title: 'Interview Integrity Warning',
    message: 'You left the interview window. Please remain on the interview screen throughout the assessment.',
  },
  FULLSCREEN_EXIT: {
    title: 'Interview Integrity Warning',
    message: 'You left fullscreen mode. Please remain in fullscreen throughout the assessment.',
  },
};
