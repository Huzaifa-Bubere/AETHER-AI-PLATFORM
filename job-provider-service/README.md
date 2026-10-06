# Job Provider Service

Optional, isolated FastAPI wrapper around [`python-jobspy`](https://github.com/speedyapply/JobSpy).

It exists so that JobSpy's scraping dependencies never touch `ai-server/` (MediaPipe / ML)
or the Node backend. AETHER's canonical store remains MongoDB; this service only returns
raw provider records, which the Node adapter normalizes into `NormalizedJob`.

## Status

**Disabled by default.** AETHER's primary sources are the official/public APIs
(RemoteOK, Adzuna). JobSpy is an optional extra.

## Compliance

This service does **not** bypass CAPTCHAs, does **not** use a stealth browser,
does **not** spoof fingerprints, does **not** automate logins, and does **not**
rotate proxies to evade rate limits. If a source blocks access or its terms make
integration unsuitable, that source is reported `sourcesUnavailable` and the
others still run. Check each site's terms before enabling it.

## Run

```bash
pip install -r requirements.txt
JOBSPY_ENABLED=true JOBSPY_SOURCES=naukri uvicorn app.main:app --port 8010
```

## Endpoints

- `GET /health` — `DISABLED` | `NOT_CONFIGURED` | `DEGRADED` | `ACTIVE`
- `POST /jobs/search` — runs the enabled sources, returns raw records

```bash
curl -X POST http://localhost:8010/jobs/search -H 'Content-Type: application/json' \
  -d '{"sources":["naukri"],"query":"backend developer","location":"Mumbai","resultsWanted":10}'
```
