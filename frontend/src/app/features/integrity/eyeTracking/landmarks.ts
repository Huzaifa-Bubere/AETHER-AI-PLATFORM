/**
 * AETHER — MediaPipe Face Landmarker geometry.
 *
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE: every number drawn on the camera
 * overlay and every gaze/eye state fed to the integrity engine is derived from
 * an ACTUAL MediaPipe landmark index. Nothing here is decorative, approximated
 * or invented, and no index is guessed at a call site.
 *
 * Index source: the canonical MediaPipe Face Mesh / Face Landmarker topology
 * (468 face landmarks + 10 iris landmarks = 478 per face), matching the
 * FaceLandmarker model shipped in `@mediapipe/tasks-vision`. The same iris
 * centres (468 / 473) are already used by this project's Python AI server
 * (`ai-server/src/services/video_analysis.py`), so browser and server agree.
 *
 * This module imports NOTHING. It is pure, so it can be unit-tested with
 * fixture landmarks on Node without a camera, a GPU or the wasm runtime.
 */

/** One MediaPipe NormalizedLandmark. `x`/`y` are 0..1 of the camera frame. */
export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

/** A face blendshape score (0..1) keyed by MediaPipe's category name. */
export type BlendshapeScores = Record<string, number>;

// ── Canonical landmark indices (MediaPipe Face Landmarker, 478 points) ───────

export const FACE_LANDMARK_COUNT = 468;
export const TOTAL_LANDMARK_COUNT = 478;

/**
 * Left eye (the candidate's own left eye — it appears on the RIGHT of an
 * un-mirrored camera frame). Closed ring in mesh order.
 */
export const LEFT_EYE_CONTOUR: readonly number[] = [
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
];

/** Right eye contour (appears on the LEFT of an un-mirrored frame). */
export const RIGHT_EYE_CONTOUR: readonly number[] = [
  263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466,
];

/** Iris refinement ring (4 points) + centre, per eye. */
export const LEFT_IRIS_RING: readonly number[] = [469, 470, 471, 472];
export const RIGHT_IRIS_RING: readonly number[] = [474, 475, 476, 477];
export const LEFT_IRIS_CENTER = 468;
export const RIGHT_IRIS_CENTER = 473;

/** Horizontal eye corners, used to normalise iris travel to eye width. */
export const LEFT_EYE_OUTER_CORNER = 33;
export const LEFT_EYE_INNER_CORNER = 133;
export const RIGHT_EYE_INNER_CORNER = 362;
export const RIGHT_EYE_OUTER_CORNER = 263;

/** Eyelid points used for the Eye Aspect Ratio fallback. */
export const LEFT_EYE_TOP = 159;
export const LEFT_EYE_BOTTOM = 145;
export const RIGHT_EYE_TOP = 386;
export const RIGHT_EYE_BOTTOM = 374;

/**
 * Canonical face-oval ring, used ONLY for the optional faint face guide.
 * Deliberately not drawn by default: a prominent box around the face reads as a
 * surveillance scanner, and the spec asks for a clean default view.
 */
export const FACE_OVAL: readonly number[] = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

/** Nose bridge / tip, used by the landmark-based head-pose fallback. */
export const NOSE_BRIDGE = 168;
export const NOSE_TIP = 1;
export const CHIN = 152;
export const FOREHEAD = 10;

/** MediaPipe blendshape category names for eyelid closure. */
export const BLENDSHAPE_EYE_BLINK_LEFT = 'eyeBlinkLeft';
export const BLENDSHAPE_EYE_BLINK_RIGHT = 'eyeBlinkRight';

export type EyeSide = 'LEFT' | 'RIGHT';

