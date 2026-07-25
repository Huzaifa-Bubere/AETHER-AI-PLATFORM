# Codebase Audit — Smart Interview AI Platform
> Updated after .env files added. Analysis covers what's now actually runnable vs still broken.

---

## Environment Configuration Status

### backend/.env
| Variable | Value | Status |
|---|---|---|
| `MONGODB_URI` | MongoDB Atlas (pawan15 cluster) | ✅ Configured |
| `JWT_ACCESS_SECRET` | Set | ✅ Configured |
| `JWT_REFRESH_SECRET` | Set | ✅ Configured |
| `GEMINI_API_KEY` | Set | ✅ Configured |
| `GEMINI_MODEL` | gemini-2.5-flash | ✅ Configured |
| `CLOUDINARY_CLOUD_NAME/KEY/SECRET` | Set | ✅ Configured |
| `EMAIL_USER/PASSWORD` | Gmail SMTP set | ✅ Configured |
| `STRIPE_SECRET_KEY` | Test mode key set | ✅ Configured |
| `STRIPE_WEBHOOK_SECRET` | Set | ✅ Configured |
| `STRIPE_PRO_PRICE_ID` | `price_pro_monthly` | ❌ Fake — not a real Stripe Price ID |
| `STRIPE_ENTERPRISE_PRICE_ID` | `price_enterprise_monthly` | ❌ Fake — not a real Stripe Price ID |
| `CODE_EXECUTION_SERVICE` | piston | ✅ Configured |
| `PISTON_URL` | Public Piston API | ✅ Configured |
| `JUDGE0_API_KEY` | `your-judge0-api-key-here` | ❌ Not set (placeholder) |
| `REDIS_URL` | localhost:6379 | ⚠️ Only works if Redis running locally |
| `PYTHON_AI_SERVER_URL` | Not set in backend/.env | ❌ Missing — backend can't reach AI server |
| `PYTHON_AI_SERVER_API_KEY` | Not set in backend/.env | ❌ Missing — AI server will reject requests |
| `FRONTEND_URL` | http://localhost:5175 | ✅ Set |

### frontend/.env
| Variable | Value | Status |
|---|---|---|
| `VITE_API_BASE_URL` | http://localhost:5001/api | ✅ Configured |
| `VITE_AUTH0_DOMAIN` | Set | ✅ Configured |
| `VITE_AUTH0_CLIENT_ID` | Set | ✅ Configured |
| `VITE_AUTH0_AUDIENCE` | Set | ✅ Configured |
| `PYTHON_AI_SERVER_URL` | http://localhost:8000 | ⚠️ Frontend env — not used by backend |
| `PYTHON_AI_SERVER_API_KEY` | Set | ⚠️ Frontend env — not used by backend |
| `WEBRTC_STUN_SERVER` | stun:stun.l.google.com:19302 | ⚠️ Frontend env — not wired into WebRTC code |
| `WEBRTC_TURN_SERVER` | `your-turn-server-here` | ❌ Placeholder — no TURN server |
| `DEEPGRAM_API_KEY` | Set | ⚠️ Not used anywhere in codebase |
| `WHISPER_API_KEY` | Set (OpenAI Whisper key) | ⚠️ Not used anywhere in codebase |
| `OPENAI_API_KEY` | Set | ⚠️ Not used anywhere in codebase |
| `ASSEMBLYAI_API_KEY` | Set | ⚠️ Not used anywhere in codebase |
| `AVATAR_MODEL_URL` | readyplayer.me | ⚠️ Not wired into AIAvatar component |
| `SENTRY_DSN` | `your-sentry-dsn-here` | ❌ Placeholder |
| `AWS_*` | `your-aws-*` placeholders | ❌ Not configured |

### ai-server/.env
| Variable | Value | Status |
|---|---|---|
| `GEMINI_API_KEY` | Set | ✅ Configured |
| `GEMINI_MODEL` | gemini-2.5-flash | ✅ Configured |
| `PYTHON_AI_SERVER_API_KEY` | Set | ✅ Configured |

