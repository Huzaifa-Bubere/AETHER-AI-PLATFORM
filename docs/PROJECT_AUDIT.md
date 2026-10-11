# AETHER — PROJECT AUDIT

Adaptive Explainable Transformer Framework for AI-Based Skill Assessment, Career Intelligence and Personalized Recommendations.

| Field | Value |
| --- | --- |
| Audit date | 2026-10-06 |
| Branch | `ather-rag-refactor` |
| Remote | `git@github-huzaifa:Huzaifa-Bubere/AI_Placement_Trainning.git` |
| Local tree | Authoritative (GitHub `main` is NOT used as truth) |
| Head commit | `710ef6f Job Provider Service` |
| Backend test suites | 35 (419 tests) |
| Detected test files | 78 |

> **Repository-name discrepancy (not changed).** The brief names the repository
> `Huzaifa-Bubere/AETHER-AI-PLATFORM`. The configured `origin` is
> `Huzaifa-Bubere/AI_Placement_Trainning.git`. Renaming a remote is a
> publishing action and was deliberately **not** performed. Flagged for a
> human decision.

---

## 1. Baseline working tree

`git status` at audit time:

- **Modified (tracked):** `CURRENT_ARCHITECTURE.md`, `RAG.md`, `REFACTOR_PLAN.md`,
  `implementation_plan.md`, `docker-compose.yml`
- **Untracked (docs/reports):** `AETHER_PROJECT_RUN_GUIDE.md`,
  `AUDIT_2026-09-13.md`, `CONTINUATION_VERIFICATION.md`, `GAP_ANALYSIS.md`,
  `TESTING_GUIDE.md`, `UPGRADE_REPORT_2026-09-24.md`, `UPGRADE_REPORT_2026-09-27.md`,
  `audit/*.patch`, `audit/*.md`, `testing/*.md`, `major project.pptx`, `Poster.png`,
  `SEM 7 POSTER.pdf`
- **Untracked (code):** `backend/scripts/devMemoryMongo.js` (local test helper)

The Stage 1/2/3 Job Search / Job Fit / Career work **is committed** (commits
`60944df Job Fuctionality Added`, `710ef6f Job Provider Service`), so the tree is
not carrying uncommitted feature code. No work was discarded.

The previously-reported "saved-state runtime block" (Stage-3 §40) was resolved in
`backend/scripts/jobsRuntimeE2E.js`, which now passes **34/34** checks against an
ephemeral MongoDB.

## 2. Architecture (as built)

```
Browser (React + Vite + TS)
        │  REST / WS
Node.js / Express  ── gateway, all protected business logic
   ├── MongoDB (Mongoose)
   ├── Redis (cache / sockets / locks)
   ├── FastAPI ai-server  ── media analysis, speech, resume parse, Gemini
   └── FastAPI job-provider-service ── OPTIONAL JobSpy sources (off by default)
        │
   External: Gemini, Cloudinary, Stripe, YouTube Data API,
             Adzuna, RemoteOK, JobSpy, Piston / Judge0 (code execution)
```

Secrets never reach the browser: the frontend only reads
`import.meta.env.VITE_API_BASE_URL`; **zero** `process.env` usage exists in
`frontend/src`.

## 3. Backend surface

Route files (29): `activity, adaptiveInterview, admin, analytics, aptitudeAdmin,
aptitudeStudent, auth, codeExecution, dashboard, feedback, health, interview,
payment, practice, profile, rag, resume, resumeBuilder, scheduling, subscription,
user` plus module routers for `career`, `coding`, `interview`, `jobs`.

Mount points (`backend/src/app.ts`), all behind Helmet + CORS + rate limiters:

| Prefix | Guard |
| --- | --- |
| `/api/auth` | auth limiter |
| `/api/user`, `/api/resume`, `/api/profile`, `/api/dashboard`, `/api/analytics` | JWT + candidate |
| `/api/interview`, `/api/adaptive-interview` | JWT + candidate + assessment limiter |
| `/api/admin`, `/api/admin/coding`, `/api/admin/careers`, `/api/admin/aptitude`, `/api/admin/rag` | JWT + admin |
| `/api/coding`, `/api/practice`, `/api/aptitude`, `/api/jobs`, `/api/careers`, `/api/activity` | JWT + candidate |
| `/api/payment`, `/api/subscription` | JWT |
| `/api/health` | public |

**Duplicated mount prefixes (intentional sub-routers, verify in Phase 7):**
`/api/resume` (resumeRoutes + resumeBuilderRoutes), `/api/interview`
(interviewRoutes + interviewMediaRoutes), `/api/careers` (careerRoutes +
roleProgressRoutes), `/api/jobs` (self-contained jobs router).

