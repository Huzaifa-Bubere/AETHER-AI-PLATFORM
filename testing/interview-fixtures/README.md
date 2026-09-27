# Interview Fixtures — Usage Guide

Fixtures for the **webcam recording + body-language/confidence analysis** loop.

## Files

| File | Purpose |
|---|---|
| `sample-mock-interview.webm` | 45-second synthetic mock-interview recording (640×480 @ 25fps). The scripted scenario: candidate centered and composed (0–8s), actively gesturing (8–13.5s), **leans out of frame (13.5–18s)**, returns steady (18–30s), looks down reading notes (30–36s), composed close (36–45s). |
| `sample-mock-interview.mp4` | Same content, MP4 container (for players that lack VP8). |
| `generate_sample_video.py` | Regenerates both videos. Run: `ai-server/venv/Scripts/python.exe testing/interview-fixtures/generate_sample_video.py` (downloads one public OpenCV sample face image on first run, cached as `_face_source.jpg`). |
| `expected-behavior-analysis.json` | Actual analyzer output for the video above — **verified against the real pipeline**, so regressions are caught by diffing. |

## Verified analyzer output (recorded 2026-09-26)

```json
{
  "presence_percentage": 93.3,
  "eye_contact_percentage": 66.7,
  "centeredness_percentage": 78.0,
  "engagement_percentage": 100.0,
  "confidence_index": 86.7,
  "frames_sampled": 45
}
```

Absence window correctly detected at t = 15s, 16s, 17s (the scripted
out-of-frame segment). Short 1–2s gaps are intentionally treated as detector
noise by the majority filter — only sustained absence (≥3s) counts.

## How to verify end-to-end (§: real recording storage)

1. **Direct analyzer check** (no services needed):
   ```
   ai-server/venv/Scripts/python.exe -c "import asyncio,sys; sys.path.insert(0,'ai-server/src'); from services.behavior_analysis import behavior_analyzer; import json; r=asyncio.run(behavior_analyzer.analyze_video(open('testing/interview-fixtures/sample-mock-interview.webm','rb').read())); print(json.dumps({k:v for k,v in r.items() if k!='timeline'}, indent=1))"
   ```
   Compare against `expected-behavior-analysis.json`.

2. **Full loop with services running** (`docker compose up -d`, or local dev
   servers):
   - Sign in → **AI Interview** → start a session → answer questions on camera.
   - **End interview.** Watch for the `Uploading your recording…` toast →
     `Recording attached`.
   - On the report page, a **Webcam recording** section plays your video
     (selectable, owner-only, streamed through the authorized API route).
   - A **Body language & confidence** section shows: Confidence index, camera
     presence %, eye-region contact %, frame centeredness %, motion
     engagement %, a per-answer trend, and neutral explanatory notes.
   - Verify persistence in MongoDB:
     `db.adaptiveinterviews.findOne({}, {recording:1, behaviorAnalysis:1})` →
     `recording.publicId` starts with `videos/recording_…`,
     `behaviorAnalysis.available: true`.

3. **Failure-path check:** stop the AI server, run a fresh interview →
   recording still uploads and saves (local storage is primary). The report
   shows a "Body language analysis" card with an **Analyze my recording**
   button; start the AI server, click it → analysis appears without reloading.

## What the signals mean (and don't mean)

- **Camera presence** — share of sampled frames with a detectable face.
- **Eye-region contact** — frames where both eye regions are visible inside
  the face box (gaze-toward-camera proxy, not a pupil tracker).
- **Frame centeredness** — how consistently the face stays centered.
- **Motion engagement** — posture/gesture activity from frame differencing.
- **Confidence index** — weighted composite of the four observable signals.

These are delivery cues only. The system never claims personality traits,
honesty, emotion, or intelligence. "Not evidenced" ≠ "not capable".
