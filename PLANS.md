# CodeInspect — Implementation Plan

This plan turns SPECS.md into a buildable sequence of milestones. It picks concrete defaults where SPECS lists options, defers genuinely future work (graph intelligence), and orders work so each milestone produces something runnable/demoable end-to-end before adding sophistication.

## Scope decisions (defaults, revisit later)

| Area | Choice | Why |
|---|---|---|
| Monorepo vs polyrepo | Monorepo (pnpm workspaces or Nx) | One event schema, shared types, easier local dev of 5 services |
| Message broker | RabbitMQ (topic exchange, routing key = event name) | Matches the sibling project's proven pattern; durable queues per consumer, easy to add new subscribers without touching publishers |
| Vector store | PostgreSQL + pgvector | One database for metadata + vectors early on; avoids running a second stateful service before it's justified |
| Keyword index | PostgreSQL Full Text Search | Same reasoning — Elasticsearch/OpenSearch is a later swap once query volume demands it |
| Embeddings | Self-hosted `BAAI/bge-small-en-v1.5`, served by a dedicated Embedding Service | No per-token cost, no external dependency for a core pipeline stage; 384-dim vectors are cheap to store/index at MVP scale |
| Reranker | Cohere Rerank API | Fastest to integrate; LLM-based/BGE reranker considered later for cost |
| Repo storage | Local disk volume keyed by projectId, mounted/shared across API+Checkout+Parse | Object storage (S3) upgrade once running multi-node |
| Graph-aware intelligence | Explicitly out of scope until Milestone 6+ | SPECS marks it "Future"; don't build Neo4j infra prematurely |
| Live chat state (Milestone 4) | Redis cache (`chat:{uuid}`) polled by a backend WebSocket gateway | Mirrors the sibling project's proven experiment-chat pattern; a handful of discrete pipeline-step updates don't need token-level streaming infrastructure |

Each of these is a boundary, not a rewrite trap: services talk to interfaces (`VectorStore`, `KeywordIndex`, `EventBus`) so swapping pgvector→Weaviate or RabbitMQ→Kafka later doesn't touch business logic.

## Milestone 0 — Repo & contracts skeleton

Goal: nothing functional yet, but every service can be scaffolded against a shared contract.

- Monorepo scaffold: `apps/api`, `apps/checkout-service`, `apps/parse-service`, `apps/embedding-service`, `apps/index-service`, `apps/retrieval-service`, `apps/web` (Next.js), `packages/shared` (event types, DTOs).
- Define event envelope shared across all services:
  ```ts
  interface CodeInspectEvent<T> {
    event: string;        // "code-inspect.project.started"
    projectId: string;
    timestamp: string;
    payload: T;
  }
  ```
- Define Postgres schema v1: `projects`, `project_status_history`.
- Docker Compose for local dev: Postgres (with pgvector extension), RabbitMQ.
- CI: lint + typecheck + build across workspace.

Exit criteria: `docker compose up` brings up Postgres+RabbitMQ; all app shells boot and log "ready".

## Milestone 1 — Project lifecycle, no intelligence yet

Goal: a user can submit a repo URL and watch it move CREATED → CHECKED_OUT, backed by real events. No parsing/indexing yet — prove the event spine works.

**API Service (NestJS)**
- `POST /projects { repositoryUrl, branch }` — validate URL (reachable, GitHub host, public repo only for now), create row in `projects` (status=CREATED), publish `code-inspect.project.started`.
- `GET /projects/:id` — return status + timestamps.
- `GET /projects/:id/events` — SSE or polling endpoint for the frontend to watch status transitions live.