**Two interview surfaces exist:**
- **Canonical (frontend `/interview`)** → `/api/adaptive-interview` →
  `adaptiveInterview.service.ts`, models `AdaptiveInterview`.
- **Legacy** → `/api/interview` → `routes/interview.ts` (+ `routes/feedback.ts`),
  model `Interview`. This legacy surface still drives the Python emotion
  endpoint and an `emotionAnalysis` chart. **Consolidation decision required
  (see §9, and Phase 7).**

## 4. Data models (37)

`career/`: CareerRole, Course, LearningTopic, LearningVideo, market,
RoadmapProgress, Skill, TopicProgress, UserCareerGoal, UserSkillProfile.
`coding/`: CodingProblem, CodingProgress, CodingSubmission.
`jobs/`: JobAlert, JobFitAnalysis, JobPosting, JobSearchPreference,
RoleMarketSnapshot, SavedJob, SavedJobSearch.
`models/`: AdaptiveInterview, AptitudeAttempt, AptitudeQuestion, AptitudeTest,
IntegrityEvent, Interview, Payment, PracticeSession, RagChunk, RagSource, Resume,
ResumeVersion, Subscription, UsageLedger, User, UserActivityEvent.

`UserCareerGoal` has **10 runtime callers** (career + jobs services) — it is
**live**, not legacy.

## 5. Frontend surface

40 page components under `frontend/src/app/pages` (+ `features/coding/pages`).
`App.tsx` already implements: a shared Header + ApplicationSidebar shell, a
`PageErrorBoundary`, lazy loading for every heavy route, protected/public/admin
route wrappers, `from`-aware login redirects, admin→`/admin` and
candidate→`/dashboard` home resolution, and legacy→canonical redirects
(`/resume`→`/resume-analyzer`, `/ai-interview*`→`/interview*`).

Canonical routes present: `/welcome`, `/login`, `/signup`, `/forgot-password`,
`/reset-password`, `/verify-email`, `/admin/login`, `/onboarding`, `/dashboard`,
`/profile`, `/analytics`, `/subscription`, `/payment/success`,
`/resume-analyzer`, `/resume-builder`, `/history`, `/settings`,
`/interview-setup`, `/interview`, `/interview/:sessionId`,
`/interview/:sessionId/report`, `/interview-room`, `/coding`,
`/coding/problems`, `/coding/problems/:slug`, `/coding/submissions`,
`/coding/submissions/:id`, `/feedback/:id`, `/career-learning(+topic/role/course)`,
`/career-intelligence(+:roleSlug)`, `/aptitude`, `/technical`,
`/aptitude/attempts/:attemptId(+result)`, `/jobs`, `/jobs/:jobId`, `/saved-jobs`,
`/job-fit`, `/admin`, `/admin/aptitude(+questions/tests/students)`,
`/admin/knowledge`, `/admin/coding`, `/admin/careers`,
`/admin/learning-content`, `/admin/billing`.

## 6. Environment variables (source-verified)

- **Backend (63):** MONGODB_URI/MONGO_URI, JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET(+EXPIRES_IN), PORT, NODE_ENV, FRONTEND_URL, BACKEND_URL,
  REDIS_URL, PYTHON_AI_SERVER_URL, PYTHON_AI_SERVER_API_KEY, GEMINI_API_KEY,
  GEMINI_MODEL, GEMINI_EMBEDDING_MODEL, CLOUDINARY_*, EMAIL_* ,
  STRIPE_* (5), YOUTUBE_API_KEY, YOUTUBE_REFRESH_DAYS, ADZUNA_APP_ID/KEY,
  ADZUNA_COUNTRY, REMOTEOK_ENABLED, JOBSPY_ENABLED/SERVICE_URL/SOURCES/
  RESULTS_PER_SOURCE/TIMEOUT?, JOB_REFRESH_INTERVAL_MINUTES,
  JOB_PROVIDER_TIMEOUT_MS, JOB_ALERT_MIN_RELEVANCE,
  CODE_EXECUTION_SERVICE, PISTON_URL, JUDGE0_*, ALLOW_UNSAFE_LOCAL_CODE_EXECUTION,
  ALLOW_MANUAL_PLAN_ACTIVATION, RAG_* (4), QUESTION_REPEAT_COOLDOWN_DAYS,
  INTERVIEW_MAX_FOLLOW_UPS, COMPLEXITY_CONFIDENCE_THRESHOLD, TRACE_*, MAX_FILE_SIZE,
  SUPPORTED_FILE_TYPES, DNS_SERVERS, JAVA_HOME, SEED_MONGODB_URI,
  SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD.
- **ai-server (7):** ENVIRONMENT, PORT, FRONTEND_URL, BACKEND_URL,
  GEMINI_API_KEY, GEMINI_MODEL, PYTHON_AI_SERVER_API_KEY.
