# Feature Status Report
## Smart Interview AI Platform — Post-Deployment Analysis

> Date: April 2026 | Deployment: Frontend → Vercel, Backend → Render

---

## BACKEND — Features Not Working

### 1. PDF Report Generation
**Status:** ❌ Not implemented  
**What happens:** `POST /api/interview/:id/report` returns a placeholder URL string pointing to the frontend feedback page. No actual PDF is generated.  
**Root cause:** No PDF library integrated. The route has a comment `// TODO: Implement actual PDF generation`.  
**Solution:**
- Install `puppeteer` or `pdfkit` in backend
- For `puppeteer`: launch headless Chrome, navigate to the feedback page URL, call `page.pdf()`
- For `pdfkit`: build the PDF programmatically from interview data
- Store the generated PDF in Cloudinary and return the download URL
- Estimated effort: 1–2 days

---

### 2. OTP Verification
**Status:** ❌ Not implemented — returns mock success  
**What happens:** `POST /api/auth/verify-otp` always returns `{ success: true, verified: true }` regardless of input.  
**Root cause:** Route exists with a `// TODO: Implement OTP verification logic` comment. No OTP generation, storage, or validation logic.  
**Solution:**
- Generate a 6-digit OTP using `crypto.randomInt(100000, 999999)`
- Store OTP + expiry (5 min) in MongoDB on the User document
- Send via email using existing `emailService`
- Validate on verify: check OTP matches and hasn't expired
- Estimated effort: 4–6 hours

---

### 3. Scheduling Reminder Cron Job
**Status:** ❌ No automated reminders  
**What happens:** The `POST /api/scheduling/:id/send-reminder` endpoint works when called manually, but there is no cron job to automatically trigger reminders before scheduled interviews.  
**Root cause:** No `node-cron` job configured anywhere in the codebase. The package is installed but never used.  
**Solution:**
- Add a cron job in `server.ts` using `node-cron`:
  ```ts
  cron.schedule('*/15 * * * *', async () => {
    // Find interviews scheduled in next 30 min with reminderSent=false
    // Call send-reminder for each
  });
  ```
- Estimated effort: 2–3 hours

---

### 4. Interview Recording Storage
**Status:** ❌ Not implemented  
**What happens:** Video/audio recorded during interviews is captured by the browser but never uploaded to the server. `videoUrl` and `audioUrl` on responses are always `null`.  
**Root cause:** No upload endpoint for recording blobs. The `VideoRecorder` component captures data via `onVideoData` callback but `InterviewRoomPage` doesn't use it.  
**Solution:**
- Add `POST /api/interview/:id/upload-recording` endpoint
- Accept multipart form data (video blob)
- Upload to Cloudinary using `cloudinaryService.uploadVideo()`
- Store URL in `interview.session.recordingUrls.video`
- Wire `onVideoData` in `InterviewRoomPage` to call this endpoint
- Estimated effort: 1 day

---

### 5. Real-time Video/Audio Analysis (Socket.IO → Python AI Server)
**Status:** ⚠️ Code is correct but depends on AI server being deployed  
**What happens:** Socket handlers now correctly call the Python AI server (`callPythonAI()`). But if `PYTHON_AI_SERVER_URL` is not set on Render, every `video-frame` and `audio-chunk` socket event throws an error and emits `video-analysis-error` / `audio-analysis-error` back to the client.  
**Root cause:** Python AI server is not deployed (memory constraints on free tier).  
**Solution:**
- Deploy AI server on Railway or Fly.io (see AI Server section below)
- Set `PYTHON_AI_SERVER_URL` and `PYTHON_AI_SERVER_API_KEY` in Render env vars
- No code changes needed — socket handlers are already wired correctly

---

### 6. WebRTC Peer Video (TURN Server)
**Status:** ❌ Will fail on most real networks  
**What happens:** WebRTC signaling (offer/answer/ICE) works via Socket.IO. But without a TURN server, peer connections fail when both users are behind NAT (home routers, corporate firewalls).  
**Root cause:** No TURN server configured. Only Google STUN is available.  
**Solution:**
- Use Twilio's free TURN service (free tier: 10GB/month)
- Or use `coturn` self-hosted on a VPS
- Add TURN credentials to Socket.IO WebRTC handler
- Estimated effort: 2–4 hours

---

