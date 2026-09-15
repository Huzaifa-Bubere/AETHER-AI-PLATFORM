# ATHER: current architecture and source audit

Audit started 2026-09-15. This describes the working tree, including pre-existing uncommitted changes. The source is authoritative; earlier audit reports are evidence of prior work, not proof of current end-to-end behavior.

## Baseline and preservation

- Backend TypeScript build: passed. Frontend type check and Vite production build: passed.
- Existing Jest and isolated MongoDB workflows are being rerun. External AI, media devices, code execution and browser workflows require separate verification.
- Pre-existing changes include adaptive interviews, proctoring, aptitude validation/availability and integration tests. Preserve these while integrating them.
- `AGENTS.md` refers to `RTK.md`, which was not found in the repository or checked parent/instruction directories.
- Do not modify credentials or reuse production records for tests. Do not delete the compatibility module or existing audit patches without checking references.

## Service ownership

The Vite React application uses a Node Express API. MongoDB/Mongoose persists identity, resumes, interviews, practice sessions, aptitude tests/questions/attempts and payments. Socket.IO handles authenticated interview events. FastAPI exposes audio/video/emotion/speech/resume and duplicate Gemini endpoints. Redis and Cloudinary are optional services. Python and Node both own parts of generative AI today, and three separate Node services instantiate Gemini clients.

Development defaults: frontend 5175, Node 5001, Python 8000. Compose currently publishes frontend on 5174. Preserve API paths, collection names and storage namespaces during branding changes.

## Feature dependency map

Paths in the frontend column are relative to `frontend/src`; backend paths are relative to `backend/src`.

| Feature / frontend | Client and state | Backend route and implementation | Persistence / dependency | Current assessment |
|---|---|---|---|---|
| Login, signup, reset, verify (`app/pages/*`) | `app/services/auth.ts`, `api.ts`, `http.ts`, `app/stores/authStore.ts` | `/api/auth`, `routes/auth.ts`, `middleware/auth.ts`, `utils/auth.ts` | User, JWT, email | PARTIALLY WORKING: purpose/version checks and refresh repairs exist; request role incorrectly uses subscription plan |
| Candidate dashboard/profile | API/user wrappers, auth store | `/api/user/profile`, `/stats`, `/preferences` in `routes/user.ts` | User, Interview | MOCKED: skill progress is invented; stats can be stale |
| Aptitude and technical MCQs (`pages/aptitude/*`) | `lib/aptitudeApi.ts`, `store/aptitudeStore.ts` | `/api/aptitude`, `studentAptitude.controller.ts`, selector and availability services | AptitudeTest, AptitudeQuestion, AptitudeAttempt | PARTIALLY WORKING: exact quotas, immutable snapshots, autosave, deadlines; ID-only exclusion, no content dedup or generation |
| Aptitude administration (`pages/admin/aptitude/*`) | aptitude client | `/api/admin/aptitude`, admin controller and validation middleware | Same aptitude models, image uploads | PARTIALLY WORKING: server admin guard, publish availability checks; no RAG sources/cache management |
| Standard interview setup/room | `app/services/interview.ts`, `app/stores/interviewStore.ts` | `/api/interview`, `routes/interview.ts`, Gemini | Interview, Resume | PARTIALLY WORKING: lifecycle/resume fixes exist; weak output validation and generic fallback can erase mode distinctions |
| Adaptive technical interview (`app/pages/Adaptive*`) | `lib/adaptiveInterviewApi.ts`, `store/adaptiveInterviewStore.ts` | `/api/adaptive-interview`, adaptive route/service | AdaptiveInterview, direct Gemini, recordings | DUPLICATED/PARTIALLY WORKING: separate question/evaluation logic and history; heuristic fallback source not carried through all UI types |
| Coding interview (`CodingInterviewPage`) | interview API/store and code API | `/api/code`, `routes/codeExecution.ts`, `services/codeExecution.ts` | Interview, external Piston/Judge0 | BROKEN/SECURITY ISSUE: host runner remains opt-in; language wrappers assume specific problems; grading trusts client tests; infrastructure error classification incomplete |
| Resume analyzer/onboarding | `app/services/resume.ts`, API upload | `/api/resume`, `routes/resume.ts` | Resume, Cloudinary/local storage, Python parser, Gemini | BROKEN/MOCKED: no upload when Cloudinary unconfigured; parser failure invents skills/summary/scores; onboarding upload is local-only |
| Camera/microphone | VideoRecorder, SpeechRecognition, audio/WebRTC/socket/proctor hooks | interview media routes, socket service -> Python | FastAPI analysis services | BROKEN: data URI and response-contract mismatches; missing audio duration; fallback metrics imply successful measurement |
| Feedback/history | FeedbackPage, HistoryPage, interview service | `/api/feedback`, interview feedback/history routes | Interview | MOCKED/DUPLICATED: random media metrics; alternate feedback writer; HTML labeled PDF |
| Admin dashboard | `app/services/admin.ts`, active `app/pages/AdminDashboardPage.tsx` | `/api/admin`, `routes/admin.ts` | User, Interview, Resume | PARTIALLY WORKING/MOCKED: server authorization exists; hardcoded system/growth data; deletion and CSV issues |
| Practice | `app/services/practice.ts` (no dedicated mounted page) | `/api/practice`, route | PracticeSession, Gemini | PARTIALLY WORKING: duplicate completed submissions and Map aggregation need repair |
| Scheduling | `app/services/scheduling.ts` (no mounted scheduler) | `/api/scheduling`, route | Interview, email | PARTIALLY WORKING: start generation repaired; reminder ownership and persistence remain open |
| Subscriptions/payments | SubscriptionPage, PaymentSuccessPage | `/api/payment`, Stripe service | Payment, User, Stripe, email | SECURITY ISSUE/BROKEN: verify-session lacks ownership; raw webhook parser comes after JSON; receipt/amount/idempotency problems |
| RAG | No client or admin screen | No ingestion/chunk/embedding/vector retrieval service | None | MISSING: Gemini generation is not RAG |

