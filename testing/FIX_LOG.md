# AETHER Feature Repair & UX Stabilization — FIX_LOG

Status legend: **PASS** = verified by running the artifact through the interface the user
uses · **FAIL** · **NOT TESTED** · **BLOCKED** · **NOT CONFIGURED**

Verification commands used (all rerun after the final edits):

| Check | Command | Exit | Result |
| --- | --- | --- | --- |
| Backend build | `cd backend && npm run build` | 0 | PASS |
| Backend tests | `cd backend && npm test` | 0 | PASS — 37 suites / 418 tests passed, 3 suites + 16 tests skipped (pre-existing), 0 failures |
| Frontend typecheck | `cd frontend && npm run typecheck` | 0 | PASS |
| Frontend build | `cd frontend && npm run build` | 0 | PASS — real production bundle (`jsxDEV` = 0, entry chunk 252 kB) |
| AI server compile | `cd ai-server && python -m compileall src` | 0 | PASS |
| Built app over HTTP | `vite preview` → `curl /`, `/assets/index-*.js`, `/jobs` | 200/200/200 | PASS (SPA + deep link + lazy chunks) |

---

## 0. Cross-cutting BUG found while verifying the build — `npm run build` silently shipped a DEVELOPMENT bundle

- **BUG**: `cd frontend && npm run build` exited 0 but emitted a *development* bundle.
  Measured on the entry chunk: `jsxDEV` runtime present in 966 places, dev-only
  diagnostics retained, chunk **463,107 B** vs **252,493 B** for a true production build.
- **ROOT CAUSE**: `frontend/.env` contained `NODE_ENV=development`. Vite loads `NODE_ENV`
  from `.env` and derives `config.isProduction = process.env.NODE_ENV === 'production'`,
  which `@vitejs/plugin-react` uses to choose the dev JSX runtime and to add
  `jsx-self`/`jsx-source`. Proven from the installed sources
  (`vite@6.4.3`, chunk `dep-Dm0c1Wj2.js:49059-49070`) and by measurement:
  `NODE_ENV=production vite build` → `jsxDEV` = 0; `vite build --mode production` → still 966.
  Assigning `process.env.NODE_ENV` inside `vite.config.ts` does **not** work: Vite captures
  `isNodeEnvSet` before the config file is evaluated and then re-applies the `.env` value
  after it (so the config-level guard was measured to have no effect and was reverted).
- **FILES**: `frontend/package.json`, `frontend/scripts/build.mjs` (new), `frontend/.env`,
  `frontend/.env.example` (guidance), `frontend/vite.config.ts` (reverted to original).
- **FIX**: `build` now runs `node scripts/build.mjs`, which pins `NODE_ENV=production` in the
  process **before** Vite starts (Vite then reports `isNodeEnvSet = true` and cannot be
  overridden by any `.env`), then calls Vite's programmatic `build()`. The stale
  `NODE_ENV=development` line was removed from `frontend/.env` and replaced with a warning
  comment. This follows the repo's existing `frontend/scripts/*.mjs` convention.
- **TEST**: `python -c "...count('jsxDEV')"` over `dist/assets/index-*.js` after each build.
- **RESULT**: **PASS** — `npm run build` exit 0 with `jsxDEV` = 0, dev-only block absent,
  entry chunk 252 kB (−45%). Served via `vite preview`: `/` 200, entry JS 200 (252,543 B),
  CSS 200, `/jobs` deep link 200 with lazy route chunks resolving (Dashboard, Profile,
  Subscription, Analytics, Onboarding).

---

## 1. Resume Analyzer

- **BUG**: "Resume parsed. AI content feedback is temporarily unavailable. / AI Content
  Review: Unavailable"; skills rendered as one run-on string
  (`pythonjavajavascripttypescript…`) with category headings mixed into the list; the JD
  "missing" list was computed backwards.
- **ROOT CAUSE**: (a) one monolithic pipeline stage, so an AI (Gemini) failure marked the
  whole analysis unavailable and left the page empty; (b) skill strings were concatenated
  without canonicalization or category separation; (c) the JD gap was computed client-side as
  "resume skills not present in the JD" — the reverse of the requirement.
- **FILES**: `frontend/src/app/pages/ResumeAnalyzerPage.tsx`, `backend/src/routes/resume.ts`,
  `backend/src/services/resumeProcessing.ts`, `backend/src/services/resumeSkills.ts`,
  `backend/src/services/resumeJobMatch.service.ts`, `backend/src/services/atsEngine.ts`.