### 7. Stripe Price IDs are Placeholder Strings
**Status:** ❌ Billing portal broken  
**What happens:** `STRIPE_PRO_PRICE_ID=price_pro_monthly` is not a real Stripe Price ID. Checkout sessions may work (Stripe creates ad-hoc prices) but the billing portal won't show correct plan info and subscription webhooks may fail to match plans.  
**Root cause:** Real Stripe products/prices were never created in the Stripe dashboard.  
**Solution:**
- Go to Stripe Dashboard → Products → Create "Pro" ($X/month) and "Enterprise" ($Y/month)
- Copy the generated `price_xxx` IDs
- Update `STRIPE_PRO_PRICE_ID` and `STRIPE_ENTERPRISE_PRICE_ID` in Render env vars
- Estimated effort: 30 minutes

---

### 8. Redis Not Available on Render Free Tier
**Status:** ⚠️ Degraded — caching and rate limiting not working  
**What happens:** `REDIS_URL=redis://localhost:6379` points to localhost which doesn't exist on Render. Redis initialization fails silently and the app continues without caching.  
**Root cause:** No Redis service configured for production.  
**Solution:**
- Add Upstash Redis (free tier: 10,000 requests/day) — takes 5 minutes
- Or add Render Redis add-on ($7/month)
- Update `REDIS_URL` in Render env vars
- Estimated effort: 15 minutes

---

### 9. `POST /api/interview/:id/process-video` and `process-audio`
**Status:** ❌ Broken — wrong env var name  
**What happens:** These routes use `process.env.PYTHON_API_URL` (old name) which is not set. Falls back to `http://localhost:8000` which doesn't exist on Render.  
**Root cause:** Env var was renamed to `PYTHON_AI_SERVER_URL` but these two routes still use the old name.  
**Solution:**
```ts
// Change in interview.ts lines ~910 and ~1012:
const pythonServerUrl = process.env.PYTHON_AI_SERVER_URL; // was PYTHON_API_URL
```
- Estimated effort: 5 minutes + redeploy

---

## AI SERVER — Features Not Working

### 1. AI Server Not Deployed
**Status:** ❌ Entire AI server offline  
**What happens:** All features that depend on the Python AI server return errors or degrade silently:
- Resume parsing (falls back to default skills list)
- Real-time video analysis (socket emits error)
- Real-time audio analysis (socket emits error)
- Emotion detection
- Speech-to-text transcription
**Root cause:** Python AI server requires `torch==2.1.1` (~2GB) + `mediapipe` + `transformers` which exceed Render free tier's 512MB RAM.  
**Solution options:**
- **Option A (Recommended):** Deploy on Railway — $5/month, 512MB RAM, supports Docker. Strip `torch` and `transformers` from `requirements.txt` since they're not actually called anywhere in the current code.
- **Option B:** Deploy on Fly.io free tier (256MB) — strip heavy deps first
- **Option C:** Keep AI server offline, rely on Gemini (Node.js) for all AI features — resume parsing degrades but core interview flow works

**Immediate fix to make deployment possible — strip unused heavy deps from `requirements.txt`:**
Remove: `torch==2.1.1`, `transformers==4.35.2`, `scikit-learn==1.3.2`, `pandas==2.0.3`
These are imported nowhere in the actual service files. Removing them reduces image size from ~4GB to ~400MB.

---

### 2. Whisper Speech Recognition Disabled
**Status:** ❌ Primary STT unavailable  
**What happens:** `SpeechRecognitionService` has Whisper commented out. Falls back to Google Speech Recognition API which is rate-limited and requires internet access from the server.  
**Root cause:** Whisper was disabled due to "compatibility issues on Windows" during development.  
**Solution:**
- On Linux (Railway/Fly.io), Whisper works fine
- Uncomment `import whisper` and `self.load_whisper_model()` in `speech_recognition.py`
- Use `whisper.load_model("base")` — the "base" model is only 74MB
- Estimated effort: 30 minutes after AI server is deployed

---

### 3. DeepFace Not Installed
**Status:** ⚠️ Emotion detection uses brightness heuristics  
**What happens:** `DEEPFACE_AVAILABLE = False` because `deepface` is not in `requirements.txt`. Emotion detection falls back to `_simple_emotion_heuristics()` which uses image brightness/contrast — not real emotion detection.  
**Root cause:** `deepface` was commented out in `requirements.txt` due to `dlib` C++ compilation requirements.  
**Solution:**
- Add `deepface==0.0.79` to `requirements.txt` (it installs without dlib on newer versions)
- Or use `fer` (Facial Expression Recognition) library which is lighter: `pip install fer`
- Estimated effort: 1–2 hours

