"""
AETHER Resume Builder — export/parse roundtrip verification (spec §24, §69).

The builder must produce a PDF that AETHER's own Resume Analyzer can read back.
This script feeds the generated PDFs through the REAL parser service used by
`POST /api/resume/parse` and asserts that the structured fields come back.

    cd ai-server
    ./.venv/Scripts/python.exe scripts/verify_resume_roundtrip.py

Generate the PDFs first:

    cd frontend
    npx esbuild scripts/render-sample-resume.tsx --bundle --platform=node \\
      --format=cjs --outfile=tmp/render-sample-resume.cjs --external:@react-pdf/renderer
    node tmp/render-sample-resume.cjs

Exit code is 0 only when every artifact parses with all required fields.
"""
from __future__ import annotations

import asyncio
import io
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "ai-server" / "src"
sys.path.insert(0, str(SRC))

# Windows consoles default to cp1252 and cannot print the check marks.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # pragma: no cover - older interpreters
    pass

from services.resume_parser import ResumeParserService  # noqa: E402

PDF_DIR = ROOT / "frontend" / "tmp"

REQUIRED_FIELDS = {
    "contact_info.email": "email",
    "contact_info.phone": "phone",
    "contact_info.name": "name",
    "contact_info.linkedin": "linkedin",
    "contact_info.github": "github",
    "summary": "summary",
    "skills": "skills",
    "experience": "experience",
    "projects": "projects",
    "education": "education",
    "certifications": "certifications",
}

EXPECTED_VALUES = {
    "email": "huzaifa.bubere@example.com",
    "name_contains": "Huzaifa",
}


class Check:
    def __init__(self, label: str, passed: bool, detail: str = "") -> None:
        self.label = label
        self.passed = passed
        self.detail = detail


def page_report(path: Path) -> tuple[int, list[int]]:
    """(page_count, character_count_per_page) — catches blank pages and clipping."""
    from PyPDF2 import PdfReader

    reader = PdfReader(str(path))
    counts = []
    for page in reader.pages:
        counts.append(len((page.extract_text() or "").strip()))
    return len(reader.pages), counts


def flatten_skills(skills) -> list[str]:
    """The parser may return skills grouped by category (dict of lists) or flat."""
    out: list[str] = []

    def add(value) -> None:
        if isinstance(value, str):
            if value.strip():
                out.append(value.strip())
        elif isinstance(value, dict):
            add(value.get("skills"))
        elif isinstance(value, list):
            for item in value:
                add(item)

    add(skills)
    return out


def check_parsed(parsed: dict) -> list[Check]:
    checks: list[Check] = []
    contact = parsed.get("contact_info") or {}

    checks.append(Check("email recovered", contact.get("email") == EXPECTED_VALUES["email"],
                        f"got {contact.get('email')!r}"))
    checks.append(Check("phone recovered", bool(contact.get("phone")), f"got {contact.get('phone')!r}"))
    checks.append(Check("name recovered", EXPECTED_VALUES["name_contains"] in str(contact.get("name", "")),
                        f"got {contact.get('name')!r}"))
    checks.append(Check("linkedin recovered", "linkedin" in contact))
    checks.append(Check("github recovered", "github" in contact))

    skill_flat = flatten_skills(parsed.get("skills"))
    checks.append(Check("skills recovered", len(skill_flat) >= 5, f"{len(skill_flat)} skills: {skill_flat[:6]}"))

    experience = parsed.get("experience") or []
    checks.append(Check("experience recovered", len(experience) >= 1, f"{len(experience)} entries"))
    has_title = any("software engineer" in str(e).lower() for e in experience)
    checks.append(Check("experience keeps job titles readable", has_title, f"{str(experience)[:120]}"))

    projects = parsed.get("projects") or []
    checks.append(Check("projects recovered", len(projects) >= 1, f"{len(projects)} entries"))

    education = parsed.get("education") or []
    checks.append(Check("education recovered", len(education) >= 1, f"{len(education)} entries"))

    certifications = parsed.get("certifications") or []
    checks.append(Check("certifications recovered", len(certifications) >= 1, f"{len(certifications)} entries"))

    summary = parsed.get("summary") or ""
    checks.append(Check("summary recovered", len(summary) > 40, f"{len(summary)} chars"))

    raw_text = parsed.get("raw_text") or ""
    checks.append(Check("raw text extracted", len(raw_text) > 500, f"{len(raw_text)} chars"))
    checks.append(Check("no image-only PDF", "%PDF" not in raw_text and len(raw_text) > 500, "text layer present"))

    return checks


async def verify_file(service: ResumeParserService, path: Path) -> tuple[list[Check], int, list[int]]:
    data = path.read_bytes()
    parsed = await service.parse_resume(data, path.name)
    if isinstance(parsed, dict) and "data" in parsed and isinstance(parsed["data"], dict):
        parsed = parsed["data"]
    checks = check_parsed(parsed)
    # The canonical sample uses the Acme employer; the long variant uses
    # generated company names, so only that artifact is checked for it.
    if "long-three-page" not in path.name:
        checks.append(Check(
            "employer name recovered",
            "acme" in str(parsed.get("experience") or "").lower(),
            f"{str(parsed.get('experience'))[:120]}",
        ))
    pages, per_page = page_report(path)
    return checks, pages, per_page


def main() -> int:
    if not PDF_DIR.exists():
        print(f"✗ No PDF directory at {PDF_DIR}. Run the renderer first (see this file's docstring).")
        return 2

    pdfs = sorted(PDF_DIR.glob("sample-*.pdf"))
    if not pdfs:
        print(f"✗ No sample-*.pdf artifacts in {PDF_DIR}. Run the renderer first.")
        return 2

    service = ResumeParserService()
    failures = 0

    for pdf in pdfs:
        checks, pages, per_page = asyncio.run(verify_file(service, pdf))
        blank_pages = [i + 1 for i, c in enumerate(per_page) if c == 0]
        checks.append(Check("no blank pages", not blank_pages, f"blank: {blank_pages}" if blank_pages else ""))
        checks.append(Check("content on every page", all(c > 40 for c in per_page), f"chars/page {per_page}"))

        failed = [c for c in checks if not c.passed]
        status = "PASS" if not failed else "FAIL"
        print(f"\n{status}  {pdf.name}  ({pages} page(s), text chars/page: {per_page})")
        for c in checks:
            mark = "✓" if c.passed else "✗"
            suffix = f" — {c.detail}" if c.detail else ""
            print(f"    {mark} {c.label}{suffix}")
        failures += len(failed)

    print("\n" + ("=" * 72))
    if failures:
        print(f"✗ Roundtrip verification FAILED — {failures} check(s) did not pass.")
        return 1
    print(f"✓ Roundtrip verification PASSED — {len(pdfs)} PDF(s) parsed with all required fields.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