- **FIX**:
  - Explicit independent stages/statuses: `parseStatus`, `deterministicAnalysisStatus`,
    `aiReviewStatus` ∈ {`COMPLETED`, `UNAVAILABLE`, `NOT_REQUESTED`} (`StagePill` in the page).
  - Deterministic fallback: Resume Quality, ATS Parsability, Section Completeness, Experience,
    Projects, Skills organization, Education, bullet quality, quantification, readability —
    computed from the existing ATS engine, with documented component weights. Gemini never
    invents the numeric score; when it fails the page shows a compact amber
    "AI wording review temporarily unavailable… [Retry AI Review]" state and never a 0 AI score.
  - Canonical server-side skill normalization + case-insensitive dedup with skills returned as
    `{ slug, label, category }` (backwards compatible with legacy string arrays).
  - Server-side JD matching: `POST /api/resume/:id/job-match` → `{ score, requiredSkills,
    preferredSkills, matchedSkills, missingSkills, components, suggestions }`, reusing the
    Job Fit extraction logic instead of a second JD parser. Role gap (CareerRole requirements)
    and Job gap (pasted JD requirements) are reported as separate concepts.
- **TEST**: `backend/tests/resume-skills.test.js` (normalization/dedup, incl. the `cpp` vs `c++`
  canonical-slug bug the test caught), `backend/tests/resume-job-match.test.js` (required vs
  preferred, matched vs not-evidenced, no unrelated resume skills reported as missing).
- **RESULT**: **PASS** for bank/normalization/match logic (unit + integration).
  **NOT TESTED**: live Gemini unavailability and live PDF/DOCX parse against a real upload
  (no AI key / browser in this environment).

---

## 2. Aptitude question shortage

- **BUG (runtime)**: `Insufficient medium questions for this test: need 5, found 3 distinct
  questions outside your 30-day recent history.`
- **ROOT CAUSE**: the seeded bank held only 5 questions per level, while the selector excludes
  every question the candidate saw in the last 30 days — not enough distinct questions for
  repeated attempts.
- **FILES**: `backend/src/scripts/seedQuestionData.ts`, `backend/src/scripts/seedDefaultQuestions.ts`,
  `backend/src/services/questionSelector.service.ts`, `backend/src/services/aptitudeAvailability.service.ts`.
- **FIX**: expanded the validated seed bank to **146** questions with 0 normalized-statement
  duplicates, plus unique `id`s; publish-time validation (`requireAvailableQuestions`) reports
  `difficulty: need N, available M` so a test cannot be published that its distribution cannot
  satisfy.
- **Counts — before → after** (measured from the built seed data):

  | Round | easy | medium | hard |
  | --- | --- | --- | --- |
  | Aptitude | 5 → **30** | 5 → **40** | 5 → **24** |
  | Technical | 5 → **16** | 5 → **22** | 5 → **14** |

  Total 30 → **146**; duplicate fingerprints (normalized statement) = **0**.
  The published aptitude test queries `category: { $in: [quantitative-aptitude,
  logical-reasoning, verbal-ability, puzzle-solving] }`, so the medium pool is the full 40.
- **TEST**: `backend/tests/aptitude-question-bank.test.js` (per-level depth, valid single-answer
  MCQ with explanation, unique ids), `backend/tests/aptitude-repeat-attempts.test.js` (new —
  drives the real `buildQuestionSet` against the real seeded medium bank: **8 consecutive
  starts of the shipped 5-medium test return 5 distinct questions each, 40/40 questions served
  with no repeat inside the cooldown**, and the 9th start fails with the honest shortfall
  message instead of silently reusing questions).
- **RESULT**: **PASS** (unit/integration — the exact error string is asserted).
  **NOT TESTED**: seeded bank in a live MongoDB + Cloudinary image upload (needs
  `MONGODB_URI`/Cloudinary credentials).
  **Known limitation**: the spec's aspirational "40 distinct per level" is met for aptitude
  medium only; other levels hold 14–30 (still ≥ 2× the 5 required, i.e. multiple attempts
  inside the cooldown).

---

## 3. Coding post-submission analysis UI

- **BUG**: after submitting, AST/Visualize analysis appeared in a small corner panel, partly
  hidden under the navbar.
- **ROOT CAUSE**: the result surface was rendered inside the workspace layout (below the
  sticky controls) instead of above the app chrome, with no scroll containment.
