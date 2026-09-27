# 08 — Resume Analyzer (deterministic ATS + builder re-import)

**Feature:** `/resume` uploads a PDF/DOCX, extracts the text with the Python
parser, produces structured sections and computes a **deterministic** ATS score
from documented evidence categories. Gemini may narrate the result, never
produce it.

**Scope:** the analyzer itself is unchanged by this work. What changed is what it
must handle: PDFs exported by the new Resume Builder (see `09-resume-builder.md`)
must parse back correctly, and the ATS engine must accept the extended document
shape used by the builder.

**Guardrails to keep verifying:**
- The ATS score and category points come from `computeAtsScore` with fixed
  weights; no AI numbers, no random values.
- Missing keywords carry the honesty rule (“only add a keyword you genuinely have”).
- Formatting is never scored from a screenshot; scores come from structured content.

---

## 1. ATS engine stays deterministic (spec §27, §60)

```bash
cd backend
npx tsc -p tsconfig.json
npx jest tests/resume-builder.test.js
```

**Result (actual):** `Tests: 11 passed` — PASS.

| Assertion | Detail |
| --- | --- |
| Determinism | the same document scores identically on repeat calls |
| Weights | contact 10, sections 20, parsability 15, keywords 20, bullets 15, readability 10, measurable impact 10 — total 100 |
| Progress | a complete builder document scores clearly higher than an empty one |
| New fields | `title`, `languages`, `customSections`, `sectionOrder`, `pageSize`, `typography` neither crash nor inflate the score |
| Bullet findings | weak bullets surface concrete issues |
| JD matching | match score bounded, missing keywords listed (e.g. Kubernetes), honesty note present |

## 2. Builder PDF re-import (spec §24, §69 — the critical self-test)

**Command**

```bash
cd frontend && npm run resume:pdf-verify
```

This renders 8 sample resumes with the **real templates** and parses each one with
the **real parser service** (`ai-server/src/services/resume_parser.py`, PyPDF2).

**Result (actual):** `✓ Roundtrip verification PASSED — 8 PDF(s) parsed with all
required fields.` For every artifact:

| Recovered | Evidence |
| --- | --- |
| Name | `Huzaifa Bubere` |
| Email | `huzaifa.bubere@example.com` (never merged with the job title) |
| Phone | `+91 98200 41122` |
| LinkedIn / GitHub | both URLs |
| Summary | 214 characters |
| Skills | 19–21 recognised skills |
| Experience | entries with job title and employer readable |
| Projects | at least one entry |
| Education | 1 entry (`B.E. Computer Engineering` / `University of Mumbai`) |
| Certifications | 3 entries |
| Text layer | 1918–1941 characters on a one-page resume; no image-only PDF; no blank pages |

Node-side artifact checks (`npx jest tests/resume-pdf-artifacts.test.js`, 16
passed) additionally assert the `%PDF-` signature, the absence of
`/Subtype /Image`, and that every section heading and contact value is extractable.

## 3. Parser fixes this test forced

| Input | Before | After |
| --- | --- | --- |
| `B.E. Computer Engineering` | education section empty (regex only knew Bachelor / Master / B.Tech / M.Tech) | matched, plus institution and CGPA extraction |
| `B.Sc`, `BCA`, `MCA`, `B.Com`, `MBA`, `Diploma`, `HSC`, `SSC`, `12th`, `10th` | not recognised | recognised |
| `8.4 CGPA` | GPA pattern only matched `GPA:` | `CGPA` / `Percentage` / `Score` accepted |
| Institution | always empty | taken from the same line when it names a university/college/institute |

## 4. Existing fixtures

`testing/ats-fixtures/` keeps the analyzer fixtures (`resume-complete.txt`,
`resume-fresher.txt`, `resume-keyword-stuffed.txt`, `resume-low-quality.txt`,
`resume-*.txt`, job descriptions). `testing/resume-builder-fixtures/` holds
`sample-resume-data.json` + `target-jd-backend.txt` for the builder.

---

## Manual pass (run before release)

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| M1 | `/resume` → upload `frontend/tmp/sample-ats-classic.pdf` | Parser table shows name, email, phone, skills, experience, projects, education, certifications | Parser half verified via `npm run resume:pdf-verify` (real parser, same file); upload UI not run |
| M2 | Repeat with the other four templates | Same fields recovered for each | Verified by script for all 5 templates |
| M3 | Upload the 3-page PDF | All three pages parsed, no blank page, no truncated entry | Page counts and per-page text verified by script |
| M4 | Check the ATS panel | Score matches the builder's score for the same content, categories match the documented weights | Score determinism verified; equality across the two screens not compared in a browser |
| M5 | Paste a job description | Missing keywords listed with the honesty note | Unit-tested |
| M6 | Upload a PNG/JPG renamed to `.pdf` | Clear failure message, no fabricated analysis | Not run |

> No browser or live stack was available while this work was built; the re-import
> requirement was verified by running AETHER's own parser against its own exports.
