# 10 — Career Learning: Topic Pages (database-backed lessons)

**Feature:** Clicking a roadmap topic now opens a **complete lesson page** loaded
from MongoDB — overview, objectives, prerequisites, structured content, multiple
worked examples, common mistakes, interview relevance, tiered practice, a
server-graded quiz, a recommended video, resources, notes, bookmarks, progress
and next/related topics. “Ask AETHER” is supplementary, never the lesson itself.

**Scope:** the role roadmap, readiness/gap analysis and market snapshots are
unchanged. This document covers the new lesson layer.

**Entry points:**
- `/career-learning/topics/:topicSlug` (lesson page)
- `/career-learning/:roleSlug` (roadmap — a node click resolves to its lesson)
- `/admin/learning-content` (content CMS)

**Guardrails to keep verifying:**
- The page never depends on Gemini: with the AI server offline the lesson is
  still 100 % readable (spec §56).
- Nothing on the page is hardcoded JSX — the backend returns the topic document.
- Video metadata is never fabricated; view/like counts come from the API or stay null.
- Progress, bookmarks, notes and quiz scores survive a refresh.

---

## 1. Seeded content integrity (spec §31, §40)

```bash
cd backend
npx tsc -p tsconfig.json
npx jest tests/learning-topics.test.js
```

**Result (actual):** `Tests: 32 passed` — PASS. Covered:

| Assertion | Detail |
| --- | --- |
| Topic set | 16 authored topics including python, java, javascript, react, nodejs, sql, mongodb, dbms, operating-systems, computer-networks, git-github, docker, rest-api, system-design-basics, data-structures, algorithms |
| Publish gate | every seeded topic passes the same gate the admin CMS enforces (≥ 3 sections, ≥ 1 example, ≥ 2 objectives, ≥ 3 quiz questions) |
| Real lesson material | every topic has a substantial overview, “why it matters”, interview relevance, ≥ 3 objectives, ≥ 3 sections, ≥ 2 worked examples, ≥ 1 common mistake, ≥ 1 interview tip, ≥ 1 practice item, official-doc resources |
| Code examples | every topic has ≥ 1 code block and examples with code; block types are ones the renderer supports |
| Quiz validity | unique ids, ≥ 2 options, in-range `correctIndex`, explanation + topicTag + difficulty |
| Schema validation | every seeded topic validates against the real `LearningTopic` mongoose schema |
| No hardcoded video | seed topics contain no `youtubeVideoId` / `viewCount` / `likeCount` fields |

**Seeder:** `npm run seed:topics` (idempotent upsert by slug, published, bumps
`contentVersion`; validates before writing and refuses to seed thin content;
reports unresolvable next/related slugs).

## 2. Clicking a roadmap topic opens the lesson (spec §52–§53, §70)

**Resolution logic:** `resolveTopicForRoadmapNode(roleSlug, nodeId)` matches, in order:
1. explicit `roadmapNodeIds` link, 2. topic slug equals the node id,
3. strongest skill overlap with the roadmap node.

**Steps**
1. Open `/career-learning/backend-developer`.
2. Click a node such as **Python** or **Git & GitHub**.
3. If content exists → navigate to `/career-learning/topics/<slug>?role=…&node=…`
   (the URL keeps a “Back to the roadmap step” link).
4. If nothing is authored yet → the roadmap's own node drawer opens with an
   **Open full lesson** button instead of an empty panel.

**Expected on the lesson page:** title, group, level, estimated minutes, state
chip and quiz best score in the header; “What is X?”; learning objectives;
prerequisites (with completion state); content blocks with syntax label, copy
button and OUTPUT; ≥ 2 worked examples labelled Simple / User input / Real world /
Interview style; common mistakes with wrong + fix; interview tips; practice with
EASY / MEDIUM / CHALLENGE and reveal-able hints; recommended video; quiz;
official resources; next/related cards.