All frontend HTTP clients share `http.ts` authentication but have inconsistent base path/envelope conventions. Node should remain the gateway; the Python shared key must never be bundled into the browser.

## Prioritized findings and root causes

| ID | File / function | Problem and root cause | Proposed repair |
|---|---|---|---|
| AUTH-09 | `middleware/auth.ts`: authenticateToken, optionalAuth, requireRole | Role is `subscription.plan`, not `auth.role`; candidate APIs permit admins | Separate role and plan, enforce candidate authorization on assessment endpoints, add role matrix tests |
| RAG-01 | Missing service boundary | No retrieved documents, embeddings, vector store or provenance | Mongo-backed source/chunk store, real embedding retrieval, original question generation, strict validation and provenance; Atlas vector index with explicit setup |
| APT-09 | `services/questionSelector.service.ts`: buildQuestionSet | Selection sees only IDs and silently recycles exhausted banks | Normalize/fingerprint content including snapshots, exclude recent content, preserve exact difficulty, explicit shortage response; later replenish with validated RAG questions |
| AI-09 | `services/gemini.ts`: generateInterviewQuestions and fallback | Arbitrary parsed JSON accepted; same Two Sum and behavioral fallbacks reused | Shared structured validation/difficulty rules, mode strategy, transparent unavailable state or labeled fallback |
| AI-10 | adaptive and aptitude AI services | Independent SDK setup and failure swallowing | Shared generation transport with bounded calls and safe structured logs |
| RES-05 | `routes/resume.ts`: upload | Local upload only happens inside Cloudinary catch; fabricated parsed data and years=job count | Reliable storage adapter, real parse status, no invented content, preserve structured projects/skills for interviews |
| MEDIA-07 | `ai-server/src/main.py`: analyze_video_frame_json, health_check | Data URI decoded as raw base64; top-level health ignores capability results | Validate input and capability availability, map snake_case data centrally in Node |
| CODE-05 | `services/codeExecution.ts`: executeWithTestCases | Wrappers hide inconsistent input contracts; remote failure confused with solution result | Standard stdin/stdout, authoritative stored tests, structured execution statuses, no unsandboxed runner |
| DATA-02 | `routes/feedback.ts`, `routes/user.ts` | Random/constant metrics masquerade as measurements | Persist and aggregate actual data, explicit absent/unavailable fields and empty states |
| PAY-05 | `routes/payment.ts`: verify-session; app parser order | Paid session not scoped to customer; signed webhook bytes lost | Ownership/idempotency checks; raw parser before JSON; payment-specific regression tests |
| UI-01 | Header, App, theme and page classes | Old branding, full-page anchor navigation, missing feature navigation, page-local dark classes | Shared responsive light shell/tokens, SPA navigation and real active states |
| CFG-09 | `server.ts`: initializeServices | Success logged even when optional initialize swallowed failure | Return actual capability status; readiness separate from liveness |

## Duplicates and removal policy

- `aptitude-module` is documented as a compatibility surface; inspect each alias and its documentation before removal.
- `frontend/src/pages/AdminDashboardPage.tsx` differs from the mounted `app/pages` dashboard. Prove absence of imports/build references before deleting.
- `useProctor` and `useProctoring` serve different interview flows; consolidate callers before removal.
- Python Gemini endpoints may have callers outside the main frontend; preserve compatibility while moving generation orchestration to Node.
- Existing audit patches describe earlier snapshots and must not be blindly reapplied.

## Verification limits

Compilation proves type consistency, not feature correctness. The acceptance ledger is in `REFACTOR_PLAN.md`. Browser, MongoDB, provider, execution and media-device checks must each be recorded with their actual outcomes. No feature is marked fully repaired solely because a server starts.