**Checkout Service (worker)**
- Subscribe to `code-inspect.project.started`.
- `simple-git` clone to `/repositories/{projectId}`, checkout branch.
- On success: update status CHECKED_OUT, publish `code-inspect.project.checked_out` with `repoPath`.
- On failure: publish a `code-inspect.project.failed` event (not in original SPECS diagram but necessary — add it now so error handling isn't bolted on later) with reason; API marks project FAILED.

**Frontend (Next.js)**
- Minimal form: paste repo URL → submit → status page polling `/projects/:id`.

Exit criteria: submitting a real public GitHub URL visibly transitions CREATED → CHECKED_OUT (or FAILED with a reason) in the UI.

## Milestone 2 — Parse Service: AST extraction

Goal: cloned repos become structured symbols in Postgres.

- Subscribe to `code-inspect.project.checked_out`.
- File walker respecting include/exclude lists from SPECS (`.js/.ts/.php/.go/.yaml/.yml/.md`; skip `.git/node_modules/vendor/dist/build/coverage`, binaries by extension + a content sniff for null bytes).
- Tree-sitter grammars for JS, TS, PHP, Go; simple structural parsers for YAML (K8s resource kind/name/spec) and Markdown (headings as sections) since Tree-sitter's value there is lower.
- Extract per SPECS' Code Intelligence Model: files, symbols (class/function/method/interface), imports, and a best-effort `dependencies` list per symbol.
- Schema v2 additions: `files`, `symbols`, `symbol_dependencies`, `api_endpoints` (detect route decorators/handlers for common frameworks — Express, NestJS, Go net/http, Laravel — as a first pass; extend per-framework later).
- Store raw extracted content alongside metadata (needed later for embeddings + context building).
- On completion: status PARSED, publish `code-inspect.project.parsed`.

Exit criteria: for a sample multi-language repo, `symbols` table is populated with correct names/types/files, verified against a hand-picked sample of known functions/classes.

## Milestone 3 — Embedding Service + Index Service: embeddings + keyword index

Goal: symbols become searchable two ways. Split into two services so the model-serving concern (load once, keep warm, scale by throughput) is independent of the indexing pipeline concern (chunk, call embeddings, write to Postgres).

**Embedding Service** (new)
- Standalone NestJS HTTP service running `BAAI/bge-small-en-v1.5` locally via `@xenova/transformers` (ONNX/WASM) — no external API calls, no per-token cost, no network dependency for a core pipeline stage.
- `POST /embed { texts: string[] }` → `{ embeddings: number[][], model, dimensions }`; batches internally to keep memory bounded on large requests.
- Model loaded once at boot and kept warm in memory. Stateless, so it scales horizontally by adding replicas if embedding throughput becomes the bottleneck.

**Index Service** (responsibilities unchanged from the original single-service design — only the embedding source changes)
- Subscribe to `code-inspect.project.parsed`.
- Chunking strategy: one chunk per symbol (function/method/class body) plus one per doc section; oversized symbols split with overlap.
- Call the Embedding Service (instead of OpenAI) in batches, store vectors in pgvector table `symbol_embeddings (symbol_id, embedding vector(384), model, chunk_text)` — 384 dimensions to match `bge-small-en-v1.5`'s output.
- Build Postgres FTS index (`tsvector` column + GIN index) over the same chunk text plus symbol names (boost exact name matches).
- Idempotency: re-indexing a project (e.g. re-run) should upsert, not duplicate.
- On completion: status INDEXED, publish `code-inspect.project.indexed`, then immediately publish `code-inspect.project.ready` (no additional stages yet — matches SPECS' note that future stages slot in without changing the READY contract).

Exit criteria: given a query string, direct SQL against pgvector and FTS both return sane results for a known symbol; killing/restarting the Embedding Service doesn't affect Index Service beyond a retry on its next call.

## Milestone 4 — Retrieval Service: hybrid search + LLM answers, chat-style

Goal: ask a question, watch the answer assemble step-by-step, get a cited response. This mirrors the sibling project's event-driven chat pattern instead of a single synchronous request/response: backend creates a DB row + a live Redis cache and publishes a start event; a worker updates that cache incrementally as it works through the pipeline; backend polls Redis over a WebSocket to push updates, then persists the final state once the worker publishes completion. See `../model-arena/backend/src/experiment` (`ExperimentService`/`ExperimentGateway`/`RedisService`) and `../model-arena/candidate-agent` (`ExperimentManager`'s `append_thinking`/`set_reply`) for the exact pattern being mirrored.

**New infrastructure**: Redis, added to this project for the first time — purely as an ephemeral live-state cache for in-progress chats (key `chat:{uuid}`), polled by backend's WebSocket gateway. RabbitMQ remains the only message broker; Redis here never carries events.

**Backend (NestJS)**
- `POST /api/chat { projectId, question }`:
  - Validates the project exists and is `READY`.
  - Persists a `Chat` row: `{ id, uuid, projectId, contents, status, createdAt, updatedAt }` — `contents` (jsonb) starts empty and is filled in once the run completes, mirroring the sibling's `experiments`/`results` split (Postgres holds the final state, Redis holds the live one).
  - Writes the initial cache blob to Redis at `chat:{uuid}`: `{ chatId, projectId, question, messages: [], status: 'running', updatedAt }`.
  - Publishes `code-inspect.chat.started` with `{ chatId, projectId, question }`.
  - Returns `{ id: uuid }` immediately.
- `GET /api/chat/:uuid` — returns the persisted `Chat` row (for reloading a completed conversation).
- WebSocket at `/ws/chat?uuid={uuid}` (query param, not a path segment — `@nestjs/platform-ws` matches upgrade requests by exact literal pathname, the same constraint the sibling project's `ExperimentGateway` works around): per-connection `setInterval` polling Redis every 500ms, diffing the payload before sending, closes once `status !== 'running'`.
- Subscribes to `code-inspect.chat.completed` / `code-inspect.chat.failed`: writes `contents` and `status` onto the `chats` row, then deletes the Redis key after a short grace delay so the WS gateway can push the final state first.

**Retrieval Service** (new worker, subscribes to `code-inspect.chat.started`)

For each step below: load the Redis cache, append a message (`{ step, actor, status: 'isThinking', response: null }`), do the work, then flip that message to `status: 'hasReplied'` with the result — the same `append_thinking`/`set_reply` shape as `candidate-agent`'s `ExperimentManager`, including its reliance on strictly sequential execution rather than locking (safe here since one chat's steps always run in order within a single handler invocation, never fanned out in parallel).

1. **Query understanding** — light step: expand query with synonyms/related terms (no-op passthrough for MVP; upgrade path is LLM-based query rewriting).
2. **Hybrid retrieval** — vector search (top ~50) + BM25/FTS search (top ~50) over the project's `symbol_embeddings`.
3. **Result fusion** — reciprocal rank fusion merges the two candidate lists into ~20.
4. **Reranker** — Cohere Rerank narrows 20 → 5.
5. **Context builder** — assembles the 5 chunks with file path, symbol name, and surrounding metadata into a prompt.
6. **Answer** — Claude (Anthropic API) call; the reply carries the answer text plus citations (file/symbol/line) derived from the context chunks.

On completion: publish `code-inspect.chat.completed` with `{ chatId, projectId }` (backend reloads the full message list from Redis rather than the event carrying it, same as the sibling's terminal events). On any step failing: publish `code-inspect.chat.failed` with `{ chatId, projectId, reason }`.

**Frontend**
- User selects a project (must be `READY`) and asks a question in the `QueryChat` UI (replaces Milestone 1's synchronous `queryProject()` stub).
- `POST /api/chat { projectId, question }` → `{ id }` → open `new WebSocket(`/ws/chat?uuid=${id}`)`.
- Render each pipeline step as it arrives (e.g. "Searching the codebase…", "Reranking results…"), the same way the sibling renders one `MessageCard` per agent update.
- Final message renders the answer with clickable citations; socket closes.

Exit criteria: asking "Where is authentication handled?" against a real, indexed repo opens a socket, shows each pipeline step appear in order, ends with a correct cited answer, and reloading `GET /api/chat/:uuid` afterward returns that same persisted answer.

## Milestone 5 — Hardening

Not new features — making Milestones 1–4 production-viable:

- Retry/backoff + dead-letter handling for each event consumer (checkout/parse/index) — a clone or parse failure shouldn't wedge the pipeline. Index Service also needs a retry/backoff around Embedding Service calls specifically (transient failure of a co-located service, not just the message broker).
- Idempotent event handlers (RabbitMQ consumers ack only after successful processing, but redeliveries on crash/restart are still possible).
- Observability: structured logs with `projectId` correlation, basic metrics (events processed, pipeline latency per stage).

No repo size limits and no API auth for now (controlled environment, public repos only) — see Decisions below. Revisit both if this moves toward a shared/hosted deployment.

Exit criteria: a deliberately broken repo (malformed, nonexistent, private) fails gracefully with a visible reason instead of hanging.

## Milestone 6 — Future work (post-MVP, per SPECS "Future" section)

- Dependency graph build (Postgres graph tables first — avoid standing up Neo4j until query patterns justify it) enabling "what's affected if X changes" questions.
- Additional lifecycle stages (`embedded`, `keyword_indexed`, `dependency_graph_built`) inserted between PARSED and READY without changing the external contract, per SPECS' explicit design intent.
- Self-hosted reranking model (e.g. a BGE reranker) if Cohere Rerank API costs become material — embeddings are already self-hosted as of Milestone 3.
- Swap PostgreSQL FTS → OpenSearch and pgvector → Weaviate/Pinecone if scale demands it — interfaces from Milestone 0 make this a config change, not a rewrite.

## Decisions (resolved)

- **Repo access**: public GitHub repos only. No GitHub App/OAuth token flow for MVP.
- **Auth**: none — API and frontend are open, no multi-tenancy. Revisit if deployed outside a controlled environment.
- **LLM provider**: Claude (Anthropic API) for query understanding and final answer generation.
- **Repo size**: no enforced ceiling — running in a controlled environment, so clone timeout/file-count limits from Milestone 5 are dropped for now.