**Actual:** page implemented in `frontend/src/app/pages/LearningTopicPage.tsx`
with `features/learning/*` components; the route is declared before
`/career-learning/:roleSlug`. **Status: code + content verified (unit)** — browser
rendering not run here.

## 3. Quiz grading and recommendations (spec §57–§58)

```bash
npx jest tests/learning-topics.test.js -t "topic quiz grading"
```

| Case | Expected | Actual |
| --- | --- | --- |
| 4 / 5 correct | 80 % | PASS |
| 3 / 5 correct | 60 % — the `< 60` review boundary is not crossed | PASS |
| All-wrong mixed tags | weak tags deduplicated in question order | PASS |
| Missing / out-of-range answers | counted incorrect, never correct | PASS |
| Empty quiz | zero-score result, no throw | PASS |
| Grading | questions never mutated | PASS |

Grading is server-side (`POST /api/careers/topics/:slug/quiz`); the client never
receives the answer key before submitting. Wrong answers produce
`weakTags`, review recommendations and set the topic state to `REVIEW_NEEDED`
when the score is below 60 %.

## 4. Progress, bookmarks and notes persistence (spec §50, §73)

| Call | Behaviour |
| --- | --- |
| `PUT /api/careers/topics/:slug/progress` | `NOT_STARTED` / `IN_PROGRESS` / `COMPLETED` / `REVIEW_NEEDED` (unique per user + topic, survives refresh) |
| `POST /api/careers/topics/:slug/bookmark` | Toggle or set explicitly |
| `PUT /api/careers/topics/:slug/notes` | Learner notes (20 k cap) + last block position; the UI autosaves on a 900 ms debounce and shows Saving… / Saved |
| `GET /api/careers/topics` | Course navigation with per-user state and locked flags |

**Automated status:** state machine, grading and schema are covered by the suite.
**Manual status:** marking complete → refreshing → state persisting was not
exercised in a browser here.

## 5. Continue Learning and recommendations (spec §51, §59)

- `GET /api/careers/me/continue-learning` — resumable lessons with
  `progressPercent` derived from `lastBlockIndex` ÷ section count; empty state
  text when there is no activity.
- `GET /api/careers/me/topic-recommendations` — evidence order:
  REVIEW_NEEDED / weak quiz tags → target-role gaps → curriculum next →
  beginner cold start. Never a hardcoded list; reports `evidence` counts.
- Dashboard card `features/learning/ContinueLearningCard.tsx` renders both, with
  an honest **“No learning activity yet.”** state.

## 6. Ask AETHER stays supplementary (spec §55–§56)

`POST /api/careers/topics/:slug/ask` grounds the answer in the stored lesson
(`topicGroundingText`, capped at 12 000 characters) and offers quick prompts
(explain simply, another example, quiz me, interview question). If the AI server
is unavailable the panel shows a clear error while the lesson above remains fully
readable. Grounding behaviour is unit-tested (title, objectives, code blocks,
examples, common mistakes, truncation, minimal topics).

---

## Manual browser pass (run before release)

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| M1 | Seed topics (`npm run seed:topics`) then open `/career-learning/backend-developer` → click **Python** | Full lesson, not an empty drawer; no huge empty area | Not run — requires a live DB + browser |
| M2 | Scroll the lesson | Content blocks, ≥ 2 examples with outputs, mistakes, tips, practice, video section, quiz, resources, next/related | Not run |
| M3 | Click **Mark complete**, refresh | State stays completed; dashboard Continue Learning updates | Not run |
| M4 | Bookmark and add notes, refresh | Both persist | Not run |
| M5 | Submit the quiz with 2 wrong answers | Score, wrong topic tags, and a review recommendation for the weak tag | Not run |
| M6 | Stop the AI server, click Ask AETHER | Clear “AI unavailable” message; lesson still readable | Not run |
| M7 | Open `/career-learning/topics/python` while logged out of a role context | Page still renders the full lesson | Not run |

> No live database or browser was available while this work was built, so the
> runtime pass is outstanding. Everything else listed as PASS was verified
> through the automated suites and the checked-in content.