---

## Critical Discovery: Backend Cannot Reach AI Server

`PYTHON_AI_SERVER_URL` and `PYTHON_AI_SERVER_API_KEY` are defined in `frontend/.env` — **not in `backend/.env`**. The backend is the one that calls the Python AI server, so these variables are in the wrong file. The backend will use `undefined` for both, meaning:

- Resume parsing will fail (backend calls `http://undefined/api/resume/parse`)
- All real-time analysis endpoints will fail
- The Python AI server is effectively unreachable from the backend even though it's running

---

## 1. Frontend Pages

### LandingPage
- **Status: Works** — Static marketing page.

### LoginPage / SignupPage
- **Status: Works** — JWT auth, bcrypt, email verification via Gmail SMTP (now configured).

### ForgotPasswordPage / ResetPasswordPage
- **Status: Works** — Email reset now functional since Gmail SMTP is configured.

### OnboardingPage
- **Status: Works** — Saves preferences to backend.

### DashboardPage
- **Status: Mostly Works**
- **Issue:** `totalInterviews` API returns 0 even when interviews exist — client-side workaround in place.
- **Issue:** `upcomingInterviews` always empty — scheduling not wired to stats endpoint.
- **Issue:** Skill radar shows empty/zero state for new users with no guidance.

### InterviewSetupPage
- **Status: Works** — Creates interview, Gemini generates questions (API key configured).

### InterviewRoomPage
- **Status: Partially Works**
- Core text answer flow works.
- **Issue:** Video frames captured but never uploaded or analyzed.
- **Issue:** Speech recognition transcribes locally but no server-side audio analysis triggered.
- **Issue:** Socket `video-frame` / `audio-chunk` handlers return hardcoded mock data — Python AI server never called.
- **Issue:** AIAvatar is a non-functional placeholder.

### CodingInterviewPage
- **Status: Partially Works**
- Monaco editor, language switching, code templates work.
- Code execution via Piston API works (configured).
- **Issue:** Gemini-generated coding questions often missing `testCases`, `examples`, `constraints`.
- **Issue:** Java test wrapping requires Gson (not in Piston sandbox).
- **Issue:** C++ test wrapping is naive, breaks on complex inputs.

### FeedbackPage
- **Status: Works** — Renders score, charts, Q&A breakdown, strengths/improvements.
- **Issue:** "Download PDF" is `window.print()` only — no real PDF.
- **Issue:** `feedbackData.improvement` (vs last interview) always 0 — not implemented on backend.

### ResumeAnalyzerPage
- **Status: Broken for parsing** — Cloudinary upload will work (configured), but the backend cannot call the Python AI server to parse the resume because `PYTHON_AI_SERVER_URL` is missing from `backend/.env`.
- **Issue:** Resume deletion not implemented (TODO in route).

### HistoryPage
- **Status: Works**

### ProfilePage
- **Status: Works**

### SubscriptionPage
- **Status: Partially Works** — Stripe test keys configured, checkout session creation works.
- **Issue:** `STRIPE_PRO_PRICE_ID=price_pro_monthly` and `STRIPE_ENTERPRISE_PRICE_ID=price_enterprise_monthly` are fake placeholder strings, not real Stripe Price IDs. The service creates ad-hoc prices dynamically as a fallback, which works but is not production-ready.

### PaymentSuccessPage
- **Status: Works** — Verifies session, activates subscription.

### AdminDashboardPage
- **Status: Partially Works** — Real DB stats work.
- **Issue:** AI metrics endpoint returns hardcoded mock values.
- **Issue:** Error logs endpoint returns hardcoded mock entries.

### AdminLoginPage
- **Status: Works**

---

## 2. Backend Routes — Updated Status