- **FILES**: `frontend/src/app/features/coding/components/SubmissionAnalysisModal.tsx` (new),
  `frontend/src/app/features/coding/pages/ProblemWorkspacePage.tsx`.
- **FIX**: submission opens a centered modal (`fixed inset-0 z-[140]`, `role="dialog"`,
  `aria-modal`) — above the header (`z-50`), sidebar, Monaco and sticky controls — sized
  `min(1200px, 92vw)` / `max-h-[88vh]` with internal scrolling; full-screen sheet on mobile.
  Tabs (Overview, Test Cases, AST Analysis, Visualize, Complexity, Optimization,
  AI Explanation) are rendered only when their data exists; AST renders the tree full-width
  with an explicit empty state; Visualize reuses `ExecutionVisualizer` with its own
  "Visualization unavailable for this submission" fallback instead of crashing the modal.
- **TEST**: relies on existing `backend/tests/coding-ast.test.js` / `coding-complexity.test.js`
  for the analysis payloads; the modal is a pure presentation surface.
- **RESULT**: **PASS** for build/typecheck and z-index/scroll contract.
  **NOT TESTED**: real browser click-through of the modal (no Chrome available in this
  environment).

---

## 4. AI Mock Interview recording persistence/playback

- **BUG**: repeated `Recording not uploaded — your report is still available.`
- **ROOT CAUSE**: the report/navigation path ran before the recorder's final data had been
  collected, so a partial or zero-byte Blob was uploaded (or the upload was attempted after
  teardown).
- **FILES**: `frontend/src/app/components/interview/VideoRecorder.tsx`,
  `frontend/src/app/pages/AdaptiveInterviewRoomPage.tsx`, `frontend/src/app/pages/AdaptiveReportPage.tsx`,
  `frontend/src/store/adaptiveInterviewStore.ts`, `frontend/src/lib/adaptiveInterviewApi.ts`,
  `backend/src/routes/adaptiveInterview.routes.ts`, `backend/src/models/AdaptiveInterview.ts`,
  `frontend/src/app/pages/HistoryPage.tsx`.
- **FIX**: strict lifecycle — `getUserMedia` → `start()` → collect `dataavailable` → interview
  ends → `stop()` → **await the final `dataavailable`/`stop` event** → build Blob → validate
  `blob.size > 0` → upload → persist metadata → navigate. MIME type chosen via
  `MediaRecorder.isTypeSupported()` (`video/webm;codecs=vp8,opus` → `video/webm` → default).
  Bounded retry (max 3, 800 ms/1600 ms backoff) that retries only transient failures
  (network/timeout/5xx) and never retries a 4xx contract error. Recording is only started
  after explicit consent, and a declined consent produces no error in the report. Metadata
  persisted: storage type, url/local path, Cloudinary `publicId`, `mimeType`, `sizeBytes`,
  `durationSeconds`, `uploadedAt`. Local durable storage is kept, so a Cloudinary failure no
  longer discards a locally saved recording. `AdaptiveReportPage` has a prominent tab bar
  (Overview / Performance / Transcript / Recording) with an always-present recording panel;
  where recording is absent it shows an explanatory empty state, never an error.
- **TEST**: `backend/tests/adaptive-interview.test.js` for the session/report contract;
  owner-scoped streaming endpoint exercised by the existing authorization tests.
- **RESULT**: **PASS** for lifecycle/validation/retry/metadata code paths and API contracts.
  **NOT CONFIGURED**: Cloudinary (`CLOUDINARY_*` empty) — mirror path cannot be exercised.
  **NOT TESTED**: real 20 s Chrome recording, refresh playback, cross-user access (no browser).

---

## 5. Resume Builder crash (`Cannot read properties of undefined (reading 'length')`)

- **BUG**: `/resume-builder` → "This page could not load — Cannot read properties of undefined
  (reading 'length')".
- **ROOT CAUSE**: older/incomplete resume documents reached React without every array field
  present; components read `doc.experience.length` etc. directly.
- **FILES**: `frontend/src/app/features/resume/types.ts` (`normalizeResumeDocument`),
  `backend/src/models/ResumeVersion.ts` (schema array defaults + read-time normalization),
  `frontend/src/app/pages/ResumeBuilderPage.tsx`.
- **FIX**: one canonical `normalizeResumeDocument()` applied at the data boundary *before*
  render, filling structural defaults (`name/headline/email/phone/location/summary` → `''`,
  `experience/projects/education/skills/certifications/achievements/languages/customSections`
  → `[]`, `sectionOrder` → `DEFAULT_SECTION_ORDER`, `links` → `[]`). The Mongoose schema now
  declares `default: []` for every collection so new records are safe, and old records are
  normalized on read — no user text is ever overwritten and no user has to delete resumes.
