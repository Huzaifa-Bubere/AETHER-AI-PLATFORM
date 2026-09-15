# ATHER retrieval-augmented assessments

## Implemented flow

Admin source configuration -> permitted text import or bounded HTTPS fetch -> cleanup -> overlapping chunks -> Gemini embeddings -> MongoDB chunk storage -> topic-filtered vector retrieval -> source-grounded original MCQs -> structural/difficulty/citation validation -> independent model review -> fingerprinted seven-day question cache -> candidate attempt snapshot.

Generation occurs when starting a source-grounded test whose eligible cache cannot satisfy its exact difficulty plan. Page loads only inspect availability. Curated tests remain compatible. Recent attempts exclude questions by ID and normalized snapshot content for 30 days by default. Exhaustion produces an explicit error, never cross-difficulty substitution.

## Administration

1. Open **Admin -> Knowledge Sources**. Add a title, HTTPS documentation URL, topic and license/permission basis. Import permitted text or fetch a publicly accessible page. Imported content is sent to the configured embedding/generation provider.
2. Monitor the persisted ingestion status. A failed refresh retains the previous complete revision; no partially embedded revision is served. Interrupted jobs can be retried after their ten-minute lease expires.
3. Open **Test Management**. Enter the exact knowledge topic, one category and a difficulty plan totaling at most ten questions. Publishing requires an ingested source and AI configuration.
4. Candidates start the test from Aptitude or Technical Assessment. Generation may take several minutes when replenishing all three difficulty levels. The UI waits for the real API response.

Admin APIs: `GET/POST /api/admin/rag/sources`, `POST /sources/:id/ingest`, `PATCH /sources/:id`, `POST /generate`, `GET /cache` (relative to `/api/admin/rag`). Every route requires an authenticated admin. Disable sources rather than deleting history.

## Retrieval modes

`RAG_VECTOR_MODE=exact` is the bounded local/default mode: real embedding cosine similarity over at most 1,000 current chunks for a topic. It requires no extra infrastructure and fails explicitly above the bound. It is suitable for a small final-year deployment, not an unbounded production corpus.

`RAG_VECTOR_MODE=atlas` uses MongoDB's `$vectorSearch` stage. Create a vector search index named `ather_knowledge` (or `RAG_VECTOR_INDEX`) on the `ragchunks` collection with this definition:

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 768, "similarity": "cosine" },
    { "type": "filter", "path": "topic" },
    { "type": "filter", "path": "embeddingModel" },
    { "type": "filter", "path": "revision" }
  ]
}
```

No automatic fallback occurs if Atlas is selected but the index is unavailable. Queries and source chunks must use the same embedding model. Changing the model requires re-ingesting sources before they are eligible. The default model is `gemini-embedding-001`, with normalized 768-dimensional vectors. Live verification on 2026-09-15 confirmed the v1beta endpoint honors top-level `outputDimensionality`; the documented nested configuration was ignored and returned 3,072 values.

## Environment variable names

- Required existing configuration: `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `GEMINI_API_KEY`.
- Generation/model selection: `GEMINI_MODEL`, `GEMINI_EMBEDDING_MODEL`.
- Retrieval controls: `RAG_VECTOR_MODE`, `RAG_VECTOR_INDEX`, `RAG_MIN_SIMILARITY`.
- Source policy: `RAG_ALLOWED_HOSTS` (explicit comma-separated host allowlist).
- Repeat policy: `QUESTION_REPEAT_COOLDOWN_DAYS` (integer 1-365; default 30).

Do not put these private settings in frontend variables. The browser only calls Node.

## Source policy and limits

Fetches require allowlisted HTTPS documentation hosts, public IPv4 resolution pinned for both robots and content requests, no redirects, a 1 MB response limit and deadlines. Every robots Disallow is conservatively honored, including rules for other agents. A missing robots file is accepted; an inaccessible robots endpoint rejects fetching. Allowlisting is not a license grant: administrators must record and verify the source's permitted use.

Ingestion accepts at most 24 chunks per focused section. Source material is data, not instructions, in generation/review prompts. Validation requires citations to exact retrieved excerpts, one answer key, four distinct options, explanations, exact category/difficulty and difficulty evidence. Independent AI review is another quality signal, not a mathematical proof of correctness. Domain expert review remains valuable.

## Additive database changes

- New `ragsources` and `ragchunks` collections; ordinary indexes are created through Mongoose. Atlas search index requires the definition above.
- Optional question fingerprint and generation metadata, with a unique sparse generation key. Existing bank duplicates remain readable and are deduplicated during selection.
- Optional attempt snapshot fingerprint; existing snapshots are normalized on read. Deleted historical questions that predate snapshots cannot be reconstructed.
- Optional test `ragTopic`; empty values preserve curated-bank behavior.
- Question cache expiry controls selection eligibility; there is no destructive TTL deletion of questions or attempts. Old cache records/fingerprints and source revisions are retained for traceability. A bounded archival policy is a future operational improvement.

## Verification and limits

Unit checks cover input allowlisting, private-address rejection, robots rules, chunking, vector ranking, source diversity, missing retrieval, MCQ/citation validation, safe provider failure, cooldown and snapshot exclusion. Actual Gemini embedding requests returned 768 dimensions with the supported configuration. MongoDB live verification currently fails with a server-selection error, so end-to-end stored-source generation and Atlas index execution remain unverified. The browser provider is unavailable in this session.

Generation is currently an in-process bounded operation, with a persisted ingestion lease and database uniqueness protection. A durable worker queue is appropriate before horizontal scaling. Image-only duplicates at different URLs require OCR or perceptual hashing; only identical image URLs are currently deduplicated. Conservative text similarity does not catch every paraphrase.

## Primary references

- [Gemini embeddings API](https://ai.google.dev/api/embeddings)
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [MongoDB vector search](https://www.mongodb.com/docs/vector-search/)
- [MongoDB vector search aggregation](https://www.mongodb.com/docs/v7.0/reference/operator/aggregation/vectorSearch/)
