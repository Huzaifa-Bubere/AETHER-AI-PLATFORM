# ATHER staged repair and acceptance ledger

## Rules

Preserve the initial working tree and credentials. Implement a coherent stage, run relevant checks, fix regressions, then proceed. Existing technical names, storage paths and API routes remain compatible unless a documented change is necessary. No destructive database migration is authorized by this plan.

## Stages

| Stage | Scope | Verification | State |
|---|---|---|---|
| 1 | Trace source, map features, record existing changes and baseline | Backend/frontend builds and existing tests | Architecture map recorded; baseline builds and 57 tests passed; remaining source audit continues by stage |
| 2 | Correct role vs plan, enforce candidate/admin boundaries | Auth matrix and existing HTTP/integration tests | Implemented; 68 tests passed at this stage; live MongoDB verification blocked |
| 3 | ATHER branding, shared light layout/navigation/error boundary | Type check/build, browser desktop/mobile review | Shared shell/branding implemented and build passed; full page consistency and visual verification remain open (browser unavailable) |
| 4 | Fingerprints, recent-history exclusion, exact difficulty and MCQ quality | Dedup, quota, shortage, snapshot and validation tests | Implemented text identity/cooldown/evidence rules; 77 tests passed; image OCR and broader semantic dedup remain open |
| 5 | Genuine RAG source/chunk/embedding/retrieval/generation pipeline and admin operations | Retrieval, ingestion security, provenance, grounded generation, unavailable behavior | Implemented source/admin/template/candidate flow; both builds pass, RAG unit checks pass, live embedding verified; MongoDB/provider end-to-end remains open |
| 6 | Shared Gemini transport, validated interview strategies and resume context | Behavioral/technical/system-design/coding routing and provider failures | Pending |
| 7 | Resume storage/parser/status, Python gateway, audio/video availability | Upload/parse/resume interview, capability/contract tests, Python startup | Pending |
| 8 | Secure coding execution and stored public/hidden test grading | Five languages, compiler/runtime/time limit/wrong answer/service unavailable | Pending |
| 9 | Actual analytics, consistent history, administration, payment/scheduling repairs | Aggregation, authorization, idempotency and failure tests | Pending |
| 10 | Proven-dead cleanup, dependencies, configuration and documentation | Reference search, installs/build/lint/tests, Docker validation | Pending |
| 11 | Live end-to-end acceptance | Isolated candidate/admin accounts, all difficulty/mode flows, unavailable services, refresh/logout | Pending |

## Architecture decisions

1. Node owns identity, authorization, permanent records, grading and AI orchestration. Python owns specialized parsing/audio/video/ML. Frontend calls Node.
2. Preserve working aptitude snapshots, optimistic finalization, deadline handling and the shared refresh coordinator.
3. Use MongoDB for RAG metadata/chunks and prefer Atlas Vector Search. Keep retrieval behind an interface, explicitly detect absent index/provider, and never label an ungrounded fallback as RAG. Confirm provider APIs from official documentation before implementation.
4. Generated cache lifetime must not delete assessment history. Persist fingerprints and attempt snapshots independently of expiring generated content.
5. Difficulty is a central rubric plus validated question properties; a model-supplied label alone is insufficient.
6. Candidate exhaustion must be explicit. Preserve requested difficulty and never recycle recent questions silently.
7. No fabricated production scores. Optional analysis can be unavailable while the core interview remains usable.

## Final acceptance (all open until verified)

- Frontend, Node, Python startup and MongoDB connectivity.
- Signup/login/admin login, refresh, logout, expiry, HTTP and browser role boundaries.
- Consistent ATHER light UI, responsive navigation and meaningful error/empty/loading states.
- Aptitude easy/medium/hard, technical MCQs, difficulty quality and recent question exclusion.
- Behavioral, technical, system-design and coding interviews with distinct behavior.
- Resume upload/parsing/analysis and resume-informed interview questions.
- Integrated audio/video with optional capability failure handling.
- Validated Gemini output, real retrieval and generated source provenance.
- Secure code execution and infrastructure-aware result classification.
- Permanent attempts/results, actual analytics/history and useful administration.
- Safe dead-code cleanup; builds, lint, business and integration tests.
- No secrets in source, logs, patches or commits; no fake production functionality.

## Delivery record

Track added/changed/removed files through Git and the stage log. Document additive database fields/indexes and compatibility handling; list environment names only. The final report must distinguish passed checks, failed checks, unavailable external services and remaining work. Do not mark the overall goal complete while acceptance items remain open.