---

### 4. `analyze_eye_contact` and `analyze_posture` Missing `import os` and `import tempfile`
**Status:** ❌ Will crash at runtime  
**What happens:** `video_analysis.py` uses `tempfile.NamedTemporaryFile` and `os.path.exists` / `os.unlink` in `analyze_eye_contact` and `analyze_posture` but `import os` and `import tempfile` are missing from the file's imports.  
**Root cause:** These imports exist in other service files but were not added to `video_analysis.py` when the methods were rewritten.  
**Solution:**
```python
# Add at top of video_analysis.py:
import os
import tempfile
```
- Estimated effort: 2 minutes

---

### 5. `analyze_comprehensive` Uses Hardcoded `75 * 0.3` Placeholder
**Status:** ⚠️ Inaccurate overall score  
**What happens:** `analyze_comprehensive()` calculates overall score as `eye_contact * 0.4 + posture * 0.3 + 75 * 0.3`. The `75 * 0.3` is a hardcoded placeholder for "other factors".  
**Root cause:** Gesture analysis and confidence scoring were never implemented.  
**Solution:**
- Replace `75 * 0.3` with actual hand gesture analysis score from `_analyze_hands()`
- Or remove the third factor and reweight: `eye_contact * 0.5 + posture * 0.5`
- Estimated effort: 1 hour

---

### 6. Google Speech Recognition Rate Limited in Production
**Status:** ⚠️ Will fail under load  
**What happens:** `_transcribe_with_google()` uses the free Google Speech Recognition API (via `SpeechRecognition` library). This is rate-limited to ~50 requests/day per IP.  
**Root cause:** Free tier API used as fallback.  
**Solution:**
- Use AssemblyAI (key already in `frontend/.env`: `ASSEMBLYAI_API_KEY`)
- Add `assemblyai` to `requirements.txt` and implement `_transcribe_with_assemblyai()`
- AssemblyAI free tier: 5 hours/month
- Estimated effort: 2–3 hours

---

## FRONTEND — Features Not Working

### 1. "Download PDF" Button
**Status:** ❌ Not a real PDF  
**What happens:** Clicking "Download PDF" on the feedback page calls `window.print()` which opens the browser's print dialog. Not a real PDF download.  
**Root cause:** No PDF generation implemented. `window.print()` was used as a placeholder.  
**Solution:**
- Install `jspdf` + `html2canvas` (already in `frontend/package.json`)
- Use `html2canvas` to capture the feedback page DOM
- Convert to PDF with `jspdf`
- Or call the backend `/api/interview/:id/report` endpoint once it's implemented
- Estimated effort: 4–6 hours

---