- **TEST**: `backend/tests/resume-document-normalization.test.js` (new) — the spec §5D
  fixture `` { name: "Huzaifa" } `` loads with every collection `[]` (so `.length` is always
  safe), a partially populated legacy document keeps its user text while missing collections
  fill structurally, and the string fields default to `''`. The test caught a remaining gap:
  `doc.data` itself was `undefined` for a document created without `data`, so
  `data: { default: () => ({}) }` was added to the `ResumeVersion` schema (bounds the same
  class of crash at the subdocument level).
- **RESULT**: **PASS** — suite green, and the existing `resume-builder.test.js` still passes.

---

## 6. Jobs UI + null crash

- **BUG**: filters/list hidden under the navbar; `Cannot read properties of null (reading 'find')`.
- **ROOT CAUSE**: (a) the app shell never reserved the fixed header's height, so pages guessed
  their own `pt-16/pt-20/pt-24`; (b) the API boundary trusted backend JSON, so a `null`
  collection reached `Array.prototype.find`.
- **FILES**: `frontend/src/styles/custom.css` (`--app-header-height`), `frontend/src/app/App.tsx`,
  `frontend/src/app/services/jobs.ts`, `frontend/src/app/pages/JobsPage.tsx`,
  `frontend/src/app/components/jobs/JobCard.tsx`, `frontend/src/app/pages/JobDetailPage.tsx`.
- **FIX**: single source of truth for the offset — `:root { --app-header-height: 4rem }` and
  `.application-content { padding-top: var(--app-header-height) }` applied once on the app
  shell `<main>`; the marketing page opts out with `.no-header-offset`. All 24 ad-hoc
  `pt-16/pt-20/pt-24` guesses were removed (grep verified: none remain in `pages/`).
  Normalization at the API boundary: `normalizeJobListResponse`, `normalizeJobSummary`,
  `normalizeSavedJob`, `normalizeFitAnalysis`, `normalizeRoleGoals` coerce every collection to
  `[]` so nothing downstream can call `null.find`.
- **TEST**: `backend/tests/jobs.test.js`, `jobProviders.test.js`, `jobMarket.test.js`,
  `jobRecommendation.test.js` (server contract returns arrays, never `null`).
- **RESULT**: **PASS** for layout contract (verified in the built CSS/JS: header `h-16` fixed
  `z-50`, shell padding, no per-page hacks) and normalization.
  **NOT TESTED**: authenticated click-through of filters with live provider data.

---

## 7. Job Fit UI

- **ROOT CAUSE**: same null/array boundary as §6 plus missing optional analysis collections.
- **FILES**: `frontend/src/app/pages/JobFitPage.tsx`, `frontend/src/app/services/jobs.ts`,
  `frontend/src/app/features/resume/useResumeSkillGap.ts`.
- **FIX**: page renders the full flow (Job/JD input, Target Role, Resume Version, Analyze Fit →
  AETHER Job Requirement Match, Required/Preferred skills, Matched Evidence, Not Yet Evidenced,
  Score Breakdown, Recommended Resume, Learning Actions, Prepare for This Job) and every section
  degrades to an empty state when the role list, resume list, `components`, `requirements`,
  `matchedRequirements`, `missingRequirements` or `nextActions` are missing, or when the job was
  deleted/inactive.
- **TEST**: `backend/tests/resume-job-match.test.js` + `jobs.test.js`.
- **RESULT**: **PASS** (normalization + build); **NOT TESTED** in a live browser.

---

## 8. Saved Jobs UI

- **FILES**: `frontend/src/app/services/jobs.ts` (`normalizeSavedJob`), `frontend/src/app/pages/SavedJobsPage.tsx`.
- **FIX**: tolerates a populated job, an inactive job, a deleted job reference and a removed
  provider; when the referenced `JobPosting` no longer exists it renders
  "Job information unavailable" while keeping the tracker status/history intact.
- **TEST**: `backend/tests/jobs.test.js` (saved-job endpoints) + boundary normalizer.
- **RESULT**: **PASS** for normalization; **NOT TESTED** in a live browser.

---

## 9. History cleanup

- **BUG**: History still exposed legacy interview flows and "Start Interview".
- **ROOT CAUSE**: the page surfaced the legacy `/interview-setup` + `/interview-room` creation
  flow alongside the canonical adaptive interview history.
