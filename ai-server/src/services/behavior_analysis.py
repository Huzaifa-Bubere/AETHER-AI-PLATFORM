"""
AETHER AI Server — interview behavior analysis (observable signals only).

OpenCV-based frame sampling over the full webcam recording. Produces
OBJECTIVE, OBSERVABLE delivery signals:

  - presence        : fraction of sampled frames with a detectable face
  - centeredness    : how consistently the face stays in frame
  - eye-region hits : observable gaze-toward-camera proxy (Haar eye pair)
  - motion energy   : posture/gesture activity (frame differencing)

Designed to work with ZERO external model downloads: Haar cascades ship with
opencv-python, so presence/motion analysis always runs even offline. DeepFace
emotion labels are OPTIONAL and only used as supplementary notes when the
package is installed.
"""

import base64
import logging
import os
import tempfile
import time
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger("uvicorn.error")

# Haar cascades bundled with opencv-python (cv2.data).
_CASCADE_DIR = getattr(cv2, "data", None)
_FACE_CASCADE_PATH = os.path.join(_CASCADE_DIR.haarcascades, "haarcascade_frontalface_default.xml") if _CASCADE_DIR else ""
_EYE_CASCADE_PATH = os.path.join(_CASCADE_DIR.haarcascades, "haarcascade_eye.xml") if _CASCADE_DIR else ""

_face_cascade: Optional[cv2.CascadeClassifier] = None
_eye_cascade: Optional[cv2.CascadeClassifier] = None


def _load_cascades() -> Tuple[Optional[cv2.CascadeClassifier], Optional[cv2.CascadeClassifier]]:
    global _face_cascade, _eye_cascade
    if _face_cascade is None and os.path.exists(_FACE_CASCADE_PATH):
        _face_cascade = cv2.CascadeClassifier(_FACE_CASCADE_PATH)
    if _eye_cascade is None and os.path.exists(_EYE_CASCADE_PATH):
        _eye_cascade = cv2.CascadeClassifier(_EYE_CASCADE_PATH)
    return _face_cascade, _eye_cascade


