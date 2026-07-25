# Interview & Coding Flow — Detailed Status Report
## Every feature, every edge case, every bug

---

## PART 1 — INTERVIEW SETUP PAGE (`/interview-setup`)

### ✅ What works
- All 5 interview types render correctly: Technical, Skill-based, Coding, Behavioral, System Design
- Role input field with focus styling
- Difficulty selector (Easy / Medium / Hard)
- Duration picker (15, 30, 45, 60, 90, 120 min)
- Domain picker for skill-based interviews (10 domains)
- Resume upload for technical interviews (PDF/DOC/DOCX, 5MB limit)
- Loading state during interview creation
- Navigation to `/interview-room` or `/coding-interview` based on type

### ❌ Bug 1 — Resume upload on Technical interview is mandatory but blocks silently
**What happens:** If resume upload fails (Cloudinary error, network issue), the error toast shows but the user has no way to proceed without a resume. There is no "skip resume" option for technical interviews.  
**Code location:** `InterviewSetupPage.tsx` line ~100:
```ts
if (selectedType === 'technical' && !resumeFile)
  return toast.error('Upload your resume for technical interviews');
```
**Impact:** Users without a resume cannot do technical interviews at all.  
**Fix:** Add a "Skip resume" option that proceeds without `resumeId`.

### ❌ Bug 2 — `resumeId` extraction fragile
**What happens:** After resume upload, the code does:
```ts
resumeId = (uploadRes.data as any)?._id?.toString() || (uploadRes.data as any)?.id?.toString();
if (!resumeId) { toast.error('Resume saved but ID missing — try again'); return; }
```
If the backend returns the resume object nested differently, `resumeId` is undefined and the user gets an error even though the resume was saved.  
**Fix:** Already handled with fallback, but the backend should always return `_id` consistently.

### ⚠️ Issue 3 — Interview creation timeout is 30 seconds but Gemini can take longer
**What happens:** Question generation has a 30s timeout. On Render free tier (cold start + slow CPU), Gemini API calls can take 40–60 seconds. The timeout fires, falls back to minimal fallback questions.  
**Code location:** `backend/src/routes/interview.ts`:
```ts
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Question generation timeout')), 30000)
);
```
**Impact:** Users get generic fallback questions instead of role-specific ones.  
**Fix:** Increase timeout to 60s, or show a "Generating questions…" progress indicator on frontend.

---

## PART 2 — INTERVIEW ROOM PAGE (`/interview-room`) — Technical/Behavioral/Skill-based

### ✅ What works
- Interview session starts automatically on page load
- Question banner shows question text, difficulty tag, type tag, expected duration
- Progress bar in header updates as questions are answered
- Timer counts up correctly
- Answer textarea with word count and completeness bar
- "Submit & Next" button disabled until answer has text
- Pause / Resume session state
- End interview confirmation modal
- "All questions completed" state when no more questions
- Navigation to `/feedback/:id` after ending

### ❌ Bug 4 — Camera not working on first load (race condition)
**What happens:** `VideoRecorder` calls `initMedia()` on mount. At the same time, `InterviewRoomPage` calls `startInterview()` which calls `getNextQuestion()`. Both happen simultaneously. On some browsers, the second `getUserMedia` call (from the audio meter in `SpeechRecognition`) conflicts with the first, causing `NotReadableError`.  
**Current state:** The `SpeechRecognition` component no longer calls `getUserMedia` (fixed previously). The `VideoRecorder` now uses inline styles instead of `aspect-video` class. Camera should work.  
**Remaining issue:** On Render free tier, the backend takes 2–5 seconds to respond to `startInterview`. During this time, the page shows a loading spinner and the camera hasn't initialized yet. When the spinner disappears, the camera container renders but `initMedia()` was already called during the loading state — the video element may not be in the DOM yet.  
**Fix:** `initMedia()` is called in `useEffect(() => { initMedia(); }, [])` — this runs after the component mounts, so the video element IS in the DOM. This should be fine. If camera still doesn't show, it's a browser permission issue.

