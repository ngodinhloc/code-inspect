# CodeInspect — Specification

A distributed code intelligence platform that continuously ingests GitHub repositories and lets developers query large codebases in natural language. An event-driven pipeline clones, parses, embeds, and indexes a repository until it is `READY`; a second, independent event-driven flow then answers questions against it using hybrid vector + keyword retrieval and a LangGraph-orchestrated Claude call, with citations back to exact files, symbols, and lines.

---

## Data Interfaces

```typescript
// ── Project Lifecycle ────────────────────────────────────────────────
enum ProjectStatus {
    CREATED     = "CREATED",
    CHECKED_OUT = "CHECKED_OUT",
    PARSED      = "PARSED",
    INDEXED     = "INDEXED",
    READY       = "READY",
    FAILED      = "FAILED",
}

ProjectInterface {
    id:             number;
    uuid:           uuid;
    repositoryUrl:  string;
    branch:         string;          // default "main"
    status:         ProjectStatus;
    failureReason:  string | null;
    createdAt:      Date;
    updatedAt:      Date;
}

// ── Project Events (exchange "code-inspect.project") ─────────────────
ProjectStartedEvent    { projectId: uuid; repositoryUrl: string; branch: string; }
ProjectCheckedOutEvent { projectId: uuid; repoPath: string; }
ProjectParsedEvent     { projectId: uuid; }
ProjectIndexedEvent    { projectId: uuid; }
ProjectReadyEvent      { projectId: uuid; }
ProjectFailedEvent     { projectId: uuid; stage: ProjectStatus; reason: string; }

// ── Code Intelligence Model (parse-service, schema "parse") ──────────
type SymbolKind = "class" | "function" | "method" | "interface" | "section" | "resource";

SymbolInterface {
    id:        number;
    projectId: uuid;
    filePath:  string;
    type:      SymbolKind;
    name:      string;
    language:  string;
    content:   string;
    startLine: number;
    endLine:   number;
}

ApiEndpointInterface {
    id:          number;
    projectId:   uuid;
    filePath:    string;
    method:      string;
    path:        string;
    handlerName: string | null;
    framework:   string;
}

// ── Vector + Keyword Index (index-service, schema "index") ───────────
SymbolEmbeddingInterface {
    id:           number;
    projectId:    uuid;
    symbolId:     number;
    chunkIndex:   number;
    chunkText:    string;
    embedding:    number[];   // vector(384), pgvector column
    model:        string;
    searchVector: tsvector;   // GENERATED ALWAYS AS to_tsvector('english', chunk_text)
}

// ── Chat Lifecycle ────────────────────────────────────────────────────
type ChatStep = "query_understanding" | "hybrid_retrieval" | "fusion" | "rerank" | "context_builder" | "answer";
type ChatMessageStatus = "isThinking" | "hasReplied";
type ChatRunStatus = "running" | "completed" | "failed";

ChatCitation {
    file:   string;
    symbol: string;
    line:   number;
}

ChatMessage {
    step:     ChatStep;
    actor:    string;
    status:   ChatMessageStatus;
    response: unknown | null;
}

ChatInterface {
    id:             number;
    uuid:           uuid;
    projectId:      uuid;
    question:       string;
    contents:       ChatMessage[];   // final value, written once by backend
    status:         ChatRunStatus;
    failureReason:  string | null;
    createdAt:      Date;
    updatedAt:      Date;
}

// Stored in Redis at chat:{chatId}, TTL 7200s, 5s grace window before deletion
ChatCache {
    eventName: string;
    chatId:    uuid;
    projectId: uuid;
    question:  string;
    messages:  ChatMessage[];
    status:    ChatRunStatus;
    updatedAt: string;
}

// ── Chat Events (exchange "code-inspect.chat") ────────────────────────
ChatStartedEvent   { chatId: uuid; projectId: uuid; question: string; }
ChatCompletedEvent { chatId: uuid; projectId: uuid; }
ChatFailedEvent    { chatId: uuid; projectId: uuid; reason: string; }
```

---

## Components