### 2. Interview Recording Never Uploaded
**Status:** ❌ Recordings lost  
**What happens:** `VideoRecorder` captures video via `MediaRecorder` and calls `onVideoData(blob)` when recording stops. But `InterviewRoomPage` passes `onStartRecording={startRecording}` and `onStopRecording={stopRecording}` from the store — neither of these handles the blob. The recording is silently discarded.  
**Root cause:** `onVideoData` prop is not passed to `VideoRecorder` in `InterviewRoomPage`.  
**Solution:**
```tsx
// In InterviewRoomPage, add:
const handleVideoData = async (blob: Blob) => {
  const formData = new FormData();
  formData.append('recording', blob, 'interview.webm');
  await apiService.upload(`/interview/${interviewId}/upload-recording`, formData);
};

// Pass to VideoRecorder:
<VideoRecorder onVideoData={handleVideoData} ... />
```
- Requires backend endpoint (see Backend #4)
- Estimated effort: 2–3 hours (after backend endpoint is ready)

---

### 3. Dashboard `upcomingInterviews` Always Empty
**Status:** ❌ Scheduling data not shown  
**What happens:** The dashboard shows 0 upcoming interviews even when interviews are scheduled.  
**Root cause:** The `/api/user/stats` endpoint doesn't include upcoming scheduled interviews in its response. The dashboard fetches stats but the stats query doesn't join with the scheduling collection.  
**Solution:**
- Add `upcomingInterviews` to the `/api/user/stats` response:
  ```ts
  const upcoming = await Interview.find({
    userId, status: 'scheduled',
    scheduledTime: { $gte: new Date(), $lte: new Date(Date.now() + 7*24*60*60*1000) }
  }).limit(5);
  ```
- Estimated effort: 1–2 hours

---

### 4. `feedbackData.improvement` Always Shows 0%
**Status:** ❌ Cross-interview comparison not implemented  
**What happens:** The feedback page shows "0.00% vs Last Interview" because `feedbackData.improvement` is never set.  
**Root cause:** No logic to compare current interview score against the previous interview's score.  
**Solution:**
- In the feedback generation route, fetch the user's previous completed interview score
- Calculate delta: `((currentScore - prevScore) / prevScore) * 100`
- Include `improvement` in the feedback response
- Estimated effort: 2–3 hours

---

### 5. ATS Score is a Heuristic Formula, Not Real ATS
**Status:** ⚠️ Misleading score  
**What happens:** Resume ATS score is calculated as `50 + (skills * 2) + (experience * 5) + (education * 5) + (certs * 2)`. This is a made-up formula, not how real ATS systems work.  
**Root cause:** No real ATS simulation implemented.  
**Solution:**
- Use Gemini to score the resume against a job description
- Prompt: "Score this resume for ATS compatibility on a scale of 0-100, considering keyword density, formatting, section completeness"
- Replace the heuristic formula with the Gemini score
- Estimated effort: 3–4 hours

---

### 6. Admin Panel AI Metrics Still Partially Hardcoded
**Status:** ⚠️ `questionQuality` and `feedbackAccuracy` not real  
**What happens:** The admin AI metrics endpoint now returns real `accuracy`, `avgRelevanceScore`, `avgClarityScore`, and `userSatisfaction` from DB. But there's no `questionQuality` or `feedbackAccuracy` metric — these were removed but the admin frontend may still expect them.  
**Root cause:** Admin frontend was built expecting the old mock fields.  
**Solution:**
- Audit `AdminDashboardPage.tsx` to see which metrics it renders
- Remove references to `questionQuality` and `feedbackAccuracy` from the UI
- Or add them as derived metrics from interview data
- Estimated effort: 1–2 hours

---

### 7. `react-speech-recognition` Library Not Used
**Status:** ⚠️ Unused dependency  
**What happens:** `react-speech-recognition` is in `package.json` but the `SpeechRecognition` component uses the native Web Speech API directly. The library is bundled but never imported.  
**Root cause:** Component was rewritten to use native API but the library wasn't removed.  
**Solution:**
- Remove `react-speech-recognition` from `frontend/package.json`
- Saves ~50KB from the bundle
- Estimated effort: 5 minutes

---

### 8. Socket.IO Connection Fails When Backend Restarts
**Status:** ⚠️ No reconnection UI  
**What happens:** If the Render backend restarts (which happens on free tier after 15 min inactivity), the Socket.IO connection drops. The frontend shows no error and the interview appears to continue but real-time features stop working silently.  
**Root cause:** No reconnection state shown to the user. The socket has `reconnection: true` but there's no UI feedback.  
**Solution:**
- Listen to `socket.on('disconnect')` and `socket.on('reconnect')` in `useSocket`
- Show a toast: "Connection lost — reconnecting…" on disconnect
- Show: "Reconnected" on reconnect
- Estimated effort: 1 hour

---

## Priority Order for Fixes

### Fix immediately (breaks core functionality)
1. **AI server `import os, tempfile`** — 2 minutes, prevents crash
2. **`PYTHON_API_URL` → `PYTHON_AI_SERVER_URL`** in interview.ts — 5 minutes
3. **Stripe real Price IDs** — 30 minutes
4. **Redis (Upstash)** — 15 minutes

### Fix this week (important features)
5. **Strip heavy deps from AI server, deploy on Railway** — 2–4 hours
6. **OTP verification** — 4–6 hours
7. **Scheduling cron job** — 2–3 hours
8. **Dashboard upcoming interviews** — 1–2 hours
9. **Socket reconnection UI** — 1 hour

### Fix next sprint (nice to have)
10. **PDF report generation** — 1–2 days
11. **Interview recording upload** — 1 day
12. **Whisper STT** — 30 min (after AI server deployed)
13. **DeepFace emotion detection** — 1–2 hours
14. **AssemblyAI transcription** — 2–3 hours
15. **Feedback improvement rate** — 2–3 hours
16. **ATS real scoring** — 3–4 hours
17. **Remove unused react-speech-recognition** — 5 minutes
