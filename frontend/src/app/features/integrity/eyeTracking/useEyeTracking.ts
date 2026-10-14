import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_INTEGRITY_CONFIG,
  IntegrityRulesEngine,
  buildCalibrationBaseline,
  type CalibrationBaseline,
  type EmittedIntegrityEvent,
  type EyeState,
  type GazeDirection,
  type IntegrityConfig,
  type IntegrityDecision,
  type TrackingState,
} from '../rules/integrityRules';
import {
  combinedIrisOffset,
  eyeOpenness,
  headPoseFromLandmarks,
  headPoseFromMatrix,
  hasRequiredLandmarks,
  type EyeOpennessCalibration,
} from './landmarks';
import {
  detectFaceFrame,
  disposeFaceLandmarker,
  getFaceLandmarker,
  type FaceFrame,
  type FaceLandmarkerLike,
} from './faceLandmarker';

/**
 * AETHER — useEyeTracking
 *
 * THE ONLY piece of React that owns the camera-analysis loop. Everything that
 * decides whether something is a warning lives in the pure
 * `IntegrityRulesEngine`; this hook's job is strictly:
 *
 *   video frame → MediaPipe landmark observation → engine → report event
 *
 * It therefore holds no thresholds of its own. Sampling cadence, smoothing
 * window, the 3-second closure rule, cooldowns and blink immunity are all
 * configuration on the engine, so a whole interview replays deterministically
 * in tests without a camera (see rules/integrityRules.test.ts).
 *
 * Deliberate safety behaviour: if MediaPipe cannot load at all, this hook feeds
 * the engine NOTHING. A missing model must never be reported as "no face
 * detected" — that would turn an infrastructure failure into a warning against
 * the candidate.
 */

export interface EyeTrackingStatus {
  /** True once the sampling loop is running. */
  running: boolean;
  /** Non-null only when MediaPipe itself failed; the interview continues. */
  error: string | null;
  trackingState: TrackingState;
  eyeState: EyeState;
  gaze: GazeDirection;
  faceCount: number;
  facePresent: boolean;
  /** Rounded to 100 ms — this drives a label, not a physics simulation. */
  eyesClosedMs: number;
}

export interface EyeTrackingCallbacks {
  /**
   * Called whenever the engine emits an integrity event. Exactly one call per
   * incident — de-duplication is the engine's job, not the caller's.
   */
  onEvent?: (event: EmittedIntegrityEvent, decision: IntegrityDecision) => void;
  /** Called when the camera track ends or stops delivering frames. */
  onMediaTrackEnded?: () => void;
  /** Called after calibration produces a neutral baseline. */
  onCalibrated?: (baseline: CalibrationBaseline) => void;
}

export type CalibrationPhase = 'IDLE' | 'COLLECTING' | 'READY';

interface Options extends EyeTrackingCallbacks {
  /** Attach to the <video> element that is showing the candidate. */
  videoRef: React.RefObject<HTMLVideoElement>;
  /** Monitoring is only active during a protected interview. */
  active: boolean;
  /** Hard switch: the analysis loop itself runs only while this is true. */
  enabled: boolean;
  config?: Partial<IntegrityConfig>;
  /** Seconds of stable data required for calibration (spec Part H: 2–3 s). */
  calibrationSeconds?: number;
}

interface CalibrationSample {
  yawDeg: number;
  pitchDeg: number;
  eyeOffsetX: number;
  eyeOffsetY: number;
}

const DEFAULT_CALIBRATION_SECONDS = 3;

/** Poses further apart than this are not a "still head" and are not sampled. */
const CALIBRATION_STABILITY_DEG = 6;
/** Below this many usable samples we refuse to invent a centre of attention. */
const MIN_CALIBRATION_SAMPLES = 4;

/**
 * Head pose for one frame, always from the SAME source so a baseline measured on
 * one scale is never subtracted from values measured on another.
 */
function resolveHeadPose(frame: FaceFrame): { yawDeg: number; pitchDeg: number } | null {
  const fromMatrix = headPoseFromMatrix(frame.matrix);
  if (fromMatrix) return { yawDeg: fromMatrix.yawDeg, pitchDeg: fromMatrix.pitchDeg };
  const fromLandmarks = headPoseFromLandmarks(frame.landmarks);
  if (fromLandmarks) return { yawDeg: fromLandmarks.yawDeg, pitchDeg: fromLandmarks.pitchDeg };
  return null;
}