/** True when a detection carries the full mesh + iris points we depend on. */
export function hasRequiredLandmarks(landmarks: Landmark[] | undefined | null): boolean {
  if (!landmarks || landmarks.length < TOTAL_LANDMARK_COUNT) return false;
  const needed = [
    LEFT_IRIS_CENTER, RIGHT_IRIS_CENTER,
    LEFT_EYE_OUTER_CORNER, LEFT_EYE_INNER_CORNER,
    RIGHT_EYE_OUTER_CORNER, RIGHT_EYE_INNER_CORNER,
    LEFT_EYE_TOP, LEFT_EYE_BOTTOM, RIGHT_EYE_TOP, RIGHT_EYE_BOTTOM,
  ];
  return needed.every(i => {
    const p = landmarks[i];
    return !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  });
}

// ── Basic geometry ───────────────────────────────────────────────────────────

export function distance(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function midpoint(a: Landmark, b: Landmark): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Eye Aspect Ratio — eyelid opening normalised by eye width, from real
 * landmarks. Camera-independent because everything is expressed as a ratio of
 * the candidate's own eye width, so moving closer to the camera does not change
 * it. Thresholds are therefore meaningful without re-calibration per distance.
 */
export function eyeAspectRatio(landmarks: Landmark[], side: EyeSide): number | null {
  const top = side === 'LEFT' ? LEFT_EYE_TOP : RIGHT_EYE_TOP;
  const bottom = side === 'LEFT' ? LEFT_EYE_BOTTOM : RIGHT_EYE_BOTTOM;
  const inner = side === 'LEFT' ? LEFT_EYE_INNER_CORNER : RIGHT_EYE_INNER_CORNER;
  const outer = side === 'LEFT' ? LEFT_EYE_OUTER_CORNER : RIGHT_EYE_OUTER_CORNER;
  const [t, b, i, o] = [landmarks[top], landmarks[bottom], landmarks[inner], landmarks[outer]];
  if (!t || !b || !i || !o) return null;
  const width = distance(i, o);
  if (!Number.isFinite(width) || width <= 1e-6) return null;
  return distance(t, b) / width;
}

/**
 * Iris displacement, expressed in the eye's OWN frame so it survives head
 * movement (the pupil's position is measured against the eye it sits in, not
 * against absolute camera pixels).
 *
 * AXIS CONVENTION — deliberately IMAGE space, stated once and used everywhere:
 *   x: +1 = iris pushed towards the RIGHT of the camera frame, -1 = left.
 *   y: +1 = iris pushed towards the BOTTOM of the frame, -1 = up.
 * The neutral point is the midpoint of the eye's own corners.
 *
 * Image space is used for BOTH eyes on purpose. An anatomically-flipped
 * convention ("toward the nose") points in OPPOSITE image directions for the
 * two eyes, which is exactly how a head-relative gaze reading ends up
 * disagreeing between the left and the right eye — and, in the classic bug,
 * renders the eye marker on the wrong side. In image space both eyes agree
 * automatically, and gaze is directly comparable to head yaw, which is also
 * measured in image space.
 */
export function irisOffset(landmarks: Landmark[], side: EyeSide): { x: number; y: number } | null {
  const centerIndex = side === 'LEFT' ? LEFT_IRIS_CENTER : RIGHT_IRIS_CENTER;
  const innerIndex = side === 'LEFT' ? LEFT_EYE_INNER_CORNER : RIGHT_EYE_INNER_CORNER;
  const outerIndex = side === 'LEFT' ? LEFT_EYE_OUTER_CORNER : RIGHT_EYE_OUTER_CORNER;
  const topIndex = side === 'LEFT' ? LEFT_EYE_TOP : RIGHT_EYE_TOP;
  const bottomIndex = side === 'LEFT' ? LEFT_EYE_BOTTOM : RIGHT_EYE_BOTTOM;

  const centre = landmarks[centerIndex];
  const inner = landmarks[innerIndex];
  const outer = landmarks[outerIndex];
  const top = landmarks[topIndex];
  const bottom = landmarks[bottomIndex];
  if (!centre || !inner || !outer || !top || !bottom) return null;

  const width = distance(inner, outer);
  const height = distance(top, bottom);
  if (!Number.isFinite(width) || width <= 1e-6) return null;

  const midX = (inner.x + outer.x) / 2;
  const midY = (top.y + bottom.y) / 2;
  const x = (centre.x - midX) / (width / 2);
  const y = height > 1e-6 ? (centre.y - midY) / (height / 2) : 0;
  // Clamp: a landmark glitch must not produce an absurd offset. 1.5 leaves
  // headroom for a genuinely extreme glance without letting a bad frame dominate.
  return { x: clamp(x, -1.5, 1.5), y: clamp(y, -1.5, 1.5) };
}

/**
 * Average iris offset of both eyes in a single face-relative frame.
 * Returns null unless BOTH eyes are usable — a half-tracked face must yield
 * UNKNOWN rather than a made-up direction (never warn on a guess).
 */
export function combinedIrisOffset(landmarks: Landmark[]): { x: number; y: number } | null {
  const left = irisOffset(landmarks, 'LEFT');
  const right = irisOffset(landmarks, 'RIGHT');
  if (!left || !right) return null;
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
}

export interface EyeOpennessReading {
  /** 1 = wide open, 0 = fully closed. */
  open: number;
  /** Which signal produced it — blendshape is preferred when present. */
  source: 'BLENDSHAPE' | 'EAR';
}

/** Neutral EAR captured during calibration (open eye) — used to scale the EAR. */
export interface EyeOpennessCalibration {
  /** Median open-eye EAR measured while the candidate looked at the screen. */
  openEar: number;
  /** EAR treated as fully closed. Eye-specific variation is small; 0.12 is safe. */
  closedEar?: number;
}

/**
 * Eye openness per eye, in 0..1.
 *
 * PREFERRED SIGNAL: the MediaPipe `eyeBlinkLeft` / `eyeBlinkRight` blendshape,
 * which the model produces directly (spec Part I). FALLBACK: the Eye Aspect
 * Ratio from real eyelid landmarks, scaled against the calibrated open-eye
 * value so it adapts to the individual rather than to a hardcoded constant.
 */
export function eyeOpenness(
  landmarks: Landmark[],
  blendshapes: BlendshapeScores | null | undefined,
  side: EyeSide,
  calibration?: EyeOpennessCalibration | null,
): EyeOpennessReading | null {
  const blinkKey = side === 'LEFT' ? BLENDSHAPE_EYE_BLINK_LEFT : BLENDSHAPE_EYE_BLINK_RIGHT;
  const blink = blendshapes?.[blinkKey];
  if (typeof blink === 'number' && Number.isFinite(blink)) {
    return { open: clamp(1 - blink, 0, 1), source: 'BLENDSHAPE' };
  }

  const ear = eyeAspectRatio(landmarks, side);
  if (ear === null) return null;
  const openEar = calibration?.openEar && calibration.openEar > 0 ? calibration.openEar : 0.3;
  const closedEar = calibration?.closedEar ?? 0.12;
  if (openEar <= closedEar) return { open: ear > closedEar ? 1 : 0, source: 'EAR' };
  return { open: clamp((ear - closedEar) / (openEar - closedEar), 0, 1), source: 'EAR' };
}

// ── Head pose ────────────────────────────────────────────────────────────────

export interface HeadPose {
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
}

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Euler angles from MediaPipe's facial transformation matrix (spec Part O).
 *
 * The matrix is a flattened 4x4 (row-major, 16 values) that maps the canonical
 * face onto the detected face. Only the 3x3 rotation block is needed. The
 * extraction below is the standard ZYX decomposition.
 *
 * AXIS CONVENTION, stated honestly: the *sign* and axis labelling of this
 * decomposition depend on MediaPipe's canonical-face frame. AETHER therefore
 * never uses these absolute values — every threshold is applied to the
 * CALIBRATED DELTA (relativeYaw = yaw - neutralYaw), and the engine treats a
 * large relative yaw OR pitch as HEAD_AWAY. A swapped axis can shift which of
 * the two fires, but cannot turn a centred head into a warning or vice versa.
 */
export function headPoseFromMatrix(matrix?: number[] | null): HeadPose | null {
  if (!matrix || matrix.length < 16) return null;
  const r = matrix;
  // Row-major 4x4: row r, column c ⇒ index r*4 + c.
  const r00 = r[0], r01 = r[1], r02 = r[2];
  const r10 = r[4], r11 = r[5], r12 = r[6];
  const r20 = r[8], r21 = r[9], r22 = r[10];
  const values = [r00, r01, r02, r10, r11, r12, r20, r21, r22];
  if (!values.every(Number.isFinite)) return null;

  const yaw = Math.atan2(-r20, Math.hypot(r00, r10));
  const pitch = Math.atan2(r21, r22);
  const roll = Math.atan2(r10, r00);
  if (![yaw, pitch, roll].every(Number.isFinite)) return null;
  return { yawDeg: yaw * RAD_TO_DEG, pitchDeg: pitch * RAD_TO_DEG, rollDeg: roll * RAD_TO_DEG };
}

/**
 * Landmark-based head-pose fallback, used ONLY when the transformation matrix
 * is unavailable. Same frame as the matrix version: angles are compared against
 * a calibrated neutral, never against absolute values.
 *
 * Yaw is the horizontal asymmetry of the nose bridge between the two eye outer
 * corners; pitch is the nose-bridge height between the eye line and the chin.
 */
export function headPoseFromLandmarks(landmarks: Landmark[]): HeadPose | null {
  const leftOuter = landmarks[LEFT_EYE_OUTER_CORNER];
  const rightOuter = landmarks[RIGHT_EYE_OUTER_CORNER];
  const bridge = landmarks[NOSE_BRIDGE];
  const chin = landmarks[CHIN];
  const forehead = landmarks[FOREHEAD];
  if (!leftOuter || !rightOuter || !bridge || !chin || !forehead) return null;

  const eyeSpan = distance(leftOuter, rightOuter);
  if (!Number.isFinite(eyeSpan) || eyeSpan <= 1e-6) return null;

  const eyeMid = midpoint(leftOuter, rightOuter);
  // +yaw = bridge shifted towards the candidate's left (image right of centre).
  const yaw = ((bridge.x - eyeMid.x) / eyeSpan) * 90;
  const faceHeight = distance(forehead, chin);
  // +pitch = looking down (bridge falls closer to the chin).
  const pitch = faceHeight > 1e-6 ? (distance(eyeMid, bridge) / faceHeight - 0.5) * 90 : 0;
  if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) return null;
  return { yawDeg: yaw, pitchDeg: pitch, rollDeg: 0 };
}

