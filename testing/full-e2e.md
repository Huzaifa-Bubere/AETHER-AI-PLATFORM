# Full End-to-End Journey — Testing

**Scope (spec §108, §109, §110, §113):** the connected-career-platform flow.

> AETHER must behave like ONE connected platform: every user action creates
> evidence, every metric comes from evidence, every recommendation explains why.

## Preconditions

1. Backend running (`cd backend && npm run dev`, or Docker).
2. Frontend running (`cd frontend && npm run dev`).
3. `npm run seed:careers` and `npm run seed:topics` executed so roles and
   lessons exist.
4. A fresh candidate account.

## Status

**PARTIAL.** The logic behind each step is covered by unit tests (see
`TEST_STATUS.md`), but this walkthrough was **not executed** — no browser was
available in the build environment. Every "Actual" cell is empty on purpose.

## The journey (spec §108)

| # | Step | Expected state change | Actual |
|---|---|---|---|
| E-01 | Register | Account created; `subscription.plan` = `free` | |
| E-02 | Login | Dashboard loads; `/` resolves to `/dashboard` | |
| E-03 | Set target role: Backend Developer | `UserCareerGoal` created with `isPrimary: true` | |
| E-04 | Open dashboard | Primary role = Backend Developer; readiness shown (likely "Not assessed") | |
| E-05 | View role requirements | Matrix grouped by category with required levels | |
| E-06 | Take technical test | `AptitudeAttempt` completed; `TECHNICAL_COMPLETED` activity | |
| E-07 | **Dashboard updates** | Technical Accuracy card shows score + basis "N correct / M answered" | |
| E-08 | Solve a coding problem | Submission stored; `CODING_SUBMITTED` (+`CODING_ACCEPTED` if accepted) | |
| E-09 | Efficiency feedback | GREEN / AMBER / RED per the deterministic complexity verdict | |
| E-10 | **Skill evidence updates** | Coding tags now appear as PROJECT_EVIDENCE in the skill profile | |
| E-11 | Take a Backend interview | Session completed; `INTERVIEW_COMPLETED` with `roleSlug` | |
| E-12 | **Backend role chart updates** | Backend interview line rises; **Data Analyst line unaffected** | |
| E-13 | Upload / build resume | `ResumeVersion` stored; `RESUME_UPDATED` activity | |
| E-14 | ATS analysis | Deterministic score stored on the version | |
| E-15 | Paste a job description | — | |
| E-16 | **Job fit result** | Score + label + traceable components; no hiring claim | |
| E-17 | Missing Docker | Listed as "not evidenced", with a Learn link | |
| E-18 | Learn Docker | `LearningTopicProgress` created | |
| E-19 | Complete lesson | `LESSON_COMPLETED`; evidence source **learning** | |
| E-20 | Take the quiz | `QUIZ_COMPLETED`; evidence source **learning** with the score | |
| E-21 | **Skill evidence updates** | Docker now shows project + learning evidence | |
| E-22 | **Dashboard updates** | Learning card and readiness both rise | |
| E-23 | **Profile streak updates** | Today's cell lit; current streak ≥ 1 | |
| E-24 | Search current Backend jobs | Only Backend postings; no Data Analyst leakage | |
| E-25 | Open a job | Full description, source, freshness stamp | |
| E-26 | Analyze fit | Fit stored against that posting; badge appears on the card | |
| E-27 | Save job | `SavedJob` created, status `SAVED` | |
| E-28 | Mark applied | Status `APPLIED`, `appliedAt` stamped | |
| E-29 | **Dashboard tracker updates** | Pipeline counts reflect `APPLIED` | |

## Multi-role journey (spec §109)

| # | Step | Expected | Actual |
|---|---|---|---|
| E-30 | Add Data Analyst as a second target | Two goals; Backend stays primary | |
| E-31 | Take a Data Analyst interview | Stored with its own `roleSlug` | |
| E-32 | **Separate progress** | Backend and Data Analyst progress differ correctly | |
| E-33 | **Separate recommendations** | Each role's next action targets its own gaps | |
| E-34 | **Separate jobs** | Role filter returns disjoint sets | |
| E-35 | Shared skill contributes | SQL evidence raises both roles, because both require it | |
| E-36 | Unrelated skill ignored | React evidence does not raise Backend readiness | |
| E-37 | Switch primary role | Dashboard focus changes; the other role is retained | |

## Streak journey (spec §110)

| # | Step | Expected | Actual |
|---|---|---|---|
| E-38 | Complete activity today | Today's cell active | |
| E-39 | Refresh | Streak unchanged | |
| E-40 | Timezone boundary | Set `Asia/Kolkata`, act near UTC midnight, streak survives | |

## Data-integrity assertions to run at the end

```js
// 1. No fabricated chart data anywhere in the source tree.
//    (already swept — see TEST_STATUS.md §4)

// 2. Activity events exist for every real action
db.useractivityevents.aggregate([
  { $group: { _id: "$eventType", n: { $sum: 1 } } }, { $sort: { n: -1 } },
])

// 3. Every activity has a real timestamp and a real user
db.useractivityevents.countDocuments({ occurredAt: { $exists: false } })   // expect 0
db.useractivityevents.countDocuments({ userId: { $exists: false } })      // expect 0

// 4. No duplicate job postings
db.jobpostings.aggregate([
  { $group: { _id: { p: "$provider", e: "$externalId" }, n: { $sum: 1 } } },
  { $match: { n: { $gt: 1 } } },
])   // expect 0 documents

// 5. Exactly one primary role goal per user
db.usercareergoals.aggregate([
  { $match: { status: { $ne: "ARCHIVED" } } },
  { $group: { _id: "$userId", p: { $sum: { $cond: ["$isPrimary", 1, 0] } } } },
  { $match: { p: { $gt: 1 } } },
])   // expect 0 documents

// 6. Job postings never carry an invented salary
db.jobpostings.countDocuments({
  $or: [
    { 'salary.min': { $exists: true, $ne: null }, 'salary.raw': { $exists: false } },
  ],
})
```

## If a step fails

Record the step number, the observed value, and the expected value in
`TEST_STATUS.md`. Do **not** mark a step PASS because the page rendered — every
step above asserts persisted state, not pixels.