export function useEyeTracking({
  videoRef,
  active,
  enabled,
  config,
  calibrationSeconds = DEFAULT_CALIBRATION_SECONDS,
  onEvent,
  onMediaTrackEnded,
  onCalibrated,
}: Options) {
  const configRef = useRef<Partial<IntegrityConfig> | undefined>(config);
  configRef.current = config;

  const engineRef = useRef<IntegrityRulesEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new IntegrityRulesEngine(configRef.current, null);
  }

  const landmarkerRef = useRef<FaceLandmarkerLike | null>(null);
  /** Latest analysed frame, read imperatively by the canvas overlay. */
  const frameRef = useRef<FaceFrame | null>(null);
  const baselineRef = useRef<CalibrationBaseline | null>(null);
  const eyeCalibrationRef = useRef<EyeOpennessCalibration | null>(null);
  const calibrationSamplesRef = useRef<CalibrationSample[]>([]);
  const calibrationStartedAtRef = useRef<number | null>(null);
  const mutedSamplesRef = useRef(0);
  /** Track-ended is reported once; the blocking modal must not be re-triggered. */
  const trackEndedReportedRef = useRef(false);

  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onMediaTrackEndedRef = useRef(onMediaTrackEnded);
  onMediaTrackEndedRef.current = onMediaTrackEnded;
  const onCalibratedRef = useRef(onCalibrated);
  onCalibratedRef.current = onCalibrated;

  const [status, setStatus] = useState<EyeTrackingStatus>({
    running: false,
    error: null,
    trackingState: 'CALIBRATING',
    eyeState: 'UNKNOWN',
    gaze: 'UNKNOWN',
    faceCount: 0,
    facePresent: false,
    eyesClosedMs: 0,
  });
  const [calibrationPhase, setCalibrationPhase] = useState<CalibrationPhase>('IDLE');
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [baselineState, setBaselineState] = useState<CalibrationBaseline | null>(null);

  // ── Load MediaPipe once per interview ────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    getFaceLandmarker()
      .then(instance => { if (!cancelled) landmarkerRef.current = instance; })
      .catch((error: unknown) => {
        if (cancelled) return;
        // Report it honestly and STOP: no landmark signal means no eye/gaze
        // warnings at all (spec Part R), rather than a blind "no face" stream.
        setStatus(prev => ({
          ...prev,
          running: false,
          error: `Face tracking could not start (${(error as Error)?.message ?? 'unknown error'}). The interview continues without attention monitoring.`,
        }));
      });
    return () => { cancelled = true; };
  }, [enabled]);

  // Release the wasm instance when the interview room unmounts.
  useEffect(() => () => { void disposeFaceLandmarker(); }, []);

  // ── Sampling loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!active || !enabled) return;
    let raf = 0;
    let lastSampleAt = 0;
    const fps = configRef.current?.sampleFps ?? DEFAULT_INTEGRITY_CONFIG.sampleFps;
    const intervalMs = 1000 / fps;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const video = videoRef.current;
      const engine = engineRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !engine || !landmarker) return;

      const now = performance.now();
      if (now - lastSampleAt < intervalMs) return;
      lastSampleAt = now;

      const stream = video.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks?.()[0] ?? null;

      // Camera gone (spec Part AA). `muted` is debounced because browsers
      // momentarily report it while the first frames arrive.
      const trackDead = !track || track.readyState === 'ended';
      mutedSamplesRef.current = track && track.muted && !trackDead ? mutedSamplesRef.current + 1 : 0;
      const muted = mutedSamplesRef.current >= 3; // ~375 ms at 8 FPS

      if (trackDead || muted) {
        if (!trackEndedReportedRef.current) {
          trackEndedReportedRef.current = true;
          const decision = engine.push({
            at: now, facePresent: false, faceCount: 0, confidence: 0, mediaTrackEnded: true,
          });
          if (decision.event) onEventRef.current?.(decision.event, decision);
          onMediaTrackEndedRef.current?.();
        }
        setStatus(prev => ({ ...prev, running: true, trackingState: 'CAMERA_LOST', facePresent: false, faceCount: 0 }));
        return;
      }
      trackEndedReportedRef.current = false;

      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      let frame: FaceFrame;
      try {
        frame = detectFaceFrame(landmarker, video, now);
      } catch {
        // A single failed frame is a tracking gap, not candidate behaviour.
        return;
      }
      frameRef.current = frame;

      const hasFace = frame.faceCount > 0 && hasRequiredLandmarks(frame.landmarks);
      const pose = hasFace ? resolveHeadPose(frame) : null;
      const iris = hasFace ? combinedIrisOffset(frame.landmarks) : null;
      const leftEye = hasFace ? eyeOpenness(frame.landmarks, frame.blendshapes, 'LEFT', eyeCalibrationRef.current) : null;
      const rightEye = hasFace ? eyeOpenness(frame.landmarks, frame.blendshapes, 'RIGHT', eyeCalibrationRef.current) : null;

      const decision = engine.push({
        at: now,
        facePresent: hasFace,
        faceCount: frame.faceCount,
        confidence: frame.confidence,
        yawDeg: pose ? pose.yawDeg : null,
        pitchDeg: pose ? pose.pitchDeg : null,
        // Image space, matching how the engine compares gaze with head yaw.
        eyeOffsetX: iris ? iris.x : null,
        eyeOffsetY: iris ? iris.y : null,
        leftEyeOpen: leftEye ? leftEye.open : null,
        rightEyeOpen: rightEye ? rightEye.open : null,
      });

      if (decision.event) onEventRef.current?.(decision.event, decision);

      // ── Calibration collection (spec Part H) ──────────────────────────────
      collectCalibrationFrame({ hasFace, pose, iris, now, fps });

      setStatus(prev => {
        const next: EyeTrackingStatus = {
          running: true,
          error: prev.error,
          trackingState: decision.trackingState,
          eyeState: decision.eyeState,
          gaze: decision.debug.gaze,
          faceCount: frame.faceCount,
          facePresent: hasFace,
          eyesClosedMs: Math.round(decision.debug.eyesClosedMs / 100) * 100,
        };
        // Publish only meaningful changes so an 8 FPS loop cannot thrash React.
        const unchanged =
          prev.trackingState === next.trackingState &&
          prev.eyeState === next.eyeState &&
          prev.gaze === next.gaze &&
          prev.faceCount === next.faceCount &&
          prev.facePresent === next.facePresent &&
          prev.eyesClosedMs === next.eyesClosedMs &&
          prev.running === next.running &&
          prev.error === next.error;
        return unchanged ? prev : next;
      });
    };

    /**
     * Collect one calibration sample. Only a STILL head counts: a head-turn
     * during calibration must not become the new "centre of the screen".
     */
    function collectCalibrationFrame(input: {
      hasFace: boolean;
      pose: { yawDeg: number; pitchDeg: number } | null;
      iris: { x: number; y: number } | null;
      now: number;
      fps: number;
    }) {
      if (calibrationStartedAtRef.current === null) return;
      const samples = calibrationSamplesRef.current;
      const target = Math.max(6, Math.round(calibrationSeconds * input.fps));

      if (input.hasFace && input.pose && input.iris) {
        const stable = samples.length === 0 || samples.every(
          s => Math.abs(s.yawDeg - input.pose!.yawDeg) <= CALIBRATION_STABILITY_DEG,
        );
        if (stable) {
          samples.push({
            yawDeg: input.pose.yawDeg,
            pitchDeg: input.pose.pitchDeg,
            eyeOffsetX: input.iris.x,
            eyeOffsetY: input.iris.y,
          });
        }
      }

      const startedAt = calibrationStartedAtRef.current;
      const elapsed = input.now - startedAt;
      setCalibrationProgress(Math.min(100, Math.round((Math.min(samples.length, target) / target) * 100)));

      const finished = samples.length >= target || elapsed >= (calibrationSeconds + 1.5) * 1000;
      if (!finished) return;

      calibrationStartedAtRef.current = null;
      if (samples.length >= MIN_CALIBRATION_SAMPLES) {
        const built = buildCalibrationBaseline(samples);
        baselineRef.current = built;
        engineRef.current?.setBaseline(built);
        setBaselineState(built);
        setCalibrationPhase('READY');
        setCalibrationProgress(100);
        onCalibratedRef.current?.(built);
      } else {
        // Not enough usable data — refuse to invent a centre of attention.
        setCalibrationPhase('IDLE');
        setCalibrationProgress(0);
      }
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, enabled, videoRef, calibrationSeconds]);

  const startCalibration = useCallback(() => {
    calibrationSamplesRef.current = [];
    calibrationStartedAtRef.current = performance.now();
    baselineRef.current = null;
    engineRef.current?.setBaseline(null);
    setBaselineState(null);
    setCalibrationPhase('COLLECTING');
    setCalibrationProgress(0);
  }, []);

  const cancelCalibration = useCallback(() => {
    calibrationStartedAtRef.current = null;
    calibrationSamplesRef.current = [];
    setCalibrationProgress(0);
    setCalibrationPhase(baselineRef.current ? 'READY' : 'IDLE');
  }, []);

  /** Reset for a NEW interview: no baseline is ever carried across sessions. */
  const resetCalibration = useCallback(() => {
    calibrationStartedAtRef.current = null;
    calibrationSamplesRef.current = [];
    baselineRef.current = null;
    eyeCalibrationRef.current = null;
    trackEndedReportedRef.current = false;
    engineRef.current?.setBaseline(null);
    engineRef.current?.reset();
    setBaselineState(null);
    setCalibrationProgress(0);
    setCalibrationPhase('IDLE');
  }, []);

  return {
    status,
    frameRef,
    baseline: baselineState,
    calibrationPhase,
    calibrationProgress,
    startCalibration,
    cancelCalibration,
    resetCalibration,
  };
}
