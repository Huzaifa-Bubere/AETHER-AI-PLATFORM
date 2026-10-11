# Dashboard — Testing

**Scope (spec §8–§14):** the authenticated home screen, answering what the
candidate is preparing for, how far along they are, what they did recently, what
is weak and what to do next — all from real stored data.

**One request:** `GET /api/dashboard/summary`. The page does not fan out into
per-metric calls. It previously called only `GET /user/stats`; that call is
gone.

## The non-negotiable rules

| Rule | How it is enforced |
|---|---|
| No `Math.random()` | Swept; only ID generation and a question shuffle remain (`TEST_STATUS.md` §4) |
| No hardcoded percentages | Every value comes from a service query |
| No AI-generated numbers | Gemini never returns a metric; it may only explain evidence |
| No fake chart points | Charts render an explicit "No data yet" state |
| Not assessed ≠ zero | Every optional metric is `null` + `NOT_ASSESSED` |

## Automated checks — PASS

| # | Check | Result |
|---|---|---|
| D-1 | Dashboard service builds and typechecks | **PASS** |
| D-2 | Full backend suite green | **PASS** — 315 tests |
| D-3 | Frontend typecheck | **PASS** |
| D-4 | Production build | **PASS** |
| D-5 | Dashboard no longer calls `/user/stats` | **PASS** — grep returns 0 |

## Manual checks — NOT TESTED

Run against a candidate account with real history.

### Metric cards (spec §11)

| # | Card | Expected |
|---|---|---|
| D-6 | Technical Accuracy | e.g. `78%` with basis "41 correct / 53 answered" |
| D-7 | Coding Performance | e.g. `82%` with basis "8 evaluated submissions" |
| D-8 | Interview Score | e.g. `74%`, role-scoped to the selected role |
| D-9 | Resume Quality | e.g. `81 / 100` with the version name |
| D-10 | Learning | e.g. `43%` with "18 / 42 lessons" style basis |
| D-11 | Empty state | Fresh user → **"Not assessed"**, never `0%` |
| D-12 | Limited evidence | Sample < 5 → "Limited evidence" chip, value still shown |

### Role selector (spec §10)

| # | Test | Expected |
|---|---|---|
| D-13 | Two target roles | Both listed with their real readiness |
| D-14 | Switch role | Readiness, charts and next action all change |
| D-15 | One request per switch | Network tab shows a single `/dashboard/summary?role=` call |
| D-16 | Unassessed role bar | Muted empty track + "Not assessed", not a 0% bar |

### Next recommended action (spec §9)

| # | Test | Expected |
|---|---|---|
| D-17 | Unmet essential requirement | That skill is recommended first, with the reason stated |
| D-18 | Reason is real | Reason names the actual requirement and current level |
| D-19 | "Continue Learning" | Links to the lesson that closes the gap |
| D-20 | No evidence at all | Prompts to take an assessment / build a resume |

### Charts (spec §12)

| # | Chart | Expected |
|---|---|---|
| D-21 | Assessment over time | One point per completed attempt, no interpolation |
| D-22 | Technical by category | Bar per category from real question results |
| D-23 | Skill category coverage | Per-category coverage; unassessed = empty, not 0 |
| D-24 | ATS over time | One point per saved resume version |
| D-25 | **Interviews split by role** (spec §79) | Separate line per role, never merged into one |
| D-26 | Empty chart | "No data yet", not an empty axis implying zero |
| D-27 | Responsive | Charts resize at 375 / 768 / 1440 px |

### Activity and streak

| # | Test | Expected |
|---|---|---|
| D-28 | Recent activity grouped by day | "Today" / "Yesterday" / date, candidate's local days |
| D-29 | Empty activity | Prompt, not an empty list |
| D-30 | Streak tile | Matches `/profile` exactly (same service) |

## Consistency check (spec §93)

| # | Test | Expected |
|---|---|---|
| D-31 | Dashboard vs profile | Backend readiness identical on both pages |
| D-32 | Dashboard vs career page | Role readiness identical on all three |
| D-33 | Interview card vs interview chart | The card's average equals the chart's points for the selected role |

## Known gap

The **Jobs pipeline chart** (Saved / Applied / Interviewing / Offers / Rejected,
spec §12) is **not yet** on the dashboard. `/api/jobs/saved` already returns the
per-status `counts`, and the Saved Jobs page renders them as tiles — the
dashboard just does not consume them yet.