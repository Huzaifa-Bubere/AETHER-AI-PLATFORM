/**
 * AETHER — MediaPipe Face Landmarker loader (browser).
 *
 * Wraps `@mediapipe/tasks-vision` so the rest of the app never touches the wasm
 * runtime directly. One FaceLandmarker instance is reused for a whole interview
 * (creating one per frame would re-initialise a 9 MB wasm module every time).
 *
 * The heavy module is imported DYNAMICALLY: the wasm runtime is only fetched
 * when a protected interview actually starts, so the rest of AETHER keeps
 * loading instantly.
 *
 * CONFIGURATION (server-agnostic, no secrets):
 *   VITE_MEDIAPIPE_WASM_BASE          directory holding vision_wasm_*.wasm
 *   VITE_FACE_LANDMARKER_MODEL_URL    the .task model file
 * Both default to Google's public distribution for the EXACT version pinned in
 * package.json. A self-hosted deployment can point them at its own copies; that
 * is a deployment choice, never a build-time secret.
 */

import type { BlendshapeScores, Landmark } from './landmarks';

/** Version must match the `@mediapipe/tasks-vision` dependency exactly. */
export const MEDIAPIPE_TASKS_VISION_VERSION = '0.10.17';

const DEFAULT_WASM_BASE =
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VISION_VERSION}/wasm`;
const DEFAULT_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

function envValue(key: string, fallback: string): string {
  // import.meta.env is injected by Vite; tolerate its absence in tests/SSR.
  const env = (import.meta as { env?: Record<string, unknown> } | undefined)?.env;
  const value = env?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function mediaPipeWasmBase(): string {
  return envValue('VITE_MEDIAPIPE_WASM_BASE', DEFAULT_WASM_BASE);
}

export function faceLandmarkerModelUrl(): string {
  return envValue('VITE_FACE_LANDMARKER_MODEL_URL', DEFAULT_MODEL_URL);
}

/** One analysed camera frame. `landmarks[0]` is the primary (largest) face. */
export interface FaceFrame {
  /** Monotonic ms, from performance.now(). */
  at: number;
  faceCount: number;
  /** Primary face landmarks (478 points with iris), empty when no face. */
  landmarks: Landmark[];
  /** `eyeBlinkLeft` / `eyeBlinkRight` etc. Null when the model did not emit them. */
  blendshapes: BlendshapeScores | null;
  /** Flattened 4x4 facial transformation matrix. Null when unavailable. */
  matrix: number[] | null;
  /**
   * Confidence 0..1. FaceLandmarker does not expose a per-face score, so this
   * reports 1 when a face passed the model's own detection/presence/tracking
   * thresholds and 0 when nothing was detected — it is never a fabricated
   * certainty about a face that was not found.
   */
  confidence: number;
  /** Second-face landmarks, when more than one face was detected. */
  secondaryLandmarks?: Landmark[];
}

function toLandmarks(raw: Array<{ x: number; y: number; z?: number; visibility?: number }>): Landmark[] {
  return raw.map(p => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility }));
}

function toBlendshapeMap(
  classifications: Array<{ categories: Array<{ categoryName: string; score: number }> }> | undefined,
): BlendshapeScores | null {
  const head = classifications?.[0];
  if (!head?.categories?.length) return null;
  const out: BlendshapeScores = {};
  for (const category of head.categories) {
    if (category?.categoryName) out[category.categoryName] = category.score;
  }
  return Object.keys(out).length ? out : null;
}

export type FaceLandmarkerInstance = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number,
  ) => {
    faceLandmarks: Array<Array<{ x: number; y: number; z?: number; visibility?: number }>>;
    faceBlendshapes?: Array<{ categories: Array<{ categoryName: string; score: number }> }>;
    facialTransformationMatrixes?: Array<{ data: number[] }>;
  };
  close: () => void;
};

/** Alias kept for readability at call sites that only need the shape. */
export type FaceLandmarkerLike = FaceLandmarkerInstance;

let loadPromise: Promise<FaceLandmarkerInstance> | null = null;

/**
 * Create (or reuse) the FaceLandmarker.
 *
 * numFaces is 2 on purpose: AETHER must be able to DETECT that a second person
 * entered the frame (spec §11). Detecting two faces is not the same as tracking
 * two faces — only the first is analysed for gaze.
 */
export async function getFaceLandmarker(): Promise<FaceLandmarkerInstance> {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const vision = await import('@mediapipe/tasks-vision');
    const fileset = await vision.FilesetResolver.forVisionTasks(mediaPipeWasmBase());
    // GPU first (fastest, and what a real interview wants), CPU as the fallback
    // for machines without a usable WebGL2 context.
    try {
      return await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: faceLandmarkerModelUrl(), delegate: 'GPU' },
        runningMode: 'VIDEO',
        numFaces: 2,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
    } catch {
      return await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: faceLandmarkerModelUrl(), delegate: 'CPU' },
        runningMode: 'VIDEO',
        numFaces: 2,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
    }
  })();

  try {
    return await loadPromise;
  } catch (error) {
    // Do not cache a failed load: a transient CDN blip must be retryable.
    loadPromise = null;
    throw error;
  }
}

/** Analyse one video frame. Returns a normalised {@link FaceFrame}. */
export function detectFaceFrame(
  landmarker: FaceLandmarkerInstance,
  video: HTMLVideoElement,
  at: number,
): FaceFrame {
  const result = landmarker.detectForVideo(video, at);
  const faces = result.faceLandmarks ?? [];
  const primary = faces[0];
  return {
    at,
    faceCount: faces.length,
    landmarks: primary ? toLandmarks(primary) : [],
    blendshapes: toBlendshapeMap(result.faceBlendshapes),
    matrix: result.facialTransformationMatrixes?.[0]?.data ?? null,
    confidence: primary ? 1 : 0,
    secondaryLandmarks: faces[1] ? toLandmarks(faces[1]) : undefined,
  };
}

/** Release the wasm instance. Safe to call more than once. */
export async function disposeFaceLandmarker(): Promise<void> {
  const pending = loadPromise;
  loadPromise = null;
  if (!pending) return;
  try {
    const landmarker = await pending;
    landmarker.close();
  } catch {
    // Already failed to load — nothing to release.
  }
}
