# Profile — Testing

**Scope (spec §24–§28):** a LinkedIn-**style** professional profile in AETHER
branding. Not a LinkedIn clone — no feed, no posts, no connections.

## Precondition

The profile reads from the same services as the dashboard, so it is only
meaningful once the candidate has some evidence. For an empty-state test, use a
freshly registered account.

## Automated checks — PASS

| # | Check | Result |
|---|---|---|
| P-1 | Profile service builds and typechecks | **PASS** |
| P-2 | Full backend suite green | **PASS** — 328 tests |
| P-3 | Completeness is a deterministic field count (no AI) | **PASS** by inspection — `getProfileCompleteness` counts filled fields only |
| P-4 | Frontend typecheck + build | **PASS** |

## Manual checks — NOT TESTED

### Hero (spec §25)

| # | Test | Expected | Actual |
|---|---|---|---|
| P-5 | Cover banner | Gradient or uploaded image | |
| P-6 | Avatar | Image, or initials fallback | |
| P-7 | Name + headline | Full name and professional headline | |
| P-8 | Location | Shown when set | |
| P-9 | Links | GitHub / LinkedIn / Portfolio only when set; open in a new tab | |
| P-10 | Open-to-work badge | Shown when enabled, with target roles | |
| P-11 | Edit profile | Links to `/settings` | |

### Sections (spec §26)

| # | Section | Expected when empty |
|---|---|---|
| P-12 | About | Prompt to add a summary — no placeholder bio | |
| P-13 | Target roles & progress | Prompts to choose a role | |
| P-14 | Skills | Prompts to take an assessment | |
| P-15 | Experience | Prompts to add experience | |
| P-16 | Education | Prompts to add education | |
| P-17 | Projects | Prompts to add projects | |
| P-18 | Certifications | Prompts to add certifications | |
| P-19 | Resumes | Prompts to build a resume | |
| P-20 | AETHER streak | Heatmap or honest empty state | |
| P-21 | Recent activity | Prompt, not an empty list | |

**None of these sections may render invented content.** An empty section shows
a prompt. This is the single most important check in this document.

### Completeness (spec §28)

| # | Test | Expected | Actual |
|---|---|---|---|
| P-22 | Deterministic score | Count of 9 filled fields, integer 0–100 | |
| P-23 | Missing list names the fields | "Missing: Professional summary, GitHub or portfolio link" | |
| P-24 | No AI involvement | Score identical across reloads; never inferred from content | |

### Skills show evidence (spec §27)

| # | Test | Expected | Actual |
|---|---|---|---|
| P-25 | Evidenced skill | Level label + the sources behind it | |
| P-26 | Self-declared skill | Explicitly labelled **Self-declared**, capped at Foundation | |
| P-27 | No meaningless bars | Levels and sources, not an unexplained percentage bar | |

### Streak and consistency (spec §93)

| # | Test | Expected | Actual |
|---|---|---|---|
| P-28 | Streak matches dashboard | Identical current/longest/active values | |
| P-29 | Role progress matches dashboard | Identical readiness percentage | |
| P-30 | Requirements expand | "View requirements" renders the same matrix as the role page | |

### Responsive

| # | Test | Expected |
|---|---|---|
| P-31 | 375 px | Sections stack; heatmap scrolls horizontally |
| P-32 | 768 px | Two-column skill grid collapses cleanly |
| P-33 | 1440 px | Hero and content constrained to a readable measure |

## Editing path

Profile *view* is `/profile`; editing is `/settings`. This split exists so the
profile can be a presentation surface and Settings stays a form.

`PUT /api/user/profile` persists `headline`, `about`, `coverImage`, `links`,
`openToWork`, `openToWorkRoles`, `experience`, `education`, `projects`,
`certifications` and `achievements`. Saving writes a `PROFILE_UPDATED` activity
event, which counts toward the streak.