### `/api/auth`
| Endpoint | Status | Notes |
|---|---|---|
| POST /register | ✅ Works | Email verification now sends via Gmail SMTP |
| POST /login | ✅ Works | |
| POST /refresh | ✅ Works | |
| POST /logout | ✅ Works | |
| POST /forgot-password | ✅ Works | Email now sends |
| POST /reset-password | ✅ Works | |
| GET /verify-email | ✅ Works | |
| POST /resend-verification | ✅ Works | |
| POST /verify-otp | ❌ Broken | Mock success only — no OTP logic |
| POST /create-profile | ⚠️ Partial | Auth0 profile; mock fallback if no DB |

### `/api/interview`
| Endpoint | Status | Notes |
|---|---|---|
| POST /create | ✅ Works | Gemini API key configured |
| POST /:id/start | ✅ Works | |
| POST /:id/end | ✅ Works | |
| GET /:id/next-question | ✅ Works | |
| POST /:id/response | ✅ Works | Async AI analysis runs |
| POST /:id/feedback | ✅ Works | Gemini generates feedback |
| GET /:id/feedback | ✅ Works | |
| GET /history | ✅ Works | |
| GET /:id | ✅ Works | |
| GET /:id/analysis | ✅ Works | |
| POST /:id/report | ❌ Broken | Placeholder URL — no PDF |
| POST /:id/process-video | ❌ Broken | `PYTHON_AI_SERVER_URL` missing from backend env |
| POST /:id/process-audio | ❌ Broken | Same |
| POST /:interviewId/analyze/video | ❌ Broken | Same |
| POST /:interviewId/analyze/audio | ❌ Broken | Same |
| GET /:interviewId/analyze/summary | ⚠️ Partial | Returns stored data; live analysis never populates |

### `/api/resume`
| Endpoint | Status | Notes |
|---|---|---|
| POST /upload | ✅ Works | Cloudinary configured |
| POST /analyze | ❌ Broken | Calls Python AI server — `PYTHON_AI_SERVER_URL` missing from backend env |
| GET /latest | ✅ Works | |
| GET / | ✅ Works | |
| GET /:id | ✅ Works | |
| GET /:id/view | ✅ Works | |
| GET /:id/download | ✅ Works | |
| DELETE /:id | ❌ Broken | TODO — not implemented |

### `/api/payment`
| Endpoint | Status | Notes |
|---|---|---|
| POST /create-checkout-session | ✅ Works | Stripe test keys configured |
| POST /create-portal-session | ✅ Works | |
| GET /subscription | ✅ Works | |
| POST /cancel-subscription | ✅ Works | |
| POST /webhook | ⚠️ Partial | Webhook secret configured but Price IDs are fake strings |
| GET /verify-session/:id | ✅ Works | |
| GET /plans | ✅ Works | |
| GET /history | ✅ Works | |

### `/api/code`
| Endpoint | Status | Notes |
|---|---|---|
| POST /execute | ✅ Works | Piston API configured |
| POST /execute-tests | ✅ Works | |
| POST /interview/:id/submit | ✅ Works | |
| GET /languages | ✅ Works | |
| GET /health | ⚠️ Depends | Works if Piston public API is reachable |

### `/api/practice`
| Endpoint | Status | Notes |
|---|---|---|
| POST /questions | ✅ Works | Gemini configured |
| POST /response | ✅ Works | |
| GET /session/:id | ✅ Works | |
| POST /session/:id/end | ✅ Works | |
| GET /history | ❌ Critical | In-memory Map — lost on server restart |

### `/api/scheduling`
| Endpoint | Status | Notes |
|---|---|---|
| POST /schedule | ✅ Works | |
| GET /scheduled | ✅ Works | |
| PUT /:id/reschedule | ✅ Works | |
| DELETE /:id | ✅ Works | |
| GET /upcoming | ✅ Works | |
| POST /:id/send-reminder | ❌ Broken | Marks sent but no email sent (TODO) |