// ── Display mapping (canvas overlay) ─────────────────────────────────────────

export interface VideoDisplayGeometry {
  /** Video element content-box size in CSS pixels. */
  displayWidth: number;
  displayHeight: number;
  /** Intrinsic camera frame size in pixels. */
  videoWidth: number;
  videoHeight: number;
  /** CSS object-fit used by the <video>. Only cover/contain are meaningful. */
  objectFit: 'cover' | 'contain' | 'fill';
  /** True when the rendered video is horizontally flipped (selfie mirror). */
  mirrored: boolean;
  /** devicePixelRatio used to size the backing canvas. */
  pixelRatio: number;
}

export interface MappedPoint {
  /** CSS pixels, relative to the video content box. */
  x: number;
  y: number;
}

export interface FrameTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  renderedWidth: number;
  renderedHeight: number;
  mirrored: boolean;
}

/**
 * The exact transform from a normalised MediaPipe landmark to a CSS pixel
 * inside the displayed video box, honouring object-fit, aspect-ratio
 * letterboxing/cropping, mirroring and device pixel ratio.
 *
 * Keeping this in one pure function is what prevents the classic bug where the
 * candidate's eye is physically on the left but the marker is drawn on the
 * right: the overlay and the video must share ONE transform, and mirroring must
 * be applied (or not applied) identically by both.
 */
