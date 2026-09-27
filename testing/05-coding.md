# 05 — Coding: Complexity Optimization Feedback

**Feature:** After a submission is evaluated, AETHER compares the candidate's
*estimated* complexity with the problem's *validated* expected complexity and
shows GREEN / AMBER / RED / UNKNOWN feedback, an optional optimization hint, an
AETHER AI explanation and the reference optimized approach.

**Scope:** correctness scoring, Judge0 execution, AST analysis and hidden tests
are unchanged. This document covers the new post-submission optimization layer
only. Only a validated problem expectation can produce a RED warning, and AI
never decides the complexity verdict.

**Entry point:** `/coding/problems/:slug` → Submit → **Result / Analysis /
Complexity** tabs (and the toolbar level chip).

**Guardrails to keep verifying:**
- Correct code is never marked incorrect. Correctness and efficiency are separate.
- RED requires: `complexityGuidance.verified === true` **and** a clearly worse
  candidate (rank gap ≥ 2) **and** analyzer confidence ≥ threshold (default 0.7).
- Wording always says *estimated*; uncertainty is surfaced, never hidden.
- Gemini explains, but never classifies (spec §6, §9).
- `referenceApproach` and `optimizationHint` are stripped from the problem
  payload until a submission exists.

---

## Automated regression suite

**Command**

```bash
cd backend
npx tsc -p tsconfig.json          # tests import dist/
npx jest tests/coding-complexity.test.js
```

**Result (actual):** `Tests: 35 passed, 35 total` — PASS.

What it locks down:

| Group | Assertions |
| --- | --- |
| Canonicalization (§7) | `O(N)`, `O(n)`, `O(n*n)`, `O(N^2)`, `O(n²)`, `O(2^n)`, `O(n!)`, `logn`, `V+E` all normalize before comparison; unclassifiable input returns `null` instead of guessing |
| Metadata resolution (§6) | Curated `complexityGuidance` wins; `verified` is only true when the guidance was authored, never inferred |
| Confidence (§5) | `confidenceBand` maps analyzer confidence to LOW / MEDIUM / HIGH and respects `COMPLEXITY_CONFIDENCE_THRESHOLD` |
| Warning rules (§4) | The threshold/rank gates that decide GREEN vs AMBER vs RED vs UNKNOWN |

---

## 1. Best Time to Buy and Sell Stock — brute force (§66, §8)

**Fixture:** seeded problem `best-time-to-buy-and-sell-stock` with curated
guidance `expectedTime: O(n)`, `expectedSpace: O(1)`, `verified: true`,
`acceptedTimeClasses: ["O(n)"]`.

**Program (Python):**

```python
def maxProfit(prices):
    best = 0
    for i in range(len(prices)):
        for j in range(i + 1, len(prices)):
            best = max(best, prices[j] - prices[i])
    return best
```

**Expected:**
- Status `Accepted` (correct code is never punished).
- Estimated time `O(n^2)`, confidence HIGH, evidence mentions the nested loop.
- Expected efficient `O(n)`.
- RED — `CLEAR_OPTIMIZATION_OPPORTUNITY` with the optimization direction
  “track the minimum price seen so far”.

**Actual:** covered by the suite (`stock nested loops → RED while still
Accepted`); the verdict object carries `level`, `warn`, `headline`, `message`,
`reason`, `optimizationHint`, `evidence`, `threshold` and `confidence`.
**Status: PASS (unit)** — browser rendering verified manually below.

## 2. Best Time to Buy and Sell Stock — single pass (§66)

```python
def maxProfit(prices):
    low, best = float('inf'), 0
    for p in prices:
        low = min(low, p)
        best = max(best, p - low)
    return best
```

**Expected:** estimated `O(n)` ≈ expected `O(n)` → GREEN — “Your solution matches
the expected efficient complexity.”

**Actual:** suite assertion passes. **Status: PASS (unit)**

## 3. O(n log n) against an O(n) expectation (§4 AMBER)

**Expected:** AMBER — `POSSIBLY_IMPROVABLE`, message “This solution may be
optimizable.” (not RED — the gap is real but not dramatic).
**Status: PASS (unit)**

## 4. Uncertainty must not produce a false RED (§67)

| Case | Expected |
| --- | --- |
| Analyzer confidence below threshold | AMBER, never RED |
| Problem metadata not `verified` | AMBER/UNKNOWN, never RED |
| Language without AST support (no parse) | UNKNOWN with LOW confidence |
| Code the analyzer cannot classify | UNKNOWN — “Analysis uncertain”, no claim |
| Problem has no expected complexity | UNKNOWN, estimated only |

**Status: PASS (unit)**

## 5. AETHER AI explanation and reference approach (§9, §10)

**Steps**
1. Submit a RED-flagged solution.
2. In the result card click **Explain with AETHER AI**.
3. Click **Show Optimized Approach**.

**Expected**
- The AI receives candidate code, AST evidence, estimated complexity, canonical
  expected complexity, problem statement and the validated optimization hint, and
  must not contradict the deterministic verdict.
- With Gemini unavailable, the deterministic fallback explanation is still shown.
- The optimized approach shows approach title, explanation, time/space complexity
  and read-only reference code — the candidate's submission is never overwritten.

**Actual:** `GET /api/coding/submissions/:id/reference-approach` and
`POST /api/coding/submissions/:id/explain` implement this; the explanation
service falls back deterministically. **Status: PASS (code + route)** — UI click
path is manual (see below).

## 6. Complexity analytics use stored submissions only (§11, §60)

**Steps**
1. Submit 2 efficient and 2 optimizable solutions.
2. Open `/coding` → **Solution Efficiency**.

**Expected**
- “Efficient solutions X / Y” and “Optimizable X / Y” derived from stored
  `complexityCheck` records — no random values, no AI numbers.
- With no submissions the card shows an empty state instead of a fake chart.

**Actual:** `GET /api/coding/analytics/complexity` aggregates
`CodingSubmission.complexityCheck`; percentages are `null` (not 0) when there is
no data, and `emptyState` explains it. **Status: PASS (code)** — values verified
via the aggregation code and the DB-backed fields, not by a live click-through.

---

## Manual browser pass (run before release)

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| M1 | `/coding/problems/best-time-to-buy-and-sell-stock` → paste nested-loop solution → Run/Submit | Accepted, score shown, both complexities shown | Not run in this environment — verify in browser |
| M2 | Scroll to the warning card | RED card with optimization hint button, no incorrectness claim | Not run — verify in browser |
| M3 | Click **Explain with AETHER AI** | Explanation references the nested loop; numbers match the card | Not run — needs Gemini key (falls back to deterministic text without it) |
| M4 | Click **Show Optimized Approach** | Reference O(n) code with language tabs; submission unchanged | Not run — verify in browser |
| M5 | Submit the single-pass solution | GREEN card | Not run — verify in browser |
| M6 | Submit `python` code with an unparseable construct | UNKNOWN/LOW confidence, **no** RED | Not run — verify in browser |

> A browser session was not available in the environment where this work was
> built. Everything above that is not marked PASS was verified at the API/schema
> level only; the unit suite covers the decision logic in full.