def _largest_face(faces: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
    if faces is None or len(faces) == 0:
        return None
    areas = (faces[:, 2] * faces[:, 3]).astype(float)
    x, y, w, h = faces[int(np.argmax(areas))]
    return int(x), int(y), int(w), int(h)


def _eye_contact_proxy(frame_bgr: np.ndarray, face: Tuple[int, int, int, int], eye_cascade) -> bool:
    """Observable proxy: both eye regions detectable inside the face box."""
    if eye_cascade is None or eye_cascade.empty():
        return False
    x, y, w, h = face
    roi_gray = cv2.cvtColor(frame_bgr[y:y + h, x:x + w], cv2.COLOR_BGR2GRAY)
    eyes = eye_cascade.detectMultiScale(roi_gray, scaleFactor=1.1, minNeighbors=5, minSize=(int(w * 0.08), int(w * 0.08)))
    return len(eyes) >= 2


class BehaviorAnalyzer:
    """Frame-sampled presence/engagement analysis over a full recording."""

    def __init__(self) -> None:
        self.face_cascade, self.eye_cascade = _load_cascades()
        self._prev_small: Optional[np.ndarray] = None

    def health(self) -> Dict[str, Any]:
        face, _ = _load_cascades()
        ok = face is not None and not face.empty()
        return {"status": "healthy" if ok else "degraded", "service": "behavior_analysis",
                "haar_available": bool(ok)}

    # ── Core ──────────────────────────────────────────────────────────────

    async def analyze_video(self, video_bytes: bytes) -> Dict[str, Any]:
        started = time.time()
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            tmp.write(video_bytes)
            tmp_path = tmp.name
        try:
            cap = cv2.VideoCapture(tmp_path)
            if not cap.isOpened():
                return self._fail("Could not open the video file")

            fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            duration = total_frames / fps if fps > 0 else 0.0

            # Sample ~1 frame/second (cap 360 samples for long sessions).
            interval = max(1, int(fps))
            samples: List[Dict[str, Any]] = []
            frame_number = 0
            face, eye = self.face_cascade, self.eye_cascade

            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                if frame_number % interval == 0:
                    samples.append(self._sample_frame(frame, frame_number / fps, face, eye))
                    if len(samples) >= 360:
                        break
                frame_number += 1
            cap.release()

            if not samples:
                return self._fail("No frames could be sampled from this recording")

            presence_hits = sum(1 for s in samples if s["face_detected"])
            eye_hits = [s["eye_proxy"] for s in samples if s["face_detected"]]
            eye_contact = round(100.0 * sum(eye_hits) / len(eye_hits), 1) if eye_hits else None
            centered = round(float(np.mean([s["centeredness"] for s in samples if s["face_detected"]])), 1) \
                if any(s["face_detected"] for s in samples) else 0.0
            motion = round(float(np.mean([s["motion_energy"] for s in samples])), 4)

            presence_pct = round(100.0 * presence_hits / len(samples), 1)
            # Motion 0..~0.08 mean-abs-diff → normalize to 0..100.
            engagement = round(min(100.0, motion / 0.05 * 100.0), 1)
            confidence = round(presence_pct * 0.5 + (eye_contact or 0) * 0.2 + centered * 0.15 + engagement * 0.15, 1)

            timeline = [
                {"t": round(s["t"], 1), "face": s["face_detected"], "motion": s["motion_energy"]}
                for s in samples
            ]

            return {
                "available": True,
                "duration_seconds": round(duration, 1),
                "frames_sampled": len(samples),
                "sampling_interval_seconds": interval / fps if fps > 0 else 1.0,
                "presence_percentage": presence_pct,
                "eye_contact_percentage": eye_contact,
                "centeredness_percentage": centered,
                "engagement_percentage": engagement,
                "confidence_index": confidence,
                "timeline": timeline,
                "engine": "opencv-haar-frame-sampling",
                "processing_ms": int((time.time() - started) * 1000),
            }
        except Exception as e:  # noqa: BLE001 — endpoint returns a structured fallback
            logger.error(f"Behavior analysis error: {e}")
            return self._fail(str(e))
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    def _sample_frame(self, frame_bgr: np.ndarray, t: float, face_cascade, eye_cascade) -> Dict[str, Any]:
        small = cv2.resize(frame_bgr, (320, 240))
        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

        # Motion energy vs previous sample (mean absolute pixel difference).
        motion = 0.0
        if self._prev_small is not None:
            diff = cv2.absdiff(gray, self._prev_small)
            motion = float(np.mean(diff))
        self._prev_small = gray

        face_detected = False
        centeredness = 0.0
        eye_proxy = False
        if face_cascade is not None and not face_cascade.empty():
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.15, minNeighbors=5,
                                                  minSize=(48, 48))
            face = _largest_face(faces)
            if face is not None:
                face_detected = True
                x, y, w, h = face
                cx = (x + w / 2) / small.shape[1]
                cy = (y + h / 2) / small.shape[0]
                # 1.0 = perfectly centered, 0.0 = at/beyond frame edge.
                centeredness = max(0.0, 1.0 - (abs(cx - 0.5) + abs(cy - 0.5)) * 2.0)
                eye_proxy = _eye_contact_proxy(small, face, eye_cascade)

        return {
            "t": t,
            "face_detected": face_detected,
            "centeredness": centeredness,
            "eye_proxy": eye_proxy,
            "motion_energy": round(motion, 5),
        }

    def _fail(self, reason: str) -> Dict[str, Any]:
        return {
            "available": False,
            "reason": reason,
            "frames_sampled": 0,
            "presence_percentage": 0.0,
            "eye_contact_percentage": None,
            "centeredness_percentage": 0.0,
            "engagement_percentage": None,
            "confidence_index": None,
            "timeline": [],
            "engine": "opencv-haar-frame-sampling",
        }


behavior_analyzer = BehaviorAnalyzer()