- **frontend (1):** VITE_API_BASE_URL.

## 7. Docker services

| Service | Port | Build context |
| --- | --- | --- |
| frontend | 5174:80 | `./frontend` |
| backend | 5001:5001 | `./backend` |
| job-provider-service | 8010:8010 | `./job-provider-service` |
| ai-server | 8000:8000 | `./ai-server` |
| mongodb | 27017:27017 | `mongo:7.0` (+ `scripts/mongo-init.js`) |
| redis | 6379:6379 | `redis:7.2-alpine` |
| nginx | 80:80 | `./nginx` (profile `production`) |

## 8. Tests

35 backend Jest suites / 419 tests (all green). Highlights relevant to the brief:
`auth`, `authorization`, `auth-regressions`, `browser-auth`, `startup`,
`features`, `streak`, `skill-evidence`, `role-progress`, `jobProviders`,
`jobRecommendation`, `jobMarket`, `jobs`, `career`, `coding-ast`,
`coding-complexity`, `interview-lifecycle`, `interview-generation`,
`adaptive-interview`, `aptitude-*`, `rag-*`, `analytics-real-data`,
`resume-builder`, `question-quality`, `socket-auth`. No ai-server pytest suite
exists (only a `.venv`). No CI workflow exists.

## 9. Verification status (what was actually executed)

| Check | Command | Result |
| --- | --- | --- |
| Backend build | `npm run build` (tsc) | **PASS** |
| Backend tests | `npm test` | **PASS** — 419/419, 34 suites (2 skipped suites) |
| Frontend typecheck | `npx tsc --noEmit` (`npm run typecheck`) | **PASS** |
| Frontend build | `npm run build` | **PASS** (chunk-size warnings only) |
| ai-server compile | `python -m compileall src` | **PASS** |
| job-provider-service compile | `python -m compileall app` | **PASS** |
| Live provider smoke | `npm run jobs:smoke` | **PASS** — RemoteOK 10/10 storable; Adzuna NOT CONFIGURED; JobSpy DISABLED |
| Jobs runtime E2E | `node scripts/jobsRuntimeE2E.js` | **PASS** — 34/34 (ephemeral Mongo) |
| Docker stack | `docker compose up -d` + health URLs | **PASS** — frontend 200, backend `/api/health` OK, ai-server running, job-provider-service DISABLED-by-design |
| Browser/route matrix | — | **NOT TESTED** (no browser tooling in this environment) |

## 10. Findings by classification

### WORKING
Job Search + Job Fit (provider adapters, dedupe fingerprints, ranking, alerts,
market analytics, saved/application tracker); Career Learning/Intelligence
(DB-backed); Coding (AST + complexity + submissions); Aptitude + Technical MCQ
(admin + student flows); RAG (chunk/retrieval/validation); Auth + JWT + refresh +
role separation; Streak; Analytics-from-DB; Docker stack; the shared app shell &
route guards.

### PARTIAL
- **Two interview products** (canonical `/interview` ↔ legacy `/api/interview`).
- **Resume** mounted at one prefix from two routers.
- Docs fragmented across 18 root Markdown files; no `docs/`.
- Provider status for Jobs exists; a general *system capability* page (§40) does
  not.

### MISSING
- `docs/` (ARCHITECTURE, RUN_GUIDE, API_KEYS, TESTING, FEATURE_STATUS, CLEANUP,
  FINAL_ENGINEERING_REPORT).
- `.env.example` for root, `backend/`, `frontend/`, `ai-server/`
  (only `job-provider-service/.env.example` exists).
- `LICENSE`, `docs/`, `.github/workflows` (CI).
- Browser E2E automation (Playwright/Cypress) — `testing/` holds only manual
  Markdown checklists.
- ai-server pytest suite.

### DUPLICATE
- UI primitives: `components/Button.tsx|Card.tsx|Input.tsx` vs
  `components/ui/button.tsx|card.tsx|input.tsx`. Legacy trio is imported by
  exactly 3 pages (`LoginPage`, `SignupPage`, `KnowledgeSourcesPage`).
- Chart libraries shipped twice (`chart.js` + `react-chartjs-2` **and**
  `recharts`) — only `recharts` is imported.
- Frontend `framer-motion` **and** `motion`.
- Overlapping root reports (`AUDIT_2026-09-13`, `CODEBASE_AUDIT`,
  `CONTINUATION_VERIFICATION`, `DEPLOYMENT_READINESS`, `FEATURE_STATUS_REPORT`,
  `GAP_ANALYSIS`, `UPGRADE_REPORT_*`, `TESTING_GUIDE`, `INTEGRATION`,
  `INTERVIEW_FLOW_REPORT`).