### frontend (port 3000)
Next.js 16. `POST /api/projects` submits a repository URL and opens an SSE stream (`GET /api/projects/:id/events`) that renders the ingestion `StatusTimeline` live. Once a project reaches `READY`, `POST /api/chat` returns a chat id; the browser opens `ws://.../ws/chat?uuid={id}` and renders each LangGraph node as a live, dark, CLI-style step trace (`Query Understanding → Hybrid Retrieval → Result Fusion → Reranker → Context Builder → Claude`), then the final answer with a collapsible Sources panel. On mount, loads a project's prior chats via `GET /api/projects/:projectId/chats` and reconnects the socket automatically if the last turn was still `running`.

### backend (port 8000)
NestJS 11, schema `backend`, own PostgreSQL tables (`projects`, `chats`). The only code path that writes a project's or chat's final `status`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/projects` | Create project, publish `code-inspect.project.started` |
| `GET` | `/api/projects/:id` | Get project status |
| `SSE` | `/api/projects/:id/events` | Stream project status transitions |
| `POST` | `/api/chat` | Validate project is `READY`, create chat, seed Redis, publish `code-inspect.chat.started` |
| `GET` | `/api/chat/:uuid` | Get chat (final `contents` once terminal) |
| `GET` | `/api/projects/:projectId/chats` | List a project's chats |
| `WS` | `/ws/chat?uuid=` | Live progress: polls `chat:{uuid}` in Redis every 500ms, pushes `chat-update`; short-circuits straight to a terminal frame from Postgres if the chat is already `completed`/`failed` |
| `GET` | `/api/health` | Health check |

`ProjectEventsService` consumes `.checked_out` / `.parsed` / `.indexed` / `.ready` / `.failed` and advances `projects.status`. `ChatEventsService` consumes `chat.completed` / `chat.failed`, persists the final `contents`/`status` to Postgres, and deletes the Redis key after a 5s grace window.

### checkout-service (port 8001)
NestJS worker. No database. Consumes `code-inspect.project.started`; clones the repository via `simple-git`, checks out `branch`, stores the snapshot under `/repositories/{projectId}` (shared Docker volume); publishes `code-inspect.project.checked_out` or `.failed`.

### parse-service (port 8002)
NestJS worker, schema `parse` (`files`, `symbols`, `symbol_dependencies`, `api_endpoints`). Consumes `code-inspect.project.checked_out`. Walks the repo (excludes `.git`, `node_modules`, `vendor`, `dist`, `build`, `coverage`, binaries), then per file:

- **Tree-sitter AST parsing** for JavaScript, TypeScript, Go, and PHP — extracts classes, functions, methods, interfaces with exact `startLine`/`endLine`
- **Structural extractors** for Kubernetes-style YAML (`resource`) and Markdown (`section`)
- **API endpoint extraction** — detects framework routes/controllers into `api_endpoints`

Publishes `code-inspect.project.parsed` or `.failed`.

### embedding-service (port 8003)
NestJS. No database, no external API. Hosts `BAAI/bge-small-en-v1.5` self-hosted via `@xenova/transformers` (ONNX), producing 384-dimensional vectors at zero per-token cost. Model cache is bind-mounted so only the first boot pays the Hugging Face download.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/embed` | `{ texts: string[] }` → `{ embeddings: number[][] }` |

Called by both index-service (indexing time) and retrieval-service (query time), guaranteeing both live in the same vector space.

### index-service (port 8004)
NestJS worker, schema `index` (`symbol_embeddings`: one pgvector column + a `GENERATED ALWAYS AS to_tsvector(...) STORED` column — vector and keyword search share a single table, nothing to keep in sync). Consumes `code-inspect.project.parsed`; reads `parse.symbols`, chunks symbol content, calls embedding-service, writes rows with `model` tagging. Publishes `code-inspect.project.indexed` or `.failed`.

