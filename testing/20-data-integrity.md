# 20 — Data Integrity

**Scope:** "Where did this number come from?" must always have a real answer (§80, §91).

## Automated sweep

Run from repo root:

```bash
# Production source only (tests/fixtures excluded by path)
grep -rn "Math.random\|faker\|mockScores\|dummyAnalytics\|sampleChartData\|fakeData" \
  frontend/src backend/src ai-server/src \
  --include="*.ts" --include="*.tsx" --include="*.py" \
  | grep -v "test\|spec\|fixtures\|generate_sample"
```

**Verified 2026-09-26.** Remaining legitimate uses:
- ID/token generation (`recording_incoming_…`, `int_…`, `imp_…` batch ids) — uniqueness, not analytics.
- `frontend/src/app/components/ui/sidebar.tsx` skeleton — uses deterministic index-based width (Math.random removed).

**Fixed during this task:**
- `backend/src/routes/feedback.ts` — legacy video/audio metrics previously generated
  `Math.random()`-based eye-contact/posture/speech values. Now remain 0 ("not measured");
  real values come from behaviorAnalysis + speakingMetrics.

## Cross-module consistency checks

| # | Check | Method | Expected | PASS/FAIL |
|---|---|---|---|---|
| 20.1 | Analytics == DB | Manual aggregation of one category from `aptitudeattempts` vs `/api/analytics/technical-accuracy` | Identical | |
| 20.2 | Learning == progress store | Course page % vs dashboard hero vs `/api/analytics/learning` | All identical | |
| 20.3 | ATS == engine output | ATS breakdown chart vs `computeAtsScore()` response object | Chart equals engine exactly | |
| 20.4 | Readiness == service formula | Hero readiness vs readiness.service recomputation | Identical; no AI involvement | |
| 20.5 | Market data sourced (§28) | Career Intelligence charts | Each point has source/period/region from stored snapshots; empty dataset shows "Market trend data is not available…" | |
| 20.6 | Usage ledger audit | `/api/subscription/me` usage vs `db.usageledgers.countDocuments({userId, feature, createdAt >= monthStart})` | Equal | |
| 20.7 | No fake revenue (§67) | Admin billing (when present) | Revenue only from payment ledger; estimates labelled | |
| 20.8 | Timestamps real | Any line chart | X-axis dates exist in the source collection (no interpolated points) | |

## AI numeric-claim guard (§30-§31)

- Where AI narration exists (ATS explain, insights), the prompt receives the
  deterministic metrics and is instructed to explain — never compute.
- Verify: prompt strings contain the metric payload; responses render alongside
  (not instead of) deterministic values.
