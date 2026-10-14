import { useEffect, useRef, type RefObject } from 'react';
import {
  computeFrameTransform,
  eyeContourPoints,
  faceOvalPoints,
  irisCenterPoint,
  irisRingPoints,
  mapLandmarkToDisplay,
  mapLandmarksToDisplay,
  type EyeSide,
  type Landmark,
  type VideoDisplayGeometry,
} from './landmarks';
import type { FaceFrame } from './faceLandmarker';
import type { EyeState } from '../rules/integrityRules';

/**
 * AETHER — real eye-tracking overlay.
 *
 * WHAT MAKES THIS DIFFERENT FROM A DECORATION: every stroke is computed from the
 * ACTUAL MediaPipe landmark coordinates of the current frame. Nothing here is a
 * static circle, a floating dot or an approximate "face box". Move your head and
 * the contours move with your physical eyes, because they ARE your eyes'
 * landmarks.
 *
 * Default state is CLEAN: the overlay is only drawn when `showOverlay` is true,
 * and even then the face guide is a faint optional outline rather than a
 * scanner box.
 *
 * Rendering is imperative (one rAF loop writing to a canvas) rather than React
 * state per frame, so an 8 FPS analysis stream costs zero re-renders and stays
 * smooth at display refresh rate.
 */

const COLORS = {
  eye: 'rgba(45, 212, 191, 0.9)',      // teal-400
  eyeWarn: 'rgba(251, 191, 36, 0.95)',  // amber-400 — one eyelid unclear
  eyeAlert: 'rgba(248, 113, 113, 0.95)',// red-400   — both eyelids closed
  iris: 'rgba(255, 255, 255, 0.95)',
  irisRing: 'rgba(45, 212, 191, 0.75)',
  guide: 'rgba(148, 163, 184, 0.28)',   // slate-400, deliberately faint
  secondFace: 'rgba(251, 191, 36, 0.7)',
} as const;

function strokePolyline(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  color: string,
  width: number,
  close = true,
): void {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  if (close) ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

export interface EyeTrackingOverlayProps {
  videoRef: RefObject<HTMLVideoElement>;
  /** Imperative handle to the latest analysed frame (from useEyeTracking). */
  frameRef: RefObject<FaceFrame | null>;
  /** Whether the analysis loop is producing frames at all. */
  active: boolean;
  /** Master switch — the overlay draws nothing unless this is true. */
  showOverlay: boolean;
  /** Draw the faint face-oval guide as well as the eyes. */
  showFaceGuide?: boolean;
  /** Mirrors the video horizontally. MUST match the <video> element exactly. */
  mirrored?: boolean;
  /** Drives the colour of the eye contour (colour is never the only signal —
   *  the status pill always states the state in words). */
  eyeState?: EyeState;
}

export function EyeTrackingOverlay({
  videoRef,
  frameRef,
  active,
  showOverlay,
  showFaceGuide = false,
  mirrored = false,
  eyeState = 'UNKNOWN',
}: EyeTrackingOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Latest props read inside the rAF loop without restarting it every render.
  const propsRef = useRef({ showOverlay, showFaceGuide, mirrored, eyeState, active });
  propsRef.current = { showOverlay, showFaceGuide, mirrored, eyeState, active };

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const { showOverlay, showFaceGuide, mirrored, eyeState, active } = propsRef.current;

      const width = video.clientWidth;
      const height = video.clientHeight;
      if (width <= 0 || height <= 0) return;

      // Match the backing store to the device pixel ratio so lines stay crisp
      // and the canvas always covers exactly the video's display box.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetWidth = Math.round(width * dpr);
      const targetHeight = Math.round(height * dpr);
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      // Transform through the identity of CSS pixels: we scale by dpr so the
      // rest of the drawing code can work in CSS pixel space.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      if (!showOverlay || !active) return;
      const frame = frameRef.current;
      if (!frame || frame.faceCount === 0 || !frame.landmarks?.length) return;

      const geometry: VideoDisplayGeometry = {
        displayWidth: width,
        displayHeight: height,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        // Must match the <video>'s CSS object-fit, or the two disagree and the
        // markers slide off the face.
        objectFit: 'cover',
        mirrored,
        pixelRatio: dpr,
      };
      const transform = computeFrameTransform(geometry);
      // One shared transform for the whole frame: the video and the overlay can
      // therefore never disagree about where a landmark is.
      const map = (points: Landmark[]) => mapLandmarksToDisplay(points, transform, geometry);

      const landmarks = frame.landmarks;
      const contourColor = eyeState === 'EYES_CLOSED'
        ? COLORS.eyeAlert
        : eyeState === 'ONE_EYE_CLOSED'
          ? COLORS.eyeWarn
          : COLORS.eye;

      // 1. Very faint face guide (optional) — an outline, never a bounding box.
      if (showFaceGuide) {
        strokePolyline(ctx, map(faceOvalPoints(landmarks)), COLORS.guide, 1);
      }

      // 2. Second face, if present: outline only, so MULTIPLE_FACES is visibly
      //    justified rather than asserted.
      if (frame.secondaryLandmarks?.length) {
        strokePolyline(ctx, map(faceOvalPoints(frame.secondaryLandmarks)), COLORS.secondFace, 1.2);
      }

      // 3. Eye contours + iris rings, straight from the landmark indices.
      for (const side of ['LEFT', 'RIGHT'] as EyeSide[]) {
        const contour = map(eyeContourPoints(landmarks, side));
        strokePolyline(ctx, contour, contourColor, 1.4);

        const irisRing = map(irisRingPoints(landmarks, side));
        const irisCentre = irisCenterPoint(landmarks, side);
        if (!irisCentre) continue;
        const centre = mapLandmarkToDisplay(irisCentre, transform, geometry);

        // Radius from the REAL iris ring landmarks, not a hardcoded constant, so
        // the ring grows and shrinks with the candidate's distance from the camera.
        const radius = irisRing.length
          ? Math.max(2.5, irisRing.reduce((max, p) => Math.max(max, Math.hypot(p.x - centre.x, p.y - centre.y)), 0))
          : 3;

        ctx.beginPath();
        ctx.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.irisRing;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // The pupil marker sits exactly on the iris-centre landmark (468 / 473).
        ctx.beginPath();
        ctx.arc(centre.x, centre.y, Math.max(1.6, radius * 0.32), 0, Math.PI * 2);
        ctx.fillStyle = COLORS.iris;
        ctx.fill();
      }
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [videoRef, frameRef]);

  // Hidden by default; it exists in the DOM only so refs stay stable.
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: showOverlay ? 1 : 0,
        transition: 'opacity 180ms ease',
      }}
    />
  );
}

export default EyeTrackingOverlay;