### ❌ Bug 5 — `startInterview` called twice on page load
**What happens:** 
```ts
useEffect(() => {
  if (!interviewId) { ... return; }
  if (!currentSession) handleStartInterview(); // ← called here
}, [interviewId]);
```
In React 18 StrictMode, `useEffect` runs twice in development. In production this runs once. But if the user navigates away and back, `currentSession` may still be set from the previous interview, causing `handleStartInterview` to NOT be called — the interview never starts.  
**Fix:** Add `resetSession()` call when navigating to `/interview-room` from setup page, or check `currentInterview._id === interviewId` before skipping.

### ❌ Bug 6 — `submitResponse` fires and forgets, then `getNextQuestion` races
**What happens:**
```ts
submitResponse({ ... }).catch(console.error); // fire and forget
setCurrentAnswer('');
setIsListening(false);
await getNextQuestion(); // called immediately after
```
`submitResponse` is not awaited. `getNextQuestion` runs before the response is saved to DB. The backend's `next-question` endpoint finds the question still unanswered (because the response hasn't been saved yet) and returns the SAME question again.  
**Impact:** User sees the same question twice after submitting.  
**Fix:** Either await `submitResponse` before calling `getNextQuestion`, or add a small delay:
```ts
await submitResponse({ ... });
await getNextQuestion();
```

### ❌ Bug 7 — Speech recognition stops after first `no-speech` timeout
**What happens:** The `SpeechRecognition` component restarts on `no-speech` with a 800ms delay. But `isListening` is set to `false` after submitting an answer:
```ts
setIsListening(false);
await getNextQuestion();
setTimeout(() => { setIsListening(true); ... }, 1200);
```
If the user submits quickly and the 1200ms timeout fires before `getNextQuestion` resolves, `isListening` becomes `true` while `currentQuestion` is still the old question. The transcript from the new question gets appended to the old answer.  
**Fix:** Set `isListening(true)` only after `getNextQuestion()` resolves and `currentQuestion` is updated.

### ❌ Bug 8 — `isRecording` state from store never becomes `true`
**What happens:** `VideoRecorder` receives `isRecording={isRecording}` from the store. The store's `startRecording()` sets `isRecording: true`. But `startRecording` is called via `onStartRecording` prop — which is `startRecording` from the store. The `VideoRecorder` calls `onStartRecording()` when `isRecording` prop becomes `true`. This is circular: `isRecording` prop drives the recording, but `onStartRecording` is what sets `isRecording` in the store.  
**Actual flow:** `InterviewRoomPage` passes `isRecording={isRecording}` (from store) and `onStartRecording={startRecording}` (store action). The `VideoRecorder` calls `onStartRecording()` when `isRecording` prop is `true`. But `isRecording` in the store is only set to `true` when `startRecording()` is called. Nobody calls `startRecording()` — the interview starts but recording never begins.  
**Impact:** The REC badge never shows. No video is recorded.  
**Fix:** Call `startRecording()` in `handleStartInterview()`:
```ts
const handleStartInterview = async () => {
  await startInterview(interviewId);
  startRecording(); // ← add this
  setSessionState('active');
  ...
};
```

### ⚠️ Issue 9 — No reconnection handling when Render backend sleeps
**What happens:** Render free tier sleeps after 15 minutes of inactivity. If a user is mid-interview and the backend restarts, all API calls fail silently. The interview appears to continue but answers aren't saved.  
**Fix:** Add a connection status indicator and retry logic.

### ⚠️ Issue 10 — `handleNextQuestion` doesn't handle `getNextQuestion` returning null (all done)
**What happens:** When all questions are answered, `getNextQuestion()` sets `currentQuestion: null`. The page shows "All questions completed!" state. But `handleNextQuestion` is still callable — if the user somehow clicks "Submit & Next" after the last question, it calls `getNextQuestion()` again which hits the backend unnecessarily.  
**Fix:** Disable the "Submit & Next" button when `!currentQuestion`.

---

## PART 3 — CODING INTERVIEW PAGE (`/coding-interview`)

