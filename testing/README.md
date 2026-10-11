# AETHER — Testing

Documentation for verifying that AETHER is a connected career platform with
real data, not a set of mock screens.

## Start here

**[`TEST_STATUS.md`](./TEST_STATUS.md)** — what was actually verified by
automation, and what was **not** run. Read this before trusting any claim.

## Status vocabulary

| Status | Meaning |
|---|---|
| **PASS** | Executed here; the result was observed. |
| **FAIL** | Executed; did not meet the expectation. |
| **PARTIAL** | Some of the scope ran; the remainder did not. |
| **BLOCKED** | Could not run — needs credentials, a browser, or your action. |
| **NOT TESTED** | No check was performed. |

**No row is marked PASS unless the command was run and the result seen.**

## Documents

### This upgrade (2026-10-02)

| File | Covers |
|---|---|
| [`routing.md`](./routing.md) | Canonical routes, protected routes, refresh, 404, login return-to |
| [`streak.md`](./streak.md) | Heatmap, levels, timezone boundaries, empty state |
| [`multi-role.md`](./multi-role.md) | Multiple target roles, primary-role invariant, role separation |
| [`role-requirements.md`](./role-requirements.md) | Requirement matrix, weights, levels, learning links |
| [`dashboard.md`](./dashboard.md) | Metric cards, charts, role switching, one-request rule |
| [`profile.md`](./profile.md) | Professional profile, deterministic completeness, evidenced skills |
| [`jobs.md`](./jobs.md) | Providers, normalization, deduplication, freshness, tracker |
| [`job-fit.md`](./job-fit.md) | Requirement-match formula, traceable score, not-evidenced semantics |
| [`full-e2e.md`](./full-e2e.md) | The complete journey and multi-role journey |

### Pre-existing

| File | Covers |
|---|---|
| [`05-coding.md`](./05-coding.md) | Coding module |
| [`06-coding-visualizer.md`](./06-coding-visualizer.md) | Execution visualizer |
| [`08-resume-analyzer.md`](./08-resume-analyzer.md) | ATS analyzer |
| [`09-resume-builder.md`](./09-resume-builder.md) | Resume builder + PDF |
| [`10-career-learning.md`](./10-career-learning.md) | Career learning |
| [`17-ui.md`](./17-ui.md) | UI behaviour |
| [`18-analytics.md`](./18-analytics.md) | Analytics |
| [`19-subscription.md`](./19-subscription.md) | Subscription & entitlements |
| [`20-data-integrity.md`](./20-data-integrity.md) | Data integrity sweep |
| [`21-learning-content.md`](./21-learning-content.md) | Learning content admin |
| [`22-youtube-learning.md`](./22-youtube-learning.md) | Video integration |

## Fixtures

| Directory | Contents |
|---|---|
| `ats-fixtures/` | Resumes and job descriptions for ATS + job-fit testing |
| `interview-fixtures/` | Sample interview media and expected behaviour |
| `learning-fixtures/` | Sample course data |
| `resume-builder-fixtures/` | Resume builder sample data |

## Running the automated suites

```bash
# Backend — full suite
cd backend && npm run build && npx jest

# Backend — individual suites
cd backend && npx jest tests/streak.test.js            # streak + timezone maths
cd backend && npx jest tests/role-progress.test.js      # role coverage formula
cd backend && npx jest tests/skill-evidence.test.js     # evidence → level mapping
cd backend && npx jest tests/jobs.test.js               # providers + job fit
cd backend && npx jest tests/auth-regressions.test.js   # login blockers

# Frontend
cd frontend && npm run typecheck && npm run build

# AI server
cd ai-server && python -m compileall src
```

## Data-integrity sweep

Run this to confirm no fake data has crept back in:

```bash
grep -rn "Math.random\|faker\|mockScores\|dummyAnalytics\|sampleChartData" \
  frontend/src backend/src ai-server/src
```

Remaining matches must all be identifier generation or comment text — never a
chart value, score or progress figure. See `TEST_STATUS.md` §4 for the
current result.

## Maintenance scripts

These write to the database — run them deliberately.

```bash
cd backend
npm run migrate:multi-role   # one goal per user → many roles, keeps isPrimary
npm run repair:plans          # fixes legacy subscription.plan values (login fix)
npm run seed:admin            # create / repair the admin account (see below)
npm run seed:careers          # roles + skills (idempotent)
npm run seed:topics           # learning topics (idempotent)
```

### Admin account tool

If `/admin/login` fails, diagnose first:

```bash
npm run seed:admin -- --list                      # show all current admins
```

Then fix it with whichever applies:

```bash
npm run seed:admin                                              # create if missing
npm run seed:admin -- --reset-password                          # set a new password
npm run seed:admin -- --email you@example.com --promote         # make an existing account an admin
npm run seed:admin -- --email you@example.com --promote --password 'YourNewPass'
```

Credentials default to `admin@aether.local` / `Admin@12345`, overridable with
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

**Note:** the admin account is created by `seedDefaultQuestions.ts`, not by
`seed:careers` or `seed:topics`. If you have never run the question seed, no
admin account exists and `/admin/login` cannot succeed. Use `seed:admin`.

## Writing a new test doc

1. **Scope** — which spec sections it covers.
2. **Automated checks** — only rows whose command you actually ran. Record the
   command and the observed result.
3. **Manual checks** — everything that needs a human or a browser, with an
   **empty** `Actual` column.
4. If a check was skipped, say why. Silence implies coverage that does not exist.