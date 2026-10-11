# Role Requirements — Testing

**Scope (spec §34–§41):** the role requirement matrix, importance weights,
required levels, per-requirement evidence and gap → learning links.

## The documented formula (spec §39)

```
coverage(requirement) = min(userEvidenceLevel / requiredLevel, 1)
roleReadiness         = Σ(weight × coverage) / Σ(weight) × 100
```

Weights are fixed: **ESSENTIAL 3, RECOMMENDED 2, BONUS 1**.
Levels: **1 Foundation, 2 Working Knowledge, 3 Job Ready, 4 Advanced**.

Precision note: `coverage` is kept at full precision internally and rounded
once at the edges. Rounding per-requirement before the weighted sum was a real
bug found during this work — it turned an exact 50% into 49.9%.

## Automated checks — PASS (`npx jest tests/role-progress.test.js`, 14/14)

| # | Check | Expected | Result |
|---|---|---|---|
| RR-1 | Importance weights | ESSENTIAL 3, RECOMMENDED 2, BONUS 1 | **PASS** |
| RR-2 | Level labels | Foundation / Working Knowledge / Job Ready / Advanced | **PASS** |
| RR-3 | Unassessed requirement | `currentLevel: null`, `coverage: null`, `NOT_ASSESSED` | **PASS** |
| RR-4 | Unassessed still counts in the denominator | 1 met + 1 unassessed essential → 50, **not 100** | **PASS** |
| RR-5 | Coverage caps at 1 | level 4 vs required 2 → coverage 1, status MET | **PASS** |
| RR-6 | Weighted mean | ESSENTIAL met, RECOMMENDED half, BONUS unassessed → 66.7% | **PASS** |
| RR-7 | All essentials met → 100 | exact 100 | **PASS** |
| RR-8 | All-assessed role → 100 | exact 100 | **PASS** |
| RR-9 | Empty requirement list | `null`, not 0 | **PASS** |
| RR-10 | All-unassessed category | category coverage `null`, **not 0** | **PASS** (bug found and fixed by this test) |
| RR-11 | Next actions ordered by weight | ESSENTIAL gap beats a BONUS gap | **PASS** |
| RR-12 | Learning link attached | `learningTopicSlug` survives into the action | **PASS** |
| RR-13 | Met requirement never suggested | empty next actions | **PASS** |
| RR-14 | Lookup failure degrades | `NOT_ASSESSED`, no throw | **PASS** |

## Manual checks — NOT TESTED

| # | Test | Steps | Expected | Actual |
|---|---|---|---|---|
| RR-15 | Matrix renders | `GET /api/careers/roles/backend-developer/requirements` | Grouped by category with required vs current level | |
| RR-16 | Status icons | Matrix with mixed evidence | ✓ met, ⚠ needs improvement, ○ not assessed | |
| RR-17 | Evidence shown | Skill with several sources | Lists them (e.g. "Resume, Technical, Coding") | |
| RR-18 | **Learn link** (spec §41) | Unmet Docker requirement with `learningTopicSlug` | "Learn Docker" → `/career-learning/topics/docker` | |
| RR-19 | Learn link resolves | Follow the link | Real lesson content loads (not a 404 or empty drawer) | |
| RR-20 | Admin edit | `/admin/careers` → edit a role's requirements | Category, required level and importance persist | |
| RR-21 | Matrix survives reseed | Re-run `npm run seed:careers` | Requirement rows still valid (schema defaults applied) | |
| RR-22 | Legacy roles still load | A role seeded before the matrix existed | Loads with `CS_FUNDAMENTALS` / level 2 defaults | |

## Note on seeded roles

`npm run seed:careers` was written before the requirement matrix existed. Those
documents carry no explicit `category` or `requiredLevel`, so Mongoose applies
the defaults (`CS_FUNDAMENTALS`, level 2 = Working Knowledge). This keeps them
valid and loadable, but they are **not yet reviewed** by an admin — the matrix
for those roles is a default, not a curated set. `requirementsReviewedAt` on
the role marks when a human has actually reviewed it.

**Recommended follow-up:** populate the real matrix for Backend Developer, Data
Analyst and AI/ML Engineer, then set `requirementsReviewedAt`.