export function computeFrameTransform(geometry: VideoDisplayGeometry): FrameTransform {
  const { displayWidth, displayHeight, videoWidth, videoHeight, objectFit, mirrored } = geometry;
  if (!(displayWidth > 0) || !(displayHeight > 0) || !(videoWidth > 0) || !(videoHeight > 0)) {
    return { scale: 1, offsetX: 0, offsetY: 0, renderedWidth: displayWidth, renderedHeight: displayHeight, mirrored };
  }
  const scaleX = displayWidth / videoWidth;
  const scaleY = displayHeight / videoHeight;
  let scale: number;
  if (objectFit === 'fill') {
    // Non-uniform: handled by per-axis scale below via scaleX/scaleY only.
    return { scale: 1, offsetX: 0, offsetY: 0, renderedWidth: displayWidth, renderedHeight: displayHeight, mirrored };
  }
  scale = objectFit === 'contain' ? Math.min(scaleX, scaleY) : Math.max(scaleX, scaleY);
  const renderedWidth = videoWidth * scale;
  const renderedHeight = videoHeight * scale;
  return {
    scale,
    offsetX: (displayWidth - renderedWidth) / 2,
    offsetY: (displayHeight - renderedHeight) / 2,
    renderedWidth,
    renderedHeight,
    mirrored,
  };
}

