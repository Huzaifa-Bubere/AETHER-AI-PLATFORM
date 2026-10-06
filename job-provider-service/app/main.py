"""
Job Provider Service (spec §7, §8, §9).

A deliberately TINY, isolated FastAPI service that wraps `python-jobspy`.

WHY A SEPARATE SERVICE (spec §8): python-jobspy pulls in requests, beautifulsoup4
and pandas. Forcing it into `ai-server/` would couple unrelated dependencies to
MediaPipe / ML stacks and raise the AI server's startup risk. This service has
no ML dependencies at all and can fail without affecting anything else.

COMPLIANCE (spec §12): this service does NOT bypass CAPTCHAs, does NOT use a
stealth browser, does NOT spoof fingerprints, does NOT automate logins and does
NOT rotate proxies to evade rate limits. It calls python-jobspy's public scrapers
with plain HTTP. If a source blocks us, it is reported as unavailable and the
other sources continue. Official APIs (RemoteOK, Adzuna) remain AETHER's
primary sources.

Sources are opt-in: only what JOBSPY_SOURCES lists is ever attempted. Nothing is
enabled by default.
"""
from __future__ import annotations

import logging
import os
import time
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("job-provider-service")

app = FastAPI(
    title="AETHER Job Provider Service",
    description="Optional JobSpy-backed sources for AETHER. Disabled by default.",
    version="1.0.0",
)


class JobSearchRequest(BaseModel):
    sources: list[str] = Field(default_factory=list)
    query: str = ""
    location: str = ""
    country: str = ""
    remote: bool = False
    jobType: str = ""
    resultsWanted: int = 25
    hoursOld: int = 168


def enabled_sources() -> list[str]:
    """Only sources explicitly opted into. Never everything at once (spec §11)."""
    raw = os.getenv("JOBSPY_SOURCES", "")
    return [s.strip().lower() for s in raw.split(",") if s.strip()]


def jobspy_enabled() -> bool:
    return os.getenv("JOBSPY_ENABLED", "false").strip().lower() in {"1", "true", "yes"}


def timeout_seconds() -> int:
    return int(os.getenv("JOBSPY_TIMEOUT_SECONDS", "30"))


@app.get("/health")
def health() -> dict[str, Any]:
    """
    Reports the four states AETHER distinguishes (spec §68):
    DISABLED / NOT_CONFIGURED / DEGRADED / ACTIVE.
    """
    enabled = jobspy_enabled()
    sources = enabled_sources()
    if not enabled:
        status = "DISABLED"
    elif not sources:
        status = "NOT_CONFIGURED"
    else:
        status = "ACTIVE"

    return {
        "service": "job-provider-service",
        "status": status,
        "enabled": enabled,
        "sources": sources,
        "sourcesResponded": [],
        "sourcesUnavailable": [],
        "timeoutSeconds": timeout_seconds(),
    }


@app.post("/jobs/search")
def search(request: JobSearchRequest) -> dict[str, Any]:
    """
    Runs a JobSpy search and returns RAW provider records.

    This service does NOT convert to AETHER's NormalizedJob shape — that is the
    Node adapter's job (spec §15). Provider-specific payload stays here.

    Per-source isolation (spec §13, §25): one failing source never aborts the
    others; failures are reported alongside the results.
    """
    if not jobspy_enabled():
        return {
            "status": "DISABLED",
            "results": [],
            "errors": ["JOBSPY_ENABLED is false; no sources were queried."],
        }

    allowed = enabled_sources()
    wanted = [s for s in request.sources if s in allowed] or list(allowed)
    if not wanted:
        return {
            "status": "NOT_CONFIGURED",
            "results": [],
            "errors": [f"No requested source is enabled. Enabled: {allowed or 'none'}"],
        }

    try:
        from jobspy import scrape_jobs
    except ImportError as exc:  # pragma: no cover - depends on deployment
        logger.error("python-jobspy is not installed: %s", exc)
        return {
            "status": "DEGRADED",
            "results": [],
            "errors": ["python-jobspy is not installed in this service."],
        }

    results: list[dict[str, Any]] = []
    errors: list[str] = []
    responded: list[str] = []
    unavailable: list[str] = []

    for source in wanted:
        # JobSpy exposes one function per site (naukri_jobs, indeed_jobs, ...).
        fn_name = f"{source}_jobs"
        fn = getattr(scrape_jobs, fn_name, None)
        if fn is None:
            unavailable.append(source)
            errors.append(f"source '{source}' is not supported by the installed python-jobspy")
            continue

        started = time.time()
        try:
            df = fn(
                search=request.query or None,
                location=request.location or None,
                country_indeed=request.country or None,
                remote=request.remote,
                job_type=request.jobType or None,
                results_wanted=min(max(request.resultsWanted, 1), 50),
                hours_old=max(request.hoursOld, 1),
            )
            responded.append(source)
            if df is None or len(df) == 0:
                errors.append(f"source '{source}' returned no rows")
                continue
            # Keep the DataFrame boundary explicit: everything downstream is a
            # plain dict, so pandas types never leak into AETHER.
            for record in df.to_dict(orient="records"):
                record["_source"] = source
                results.append(record)
            logger.info("source %s returned %d rows in %dms", source, len(df), (time.time() - started) * 1000)
        except Exception as exc:  # noqa: BLE001 - one source must not kill the rest
            unavailable.append(source)
            errors.append(f"source '{source}' failed: {exc}")
            logger.warning("source %s failed: %s", source, exc)

    status = "ACTIVE" if responded else "DEGRADED"
    return {
        "status": status,
        "results": results,
        "sourcesResponded": responded,
        "sourcesUnavailable": unavailable,
        "errors": errors,
    }