# Jobs — Testing

**Scope (spec §57–§70, §111–§112):** current job postings from real providers,
never fabricated, deduplicated, filterable, with a working save/apply tracker.

## Provider status right now

| Provider | Configured? | Behaviour |
|---|---|---|
| RemoteOK | Yes — public API, no key | Used when reachable |
| Adzuna | **No** — `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` unset | Adapter reports `configured: false` and is **skipped**. It does not fall back to scraping or sample data. |

When no provider is configured the `/jobs` response sets
`noProviderConfigured: true` and the UI shows "No live job provider is
configured" — it does **not** show invented postings.

## Automated checks — PASS (`npx jest tests/jobs.test.js`, 15/15)

| # | Check | Expected | Result |
|---|---|---|---|
| J-1 | Fit weights sum to 100 | 30+15+15+15+10+5+5+5 | **PASS** |
| J-2 | Calculation version recorded | semver string | **PASS** |
| J-3 | Match label thresholds | 85 / 70 / 50 bands exact | **PASS** |
| J-4 | **No hiring-probability language** | no label matches /chance\|probab\|hired\|hire\|offer\|success/ | **PASS** |
| J-5 | Unstated work mode → UNSPECIFIED | never guessed | **PASS** |
| J-6 | Work mode asserted only with support | Remote / Hybrid detected; "London, UK" → UNSPECIFIED | **PASS** |
| J-7 | Unstated job type → UNSPECIFIED | **not** defaulted to FULL_TIME | **PASS** |
| J-8 | Unstated experience → UNSPECIFIED | "Software Engineer" → UNSPECIFIED | **PASS** |
| J-9 | Experience needs real years | "5+ years" → SENIOR; "Freshers welcome" → ENTRY | **PASS** |
| J-10 | Title normalization | stable comparison form | **PASS** |
| J-11 | HTML → text | entities decoded, tags stripped | **PASS** |
| J-12 | Script/style stripped | no `alert`, no CSS leaks into text | **PASS** |
| J-13 | Requirements verbatim + deduped | bullets kept, duplicates collapsed | **PASS** |
| J-14 | No requirement language → none | prose yields `[]` | **PASS** |
| J-15 | §113 fixture | AWS unevidenced → `NOT_EVIDENCED`, level `null`, **not 0** | **PASS** |

## Manual checks — NOT TESTED

### Ingestion (spec §111)

| # | Test | Steps | Expected | Actual |
|---|---|---|---|---|
| J-16 | Provider reachability | `npm run jobs:refresh` (or wait for the scheduler) | Report lists fetched/created/updated | |
| J-17 | Real fields present | Inspect a fetched posting | source URL, company, title, date, location all populated from the real response | |
| J-18 | **No fabricated salary** | Find a posting with no salary | UI shows "Salary not listed" — **never** a range | |
| J-19 | Not-specified fields | Experience not stated | "Not specified" | |
| J-20 | Every posting has a source | Click Apply | Opens the **original verified** provider URL | |
| J-21 | Skill extraction | Open a posting | Skills derived from the real description text | |
| J-22 | Role classification | Backend posting | Appears under Backend, not Data Analyst | |

### Deduplication (spec §112)

| # | Test | Steps | Expected | Actual |
|---|---|---|---|---|
| J-23 | Import twice | Run ingestion twice | One `JobPosting` per `(provider, externalId)` — second run reports `updated`, not `created` | |
| J-24 | DB assertion | `db.jobpostings.aggregate([{$group:{_id:{p:"$provider",e:"$externalId"},n:{$sum:1}}},{$match:{n:{$gt:1}}}])` | Zero documents | |
| J-25 | No duplicates in UI | Browse all pages | The same job never appears twice | |

### Freshness (spec §63)