### retrieval-service (port 8005)
NestJS, reads `index.symbol_embeddings` and `parse.symbols` directly via raw SQL (read-only — never writes tables it doesn't own). Consumes `code-inspect.chat.started` and runs one compiled LangGraph `StateGraph` per chat:

- **query_understanding** — embeds the (possibly reformulated) question
- **hybrid_retrieval** — vector search (`ORDER BY embedding <=> $1`) and keyword search (`to_tsquery` OR-joined across words) against `index.symbol_embeddings`, in parallel
- **fusion** — merges both ranked lists via Reciprocal Rank Fusion (k=60); routes to `reformulate` (no FTS hits, under retry cap), `skipRerank` (fused list already ≤ target size), or `rerank`
- **advance_attempt** — increments `retrievalAttempts`, loops back to `query_understanding` (max 1 retry)
- **skip_rerank** / **rerank** — Cohere Rerank narrows candidates to the top 5; falls back to unreranked top-5 if `COHERE_API_KEY` is unset or the call fails (`usedCohere: false`)
- **context_builder** — resolves each chunk's `symbolId` against `parse.symbols` to build the prompt and `ChatCitation[]`
- **generate_answer** — calls Claude directly via the Anthropic SDK with a plain-prose system prompt; throws (routing to `chat.failed`) on `stop_reason === "refusal"`

After every node, journals an `appendThinking`/`setReply` pair to the `chat:{uuid}` Redis cache. Publishes `code-inspect.chat.completed` or `.failed` when the graph reaches `END`.

### Infrastructure
- **PostgreSQL (`pgvector/pgvector:pg17`, port 5432)** — single `codeinspect` database, one schema per owning service (`backend`, `parse`, `index`); each service manages its own schema/DDL, no cross-service migrations
- **Redis (port 6379)** — live chat-progress cache only, keyed `chat:{uuid}`; never carries events
- **RabbitMQ (port 5672, mgmt UI 15672)** — two topic exchanges: `code-inspect.project` (ingestion pipeline) and `code-inspect.chat` (retrieval flow), entirely independent of each other

---

## Workflow

### Repository ingestion

1. User submits a GitHub URL in the frontend → `POST /api/projects`.
2. Backend validates the URL, creates a `projects` row (`status: CREATED`), publishes `code-inspect.project.started`, returns `{ id }`. Frontend opens the SSE stream and renders `StatusTimeline`.
3. checkout-service clones the repo to `/repositories/{projectId}`, publishes `code-inspect.project.checked_out`. Backend advances `status: CHECKED_OUT`.
4. parse-service walks the tree, extracts symbols/endpoints via Tree-sitter and structural extractors into schema `parse`, publishes `code-inspect.project.parsed`. Backend advances `status: PARSED`.
5. index-service chunks each symbol, calls embedding-service, writes `index.symbol_embeddings` rows, publishes `code-inspect.project.indexed`. Backend advances `status: INDEXED`.
6. Backend advances `status: READY` and publishes `code-inspect.project.ready`. The `READY` state is stable regardless of how many stages exist behind it — future stages (e.g. dependency-graph building) can be inserted without changing the frontend contract.
7. Any stage failure publishes `code-inspect.project.failed { stage, reason }`; backend sets `status: FAILED` with `failureReason` and the SSE stream reflects it immediately.

### Asking a question

1. Once a project is `READY`, the user asks a question in the chat UI → `POST /api/chat { projectId, question }`.
2. Backend validates the project is `READY`, creates a `chats` row (`status: running`), seeds `chat:{uuid}` in Redis, publishes `code-inspect.chat.started`, returns `{ id }`. Frontend opens `ws://.../ws/chat?uuid={id}`.
3. retrieval-service consumes the event and runs the LangGraph: `query_understanding → hybrid_retrieval → fusion → (reformulate loop | skip_rerank | rerank) → context_builder → generate_answer`, journaling a thinking/reply pair to Redis after every node.
4. Backend's `ChatGateway` polls `chat:{uuid}` every 500ms and pushes `chat-update` frames only when the payload changes; the frontend renders each frame as the next step in the CLI-style trace.
5. On graph completion, retrieval-service publishes `code-inspect.chat.completed` (or `.failed` on error, including an explicit Claude `refusal`). `ChatEventsService` persists the final `contents`/`status` to Postgres, and the Redis key is deleted 5s later.
6. `ChatGateway` sends a terminal `completed`/`failed` frame and closes the socket; the frontend renders the grounded answer with its `ChatCitation[]` in the Sources panel.
7. On reload, the frontend loads history via `GET /api/projects/:projectId/chats`; if the last turn's `status` is still `running`, it reconnects the WebSocket rather than losing the in-flight answer.
