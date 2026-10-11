# Multi-Role — Testing

**Scope (spec §29–§33, §109):** a candidate can target several roles at once;
each has independent progress; evidence never leaks between unrelated roles.

## Precondition — run the migration first

```bash
cd backend && npm run migrate:multi-role
```

The migration is **idempotent**: it drops the old single-field unique index on
`UserCareerGoal.userId`, creates the compound `{ userId, roleSlug }` unique
index, backfills `isPrimary` / `priority` / `targetLevel` / `status` /
`roadmapProgress`, and guarantees **exactly one primary goal per user**.

> **NOT RUN in the build environment** — this writes to your MongoDB.

Verify afterwards:

```js
db.usercareergoals.aggregate([
  { $match: { status: { $ne: "ARCHIVED" } } },
  { $group: { _id: "$userId", primaries: { $sum: { $cond: ["$isPrimary", 1, 0] } }, roles: { $sum: 1 } } },
  { $match: { $primaries: { $gt: 1 } } },
])
// Must return zero documents: no user may have more than one primary goal.
```

## Automated checks — PASS

| # | Check | Where | Result |
|---|---|---|---|
| M-1 | Role readiness formula | `tests/role-progress.test.js` | **PASS** — 14/14 |
| M-2 | Unassessed is not zero | same | **PASS** |
| M-3 | Confidence → level bands | `tests/skill-evidence.test.js` | **PASS** — 11/11 |
| M-4 | Self-declaration capped at Foundation | same | **PASS** |
| M-5 | Evidence lookup failure degrades to NOT_ASSESSED | `tests/role-progress.test.js` | **PASS** |
| M-6 | Backend builds, full suite green | `npx jest` | **PASS** — 315 tests |

## Manual checks — NOT TESTED

| # | Test | Steps | Expected | Actual |
|---|---|---|---|---|
| M-7 | Add a second role | `POST /api/careers/me/goals {roleSlug:'data-analyst'}` | Both goals returned; first stays primary | |
| M-8 | Switch primary | `POST /api/careers/me/goals/data-analyst/primary` | Data Analyst primary, Backend demoted; **still exactly one** | |
| M-9 | Duplicate guard | Add `backend-developer` again | `409 DUPLICATE_GOAL`, existing goal untouched | |
| M-10 | Unknown role | Add `roleSlug:'not-a-role'` | `404 ROLE_NOT_FOUND` | |
| M-11 | Archive keeps history | `DELETE /api/careers/me/goals/backend-developer` | Goal `ARCHIVED`; activity, progress and evidence retained | |
| M-12 | Never zero active roles | Archive the primary role | Next goal is promoted automatically | |
| M-13 | **Separated progress** (spec §33) | Target Backend + Data Analyst; complete a Backend interview | Backend interview progress rises; **Data Analyst unchanged** | |
| M-14 | **Separate recommendations** | Both roles have different gaps | `/careers/me/progress` returns different `nextActions` per role | |
| M-15 | **Separate jobs** | `/jobs?role=backend-developer` vs `?role=data-analyst` | Different posting sets, no unrelated mixing | |
| M-16 | Shared skill contributes | Complete SQL evidence once | SQL contributes to Backend, Data Analyst **and** Data Engineer, because each role's matrix requires it | |
| M-17 | Unrelated skill does not | Complete only React evidence | React does **not** raise a Backend role's readiness | |
| M-18 | Dashboard role switch | Switch role on `/dashboard` | Readiness, charts and next action all change; one request per switch | |
| M-19 | Profile matches dashboard | Compare Backend readiness on both pages | **Identical number** — they read one service | |

## Expected behaviour for M-13 (spec §109)

Add `Backend Developer` and `Data Analyst`. Take one Backend interview and one
Data Analyst interview.

- Backend: interview evidence present, Data Analyst-specific gaps unchanged.
- Data Analyst: interview evidence present under its own role only.
- A SQL lesson completed once appears in both role matrices, because SQL is a
  requirement of both — this is the "shared relevant skills" case and it is
  intended, not a leak.
- A React project raises neither role's readiness unless React is in that
  role's requirement matrix.