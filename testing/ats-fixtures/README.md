# ATS Fixtures — Usage Guide

Upload paths: **Resume Analyzer → Upload Resume** (PDF/DOCX/TXT accepted by the
backend's multer filter; TXT is useful when PDF tooling isn't at hand). Paste
the JD text into **Job Description** where a JD is required.

## Resume fixtures

| File | Use it for | Expected result |
|---|---|---|
| `resume-complete.txt` | §106 complete resume, §108 JD match | High Resume Quality; with `job-description-backend.txt`: Node.js/MongoDB/Docker/Git matched, AWS missing unless certification is counted; Job Match ≈ 70–85 |
| `resume-fresher.txt` | §106 fresher with projects | Lower Experience Quality (no experience section) but decent Project Quality; no crash on missing employment |
| `resume-low-quality.txt` | §106 vague/deduction checks | Low Bullet Quality + low Quantified Impact; deductions show reasons ("Worked on backend." flagged vague); missing phone/location noted in Contact score |
| `resume-keyword-stuffed.txt` | §109 keyword stuffing | **Must NOT outscore** a single legitimate mention. Repeated tokens collapse to one normalized concept; repetition flagged. Compare its JD Match against `resume-complete.txt` — stuffed ≤ complete |

## JD fixtures

| File | Use it for |
|---|---|
| `job-description-backend.txt` | §108 — matches the backend resume; verify REQUIRED vs PREFERRED split (must-have wording → REQUIRED; "preferred"/"bonus" → PREFERRED) |
| `job-description-frontend.txt` | Role/domain alignment — a backend resume against a frontend JD should lose Role Alignment points and show mostly-missing required skills |

## Key assertions (record actual numbers in TEST_STATUS.md)

1. **Determinism (§106):** upload `resume-complete.txt` + backend JD twice —
   base scores must be byte-identical (`scoringVersion` included in the response).
2. **No fake JD score (§107):** upload resume with empty JD →
   `jobMatchScore: null`, status `JOB_DESCRIPTION_REQUIRED`, UI shows
   "Add a Job Description to calculate role-specific compatibility."
3. **Synonym collapse (§112):** same skill written as alias
   (e.g. "Node" vs "Node.js" vs "NodeJS") must not double-count.
4. **Missing ≠ doesn't know (§115):** Docker missing from resume →
   UI must show **"Not evidenced on resume"** with
   `[ I know this skill ] [ Learn Docker ] [ Ignore ]` — never "You don't know Docker".
5. **Stuffed ≤ legitimate:** `resume-keyword-stuffed.txt` keyword-coverage
   score ≤ `resume-complete.txt` keyword-coverage score.