| # | Test | Expected | Actual |
|---|---|---|---|
| J-26 | Stamp shown | "Updated 2 hours ago" from `fetchedAt` | |
| J-27 | Page load does not fetch | Open `/jobs`, watch network | **No** outbound provider call from the browser request | |
| J-28 | Scheduler interval | Wait / inspect logs | Refresh every `JOB_REFRESH_INTERVAL_MINUTES` (default 360) | |
| J-29 | Overlap guard | Slow provider + short interval | Second tick skipped and logged, no duplicate run | |
| J-30 | Staleness | Posting older than 30 days | Deactivated; no longer shown as current | |

### Stage 2 environment variables (spec §P)

| Variable | Default | Purpose |
|---|---|---|
| `JOB_ALERT_MIN_RELEVANCE` | `70` | Relevance a posting must reach before it raises an in-app job alert. Read only via `alertMinRelevance()` in `backend/src/jobs/models/JobAlert.ts`, so the threshold is never hardcoded at a call site. |
| `JOB_REFRESH_INTERVAL_MINUTES` | `360` | Existing scheduler interval (unchanged). |

No new secrets are required. In-app alerts are **in-app only**: AETHER has no email
delivery channel and never claims a message was sent. `GET /api/jobs/alerts`
returns `delivery: "in-app"` so the UI states this rather than implying email.

### Stage 2 endpoints

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/jobs/preferences` | Per-role search preferences for the signed-in user only. |
| `PUT` | `/api/jobs/preferences/:roleSlug` | Writes `JobSearchPreference` only — never `UserRoleGoal`, so primary role is unaffected. |
| `GET`/`POST` | `/api/jobs/saved-searches` | Reusable saved searches (distinct from `/saved`, which is the application tracker). |
| `POST` | `/api/jobs/saved-searches/:id/run` | Owner-scoped; returns the query string to navigate to. |
| `DELETE` | `/api/jobs/saved-searches/:id` | Owner-scoped. |
| `GET` | `/api/jobs/alerts` | In-app alerts + unread count + threshold. |
| `PATCH` | `/api/jobs/alerts/:id/read` | Owner-scoped. |
| `POST` | `/api/jobs/seen` | Records the visit and returns `newJobs`, or `null` on a first visit. |
| `GET` | `/api/jobs/market` | Aggregates over stored postings only; includes a `trend` block that reports `trendingAvailable: false` until two snapshots exist. |
| `GET` | `/api/jobs/summary` | Real pipeline counts for the dashboard; no mock numbers. |

### Search UI (spec §64–§65)

| # | Test | Expected | Actual |
|---|---|---|---|
| J-31 | Role filter | Only postings for the selected role | |
| J-32 | Location filter | Matches real location text | |
| J-33 | Work mode / job type / date filters | Narrow results correctly | |
| J-34 | Empty result set | Honest "no jobs matched" — not an error | |
| J-35 | No provider configured | Amber notice explaining which keys are missing | |
| J-36 | Job card | Role, company, location, work type, posted date, skills, source | |
| J-37 | Mobile | 375 px | Cards stack; buttons remain reachable | |

### Tracker (spec §67–§68)

| # | Test | Expected | Actual |
|---|---|---|---|
| J-38 | Save | Job appears in `/saved-jobs`, status SAVED | |
| J-39 | Save twice | One tracker row (unique index), status updated | |
| J-40 | Unsaved | Removed | |
| J-41 | Status transitions | SAVED → APPLIED → SCREENING → INTERVIEW → OFFER / REJECTED / WITHDRAWN | |
| J-42 | `appliedAt` stamped | Set the first time status becomes APPLIED | |
| J-43 | Counts | `/saved-jobs` tiles match the actual rows | |
| J-44 | **Apply opens the source** | Click Apply | New tab to the provider. AETHER does **not** claim to have submitted anything | |
| J-45 | Aged-out posting | Inactive posting stays in the tracker | Flagged "posting no longer active" | |

## Note on the scheduled refresh

The refresh runs on an interval inside the backend process
(`startJobRefreshScheduler`, started in `server.ts`). It does **not** run in
serverless environments where the process is frozen between requests — on Render
or Vercel you would need an external cron calling an admin-triggered endpoint.
This is a known deployment limitation, not a code defect.