### LEGACY
- `/api/interview` + `routes/feedback.ts` (legacy interview surface, still
  reachable and still the only consumer of emotion analysis).
- `aptitude-module/` (standalone older copy — usage unproven).
- `audit/*.patch` (historical patch series).
- Root `package-lock.json` with **no** root `package.json` (stub, 101 bytes).

### UNUSED (frontend deps with zero `frontend/src` references)
`@auth0/auth0-react`, `@auth0/auth0-spa-js`, `@mui/material`,
`@mui/icons-material`, `chart.js`, `react-chartjs-2`, `react-query`,
`@tanstack/react-query`, `react-dnd`, `react-dnd-html5-backend`, `react-slick`,
`simple-peer`, `react-responsive-masonry`, `react-popper`, `@emotion/react`,
`@emotion/styled` (+ verify `dotenv`, `next-themes`, `vaul`, `cmdk`, `input-otp`,
`sonner`, `react-day-picker`, `embla-carousel-react`). **Removal deferred until
re-verified in Phase 13 after a clean `npm ci` + build.**

### UNVERIFIED (runtime)
Browser route matrix; responsive breakpoints; accessibility; subscription/Stripe
checkout (no keys); YOUTUBE recommendations (no key); Cloudinary uploads (no
keys); Judge0/Piston live execution; admin CRUD end-to-end through the UI;
fresh-clone reproduction.

## 11. Branding

**AETHER is canonical** (209 files). **ATHER** is a stale variant in 21 files
including `README.md`, `ai-server/src/main.py`, `ai-server/src/__init__.py`,
`backend/src/app.ts` (API name), `backend/src/services/email.ts` (all email
copy), `backend/src/routes/feedback.ts`, `backend/src/routes/scheduling.ts`,
`frontend/index.html`, `LoginPage/SignupPage/ForgotPasswordPage/
ResetPasswordPage/PaymentSuccessPage/AdminLoginPage/KnowledgeSourcesPage`,
`frontend/src/app/types/index.ts`, `backend/src/services/rag/documents.ts`
(User-Agent), and root reports. No old "Smart Interview AI" string remains.

## 12. Data honesty

- No `faker`/`mockStats`/`fakeData`/"random score" anywhere in `frontend/src` or
  `backend/src`.
- Every `Math.random()` is an **ID nonce** (`Date.now()` + suffix) for session,
  attempt, question and upload keys — not a displayed metric.
- Jobs path explicitly refuses fabricated salary/dates, and market analytics
  reports `sampleSize` and refuses "trending" without historical snapshots.
- Job Fit explicitly refuses hiring-probability language and returns `null`
  components rather than 0 for missing evidence.
- **Must still audit in Phase 11:** Dashboard/Analytics/Admin charts and the
  landing page for hardcoded series, testimonials, placement counts or ratings.

## 13. Security

**Good:** `.env` is not tracked and is gitignored (root, backend, frontend,
ai-server); no live secrets found in tracked files (`sk_live_…`, `AIza…`,
`AKIA…` appear only as placeholders in docs); JWT access/refresh separated;
candidate vs admin guards; rate limiters; Helmet; mongo-sanitize; URL validation
for job sources; no `process.env` in frontend.

**To fix:**
- Dev defaults `Admin@12345` (`seedAdmin.ts`, `seedDefaultQuestions.ts`) and
  `password123` (`docker-compose.yml` MONGO_INITDB_ROOT_PASSWORD) must be
  documented as LOCAL-ONLY and discouraged, and `ALLOW_UNSAFE_LOCAL_CODE_EXECUTION`
  should default `false`.
- Confirm no verbose config logging in `backend/src/utils/logger.ts`.

## 14. TODO / FIXME (source)

| File | Note |
| --- | --- |
| `backend/src/routes/feedback.ts:370,432,1316` | PDF generation not implemented |
| `backend/src/routes/interview.ts:905` | legacy audio processing to Python placeholder |
| `backend/src/routes/interview.ts:103` | experience level hardcoded in legacy path |
| `backend/src/routes/user.ts:410` | account deletion does not cascade related data |

## 15. Obsolete / non-source files to review in Phase 1

`build.log` (36 KB, Aug 2), `logs/` (gitignored), `temp/` (scratch audit
snapshots + `frontend-npm-audit.json`, gitignored), `Report/` (LaTeX chapters —
**academic, keep**), `Poster.png` / `SEM 7 POSTER.pdf` / `major project.pptx`
(academic assets — keep or move to `docs/academic-report/`), `aptitude-module/`
(prove unused), `audit/` (archive), root `package-lock.json` (delete after
proving nothing consumes it).

---

*This audit reflects the local working tree at 2026-10-06 and the checks actually
executed (see §9). Nothing in this document is reported as PASS without a
command behind it.*
