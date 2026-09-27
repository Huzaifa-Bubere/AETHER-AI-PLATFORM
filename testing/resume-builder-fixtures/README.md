# Resume Builder Fixtures — Usage Guide

## Files

| File | Purpose |
|---|---|
| `sample-resume-data.json` | Complete resume matching the `ResumeVersion.data` schema. Use for **Import JSON** (if enabled) or as the body for `POST /api/resume-builder/versions` in API-level tests. Also the reference data for the PDF re-import test. |
| `target-jd-backend.txt` | Paste into **Target Job Description** panel to test live Job Match, Required/Preferred/Missing skill lists (spec §52). |

## Manual test script (record results in `testing/09-resume-builder.md`)

### A. CRUD + autosave (§110)
1. `/resume-builder` → **New Resume** → name it `Backend v1`, template **ATS Classic**.
2. Fill Personal Info (name, email, phone, location, links).
3. Add the two experience entries and two projects from `sample-resume-data.json`.
4. Watch autosave indicator: `Saving…` → `Saved` → navigate away and back → content persists (§37).
5. Reorder: move the second experience entry **Up** → refresh → order persists.
6. Duplicate the version → rename the copy `Backend v2 – Logistics` → both appear in the version list.
7. Set `Backend v1` as **Default** → refresh → default badge persists.

### B. Live ATS score (§50–§51)
8. With the resume open, note **Resume Quality** (e.g. 78/100).
9. Delete the phone number → score drops; the change explanation must show a contact-related deduction (e.g. "−2 Incomplete contact information").
10. Re-add phone and add a quantified bullet → score rises with a positive explanation. Never call Gemini per keystroke — scoring is local/deterministic and debounced.

### C. JD mode (§52)
11. Paste `target-jd-backend.txt` into Target JD.
12. Builder shows **Required** (Node.js, Express, MongoDB, Docker, Git…) and **Preferred** (AWS, Redis, TypeScript, Kubernetes) lists with **Matched** vs **Missing / Not Evidenced**.
13. Expected: most required skills matched; **AWS / Kubernetes** shown as *Not evidenced* (not "you don't know this").

### D. AI writing assistant (§53–§55)
14. Select the vague bullet "Fixed 40+ production bugs…" → **Improve Writing** → dialog shows **Original vs Suggested** → press **Cancel** → original text unchanged (never silently overwritten).
15. Press **Apply** on a suggestion → text updates + autosave fires.

### E. PDF export (§44–§45, §47)
16. Template **ATS Classic**, page size **A4** → **Download PDF** → button states `Preparing PDF… → Downloaded`.
17. Open the PDF: text is **selectable/searchable** (select your name and copy it). Filename resembles `Huzaifa_Bubere_Backend_Developer_Resume.pdf`.
18. Switch to **Letter** size → re-export → no clipped content.
19. Add enough content for **2–3 pages** → export → verify: no overlapping text, no cut-off sections, no unexpected blank page (§112).
20. Export **JSON** → file contains the full structured resume.

### F. PDF RE-IMPORT — mandatory (§46, §111)
21. Upload the PDF you just exported to **Resume Analyzer**.
22. Parser must recover: name, email, phone, skills, education, experience, projects.
23. Compare against `sample-resume-data.json`. If any core field is lost → **the export feature is NOT complete** (record FAIL and stop).

### G. Import existing (§49)
24. Upload `../ats-fixtures/resume-complete.txt` (or a PDF/DOCX) via **Import Resume**.
25. Builder shows imported draft + missing/low-confidence fields; verify before saving.