### `/api/admin`
| Endpoint | Status | Notes |
|---|---|---|
| GET /stats | ✅ Works | |
| GET /users | ✅ Works | |
| PUT/DELETE /users/:id | ✅ Works | |
| GET /system-metrics | ✅ Works | |
| GET /error-logs | ❌ Broken | Hardcoded mock entries |
| GET /ai-metrics | ❌ Broken | Hardcoded mock values |
| GET /export/* | ✅ Works | |

---

## 3. Services — Updated Status

### Gemini (Node.js backend)
- **Status: Works** — API key configured, `gemini-2.5-flash` model set.
- Fallback to hardcoded questions still exists if API fails.

### Stripe
- **Status: Partially Works** — Test keys configured, checkout/portal/webhooks work.
- **Issue:** `STRIPE_PRO_PRICE_ID` and `STRIPE_ENTERPRISE_PRICE_ID` are fake strings (`price_pro_monthly`) — not real Stripe Price IDs from the dashboard. The service falls back to creating ad-hoc prices dynamically.

### Cloudinary
- **Status: Works** — Credentials configured.

### Email (Gmail SMTP)
- **Status: Works** — Gmail app password configured. Verification, reset, welcome, receipt emails will send.

### Redis
- **Status: Optional / May Fail** — `REDIS_URL=redis://localhost:6379`. Works only if Redis is running locally. In Docker Compose it would need to be `redis://redis:6379`.

### Python AI Server
- **Status: Unreachable from backend** — `PYTHON_AI_SERVER_URL` and `PYTHON_AI_SERVER_API_KEY` are defined in `frontend/.env`, not `backend/.env`. Backend will call `http://undefined/...` and fail on every AI server request.
- The AI server itself will start fine (its own `.env` is correct).

### Socket.io (video/audio analysis)
- **Status: Still mocked** — Hardcoded mock data regardless of env config.

### WebRTC
- **Status: Still broken** — `WEBRTC_STUN_SERVER` is in `frontend/.env` but not read by any code. No TURN server configured.

### Code Execution (Piston)
- **Status: Works** — Public Piston API configured. No API key needed.

---

## 4. AI Server (Python) — Updated Status

### Gemini Service
- **Status: Works** — API key configured in `ai-server/.env`.

### Audio Analysis
- **Status: Works internally** — But unreachable from backend (wrong env file placement).

### Video Analysis
- **Status: Partially Works internally** — Eye contact and posture for full video still use `np.random.uniform()` placeholders.
- Unreachable from backend.

### Emotion Detection
- **Status: Partially Works internally** — DeepFace optional; fallback uses brightness heuristics.
- Unreachable from backend.

### Speech Recognition
- **Status: Degraded** — Whisper disabled. Google SR fallback works but rate-limited.
- Unreachable from backend.

### Resume Parser
- **Status: Works internally** — Real PyPDF2/docx parsing.
- **Unreachable from backend** due to missing env vars in `backend/.env`.

---

## 5. Unused API Keys in frontend/.env

These keys are defined but **not used anywhere in the codebase**:

| Key | Service | Status |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI GPT | Defined, never imported or called |
| `ASSEMBLYAI_API_KEY` | AssemblyAI STT | Defined, never imported or called |
| `DEEPGRAM_API_KEY` | Deepgram STT | Defined, never imported or called |
| `WHISPER_API_KEY` | OpenAI Whisper | Defined, never imported or called |
| `HUGGINGFACE_API_KEY` | HuggingFace | Defined, never imported or called |
| `ANALYTICS_API_KEY` | PostHog | Defined, never imported or called |
| `SENTRY_DSN` | Sentry | Placeholder value, never imported |
| `AWS_*` | S3 storage | Placeholder values, never used |
| `AVATAR_MODEL_URL` | Ready Player Me | Defined, AIAvatar component not wired to it |
| `WEBRTC_STUN_SERVER` | Google STUN | Defined in env, not read by WebRTC code |
| `WEBRTC_TURN_SERVER` | TURN | Placeholder value |

---

## 6. Critical Issues — Updated Priority

### CRITICAL — Breaks Core Functionality Right Now

| # | Issue | Root Cause |
|---|---|---|
| 1 | **Resume parsing broken** | `PYTHON_AI_SERVER_URL` missing from `backend/.env` — must be moved from `frontend/.env` |
| 2 | **All AI server endpoints unreachable** | Same — backend calls `http://undefined/...` |
| 3 | **Real-time video/audio analysis mocked** | Socket handlers hardcoded — Python server never called even if URL was set |
| 4 | **Interview recording never stored** | No upload logic for webcam video/audio |
| 5 | **OTP verification fake** | Returns mock success — no real OTP logic |
| 6 | **PDF report generation missing** | Placeholder URL returned; `window.print()` only |
| 7 | **Practice history lost on restart** | In-memory Map, not persisted to MongoDB |
| 8 | **Scheduling emails not sent** | All email calls in scheduling routes have TODO comments |
| 9 | **Resume deletion not implemented** | TODO in route handler |

### HIGH — Hardcoded / Mock Data

| # | Issue |
|---|---|
| 10 | Admin AI metrics — hardcoded numbers (accuracy: 94, satisfaction: 92) |
| 11 | Admin error logs — 2 fake hardcoded entries |
| 12 | Video eye contact score — `np.random.uniform(60, 85)` in Python |
| 13 | Video posture score — `np.random.uniform(70, 90)` in Python |
| 14 | Per-frame eye contact — `np.random.uniform(60, 90)` |
| 15 | Per-frame posture — `np.random.uniform(70, 95)` |
| 16 | Fallback interview questions — same 10 hardcoded questions for all users when Gemini fails |
| 17 | Socket video-frame response — `{happy: 0.7, confident: 0.8, nervous: 0.2}` hardcoded |
| 18 | Socket audio-chunk response — `{speechRate: 150, fillerWords: ['um','uh']}` hardcoded |

### MEDIUM — Incomplete / Misconfigured

| # | Issue |
|---|---|
| 19 | Stripe Price IDs are fake strings — not real IDs from Stripe dashboard |
| 20 | Redis URL points to localhost — fails in Docker (should be `redis://redis:6379`) |
| 21 | STUN server defined in frontend env but not read by any WebRTC code |
| 22 | No TURN server — WebRTC peer connections will fail on most real networks |
| 23 | Whisper disabled in Python — primary STT unavailable |
| 24 | Coding questions from Gemini missing `testCases`/`examples`/`constraints` fields |
| 25 | Java/C++ test case wrapping broken in code execution |
| 26 | Dashboard `upcomingInterviews` always empty |
| 27 | `feedbackData.improvement` always 0 |
| 28 | ATS score is a heuristic formula, not real ATS simulation |

---

## 7. The One Fix That Unlocks the Most

Adding these two lines to `backend/.env` would immediately fix resume parsing and enable all AI server routes:

```
PYTHON_AI_SERVER_URL=http://localhost:8000
PYTHON_AI_SERVER_API_KEY=smart-interview-ai-python-server-key-2024
```

(These values already exist in `frontend/.env` — they just need to be in `backend/.env`.)

---

## 8. What Works Right Now (with current .env)

| Feature | Works? |
|---|---|
| User registration + login | ✅ |
| Email verification / password reset | ✅ (Gmail configured) |
| Interview creation with AI questions | ✅ (Gemini configured) |
| Interview session (text answers) | ✅ |
| Response AI analysis | ✅ |
| Feedback generation | ✅ |
| Resume upload to Cloudinary | ✅ |
| Resume parsing (Python AI server) | ❌ (missing backend env vars) |
| Stripe payments | ✅ (test mode) |
| Code execution | ✅ (Piston) |
| Dashboard stats | ✅ |
| Interview history | ✅ |
| Admin panel (CRUD) | ✅ |
| Real-time video/audio analysis | ❌ (hardcoded mock) |
| WebRTC peer video | ❌ (no TURN server) |
| Recording storage | ❌ (not implemented) |
| PDF export | ❌ (window.print only) |
| Practice history persistence | ❌ (in-memory) |
| Scheduling emails | ❌ (TODO) |
