# 18 — Analytics Testing

**Scope:** every chart traces to DB records through the deterministic analytics service (`/api/analytics/*`). No random data, no AI-generated numbers.

## Precondition

Seed known data (spec §83-§84):
1. Technical assessment fixture: 10 DBMS questions, 7 correct → expect **70%**.
2. Course with 10 lessons, 4 completed → expect **40%**.

Sign in as the candidate test account.

## Tests

| # | Test | Steps | Expected | Actual | PASS/FAIL |
|---|---|---|---|---|---|
| 18.1 | Assessment accuracy bar | DB fixture above → `GET /api/analytics/technical-accuracy` → open **/analytics** | DBMS bar = **70**, tooltip shows `7/10 correct`. Not 69/72/random | | |
| 18.2 | Cross-check vs DB | Pick one category → `db.aptitudeattempts.find({userId})` → sum totalQuestions & correctAnswers | API `attempted`/`correct` equal manual sums | | |
| 18.3 | Learning % consistency | Course page shows 40% → dashboard learning card | Both show 40, basis text "4/10 lessons" | | |
| 18.4 | Line chart uses real dates | `/analytics` Assessment Score Over Time | Only dates where attempts exist; no interpolated points | | |
| 18.5 | Empty state (§13) | Fresh user, no attempts → /analytics | "Not enough data yet" with CTA — no chart, no 0% | | |
| 18.6 | Small-sample confidence (§14) | User with 2 questions | "Limited evidence" chip visible; values still shown | | |
| 18.7 | Skill radar not-assessed (§21) | Skill never assessed → radar | Axis labeled "Not assessed yet (shown at baseline, not zero ability)" — never 0 claim | | |
| 18.8 | ATS chart matches engine | Analyze known resume (testing/ats-fixtures) → save version | ATS Over Time chart = engine's exact totalScore | | |
| 18.9 | Provenance (§12) | Any chart → "Why this number?" | Shows source tables, sampleSize, calculationVersion, generatedAt | | |
| 18.10 | Filters don't invent data (§34) | Toggle 7d/30d/90d/All | Different DB windows; same values for overlapping records; no random recalculation | | |
| 18.11 | Dashboard hero basis (§7-§8) | /dashboard hero cards | Each metric card shows value + basis text ("N correct of M attempted…"); zero-data shows "—" + "Not enough data yet" | | |
| 18.12 | Career readiness formula (§27) | Set goal role + skill evidence | Readiness = documented weight formula from readiness.service; Gemini never returns it | | |
| 18.13 | AI insight grounding (§76-§78) | Where AI insights appear | Narrative cites metricIds/sample sizes; no "better than 80%" percentile claims | | |
| 18.14 | Chart loading (§74) | Throttle network | Skeleton with chart shape; no fake data flash | | |
| 18.15 | Chart error (§75) | Stop backend | "Unable to load analytics." + Retry — no mock substitute | | |

## Data-integrity sweep commands (§80)

```
grep -rn "Math.random\|faker\|mockScores\|dummyAnalytics\|sampleChartData" frontend/src backend/src ai-server/src
```

**Verified 2026-09-26:** only remaining matches are (a) ID generation using
timestamp+random suffix (not analytics), (b) removed legacy feedback
metrics — now fixed to zero/"not measured".
