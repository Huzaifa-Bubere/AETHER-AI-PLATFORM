# Routing — Test Matrix

**Scope (spec §3–§7, §105–§107):** one canonical route per feature, protected
routes redirect to auth and return correctly afterwards, direct URL refresh
works, and no dead navigation links exist.

## Canonical routes

`frontend/src/app/components/navigation.ts` is the single source of truth. The
sidebar, header and mobile drawer all read from it; no component hardcodes a
path of its own.

| Canonical route | Page | Legacy routes that redirect here |
|---|---|---|
| `/` | Dashboard for a signed-in candidate | — |
| `/welcome` | Marketing page (anonymous only) | — |
| `/dashboard` | Dashboard | — |
| `/profile` | Professional profile | — |
| `/analytics` | Analytics | — |
| `/aptitude` | Aptitude test selection | — |
| `/technical` | Technical MCQ round | `/aptitude?round=technical`, `/technical-assessment` |
| `/coding` | Coding dashboard | — |
| `/coding/problems`, `/coding/problems/:slug`, `/coding/submissions`, `/coding/submissions/:id` | Coding module | — |
| `/interview`, `/interview/:sessionId`, `/interview/:sessionId/report` | Adaptive interview | `/ai-interview/*` |
| `/interview-setup`, `/interview-room` | Legacy interview flow (reachable from History only) | — |
| `/resume-analyzer` | ATS analyzer | `/resume` |
| `/resume-builder` | Resume builder | — |
| `/career-learning`, `/career-learning/topics/:topicSlug`, `/career-learning/:roleSlug` | Career learning | `/career`, `/learning`, `/courses` |
| `/career-intelligence`, `/career-intelligence/:roleSlug` | Market intelligence | — |
| `/jobs`, `/jobs/:jobId` | Job search | — |
| `/job-fit` | Job requirement match | — |
| `/saved-jobs` | Application tracker | — |
| `/subscription` | Subscription | — |
| `/settings` | Account settings | — |
| `/admin/*` | Admin area | — |

## Automated checks already run — PASS

| # | Check | Command | Result |
|---|---|---|---|
| R-1 | Every nav link resolves to a declared route | compare `navigation.ts` paths against `App.tsx` `path=` values | **PASS** |
| R-2 | Frontend compiles with the new route table | `npm run typecheck` | **PASS** |
| R-3 | Production bundle builds | `npm run build` | **PASS** |
| R-4 | SPA fallback configured in Nginx | `frontend/nginx.conf` contains `try_files $uri $uri/ /index.html;` | **PASS** |
| R-5 | No dead internal links | `grep` for `to=`/`navigate(`/`href=` paths, compared against the route table | **PASS** — fixed `/features` and 10 stale links |
| R-6 | `/analytics` is auth-protected | route wrapped in `ProtectedRoute` | **PASS** (bug fixed) |
| R-7 | 404 route exists and is real | `path="*"` → `NotFoundPage` | **PASS** (previously redirected to `/`, hiding broken links) |

## Manual matrix — NOT TESTED

No browser was available, so every row below is unverified.

| # | Route | Sidebar link | Direct URL | Refresh (F5) | Back / Forward | Anonymous → login → return |
|---|---|---|---|---|---|---|
| R-8 | `/dashboard` | | | | | |
| R-9 | `/profile` | | | | | |
| R-10 | `/analytics` | | | | | |
| R-11 | `/technical` | | | | | |
| R-12 | `/coding` | | | | | |
| R-13 | `/interview` | | | | | |
| R-14 | `/resume-analyzer` | | | | | |
| R-15 | `/resume-builder` | | | | | |
| R-16 | `/career-learning` | | | | | |
| R-17 | `/career-learning/topics/python` | | | | | |
| R-18 | `/career-intelligence` | | | | | |
| R-19 | `/jobs` | | | | | |
| R-20 | `/jobs/:jobId` | | | | | |
| R-21 | `/saved-jobs` | | | | | |
| R-22 | `/job-fit` | | | | | |
| R-23 | `/subscription` | | | | | |
| R-24 | `/settings` | | | | | |
| R-25 | `/admin` | | | | | |

### Specific refresh test the spec calls out (spec §6)

1. Sign in as a candidate.
2. Navigate to `/career-learning/topics/python`.
3. Press **F5**.
4. **Expected:** the lesson page renders — not a 404, not an Nginx error.
5. **Actual:** _(not run)_

### Login return-to test (spec §5)

1. Sign out.
2. Open `/job-fit` directly.
3. **Expected:** redirected to `/login`.
4. Log in.
5. **Expected:** returned to `/job-fit`, not to the dashboard.
6. **Actual:** _(not run)_

### Legacy redirect test

1. Open `/resume` while signed in → **Expected** `/resume-analyzer`.
2. Open `/ai-interview` → **Expected** `/interview`.
3. Open `/career` → **Expected** `/career-learning`.
4. Open `/nonsense` → **Expected** the 404 page listing valid destinations.
5. **Actual:** _(not run)_

### Home-route test (spec §4)

1. Sign in → `/` → **Expected** `/dashboard`, not the marketing page.
2. Sign out → `/` → **Expected** `/welcome`.
3. Sign in as admin → `/` → **Expected** `/admin`.
4. **Actual:** _(not run)_

## Known limitation

`/interview-setup` and `/interview-room` are the older, non-adaptive interview
flow. They are intentionally kept reachable from the History page so existing
legacy sessions are not orphaned, but they are **not** in the navigation. This
is a deliberate decision, not an oversight — see `TEST_STATUS.md`.