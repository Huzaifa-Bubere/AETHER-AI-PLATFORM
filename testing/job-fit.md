# Job Fit — Testing

**Scope (spec §49–§56, §113):** AETHER's JOB REQUIREMENT MATCH for a pasted
description or a stored posting.

> This is **not** a hiring probability. AETHER cannot know whether an employer
> will hire anyone, so no output claims a chance of being hired. A test asserts
> every match label is free of `chance|probab|hired|hire|offer|success`.

## The documented formula (spec §53)

| Component | Weight | Source of truth |
|---|---:|---|
| Required skill coverage | 30 | Extracted JD skills vs the evidence-backed skill profile |
| Semantic resume ↔ JD match | 15 | Existing `atsEngine.matchJobDescription` |
| Experience / project evidence | 15 | Skills with project or resume evidence |
| AETHER skill profile alignment | 15 | Extracted JD skills present in the profile |
| Assessment evidence | 10 | Average `scorePercent` across completed attempts |
| Interview role evidence | 5 | Average report score for the selected role |
| Education / certification | 5 | Not evaluated — see below |
| Eligibility / work preference | 5 | Not evaluated — see below |
| **Total** | **100** | |

**Inaccessible components are excluded from the denominator, not scored zero.**
If Education is never evaluated, the score is normalised across the remaining
85 points. Scoring 0/5 for "we have no data" would understate a candidate whose
profile is merely incomplete in an unrelated area.

## Automated checks — PASS (`npx jest tests/jobs.test.js`, 15/15)

| # | Check | Result |
|---|---|---|
| F-1 | Weights sum to exactly 100 | **PASS** |
| F-2 | Calculation version recorded on every analysis | **PASS** |
| F-3 | Label bands exact (85 / 70 / 50) | **PASS** |
| F-4 | No hiring-probability language in any label | **PASS** |
| F-5 | §113 fixture: AWS → `NOT_EVIDENCED`, level `null`, not 0 | **PASS** |

## Manual checks — NOT TESTED

| # | Test | Steps | Expected | Actual |
|---|---|---|---|---|
| F-6 | Pasted JD | Paste a full description → Analyze fit | Requirements extracted, score shown | |
| F-7 | Stored posting | `/job-fit?jobId=<id>` | Uses that posting's description | |
| F-8 | Traceable score | Read "How this score was calculated" | Every component shows points + a basis sentence | |
| F-9 | Excluded components | New user, no assessments | Assessment/Interview show as excluded; total still meaningful | |
| F-10 | Short JD rejected | Paste 10 characters | Button disabled / server 400 with a clear message | |
| F-11 | Required vs preferred | JD with "Requirements" and "Preferred" sections | Bullets classified correctly | |
| F-12 | Matched list | Skill with evidence | Listed with its level, e.g. "Node.js ✓ (Job Ready)" | |
| F-13 | **Not evidenced** wording | Skill with no evidence | Listed as not evidenced + "this means nothing on your profile evidences these yet — not that you lack them" | |
| F-14 | Next actions → learning | Gap with a `learningTopicSlug` | "Learn" links to the real lesson | |
| F-15 | Recommended resume (spec §84) | Multiple resume versions | Role-matched one preferred; reason stated; resume never silently edited | |
| F-16 | Determinism | Re-run the same JD twice | **Identical** score — no AI in the number path | |
| F-17 | Role switch changes the result | Same JD, two roles | Interview-role-evidence component differs appropriately | |

## Required honesty checks (spec §50, §56)

| # | Test | Expected |
|---|---|---|
| F-18 | No "82% chance of getting hired" anywhere in the UI | Never appears |
| F-19 | Every point traceable | No unexplained score component |
| F-20 | Score label is present | "Strong / Good / Partial Requirement Match" or "Significant Gaps" |
| F-21 | Gemini not in the number path | Disconnect Gemini; the score still computes |

## Fixture (spec §113) — use `testing/ats-fixtures/`

```
job-description-backend.txt   ← the JD
```

Expected with a candidate whose resume + project evidence covers Node.js,
MongoDB and Docker but nothing evidences AWS:

- **Node.js** — EVIDENCED
- **MongoDB** — EVIDENCED
- **Docker** — EVIDENCED (project)
- **AWS** — NOT_EVIDENCED, level `null`

The UI must **not** say the candidate lacks AWS. It says nothing evidences it
yet, and offers a way to create that evidence.