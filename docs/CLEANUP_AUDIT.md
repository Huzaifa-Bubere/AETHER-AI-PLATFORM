# AETHER — CLEANUP AUDIT (Phase 1)

Planning document for safe consolidation. **Nothing is deleted in this phase.**
Every row is backed by a command, and each deletion batch must end with
`npm run build` (backend), `npm run typecheck && npm run build` (frontend) and
`python -m compileall src` (ai-server) before the next batch starts.

## Method

Evidence used, per brief §2:

- `git grep` for imports, dynamic imports, routes, scripts, Docker/CI/doc
  references
- import-graph inspection of `frontend/src` and `backend/src`
- `frontend/package.json` / `backend/package.json` script inspection
- `docker-compose.yml` service inspection
- full build + test run after each batch

Categories: **KEEP · CONSOLIDATE · ARCHIVE · DELETE · DEFER**

---

## KEEP (proven live, do not touch)

| Item | Evidence |
| --- | --- |
| `backend/src/jobs/**`, `job-provider-service/**` | 34/34 runtime E2E pass; live RemoteOK smoke pass |
| 37 Mongoose models | each has runtime callers in services/routes |
| `career/models/UserCareerGoal.ts` | 10 runtime callers (career + jobs services) — **not** legacy |
| `Report/` (24 LaTeX files) | academic report source; moving it risks breaking its build |
| `Poster.png`, `SEM 7 POSTER.pdf`, `major project.pptx` | academic artefacts (currently untracked) |
| `scripts/mongo-init.js` | referenced by `docker-compose.yml` mongodb volume |
| `nginx/nginx.conf` | referenced by the compose `production` profile |
| `backend/tests/**` (35 suites, 419 tests) | green; they are the regression net for this cleanup |
| `testing/*.md` | manual route checklists still referenced by TESTING flow |
| `backend/scripts/jobsRuntimeE2E.js`, `jobsProviderSmoke.js` | verification scripts (npm `jobs:smoke`) |

## CONSOLIDATE

| Item | Action | Evidence |
| --- | --- | --- |
| `components/Button.tsx`, `Card.tsx`, `Input.tsx` | migrate the 3 importers (`LoginPage.tsx`, `SignupPage.tsx`, `KnowledgeSourcesPage.tsx`) to `components/ui/button|card|input`, then delete | `git grep "components/Button\|components/Card\|components/Input"` returns exactly those 3 files |
| 18 root `*.md` reports | fold current truth into `README.md` + `docs/*`; move history to `docs/archive/` | `ls *.md` |
| Two interview surfaces | pick canonical (`/interview` ↔ `/api/adaptive-interview`); redirect/retire the legacy router | `App.tsx` mounts `/interview` on `AdaptiveSetupPage`; `/api/interview` still mounted in `app.ts` |
| `README.md` "ATHER" | rename to AETHER | AETHER = 209 files vs ATHER = 21 |

## ARCHIVE (move to `docs/archive/`, keep in git)

`AUDIT_2026-09-13.md`, `CODEBASE_AUDIT.md`, `CONTINUATION_VERIFICATION.md`,
`DEPLOYMENT_READINESS.md`, `FEATURE_STATUS_REPORT.md`, `GAP_ANALYSIS.md`,
`UPGRADE_REPORT_2026-09-24.md`, `UPGRADE_REPORT_2026-09-27.md`, `REFACTOR_PLAN.md`,
`implementation_plan.md`, `CURRENT_ARCHITECTURE.md`, `INTEGRATION.md`,
`INTERVIEW_FLOW_REPORT.md`, `DEPLOY.md`, `TESTING_GUIDE.md`,
`AETHER_PROJECT_RUN_GUIDE.md` (superseded by `docs/RUN_GUIDE.md`), and `audit/*`
(11 tracked patch/report files — the historical patch series).

Rationale: history is useful for the academic write-up, but must not sit at the
repository root where it reads as current truth.

