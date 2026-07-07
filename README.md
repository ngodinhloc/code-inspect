# Code Inspect

An **event-driven RAG pipeline** for GitHub repositories. Point it at a public repo and it clones, parses, embeds, and indexes the codebase through a chain of independent services — no central orchestrator. Once a project reaches `READY`, you can ask it plain-English questions and get answers grounded in the actual code, with file/line citations, streamed live over a WebSocket.

Three things this project is specifically built to demonstrate:

- **Real AST-based code understanding, not text chunking.** Parse Service runs actual Tree-sitter grammars for JavaScript, TypeScript, Go, and PHP to extract classes/functions/methods/interfaces with real line ranges, plus structural parsers for Kubernetes YAML and Markdown — and derives a best-effort dependency graph per symbol by cross-referencing each file's imports against identifiers used in that symbol's body. See [Parse Service](#parse-service-port-8002) and the [worked example](#example-a-real-parse--index-run) below.
- **Self-hosted embeddings behind a schema-per-service Postgres.** Embedding Service runs `BAAI/bge-small-en-v1.5` locally via ONNX (no external API, no per-token cost); Index Service, Parse Service, and the API service all share one Postgres instance but never share a schema, each owning its own tables and reading across schemas only via explicit raw SQL where it genuinely needs to. See [Postgres schemas](#postgres-schemas) and [Index Service](#index-service-port-8004).
- **A graph-structured RAG pipeline with conditional routing, not a fixed linear chain.** Retrieval Service runs LangGraph state machine of 8 nodes — hybrid (vector + keyword) retrieval, reciprocal rank fusion, a free heuristic query-reformulation retry, a conditional reranker skip, and a grounded Claude answer — streaming per-step progress to the frontend as it runs. See [RAG Pipeline](#rag-pipeline) and [Retrieval Service](#retrieval-service-port-8005).

![Screenshot of the Code Inspect chat UI: a project status timeline (Started → Checked Out → Parsed → Indexed → Ready), a user question "what is this project about?", a black CLI-style step trace (Query Understanding → Hybrid Retrieval → Result Fusion → Reranker → Context Builder → Claude, each with a green checkmark), the grounded answer text, and a collapsible "Sources" panel listing five file/symbol/line citations.](screenshot.png)

---

## Architecture

![Architecture diagram: Frontend talks to Backend, which writes to its own Postgres and publishes to RabbitMQ; Checkout, Parse, and Index services each consume pipeline events and own their own Postgres tables; Embedding Agent runs BAAI/bge-small-en-v1.5 locally; Retrieval Service consumes chat events, reads/writes Redis, and calls the Claude LLM.](architecture.png)

```
┌────────────────────────────────────────────────────────────────────────┐
│  Browser                                                                │
│  Next.js frontend  (port 3000)                                         │
│  · New Project form, live status timeline, chat-style query UI         │
└──────────────────────────────┬───────────────────────────────────────────┘
                                │ HTTP  /api/*
┌───────────────────────────────▼──────────────────────────────────────────┐
│  Backend  (NestJS · port 8000 · schema: backend)                         │
│  · POST /api/projects — validates the GitHub URL against the GitHub     │
│    API, writes a Postgres row, publishes code-inspect.project.started   │
│  · GET /api/projects/:id · GET /api/projects/:id/events (SSE)           │
│  · Consumes checked_out / parsed / indexed / ready / failed and         │
│    updates the project's status column accordingly                      │
└────────────┬───────────────────────────────────────────────────────────┘
             │ AMQP — single topic exchange, routing key = event name
┌────────────▼───────────────────────────────────────────────────────────┐
│  RabbitMQ                                                                │
│  exchange: code-inspect.project                                         │
│  routing keys: .started · .checked_out · .parsed · .indexed · .ready ·  │
│                .failed                                                   │
└───┬────────────────────────┬─────────────────────────┬───────────────────┘
    │ .started                │ .checked_out             │ .parsed
┌───▼───────────────────┐ ┌───▼───────────────────────┐ ┌▼────────────────────────┐
│ Checkout Service       │ │ Parse Service              │ │ Index Service            │
│ (port 8001)            │ │ (port 8002 · schema: parse)│ │ (port 8004 · schema:     │
│ simple-git shallow     │ │ Tree-sitter (JS/TS/PHP/Go) │ │  index)                  │
│ clone → publishes      │ │ + YAML (k8s resources) +   │ │ reads parse.symbols,     │
│ .checked_out           │ │ Markdown (sections)        │ │ chunks, calls Embedding  │
│                        │ │ + regex API-endpoint scan  │ │ Service, writes          │
│                        │ │ → publishes .parsed        │ │ pgvector + tsvector rows │
│                        │ │                            │ │ → publishes .indexed,    │
│                        │ │                            │ │   then .ready            │
└────────────────────────┘ └────────────────────────────┘ └──────────┬───────────────┘
                                                                       │ HTTP POST /api/embed
                                                            ┌──────────▼────────────────┐
                                                            │  Embedding Service         │
                                                            │  (port 8003)               │
                                                            │  BAAI/bge-small-en-v1.5    │
                                                            │  via @xenova/transformers  │
                                                            │  (ONNX, local, no API key) │
                                                            └────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│  postgres  (one instance, one schema per owning service)              │
│  schema backend → projects, project_status_history, chats             │
│  schema parse   → files, symbols, symbol_dependencies, api_endpoints  │
│  schema index   → symbol_embeddings (vector(384) + generated tsvector)│
└───────────────────────────────────────────────────────────────────────┘
```

Every downstream stage only ever *publishes* — the API service is the only thing that writes to the `projects` table, turning each lifecycle event back into a status update. Checkout Service and Parse Service never touch Postgres to signal completion; they just publish and move on. The RAG pipeline (below) follows the same event-driven shape once a project is `READY`.

---

## RAG Pipeline

Once a project is `READY`, asking it a question kicks off a second, independent event-driven flow — same shape as ingestion (publish an event, a service picks it up, publishes the next one), but built around a chat lifecycle instead of a project lifecycle, and with Redis added purely as an ephemeral live-progress cache (RabbitMQ remains the only message broker; Redis never carries events).

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Frontend — chat UI on the project page                                  │
│  · POST /api/chat {projectId, question} → { id }                         │
│  · opens WebSocket ws://.../ws/chat?uuid={id}, renders each step live    │
└───────────────────────────────┬────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼───────────────────────────────────────────┐
│  Backend  (schema: backend)                                                │
│  · ChatService.createChat: writes a `chats` row (status: running),        │
│    seeds a Redis cache at chat:{id}, publishes code-inspect.chat.started  │
│  · ChatGateway (WS /ws/chat): polls the Redis cache every 500ms, pushes   │
│    diffs to the browser, closes once status is completed/failed          │
│  · ChatEventsService: consumes chat.completed/.failed, persists the      │
│    Redis cache's final messages into the `chats` row, then (after a 5s   │
│    grace window so the WS gateway's last poll still sees it) deletes it  │
└───────────────────────────────┬────────────────────────────────────────────┘
                                 │ code-inspect.chat.started
┌────────────────────────────────▼───────────────────────────────────────────┐
│  Retrieval Service  (port 8005 · LangGraph state machine)                 │
│                                                                             │
│   query_understanding → hybrid_retrieval → fusion ──┬── rerank ──┐        │
│         ▲                                            ├── skip_rerank ─┤   │
│         └──────────── advance_attempt ◄───────────────┘             ▼    │
│                     (reformulate, capped at 1 retry)      context_builder │
│                                                                    │       │
│                                                             generate_answer│
│                                                                    │       │
│  every node appends an isThinking → hasReplied message to the Redis      │
│  cache as it runs — that's what the WS gateway is polling for            │
└────────────────────────────────┬────────────────────────────────────────────┘
                                  │ code-inspect.chat.completed / .failed
                                  ▼
                    back to Backend → Postgres `chats` row finalized
```

See [Retrieval Service](#retrieval-service-port-8005) for what each graph node actually does, and [Example: A Real RAG Query](#example-a-real-rag-query) for a captured end-to-end run.

---

## Services

| Service | Port | Directory | Stack |
|---|---|---|---|
| frontend | 3000 | `frontend/` | Next.js 16 · React 19 · Tailwind CSS 4 · lucide-react |
| backend | 8000 | `backend/` | NestJS 11 · TypeORM · PostgreSQL · RabbitMQ · Redis · WebSocket (`@nestjs/platform-ws`) |
| checkout-service | 8001 | `checkout-service/` | NestJS 11 · simple-git · RabbitMQ |
| parse-service | 8002 | `parse-service/` | NestJS 11 · Tree-sitter · TypeORM · PostgreSQL · RabbitMQ |
| embedding-service | 8003 | `embedding-service/` | NestJS 11 · `@xenova/transformers` (ONNX) |
| index-service | 8004 | `index-service/` | NestJS 11 · TypeORM (raw SQL) · pgvector · RabbitMQ |
| retrieval-service | 8005 | `retrieval-service/` | NestJS 11 · LangGraph · Anthropic SDK (Claude Opus 4.8) · Cohere Rerank (optional) · RabbitMQ · Redis |
| rabbitmq | 5672 / 15672 | — | RabbitMQ 3 (single topic exchange per domain: `code-inspect.project`, `code-inspect.chat`) |
| redis | 6379 | — | Redis 7 — live chat progress cache only, keyed `chat:{uuid}`, never carries events |
| postgres | 5432 | — | `pgvector/pgvector:pg17` — one instance, three schemas, shared by backend/parse-service/index-service |

`ANTHROPIC_API_KEY` is required for Retrieval Service to answer questions (`retrieval-service/.env`). `COHERE_API_KEY` is optional — if unset, the reranker step logs a warning and passes the top 5 fused candidates through unreranked rather than failing the chat. Every other service is self-hosted with no API key.

---

## RabbitMQ topology

Two topic exchanges — one per domain, each with its own linear lifecycle. Routing key equals the event name; every consumer binds its own durable queue.

**`code-inspect.project`** — the ingestion pipeline:

| Publisher | Routing key | Consumer · queue |
|---|---|---|
| backend | `code-inspect.project.started` | checkout-service · `checkout.project.started` |
| checkout-service | `code-inspect.project.checked_out` | backend · `api.project.checked_out`; parse-service · `parse.project.checked_out` |
| parse-service | `code-inspect.project.parsed` | backend · `api.project.parsed`; index-service · `index.project.parsed` |
| index-service | `code-inspect.project.indexed` | backend · `api.project.indexed` |
| index-service | `code-inspect.project.ready` | backend · `api.project.ready` |
| any service | `code-inspect.project.failed` | backend · `api.project.failed` |

**`code-inspect.chat`** — the RAG pipeline:

| Publisher | Routing key | Consumer · queue |
|---|---|---|
| backend | `code-inspect.chat.started` | retrieval-service · `retrieval.chat.started` |
| retrieval-service | `code-inspect.chat.completed` | backend · `api.chat.completed` |
| retrieval-service | `code-inspect.chat.failed` | backend · `api.chat.failed` |

The event contract for each exchange (`ProjectStartedEvent`, `ChatStartedEvent`, …) is hand-duplicated into each service's own `contracts/*.interface.ts` — there's no shared package — so a field added on one side has to be mirrored everywhere it's consumed, same convention as `../model-arena`'s `experiment.interface.ts`.

---

## Postgres schemas

One `postgres` instance, three schemas, one owner each — nobody outside the owning service writes to its tables:

| Schema | Owner | Tables |
|---|---|---|
| `backend` | backend | `projects`, `project_status_history`, `chats` |
| `parse` | parse-service | `files`, `symbols`, `symbol_dependencies`, `api_endpoints` |
| `index` | index-service | `symbol_embeddings` |

Index Service and Retrieval Service are the exceptions to "never read another service's schema": both read `parse.symbols` directly via raw SQL (Index Service to embed it, Retrieval Service to resolve chunk provenance for citations), and Retrieval Service also reads `index.symbol_embeddings` for hybrid search. Neither ever writes to `parse`'s tables.

`backend` and `parse-service` use TypeORM entities with `synchronize: true`, scoped to their schema via a small `ensureSchemaExists()` helper that runs `CREATE SCHEMA IF NOT EXISTS` before TypeORM connects (Postgres won't create a table in a schema that doesn't exist, and `synchronize` doesn't create the schema itself). `index-service` registers no TypeORM entities at all — TypeORM has no native column type for pgvector's `vector` or Postgres's generated `tsvector`, so its schema/table/indexes are created via raw DDL instead (see `SymbolEmbeddingsSchemaService`). `retrieval-service` likewise registers no entities — it only ever reads `parse` and `index`'s tables via raw SQL, and owns no tables of its own.

---

## Backend (port 8000)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/projects` | Validates `repositoryUrl` is a public GitHub repo (checks the GitHub API), creates a `projects` row (`status: CREATED`), publishes `code-inspect.project.started` |
| `GET` | `/api/projects/:id` | Current project status |
| `GET` | `/api/projects/:id/events` | SSE stream — polls Postgres every 2s, emits only on status change, closes once the project reaches `READY`/`FAILED` |
| `POST` | `/api/chat` | Validates the project is `READY`, creates a `chats` row (`status: running`), seeds a Redis cache, publishes `code-inspect.chat.started` |
| `GET` | `/api/chat/:uuid` | A single chat's persisted state (question, per-step `contents`, status, answer, citations) |
| `GET` | `/api/projects/:id/chats` | A project's full chat history, chronological |
| `WS` | `/ws/chat?uuid=` | Polls the chat's Redis cache every 500ms, pushes `chat-update` frames on change, closes with `completed`/`failed` |
| `GET` | `/api/health` | — |

The `ProjectEventsService` is the other half of the API service for ingestion: it subscribes to every downstream lifecycle event and is the *only* code path that writes to `projects.status` — checkout-service, parse-service, and index-service never touch Postgres to report progress, they just publish. `ChatEventsService` plays the equivalent role for chat: it's the only code path that writes a `chats` row's final `status`/`contents`, triggered by consuming `chat.completed`/`chat.failed` from Retrieval Service.

Project lifecycle: `CREATED → CHECKED_OUT → PARSED → INDEXED → READY`, or `FAILED` with a `failureReason` at any stage. Chat lifecycle: `running → completed`, or `failed` with a `failureReason`.

---

## Checkout Service (port 8001)

Subscribes to `code-inspect.project.started`. Shallow-clones (`--single-branch --depth 1`) the repository to `/repositories/{projectId}` via `simple-git`, then publishes `code-inspect.project.checked_out` with the resulting path. A redelivered event first removes any partial clone at that path, so retries are idempotent. Clone failures (bad branch, unreachable repo) publish `code-inspect.project.failed` with the underlying git error as the reason — no repo ever silently disappears from the pipeline.

---

## Parse Service (port 8002)

Subscribes to `code-inspect.project.checked_out`. For every included file (`.js .ts .php .go .yaml .yml .md`, skipping `.git node_modules vendor dist build coverage`, binaries detected by a null-byte sniff, and anything over 2MB):

- **JS / TS / Go / PHP** — real Tree-sitter grammars extract `function` / `class` / `method` / `interface` symbols (Go structs map to `class`) with exact start/end lines and raw source text.
- **YAML** — each document with a `kind` + `metadata.name` becomes a `resource` symbol (`Deployment/auth-service`), Kubernetes-flavored per SPECS' code intelligence model.
- **Markdown** — each heading becomes a `section` symbol running until the next heading of equal-or-higher level.
- **API endpoints** — regex-based first pass over the raw file text for NestJS (`@Get`/`@Post`/…), Express (`app.get`/`router.post`/…), Go `net/http` (`HandleFunc`), and Laravel (`Route::get`/…).
- **Dependencies** — each file's imports (`import`/`use`/Go import path) are cross-referenced against identifiers appearing in each symbol's body; a match becomes a `symbol_dependencies` row.

Publishes `code-inspect.project.parsed` on success, `code-inspect.project.failed` (stage `PARSED`) on any error. Re-processing a project (redelivery, manual re-run) deletes and rewrites its rows rather than duplicating them.

---

## Embedding Service (port 8003)

A standalone HTTP service, used by both the ingestion pipeline and the RAG pipeline — no RabbitMQ involvement — `POST /api/embed { texts: string[] }` → `{ embeddings: number[][], model, dimensions }`. Runs `BAAI/bge-small-en-v1.5` (via its ONNX mirror, `Xenova/bge-small-en-v1.5`) locally through `@xenova/transformers`: each batch is tokenized, run through the ONNX model, mean-pooled across tokens, and L2-normalized, producing a 384-dimensional vector per input text. The model loads once during `onModuleInit` — which blocks Nest's own startup, so by the time the HTTP server accepts connections the model is already warm and `/api/health` is truthful by construction. Index Service calls it while embedding a project's chunks (batches of 64); Retrieval Service calls it once per question, to embed the query for vector search.

---

## Index Service (port 8004)

Subscribes to `code-inspect.project.parsed`. Reads every row from `parse.symbols` for the project, builds one chunk per symbol (oversized ones split into 2000-character chunks with 200-character overlap), and embeds them in batches of 64 via the Embedding Service. Each chunk is stored in `index.symbol_embeddings`:

```sql
CREATE TABLE index.symbol_embeddings (
  id SERIAL PRIMARY KEY,
  project_id UUID NOT NULL,
  symbol_id INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  chunk_text TEXT NOT NULL,
  embedding vector(384) NOT NULL,
  model VARCHAR(100) NOT NULL,
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

One column, two search strategies: `embedding <=> $1` for cosine-distance vector search, `search_vector @@ to_tsquery(...)` for keyword search — both queried directly against the same rows, no separate keyword index to keep in sync. No ANN index (ivfflat/hnsw) yet; brute-force distance scans are fine at MVP scale. Publishes `code-inspect.project.indexed` then immediately `code-inspect.project.ready` (no intermediate stages yet, by design — SPECS calls this out explicitly so future stages can slot in without changing the external contract). This table is also what Retrieval Service's hybrid retrieval step reads from at query time — Index Service only ever writes it.

---

## Retrieval Service (port 8005)

Subscribes to `code-inspect.chat.started`. The whole answer flow is one compiled LangGraph state machine (`@langchain/langgraph`), not a hand-rolled sequence of `await` calls — each stage is its own node, and the graph handles routing between them:

| Node | What it does |
|---|---|
| `query_understanding` | First pass: uses the question as-is. On a retry (see `fusion`'s routing below), applies a **free, non-LLM heuristic** — strips stopwords/interrogative words (`reformulate-query.ts`) — rather than paying for a second Claude call just to reword the query. |
| `hybrid_retrieval` | Embeds the (expanded) query via Embedding Service, then runs vector search (`embedding <=> $1`, top 50) and keyword search (`to_tsquery`, OR-joined terms, top 50) against `index.symbol_embeddings` in parallel. |
| `fusion` | Combines both ranked lists via **Reciprocal Rank Fusion** (`score = Σ 1/(k + rank)`, k=60) into one ranked candidate list, then routes: |
| ↳ *(routing)* | → **`advance_attempt`** (loops back to `query_understanding`) if keyword search came back completely empty and this is the first attempt — capped at one retry; → **`skip_rerank`** if the fused list is already ≤5 candidates (reranking a set that small changes nothing); → **`rerank`** otherwise. |
| `rerank` | Calls Cohere Rerank (`rerank-v4.0-pro`) to narrow the fused candidates to the top 5 by relevance to the question. If `COHERE_API_KEY` isn't set (or the call fails), logs a warning and falls back to the top 5 fused candidates unreranked — the chat still completes. |
| `context_builder` | Resolves each surviving chunk's `symbolId` against `parse.symbols` (file path, symbol name, line number), and assembles the final prompt plus the citation list shown in the UI. |
| `generate_answer` | Calls Claude (`claude-opus-4-8`, adaptive thinking) with a system prompt constraining it to the assembled context, instructed to say so plainly rather than guess if the context is insufficient, and to reply in plain prose (the frontend renders it as plain text, not Markdown). Checks for `stop_reason: "refusal"` before reading the response. |

Every node calls back into a small `ChatManagerService` before and after it runs — `appendThinking(chatId, step, actor)` then `setReply(chatId, step, response)` — mutating the same Redis cache the backend's WS gateway is polling. That's the entire mechanism behind the frontend's live step-by-step progress list; the graph itself has no knowledge of WebSockets, Redis is just where it journals its own progress.

On success, publishes `code-inspect.chat.completed`; on any uncaught error, publishes `code-inspect.chat.failed` with the error as the reason. Both are consumed by backend to finalize the Postgres `chats` row.

---

## Frontend (port 3000)

- **New Project** (`/`) — GitHub URL + branch form; client-side validates the URL shape before enabling submit, then `POST /api/projects` and redirects to `/projects/:id`.
- **Project view** (`/projects/:id`) — polls `GET /api/projects/:id` every 2s, renders a five-stage timeline (Started → Checked Out → Parsed → Indexed → Ready) plus a failure banner with `failureReason` if the project fails. Once `READY`, shows the chat query UI.
- **Chat UI** — loads a project's prior conversation on mount (`GET /api/projects/:id/chats`, so history survives a page refresh), and for a new question: `POST /api/chat`, then opens `ws://.../ws/chat?uuid={id}` and renders each pipeline step live (spinner → checkmark) as `chat-update` frames arrive, resuming the socket automatically if the page is refreshed mid-answer. The final answer renders with a collapsible "Sources" panel listing each citation's file, symbol, and line.
- **Sidebar** — recent projects, sourced from `localStorage` (there's no `GET /projects` list endpoint yet) rather than a backend call, with a live status dot per project (polls `GET /api/projects/:id` every 3s for any non-terminal project; auto-evicts an entry from `localStorage` if the backend reports it 404 — e.g. after a manual deletion).

---

## Example: A Real Parse + Index Run

A small fixture repo spanning every supported language, run through the real pipeline end to end (`checkout → parse → index`).

`src/auth.ts`:

```typescript
interface TokenValidator {
  validate(token: string): boolean;
}

export class JWTService implements TokenValidator {
  private redis = new Redis();

  validate(token: string): boolean {
    return this.redis.get(token) !== null;
  }
}
```

`src/JWTService.php`:

```php
<?php
use Redis;

class JWTService implements Cacheable {
  public function validateToken($token) {
    $redis = new Redis();
    return $redis->get($token);
  }
  public function cacheKey(): string {
    return "jwt";
  }
}
```

Parse Service's extracted `symbols` (subset):

| file_path | type | name | start_line | end_line |
|---|---|---|---|---|
| src/JWTService.php | class | JWTService | 10 | 19 |
| src/JWTService.php | method | validateToken | 11 | 14 |
| src/auth.ts | interface | TokenValidator | 4 | 6 |
| src/auth.ts | class | JWTService | 9 | 15 |
| src/auth.ts | method | validate | 12 | 14 |
| src/controller.ts | class | AuthController | 4 | 14 |
| docs/README.md | section | Token Validation | 9 | 12 |
| k8s/deployment.yaml | resource | Deployment/auth-service | 1 | 7 |

Best-effort `symbol_dependencies` — SPECS' own worked example (`validateToken` → `["Redis"]`) reproduced exactly by the real pipeline:

| file_path | symbol | dependency_name |
|---|---|---|
| src/JWTService.php | validateToken | Redis |
| src/auth.ts | JWTService | Redis |
| src/controller.ts | AuthController | Get |
| src/controller.ts | AuthController | Post |
| src/main.go | main | http |

Index Service's `symbol_embeddings`, then queried two ways against the real stored rows:

**Postgres full-text search**, `plainto_tsquery('english', 'validate token')`:

| symbol_id | preview | rank |
|---|---|---|
| 3 | section "Token Validation" (docs/README.md) | 0.600 |
| 15 | method `validate` (src/auth.ts) | 0.304 |
| 14 | class `JWTService` (src/auth.ts) | 0.176 |

**pgvector cosine search**, embedding the question *"Where is authentication handled?"* through the real Embedding Service and running `embedding <=> $1`:

| symbol_id | preview | distance |
|---|---|---|
| 1 | section "Auth Service" (docs/README.md) | 0.293 |
| 17 | class `AuthController` (src/controller.ts) | 0.373 |
| 19 | method `login` (src/controller.ts) | 0.392 |

Both searches surface the right answer from a plain-English question with zero manual tuning — exactly the exit criteria PLANS.md sets for this milestone.

---

## Example: A Real RAG Query

A real chat, captured end to end against a fully-ingested project, showing every graph node's actual output:

**Question:** *"Where is authentication handled?"*

| Step | Real response |
|---|---|
| `query_understanding` | `{ attempt: 0, expandedQuery: "Where is authentication handled?" }` — first pass, question used as-is |
| `hybrid_retrieval` | `{ vectorCount: 50, ftsCount: 2 }` |
| `fusion` | `{ candidateCount: 20 }` — RRF-merged; routed straight to `rerank` (more than 5 candidates, keyword search wasn't empty) |
| `rerank` | `{ usedCohere: false, rerankedCount: 5 }` — no `COHERE_API_KEY` set in this run, graceful fallback to the top 5 fused candidates |
| `context_builder` | `{ chunkCount: 5 }` |
| `generate_answer` | Claude Opus 4.8, grounded strictly in those 5 chunks |

The real answer text, verbatim:

> The provided context does not contain any information about user authentication being handled anywhere in this codebase. None of the included files reference an auth mechanism, login flow, session handling, or credential verification for users.
>
> What the context does show is API key configuration for external services, not authentication of clients or users: README.md (Required API keys, line 296) documents two keys: `ANTHROPIC_API_KEY` in `ai-agent/.env` and `GOOGLE_API_KEY` in `mcp-server/.env`. There is also a relevant design note in ARTICLE.md (Key Design Decisions): the "MCP server as a separate service" decision states that the agent owns no API keys — the keys live with the MCP server. The only other runtime-facing file here, `backend/src/chat/gateways/chat.gateway.ts`, shows just `handleDisconnect` with no authentication logic.
>
> So based strictly on this context, I can't point you to an authentication handler — it either lives in files not included here or isn't part of the shown design.

With citations:

| file | symbol | line |
|---|---|---|
| ARTICLE.md | Key Design Decisions | 304 |
| backend/src/chat/gateways/chat.gateway.ts | handleDisconnect | 49 |
| ARTICLE.md | ai-agent: subscribe and process | 140 |
| README.md | Required API keys | 296 |
| README.md | 1. Fill in API keys | 284 |

This is the system doing exactly what its prompt asks of it: saying "I don't know" plainly, with receipts, rather than fabricating an authentication mechanism that doesn't exist in the indexed code.

---

## Roadmap

See [PLANS.md](PLANS.md) for the full milestone breakdown. Not yet built:

- **Hardening (Milestone 5)** — retry/backoff and dead-letter handling per consumer, structured log correlation by `projectId` (already threaded through Retrieval Service's own logs; not yet extended to the ingestion pipeline).
- **Graph-aware intelligence (Milestone 6)** — a dependency graph over `symbol_dependencies` for "what's affected if this changes?" questions.

---

## Quick start

```bash
docker compose up --build
```

Every service in the ingestion pipeline is self-hosted with no API key required. To ask questions once a project is `READY`, Retrieval Service needs an Anthropic key:

```bash
cp retrieval-service/.env.example retrieval-service/.env
# edit retrieval-service/.env and set ANTHROPIC_API_KEY=sk-ant-...
# COHERE_API_KEY is optional — the reranker gracefully falls back if it's unset
```

Open [http://localhost:3000](http://localhost:3000), paste a public GitHub repository URL, and watch it move through the pipeline.

- RabbitMQ management: [http://localhost:15672](http://localhost:15672) — `guest` / `guest`
- Backend health: [http://localhost:8000/api/health](http://localhost:8000/api/health)
- Checkout Service health: [http://localhost:8001/api/health](http://localhost:8001/api/health)
- Parse Service health: [http://localhost:8002/api/health](http://localhost:8002/api/health)
- Embedding Service health: [http://localhost:8003/api/health](http://localhost:8003/api/health)
- Index Service health: [http://localhost:8004/api/health](http://localhost:8004/api/health)
- Retrieval Service health: [http://localhost:8005/api/health](http://localhost:8005/api/health)
