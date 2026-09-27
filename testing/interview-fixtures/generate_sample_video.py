"""
AETHER fixture generator — synthetic mock-interview recording.

Renders a realistic webcam-style mock interview video using OpenCV drawing:
a centered "candidate" head+shoulders with blinking eyes, natural head sway,
periodic hand gestures, and short camera-absence windows (mimicking a real
session where the candidate briefly leans out of frame).

Output: testing/interview-fixtures/sample-mock-interview.webm + a .webm via
the analyzer's OpenCV backend reads it frame-by-frame).

Run:  ai-server/venv/Scripts/python.exe testing/interview-fixtures/generate_sample_video.py
"""

import os
import sys
import urllib.request

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_WEBM = os.path.join(HERE, "sample-mock-interview.webm")
OUT_MP4 = os.path.join(HERE, "sample-mock-interview.mp4")

# Real photo composite source — Haar cascades are trained on natural photos, so
# a textured human face guarantees reliable detection in the fixture.
FACE_URLS = [
    "https://raw.githubusercontent.com/opencv/opencv/4.x/samples/data/lena.jpg",
    "https://github.com/opencv/opencv/raw/4.x/samples/data/lena.jpg",
]
FACE_PHOTO = os.path.join(HERE, "_face_source.jpg")

W, H, FPS, SECONDS = 640, 480, 25, 45
TOTAL = FPS * SECONDS

# Scripted scenario (matches testing/interview-fixtures/README.md):
# 0-8s    centered, calm, strong eye contact
# 8-13.5s active gesturing while explaining
# 13.5-18s leans out of frame (camera-absence integrity scenario)
# 18-30s  returns, steady, occasional nods
# 30-36s  looks down (reading notes — eye-proxy drops)
# 36-45s  composed close
def face_center(t: float):
    """Head position with gentle sway; exits frame during 13.5-18s.
    The absence spans >= 4s so it survives the analyzer's flicker filter
    (short 1-2s gaps are treated as detection noise by design)."""
    if 13.5 <= t < 18:
        if t < 15.5:
            # slide out to the right
            k = min(1.0, (t - 13.5) / 1.5)
            return W * 0.5 + (W * 0.62) * k, H * 0.42
        return W + 300, H * 0.42  # fully out
    sway = np.sin(t * 0.9) * 10 + np.sin(t * 2.3) * 3
    bob = np.sin(t * 1.1) * 4
    return W * 0.5 + sway, H * 0.42 + bob


def gesture_offset(t: float) -> float:
    """Hands visible/gesturing during 8-14s and 24-30s."""
    if 8 <= t < 14 or 24 <= t < 30:
        return 30 * np.sin(t * 4.5) + 12
    return 0.0


def eyes_open(t: float) -> bool:
    """Blink every ~3.5s for 0.15s. Eyes look down during 30-36s (note-reading)."""
    if 30 <= t < 36 or 13.5 <= t < 18:
        return False
    phase = t % 3.5
    return not (phase < 0.15)


def _load_face_photo() -> np.ndarray | None:
    """Fetch a real textured face photo once (cached beside the fixture)."""
    if os.path.exists(FACE_PHOTO):
        img = cv2.imread(FACE_PHOTO)
        if img is not None:
            return img
    for url in FACE_URLS:
        try:
            urllib.request.urlretrieve(url, FACE_PHOTO)
            img = cv2.imread(FACE_PHOTO)
            if img is not None:
                return img
        except Exception as e:
            print(f"WARN face source download failed: {e}")
    return None


_FACE_SRC: np.ndarray | None = None


