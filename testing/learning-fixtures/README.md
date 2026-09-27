# Learning Fixtures — Usage Guide

## Setup

1. Seed `sample-courses.json` via the admin panel (course admin screens) or a
   one-off mongo insert — the JSON matches `backend/src/career/models/Course.ts`.
2. Sign in as a **candidate** test account.
3. Dashboard → set **Target Role = Backend Developer** (Career Intelligence page
   if the goal picker lives there — `UserCareerGoal`).

## Test script (record results in `testing/10-career-learning.md`)

### A. Catalog & course detail (§64–§65)
1. `/career-learning` → catalog shows the 3 seeded courses with skill, level,
   duration, prerequisites and status `Start`.
2. Open **REST API Development** → module/lesson tree renders
   (4 modules, quizzes, project card at the end).

### B. Progress persistence (§77–§78) — critical
3. Open lesson `HTTP Methods & Semantics` → mark/complete it.
4. **Refresh the browser.** Lesson still shows completed; progress % unchanged.
5. Complete a second lesson; check DB:
   `db.courseprogresses.find({ courseSlug: "rest-api-development" })` →
   lesson states `COMPLETED` with timestamps (collection name may differ —
   inspect `LearningProgress` model if queries fail).
6. Dashboard **Continue Learning** card shows the course + last visited lesson.

### C. Quiz → recommendation loop (§75–§76, §113)
7. Take **HTTP Fundamentals Quiz**, deliberately answer the *caching* question wrong.
8. Result screen shows score, correct/incorrect breakdown, and a
   **Recommended lesson** pointing back to `Caching Basics`.
9. Verify the quiz attempt persisted (`quizScores` on the progress document).

### D. Personalization (§83–§85, §114)
10. Ensure evidence: Node.js strong (resume has Node.js experience), DBMS weak,
    Docker not evidenced (use `resume-complete.txt` in the analyzer if needed —
    it covers Docker, so instead test with `resume-fresher.txt`-style profile
    or remove Docker from the resume version).
11. Open **Recommended Next** → expected: Database Indexing / Docker courses
    surfaced with a **WHY THIS?** expansion listing reasons
    (target role requires it, resume gap, prerequisites completed).
12. Node.js introductory content must NOT be recommended.

### E. ATS → Learning (§87, §115)
13. In **Resume Analyzer**, analyze a resume **without** Docker evidence against
    `../ats-fixtures/job-description-backend.txt` (Docker is required).
14. Result shows `Docker — Not evidenced on resume` with CTAs
    `[ I know this skill ] [ Learn Docker ] [ Ignore ]`.
15. Click **Learn Docker** → lands on the **Docker Fundamentals** course page.

### F. Notes & bookmarks (§93–§94)
16. In a lesson, add a note → refresh → note persists (autosave).
17. Bookmark the course + a lesson → Dashboard **Saved Learning** shows both.

### G. Weekly plan (§91–§92)
18. Set weekly goal **3 hours/week** → plan generates realistic blocks
    (e.g. MON Database Indexing 40 min, TUE Practice 30 min) drawn from
    incomplete lessons and weak skills, respecting prerequisites.

### H. Project evidence (§80–§81)
19. Open the **Task Management API** project in REST API Development →
    mark deliverables complete → course/project completion recorded.
20. Skill profile shows evidence entries for `rest-api-design`, `jwt-authentication`
    with source **Career Learning Project** and confidence per §100.

### I. AI resilience (§69, §74)
21. Open a lesson with network throttled / Gemini key disabled →
    full lesson content still renders from persistence; **Ask AETHER** panel
    shows a graceful error. Course remains usable.

### J. Determinism check
22. Repeat steps 7–8 with identical answers → identical score + identical
    recommendation (no AI variance in the base loop).
