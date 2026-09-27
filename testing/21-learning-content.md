# 21 — Learning Content (database-backed, admin editable)

**Feature:** All lesson content lives in MongoDB as structured blocks and is
managed from `/admin/learning-content`. Editing a lesson changes what learners
see — with no React source change and no redeploy.

**Scope:** content authoring and delivery. The learner-facing page is covered in
`10-career-learning.md`; video discovery in `22-youtube-learning.md`.

**Guardrails to keep verifying:**
- Nothing on the lesson page is hardcoded JSX; unknown blocks render from data.
- A topic cannot be published as an empty shell.
- Seeded topics are original AETHER content with official documentation links.
- Every seed topic validates against the real schema (drift is a build failure).

---

## 1. Content model (spec §37–§38)

`backend/src/career/models/LearningTopic.ts`

| Field group | Fields |
| --- | --- |
| Identity | `slug` (unique, lowercase), `title`, `shortDescription`, `description`, `whyItMatters`, `interviewRelevance` |
| Taxonomy | `skillSlugs`, `roleSlugs`, `roadmapNodeIds`, `courseSlugs`, `moduleId`, `stageId` |
| Navigation | `group`, `order`, `level`, `estimatedMinutes`, `prerequisites`, `optionalPrerequisites`, `nextTopicSlugs`, `relatedTopicSlugs` |
| Lesson | `learningObjectives`, `sections` |
| Extension | `examples`, `commonMistakes`, `interviewTips`, `practice`, `quiz`, `resources` |
| Lifecycle | `status` (draft/review/published/archived), `contentVersion`, `source`, `reviewedBy`, `publishedAt` |

Block types rendered dynamically: `heading`, `paragraph`, `list`, `code`
(with `language`, `output`, `caption`), `tip`, `warning`, `note`, `table`,
`steps`, `compare`.

Indexes: unique `slug`; `{status, group, order}`; text index on
`title`/`shortDescription`/`description`; individual indexes on the taxonomy
arrays and `status`/`level`/`group`. Static helper `findPublishedBySlug`.

## 2. Publish gate (spec §31)

`POST /api/admin/careers/topics/:id/publish` refuses unless the topic has:

- ≥ 3 content sections
- ≥ 1 worked example
- ≥ 2 learning objectives
- ≥ 3 quiz questions

The response lists exactly what is missing. The same gate is enforced by
`validateTopic` in the seeder, and asserted for all 16 seeded topics by
`tests/learning-topics.test.js` (`seedTopicsIssues()` returns `[]`).

## 3. Admin CMS (spec §39)

Page: `/admin/learning-content` (also linked from `/admin/careers`).

| Capability | UI |
| --- | --- |
| Create | **New topic** → slug + title prompts → draft created |
| Edit | full editor: metadata, objectives, prerequisites, next/related, skill/role slugs, reviewed-by |
| Sections | add / reorder (↑↓) / delete, with per-type fields (code, list, steps, table with `|` cells, compare, callouts) |
| Examples | add / delete with title, kind, language, explanation, code, output |
| Quiz | add / delete, options as one-per-line, correct index, difficulty, topic tag, explanation |
| Practice / resources / mistakes / tips | add / delete rows |
| Lifecycle | Publish, Unpublish, Archive, live content-version display, **Preview lesson** link |
| Videos | stored inventory with ranking reasons, active state, refresh for a topic, bulk refresh, validate |

Every edit is stored in the database; learners see it on the next page load.

## 4. Test §71 — edit a lesson without touching React source

**Steps**
1. Open `/admin/learning-content`, select **Python**.
2. Change the first section heading to “What is Python (updated)?” and click **Save**.
3. Reload `/career-learning/topics/python`.

**Expected:** the updated heading appears; `contentVersion` increments; no code
change, no rebuild, no redeploy.

**Actual:** `PUT /api/admin/careers/topics/:id` applies only whitelisted editable
fields and bumps `contentVersion`; the lesson page renders whatever blocks are
stored. **Status: PASS (code path)** — the browser click-through was not run here.

## 5. Seeded content inventory (spec §40)

`npm run seed:topics` (idempotent, validates first):

| Group | Topics |
| --- | --- |
| Programming Languages | python, javascript, java |
| Version Control | git-github |
| Computer Science | data-structures, algorithms, dbms, operating-systems, computer-networks |
| Data | sql, mongodb |
| Backend & Infra | nodejs, rest-api, docker, system-design-basics |
| Frontend | react |

Each topic ships overview, why-it-matters, interview relevance, 7+ objectives,
10+ content blocks, 3–4 worked examples with outputs, common mistakes (wrong +
fix), interview tips, tiered practice and a 5-question quiz.

## 6. Verification commands

```bash
cd backend
npx tsc -p tsconfig.json                 # typecheck + build dist for jest
npx jest tests/learning-topics.test.js   # content + schema + grading + grounding
npm run seed:topics                       # idempotent upsert (validates first)
```

**Actual:** typecheck clean; 32 tests pass; the seeder validates and reports
unresolvable next/related slugs instead of silently linking to a dead page
(`LearningTopic.exists` check). Seeding itself was **not executed against the
project database** — see the note below.

---

## Manual pass (run before release)

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| M1 | `npm run seed:topics` | 16 topics upserted, `published`, warnings only for optional prerequisite slugs that do not exist yet | BLOCKED — requires a database; not run in this environment |
| M2 | `GET /api/careers/topics` as a learner | List grouped by `group` with per-user state | BLOCKED — needs a live stack |
| M3 | Edit Python as in §4 and reload the lesson | Updated content shows | BLOCKED — needs a live stack + browser |
| M4 | Publish a draft with 2 sections | HTTP 400 listing the missing content | Not run — logic verified by code and the mirrored seeder gate |
| M5 | Archive a topic | Topic disappears from `/career-learning/topics` (published filter) | Blocked with M1 |
