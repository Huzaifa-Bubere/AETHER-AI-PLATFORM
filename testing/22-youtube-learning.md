# 22 — YouTube Learning Videos (real metadata, deterministic ranking)

**Feature:** Each lesson shows a relevant YouTube video discovered through the
YouTube Data API v3, ranked deterministically, stored in MongoDB, and rendered
from the stored record — the browser never calls YouTube.

**Scope:** video discovery, ranking, storage, refresh and failure handling.
Lesson rendering is covered in `10-career-learning.md`.

**Guardrails to keep verifying:**
- Every number (`viewCount`, `likeCount`, `duration`) is real API metadata; when
  the API omits it the field stays `null` and the UI omits it.
- No hardcoded videos anywhere — seed topics contain no video fields.
- Wording never claims “most viewed/liked on YouTube”; only “Highly viewed,
  relevant video”, “Popular recommended video” or “Recommended for this topic”.
- With no API key the system says so and stores nothing (no fabricated metadata).
- A deleted/private video is marked inactive and replaced on the next refresh —
  never a broken player.

---

## 1. Deterministic ranking (spec §42–§43, §72)

```bash
cd backend
npx tsc -p tsconfig.json
npx jest tests/learning-topics.test.js -t "YouTube"
```

**Result (actual):** all YouTube-related tests pass (`Tests: 32 passed` for the
whole file).

| Assertion | Detail |
| --- | --- |
| ISO-8601 durations | `PT18M42S` → 1122 s, `PT1H2M3S` → 3723 s, `P1DT1M` → 86460 s, garbage → `null` |
| Display formatting | `18 min`, `1h 2m`, `45s`, `2.4M`, `12.0K` |
| Query building | `Python variables beginner tutorial`, `System Design advanced tutorial`, `SQL intermediate tutorial` |
| Relevance | on-topic tutorial > unrelated gaming video > clickbait `#shorts` reaction |
| Duration suitability | unknown = 0.5 (neutral, never assumed ideal); peaks at 10–15 min |
| Channel confidence | curated educational channels score ≥ 0.9, unknown channels 0.5 |
| Rank order | the on-topic educational tutorial outranks a clickbait video an order of magnitude more viewed |
| Determinism | same candidate set in reverse input order produces the identical order |
| Missing statistics | never invented — the reason string does not invent a view count |
| Empty candidates | returns nothing (no placeholder video) |

Weights are fixed and documented in the service: `0.45 · relevance +
0.20 · normalised views + 0.15 · like rate + 0.10 · channel confidence +
0.10 · duration suitability`, with a stable id tiebreak.
`VIDEO_SELECTION_VERSION` identifies the selection algorithm; refresh interval
defaults to 30 days (`YOUTUBE_REFRESH_DAYS` overrides).

## 2. Storage model (spec §44)

`LearningVideo`: `topicId`, `topicSlug`, `youtubeVideoId`, `title`, `channelId`,
`channelTitle`, `thumbnail`, `duration` (ISO), `durationSeconds`,
`viewCount`, `likeCount`, `publishedAt`, `language`, `relevanceScore`,
`rankingScore`, `rankingReasons`, `searchQuery`, `fetchedAt`, `active`,
`inactiveReason`. Unique index on `{topicSlug, youtubeVideoId}`.

Tested: a video created without statistics keeps `viewCount`, `likeCount`,
`durationSeconds` and `publishedAt` as `null` and still validates (`active: true`,
no fabricated zeros).

## 3. Refresh flow (spec §45, §47)

`POST /api/admin/careers/videos/refresh` → `refreshAllTopicVideos({ slug?, onlyStale?, limit? })`:

1. Search candidates (`search` + `videos` endpoints, embeddable + safe search).
2. Rank deterministically, keep the top 4 per topic.
3. Upsert the winners, deactivate any stored video that no longer appears
   (`inactiveReason: "No longer returned by the latest refresh"`).
4. Stop immediately on a quota error and report `quotaExceeded: true` — stored
   videos are left untouched.

`POST /api/admin/careers/videos/validate` re-checks stored videos for
`privacyStatus === 'public'` and `embeddable !== false`, deactivating the rest.
The frontend reads the database only (`GET /api/careers/topics/:slug` →
`videos[]` + `videoStatus`); opening a lesson never triggers a search call.

## 4. No-API-key behaviour (spec §47, §72)

**Tested automatically.** With `YOUTUBE_API_KEY` unset:

| Call | Result |
| --- | --- |
| `refreshTopicVideos(topic)` | `{ searched: false, stored: 0, top: null }`, reason mentions `YOUTUBE_API_KEY` — no network call |
| `refreshAllTopicVideos()` | `configured: false`, `topicsProcessed: 0`, message explains the key is missing |
| `validateStoredVideos()` | `checked: 0` with the reason — it does not assume stored videos are fine |
| Lesson page | `videoStatus.configured: false`, `credentialRequest` explains that no metadata is fabricated, and the section states the lesson is complete without a video |

**Status: PASS (unit)**

---

## Manual pass (run before release)

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| M1 | Add `YOUTUBE_API_KEY` to `backend/.env`, restart, then `POST /api/admin/careers/videos/refresh` `{ "slug": "python" }` | `configured: true`, candidates > 0, videos stored with real `viewCount`/`likeCount`, `fetchedAt` now | BLOCKED — no API key configured in this environment |
| M2 | Open `/career-learning/topics/python` | Recommended video with thumbnail, channel, real view count, duration and “Why this video” reasons | BLOCKED — depends on M1 |
| M3 | Click **Watch** | Embedded player plays, or **Open on YouTube** works when embedding is disallowed | Not run — verify in browser |
| M4 | Run refresh twice in a row | Second run is idempotent (upsert, no duplicates), `fetchedAt` updates | BLOCKED — depends on M1 |
| M5 | Invalidate a stored `youtubeVideoId`, run validate | Video marked inactive with a reason and replaced by the next candidate | BLOCKED — depends on M1 |
| M6 | Exhaust quota (or use a bad key) and refresh | Honest quota error, previously stored videos kept, no fabricated metadata | Not run — logic verified in code |