## DELETE (verified unused — execute in Phase 13, in small batches)

| File | Reason | Evidence it is unused | Replacement | Verification after deletion |
| --- | --- | --- | --- | --- |
| `package-lock.json` (root) | stub orphan | `ls package.json` → absent; content is a 101-byte empty lock; `git grep package-lock` in docs/scripts/CI → no hits | none | `npm run build`/`test` in backend+frontend still green |
| `build.log` | stale build output (Aug 2) | untracked and matched by `*.log` in `.gitignore` | none | n/a (disk only) |
| `temp/` (scratch) | audit snapshots + `frontend-npm-audit.json` | untracked, no references | none | n/a (disk only) |
| `logs/` | runtime logs (`combined.log`,`error.log`) | gitignored, no references | none | n/a (disk only) |
| `aptitude-module/` (22 tracked files) | superseded standalone copy | only referenced by `CURRENT_ARCHITECTURE.md` prose and `audit/*.patch` diff headers; **zero** code imports, not in any package.json, not in docker-compose, no test import | live module in `frontend/src/pages/aptitude/**` + `backend/src/routes/aptitude*` | backend+frontend builds green; `aptitude-*` tests green |
| 16 unused frontend deps (below) | shipped but never imported | see table | none | `npm ci` + `typecheck` + `build` green |

### Frontend dependencies to remove (Phase 13)

Each was checked with `git grep -l "<pkg>" frontend/src` → **0 files**:

`@auth0/auth0-react`, `@auth0/auth0-spa-js`, `@mui/material`,
`@mui/icons-material`, `chart.js`, `react-chartjs-2`, `react-query`,
`@tanstack/react-query` (if present), `react-dnd`, `react-dnd-html5-backend`,
`react-slick`, `simple-peer`, `react-responsive-masonry`, `react-popper`,
`@emotion/react`, `@emotion/styled`.

Positive controls (must stay): `recharts` (8 refs), `framer-motion` (8 refs),
`html2canvas` (1 ref), `@monaco-editor/react`, `@react-three/fiber|drei`,
`three`, `react-router-dom`, `zustand`, `socket.io-client`, `react-webcam`,
`react-speech-recognition`, `react-pdf/renderer`.

Before removal, each candidate is re-checked against **all** of `frontend/`
(not just `src/`): Vite/Tailwind/PostCSS config, `index.html`, `scripts/`, and
any test. Removal only after a clean `npm ci`.

## DEFER (needs a product decision or more evidence)

| Item | Why deferred |
| --- | --- |
| Emotion analysis (`ai-server/src/services/emotion_detection.py`, `POST /api/emotion/analyze`) | **It is live**: `backend/src/routes/interview.ts:846` calls it, `models/Interview.ts` stores `emotionAnalysis`, `routes/feedback.ts` charts it. Brief §21 forbids inferring emotion from face — so this needs an explicit keep/remove decision before touching it (it also appears in the academic report). |
| `ai-server/src/services/behavior_analysis.py`, `video_analysis.py` | same policy question — objective signals (face present, multiple faces, posture) are allowed; confirm which subset is retained |
| `backend/src/models/Interview.ts` | removal depends on the interview consolidation decision |
| Piston/Judge0 code execution | keep both adapters or standardise — depends on deployment choice |
| `Report/` relocation | moving LaTeX may break the report's own build; keep until confirmed |
| `backend/src/routes/user.ts:410` account-deletion cascade | feature work, not cleanup |
| PDF generation TODOs (`feedback.ts`) | feature work |

## Execution order (brief §92)

1. docs duplicates → 2. dead assets → 3. dead frontend components →
4. dead pages → 5. legacy routes → 6. duplicate stores/services →
7. duplicate backend routes → 8. duplicate models → 9. unused dependencies →
10. unused Python services.

Each batch: change → build/typecheck/test → record PASS/FAIL in
`docs/FINAL_ENGINEERING_REPORT.md`.