### ✅ What works
- Monaco editor renders with syntax highlighting
- Language switching (JS, TS, Python, Java, C++, C, C#)
- Code templates load per language (Two Sum example)
- Timer counts up
- "Run Code" button calls Piston API and shows test results
- Test case pass/fail display with input/expected/actual
- "Submit & Next" flow
- Dynamic hints via Gemini API
- Static hints from `followUpQuestions`
- Question description, examples, constraints display
- `fmtVal()` handles object/array examples correctly

### ❌ Bug 11 — `loadQuestion` still called on mount even when question exists
**What happens:**
```ts
useEffect(() => {
  if (!interviewId) { ... return; }
  if (currentQuestion) { setLoading(false); return; } // ← guard exists
  
  let cancelled = false;
  const fetchQuestion = async () => { ... await getNextQuestion(); ... };
  fetchQuestion();
  return () => { cancelled = true; };
}, [interviewId]);
```
The guard `if (currentQuestion)` correctly skips the fetch. But `currentQuestion` from the store is the question object from the PREVIOUS interview if the user did an interview before. The `interviewId` changes but `currentQuestion` is stale.  
**Impact:** User sees the previous interview's question briefly before the new one loads.  
**Fix:** Reset `currentQuestion` to `null` in the store when navigating to a new interview. Call `resetSession()` in `InterviewSetupPage` before navigating.

### ❌ Bug 12 — Code execution uses Piston public API — rate limited
**What happens:** Piston public API (`https://emkc.org/api/v2/piston`) has no authentication and is rate-limited. Under load (multiple users), requests fail with 429 or timeout.  
**Impact:** "Run Code" fails for users during peak usage.  
**Fix:** Self-host Piston (Docker image available) or use Judge0 with API key.

### ❌ Bug 13 — Test case comparison fails for Python list output
**What happens:** Python `print([0, 1])` outputs `[0, 1]` (with space after comma). The expected output stored in DB is `[0,1]` (no space). The `normalizeOutput()` function in `codeExecution.ts` does `JSON.stringify(JSON.parse(output))` which converts `[0, 1]` → `[0,1]`. This should work.  
**But:** Python's `json.dumps([0, 1])` outputs `[0, 1]` (with space). The test harness uses `print(json.dumps(result))` which outputs `[0, 1]`. After `normalizeOutput`, both become `[0,1]`. ✅ This is actually fine.  
**Real issue:** The Python test harness uses `_user_funcs[0]` to find the function name. If the user writes a helper function before the main solution, the wrong function gets called.  
**Fix:** Look for the function that matches the question's expected function name (e.g., `twoSum`) rather than just the first function.

### ❌ Bug 14 — `handleSubmit` uses stale `currentInterview` for question count
**What happens:**
```ts
const interview = currentInterview || await apiService.get(`/interview/${interviewId}`).then(r => r.data);
const totalQuestions = interviewData?.questions?.length || 0;
const answeredQuestions = interviewData?.responses?.length || 0;

if (answeredQuestions + 1 < totalQuestions) {
  // load next
} else {
  // end interview
}
```
`currentInterview` in the store may be stale (responses not updated after submit). The `answeredQuestions` count may be wrong, causing the interview to end prematurely or continue past the last question.  
**Current fix applied:** `handleSubmit` now calls `getNextQuestion()` and checks `currentQuestion` from store state. This is correct.  
**Remaining issue:** The old `apiService.get` call is still there as a fallback — it fetches the interview but the response count may be stale due to async DB write.  
**Fix:** Remove the `apiService.get` fallback entirely. Trust `getNextQuestion()` return value.

### ❌ Bug 15 — Language change resets code to Two Sum template always
**What happens:**
```ts
const handleLanguageChange = (newLanguage: string) => {
  setLanguage(newLanguage);
  setCode(CODE_TEMPLATES[newLanguage] || CODE_TEMPLATES.python);
};
```
When the user switches language mid-solution, their code is wiped and replaced with the Two Sum template. The template is hardcoded as Two Sum regardless of the actual question.  
**Impact:** User loses their work when switching languages.  
**Fix:** Either warn before resetting, or generate a language-appropriate template based on the current question's function signature.

### ⚠️ Issue 16 — `questionIndex` state is local and doesn't sync with store
**What happens:** `questionIndex` is a local `useState(0)` that increments on submit. But `currentQuestionIndex` in the store also increments. They can get out of sync if the user navigates away and back.  
**Impact:** "Q 1", "Q 2" counter may show wrong number.  
**Fix:** Use `currentQuestionIndex` from the store directly instead of local state.

### ⚠️ Issue 17 — Hints fetch on every "Show hints" click
**What happens:**
```ts
const handleToggleHints = async () => {
  if (!showHint && hints.length === 0) {
    await fetchDynamicHints(); // calls Gemini API
  }
  setShowHint(prev => !prev);
};
```
Hints are only fetched once (when `hints.length === 0`). After that, toggling show/hide reuses cached hints. ✅ This is correct.  
**But:** If Gemini fails, `hints` stays empty. Next time user clicks "Show hints", it tries Gemini again. This is fine behavior.

---

## PART 4 — FEEDBACK PAGE (`/feedback/:id`)

### ✅ What works
- Fetches interview data and feedback from backend
- If feedback doesn't exist, auto-generates it via `POST /api/interview/:id/feedback`
- Overall score circular progress chart
- Grade (A+/A/B/C/D) calculation
- Questions attempted count
- Duration display
- Content metrics (Communication, Relevance, Structure, Technical) with progress bars
- Bar chart and radar chart for category scores
- Keyword analysis tags
- Question-by-question breakdown with collapsible cards
- Each question shows: difficulty, category, time spent, answer, follow-up questions
- Strengths and improvements lists
- Detailed feedback paragraph
- Personalized recommendations with priority badges
- "Start Another Interview" and "Back to Dashboard" buttons
- Print/PDF via `window.print()` with print-specific CSS

### ❌ Bug 18 — Feedback generation can timeout on Render free tier
**What happens:** `POST /api/interview/:id/feedback` calls Gemini to generate feedback. On Render free tier, this can take 30–60 seconds. The frontend has a 60-second Axios timeout. If Gemini is slow, the request times out and the user sees "Failed to generate feedback".  
**Impact:** Feedback page shows error state after completing an interview.  
**Fix:** Show a progress indicator ("Generating your feedback, this may take a moment…") and increase timeout for this specific call to 90 seconds.

### ❌ Bug 19 — Content metrics show 0 if AI analysis didn't run
**What happens:** Content metrics (relevanceScore, communicationClarity, etc.) are populated by the background AI analysis that runs after each response is submitted. If the user answers quickly and ends the interview before the background analysis completes, all metrics show 0.  
**Code location:** `FeedbackPage.tsx`:
```ts
const communicationClarity = contentMetrics.communicationClarity ?? 0;
```
**Impact:** Feedback page shows 0/100 for all content metrics even for good answers.  
**Fix:** Add a "Analyzing your responses…" state that polls `/api/interview/:id/analysis` until scores are non-zero, or run analysis synchronously before generating feedback.

### ❌ Bug 20 — "vs Last Interview" always shows 0.00%
**What happens:**
```ts
<p className="text-2xl gradient-text">
  {feedbackData?.improvement ? `+${f2(feedbackData.improvement)}%` : '0.00%'}
</p>
```
`feedbackData.improvement` is never set by the backend. The feedback generation prompt doesn't include previous interview data.  
**Fix:** In the feedback route, fetch the user's previous completed interview score and include it in the Gemini prompt. Return `improvement` in the response.

### ❌ Bug 21 — `avgDuration` shows seconds but label says "avg Xs per answer"
**What happens:**
```ts
const avgDuration = responses.length
  ? Math.round(responses.reduce((sum, r) => sum + (r.duration || 0), 0) / responses.length)
  : 0;
```
`response.duration` is stored in seconds (set as `Math.round((Date.now() - responseStartTime) / 1000)`). The display shows `avg 45s per answer` which is correct. ✅  
**But:** In `CodingInterviewPage`, `duration: timeElapsed` is passed where `timeElapsed` is in seconds. In `InterviewRoomPage`, `duration: Math.round((Date.now() - responseStartTime) / 1000)` is also seconds. Consistent. ✅

### ⚠️ Issue 22 — "Download PDF" is `window.print()` not a real PDF
**What happens:** The "Download PDF" button calls `window.print()`. This opens the browser's print dialog. The user must manually select "Save as PDF".  
**Impact:** Not a real download. Confusing UX. Doesn't work on mobile.  
**Fix:** Use `jspdf` + `html2canvas` (both already in `package.json`) to generate a real PDF blob and trigger a download.

### ⚠️ Issue 23 — Feedback page re-fetches on every visit
**What happens:** Every time the user visits `/feedback/:id`, it calls `GET /api/interview/:id/feedback`. If feedback doesn't exist, it calls `POST /api/interview/:id/feedback` (Gemini). This means every page refresh regenerates feedback (costs Gemini API calls).  
**Fix:** Cache feedback in the store after first fetch. Check store before making API call.

---

## PART 5 — BACKEND INTERVIEW ROUTES

### ✅ What works
- `POST /api/interview/create` — creates interview, generates questions via Gemini
- `POST /api/interview/:id/start` — sets status to in-progress, records start time
- `POST /api/interview/:id/end` — sets status to completed, calculates duration
- `GET /api/interview/:id/next-question` — returns next unanswered question, returns `completed:true` when done
- `POST /api/interview/:id/response` — saves answer immediately, runs AI analysis in background
- `POST /api/interview/:id/feedback` — generates feedback via Gemini
- `GET /api/interview/:id/feedback` — returns stored feedback
- `GET /api/interview/history` — paginated interview list
- `GET /api/interview/:id` — get specific interview

### ❌ Bug 24 — Background AI analysis race condition
**What happens:** `POST /api/interview/:id/response` saves the response and immediately returns 200. Then runs AI analysis in background:
```ts
(async () => {
  const analysis = await geminiService.analyzeResponse({ ... });
  await Interview.findByIdAndUpdate(id, { $set: { "analysis.contentMetrics...": ... } });
})();
```
If the user submits all answers quickly and calls `POST /api/interview/:id/end` before the background analysis completes, the interview is marked completed but analysis scores are 0.  
**Impact:** Feedback page shows 0 for all content metrics.  
**Fix:** Either run analysis synchronously (slower but accurate), or wait for all background analyses to complete before allowing `end` to be called.

### ❌ Bug 25 — `POST /api/interview/:id/response` validation requires `answer` to be non-empty
**What happens:**
```ts
body('answer').notEmpty().trim(),
```
For coding interviews, the answer is the code. If the user submits an empty code editor (just the template), validation fails with 400.  
**Fix:** Make `answer` optional for coding type, or use a different field (`codeSubmission.code`) as the primary answer.

### ❌ Bug 26 — `GET /api/interview/:id/next-question` uses `Array.find` which is O(n²)
**What happens:**
```ts
const answeredQuestionIds = new Set(interview.responses.map((r: any) => r.questionId));
const nextQuestion = interview.questions.find((q: any) => !answeredQuestionIds.has(q.id));
```
This is actually O(n) with the Set. ✅ Fine.  
**But:** If a question's `id` field is undefined (Gemini returned a question without an id), `answeredQuestionIds.has(undefined)` is always false, so the question is always returned as "unanswered" — infinite loop.  
**Fix:** Filter out questions with no `id` during creation, or generate IDs server-side always.

### ⚠️ Issue 27 — Interview `status` stays `in-progress` if user closes browser
**What happens:** If the user closes the browser mid-interview, `POST /api/interview/:id/end` is never called. The interview stays `in-progress` forever.  
**Impact:** Dashboard shows interview as "in progress" indefinitely. History page shows stale data.  
**Fix:** Add a cron job that marks interviews as `cancelled` if they've been `in-progress` for more than 3 hours.

---

## PART 6 — CAMERA (VideoRecorder Component)

### ✅ What works
- Requests camera + mic with fallback constraints
- Falls back to audio-only if camera unavailable
- Shows error UI with Retry and "Audio only" buttons
- Toggle camera on/off during interview
- Toggle mic on/off during interview
- REC badge when recording
- Fills container correctly (fixed aspect-video issue)
- Works in Chrome, Firefox, Edge

### ❌ Bug 28 — Camera shows black screen on some laptops
**What happens:** On some Windows laptops with integrated + discrete GPU, `facingMode: 'user'` constraint causes the camera to initialize but show a black frame. The stream is active but no video.  
**Root cause:** GPU driver issue with `facingMode` constraint on desktop cameras.  
**Fix:** Remove `facingMode: 'user'` from the ideal constraints (it's only meaningful on mobile):
```ts
video: { width: { ideal: 1280 }, height: { ideal: 720 } }, // no facingMode
```

### ❌ Bug 29 — `videoRef.current.play()` called before `srcObject` is set
**What happens:**
```ts
if (gotVideo && videoRef.current) {
  videoRef.current.srcObject = stream;
  try { await videoRef.current.play(); } catch { }
}
setStatus('ready');
```
`srcObject` is set and `play()` is called. But `play()` may resolve before the video has loaded metadata (first frame). The video element shows black until the first frame arrives.  
**Fix:** Wait for `loadedmetadata` event before calling `play()`:
```ts
await new Promise(resolve => { videoRef.current!.onloadedmetadata = resolve; });
await videoRef.current.play();
```

### ⚠️ Issue 30 — Recording blob is captured but never uploaded
**What happens:** `VideoRecorder` calls `onVideoData(blob)` when recording stops. In `InterviewRoomPage`, `onVideoData` prop is NOT passed to `VideoRecorder`:
```tsx
<VideoRecorder isRecording={isRecording} onStartRecording={startRecording} onStopRecording={stopRecording} />
// ↑ no onVideoData prop
```
The recording blob is silently discarded.  
**Impact:** No video recordings stored anywhere.  
**Fix:** Pass `onVideoData` and upload to backend (requires backend endpoint).

---

## SUMMARY TABLE

| # | Feature | Status | Severity |
|---|---|---|---|
| 1 | Interview setup — resume mandatory blocks | ❌ Bug | Medium |
| 2 | Interview setup — resumeId extraction | ⚠️ Fragile | Low |
| 3 | Question generation timeout too short | ⚠️ Issue | Medium |
| 4 | Camera race condition on load | ✅ Fixed | — |
| 5 | `startInterview` called twice / stale session | ❌ Bug | Medium |
| 6 | `submitResponse` not awaited before `getNextQuestion` | ❌ Bug | HIGH |
| 7 | Speech recognition starts before new question loads | ❌ Bug | Medium |
| 8 | `isRecording` never becomes true — no recording | ❌ Bug | HIGH |
| 9 | No reconnection handling | ⚠️ Issue | Medium |
| 10 | Submit button not disabled after last question | ⚠️ Issue | Low |
| 11 | Stale `currentQuestion` from previous interview | ❌ Bug | Medium |
| 12 | Piston API rate limited | ⚠️ Issue | Medium |
| 13 | Python function detection picks wrong function | ❌ Bug | Medium |
| 14 | Stale interview data in handleSubmit | ✅ Fixed | — |
| 15 | Language change wipes user's code | ❌ Bug | Medium |
| 16 | `questionIndex` out of sync with store | ⚠️ Issue | Low |
| 17 | Hints fetch correctly | ✅ Works | — |
| 18 | Feedback generation timeout | ❌ Bug | HIGH |
| 19 | Content metrics show 0 if analysis incomplete | ❌ Bug | HIGH |
| 20 | "vs Last Interview" always 0% | ❌ Bug | Low |
| 21 | Duration display correct | ✅ Works | — |
| 22 | PDF download is window.print() | ⚠️ Issue | Medium |
| 23 | Feedback re-fetched on every visit | ⚠️ Issue | Low |
| 24 | Background analysis race with interview end | ❌ Bug | HIGH |
| 25 | Empty code fails response validation | ❌ Bug | Medium |
| 26 | Question with undefined id causes infinite loop | ❌ Bug | HIGH |
| 27 | Interview stays in-progress if browser closed | ⚠️ Issue | Low |
| 28 | Black camera on some laptops | ❌ Bug | Medium |
| 29 | Video shows black until first frame | ⚠️ Issue | Low |
| 30 | Recording blob discarded | ❌ Bug | Medium |

### Critical (fix immediately)
- **Bug 6** — Same question shown twice after submit
- **Bug 8** — Recording never starts
- **Bug 18** — Feedback generation times out
- **Bug 19** — Content metrics always 0
- **Bug 24** — Analysis race with interview end
- **Bug 26** — Infinite loop on undefined question id