- **FILES**: `frontend/src/app/pages/HistoryPage.tsx`.
- **FIX**: History is read-only, canonical AI Mock Interview only (`adaptiveInterviewApi.getHistory`),
  showing role, domain, interview type, date, questions answered, score, readiness and
  recording availability with `[View Report]` and, when a recording exists,
  `[View Recording]` → report `?tab=recording`. Interview creation remains at `/interview`.
  Verified by grep: no "Start Interview" / "Resume Interview" / interview-room strings remain.
- **TEST**: `backend/tests/adaptive-interview.test.js` (history payload includes `hasRecording`).
- **RESULT**: **PASS**.

---

## 10-11. Welcome Page Jobs section + Pricing consistency

- **FILES**: `frontend/src/app/pages/LandingPage.tsx`,
  `frontend/src/app/components/landing/JobFitShowcase.tsx`,
  `frontend/src/app/components/landing/PricingSection.tsx`,
  `frontend/src/app/stores/subscriptionStore.ts`, `backend/src/config/plans.ts`,
  `backend/src/routes/subscription.ts`.
- **FIX**: a "Placement Intelligence" section (Job Search showcase + Job Fit showcase, both
  labelled *Illustrative Product Preview*, no fabricated employers) sits **before** the pricing
  section and documents the connected flow (Job → Job Fit → Skill Gap → Learning → Resume →
  AI Interview → Application). Pricing is **not** duplicated: both `/welcome` and
  `/subscription` read the same store (`useSubscriptionInit()` → `GET /subscription/plans-config`
  → `publicPlanConfig()` from `backend/src/config/plans.ts`).
- **TEST**: executed the real data contract the page consumes —
  `node -e "publicPlanConfig()"`:
  `free → "Free"` · `AETHER Pro → pricing {monthly:299, halfyear:1499, yearly:2499} → ₹299 /month`
  · `Campus → pricing "custom" → "Custom" / "Institutional pricing"` + CTA
  "Contact / Request Access". `/plans-config` is registered without `authenticateToken`, so the
  logged-out welcome page receives it.
- **RESULT**: **PASS** (single source of truth verified; values match `/subscription`, whose
  default interval is `monthly` → ₹299).
  **NOT TESTED**: visual rendering in a browser.
  **Known limitation**: if `/subscription/plans-config` fails at runtime, `PricingSection` shows
  placeholder skeletons rather than a stale hardcoded price — deliberate, since duplicating the
  price list in the frontend is what the spec forbids.

---

## 12. SVG / icon accessibility

- **FIX**: icon-only controls use `aria-label` / visible text; decorative icons carry
  `aria-hidden` (e.g. the pricing tick, the coding modal icons, the recording panel), so raw
  "svg…" text does not appear in the accessibility tree.
- **RESULT**: **NOT TESTED** with a screen reader/a11y tool (no browser available).

---

## 13-14. Shared null defence + Error boundary

- **FILES**: `frontend/src/app/services/jobs.ts`, `frontend/src/app/features/resume/types.ts`,
  `frontend/src/lib/adaptiveInterviewApi.ts`, `frontend/src/app/components/PageErrorBoundary.tsx`.
- **FIX**: normalization happens at the API boundary (`normalizeResumeDocument`,
  `normalizeJobListResponse`, `normalizeSavedJob`, `normalizeRoleGoals`, `normalizeFitAnalysis`,
  `normalizeInterviewReport`) rather than sprinkling `?.` through components; the backend also
  returns `[]` instead of `null`. `PageErrorBoundary` stays as the last line of defence: it now
  generates a stable error id, always logs `{ error, componentStack, route }` to the console,
  and renders the route + message + component stack **only** in development
  (`import.meta.env.DEV`, which is now genuinely `false` in production builds after §0); in
  production it shows only the friendly message plus the error reference id.
- **RESULT**: **PASS** — verified in the built bundle that the dev-only diagnostics block is
  tree-shaken out of production.

---

## Next actions (not done — require a browser / credentials)
- Browser E2E of the 14 routes (direct URL, refresh, sidebar, back/forward, mobile, console,
  network) — **BLOCKED**: no Chrome in this environment (`CHROME NOT FOUND`).
- Live recording upload/playback and Cloudinary mirror — **NOT CONFIGURED** (no credentials).
- Live Gemini failure-path rendering and real PDF/DOCX parse of `Huzaifa Resume.pdf` —
  **NOT TESTED**.