/** Map a normalised landmark to CSS pixels inside the displayed video box. */
export function mapLandmarkToDisplay(
  point: { x: number; y: number },
  transform: FrameTransform,
  geometry: Pick<VideoDisplayGeometry, 'objectFit' | 'displayWidth' | 'displayHeight'>,
): MappedPoint {
  if (geometry.objectFit === 'fill') {
    const nx = transform.mirrored ? 1 - point.x : point.x;
    return { x: nx * geometry.displayWidth, y: point.y * geometry.displayHeight };
  }
  const nx = transform.mirrored ? 1 - point.x : point.x;
  return {
    x: transform.offsetX + nx * transform.renderedWidth,
    y: transform.offsetY + point.y * transform.renderedHeight,
  };
}

/** Map a whole landmark list for one frame in a single pass. */
export function mapLandmarksToDisplay(
  points: readonly { x: number; y: number }[],
  transform: FrameTransform,
  geometry: Pick<VideoDisplayGeometry, 'objectFit' | 'displayWidth' | 'displayHeight'>,
): MappedPoint[] {
  return points.map(p => mapLandmarkToDisplay(p, transform, geometry));
}

/** Convenience: the landmarks of one eye's contour, in draw order. */
export function eyeContourPoints(landmarks: Landmark[], side: EyeSide): Landmark[] {
  const indices = side === 'LEFT' ? LEFT_EYE_CONTOUR : RIGHT_EYE_CONTOUR;
  return indices.map(i => landmarks[i]).filter((p): p is Landmark => !!p);
}

/** Convenience: the face-oval ring points, in draw order. */
export function faceOvalPoints(landmarks: Landmark[]): Landmark[] {
  return FACE_OVAL.map(i => landmarks[i]).filter((p): p is Landmark => !!p);
}

/** Convenience: the four iris ring points of one eye, in draw order. */
export function irisRingPoints(landmarks: Landmark[], side: EyeSide): Landmark[] {
  const indices = side === 'LEFT' ? LEFT_IRIS_RING : RIGHT_IRIS_RING;
  return indices.map(i => landmarks[i]).filter((p): p is Landmark => !!p);
}

/** Iris centre of one eye (real landmark 468 / 473). */
export function irisCenterPoint(landmarks: Landmark[], side: EyeSide): Landmark | null {
  const p = landmarks[side === 'LEFT' ? LEFT_IRIS_CENTER : RIGHT_IRIS_CENTER];
  return p ?? null;
}

/** Horizontal gaze polarity from the combined iris offset (image space). */
export function gazePolarityX(offset: { x: number; y: number } | null): 'LEFT' | 'RIGHT' | 'CENTER' | 'UNKNOWN' {
  if (!offset) return 'UNKNOWN';
  if (offset.x > 0.12) return 'RIGHT';
  if (offset.x < -0.12) return 'LEFT';
  return 'CENTER';
}