def _render_face(img: np.ndarray, cx: int, cy: int, t: float) -> None:
    """Composite the real photo face, scaled/positioned for the scene.

    Talking/eye animation is approximated by darkening the mouth band while
    'speaking' — Haar presence depends on overall facial structure, which the
    photo provides.
    """
    global _FACE_SRC
    if _FACE_SRC is None:
        _FACE_SRC = _load_face_photo()
    if _FACE_SRC is None:
        raise RuntimeError("Face source photo unavailable — cannot render fixture")

    # The source is 512x512 with the face around (320, 300) r≈90 → crop head box.
    src = _FACE_SRC
    fx, fy, fr = 320, 300, 120
    crop = src[max(0, fy - fr):fy + fr, max(0, fx - fr):fx + fr]
    if crop.size == 0:
        raise RuntimeError("Face crop failed")
    face_size = 110
    face = cv2.resize(crop, (face_size, face_size))

    # Talking mouth motion: subtly scale the lower quarter (perceptible motion).
    if 8 <= t < 14 or 24 <= t < 30 or not (14 <= t < 17):
        lower = face[80:, :]
        squeeze = 1.0 + 0.03 * np.sin(t * 9)
        lower = cv2.resize(lower, (face_size, max(2, int(lower.shape[0] * squeeze))))
        face = face.copy()
        face[80:80 + lower.shape[0], :] = lower[:face.shape[0] - 80]

    # Circular alpha mask with soft edge, then paste onto the scene.
    alpha = np.zeros((face_size, face_size), np.float32)
    cv2.circle(alpha, (face_size // 2, face_size // 2), face_size // 2 - 2, 1.0, -1)
    alpha = cv2.GaussianBlur(alpha, (7, 7), 0)

    x0, y0 = cx - face_size // 2, cy - face_size // 2
    x1, y1 = x0 + face_size, y0 + face_size
    rx0, ry0 = max(0, x0), max(0, y0)
    rx1, ry1 = min(img.shape[1], x1), min(img.shape[0], y1)
    if rx1 <= rx0 or ry1 <= ry0:
        return
    fx0, fy0 = rx0 - x0, ry0 - y0
    sub_a = alpha[fy0:fy0 + (ry1 - ry0), fx0:fx0 + (rx1 - rx0)][..., None]
    region = img[ry0:ry1, rx0:rx1].astype(np.float32)
    face_f = face[fy0:fy0 + (ry1 - ry0), fx0:fx0 + (rx1 - rx0)].astype(np.float32)
    img[ry0:ry1, rx0:rx1] = (sub_a * face_f + (1 - sub_a) * region).astype(np.uint8)

    # Hair/shoulder silhouette behind the composited face.
    hair = np.zeros((480, 640), np.uint8)
    cv2.ellipse(hair, (cx, cy - 26), (56, 42), 0, 175, 365, 255, -1)
    hair = cv2.GaussianBlur(hair, (9, 9), 0)
    img[hair > 128] = (48, 52, 58)


def draw_frame(t: float, prev_gray=None):
    frame = np.full((H, W, 3), (245, 248, 252), dtype=np.uint8)  # light room
    # subtle background wall band
    cv2.rectangle(frame, (0, 0), (W, int(H * 0.72)), (232, 237, 244), -1)

    cx_f, cy_f = face_center(t)
    visible = cx_f < W + 100
    if visible:
        cx, cy = int(cx_f), int(cy_f)
        # shoulders
        sw = 150 + int(gesture_offset(t) * 0.4)
        cv2.ellipse(frame, (cx, cy + 120), (sw, 62), 0, 0, 360, (52, 84, 140), -1)
        # neck with shading
        cv2.rectangle(frame, (cx - 16, cy + 44), (cx + 16, cy + 78), (208, 168, 148), -1)
        cv2.rectangle(frame, (cx + 4, cy + 44), (cx + 16, cy + 78), (188, 148, 128), -1)
        _render_face(frame, cx, cy, t)
        # gesturing hands
        go = gesture_offset(t)
        if go != 0.0:
            for side in (-1, 1):
                hx = int(cx + side * (95 + 8 * np.sin(t * 3)))
                hy = int(cy + 95 - go)
                cv2.circle(frame, (hx, hy), 13, (214, 176, 152), -1)

    # Sensor noise — real webcam frames are never perfectly clean.
    noise = np.random.normal(0, 2.5, frame.shape).astype(np.int16)
    frame = np.clip(frame.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    small = cv2.resize(frame, (160, 120))
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    return frame, gray


def main() -> int:
    os.makedirs(HERE, exist_ok=True)
    webm_ok = True
    try:
        vw = cv2.VideoWriter(OUT_WEBM, cv2.VideoWriter_fourcc(*"VP08"), FPS, (W, H))
        if not vw.isOpened():
            webm_ok = False
    except Exception:
        webm_ok = False

    mp4_tmp = OUT_MP4 + ".tmp.mp4"
    vw_mp4 = cv2.VideoWriter(mp4_tmp, cv2.VideoWriter_fourcc(*"mp4v"), FPS, (W, H))
    if not vw_mp4.isOpened():
        print("ERROR: could not open any VideoWriter")
        return 1

    prev_gray = None
    for i in range(TOTAL):
        frame, gray = draw_frame(i / FPS, prev_gray)
        prev_gray = gray
        vw_mp4.write(frame)
        if webm_ok:
            vw.write(frame)

    vw_mp4.release()
    if webm_ok:
        vw.release()
        size = os.path.getsize(OUT_WEBM)
        print(f"OK  {OUT_WEBM} ({size} bytes, {SECONDS}s @ {FPS}fps)")
    else:
        if os.path.exists(OUT_WEBM):
            os.remove(OUT_WEBM)
        print("WARN VP80 writer unavailable — webm skipped")
    if os.path.exists(mp4_tmp):
        os.replace(mp4_tmp, OUT_MP4)
        print(f"OK  {OUT_MP4} ({os.path.getsize(OUT_MP4)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
