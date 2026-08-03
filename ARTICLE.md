# Building an Event-Driven Ingestion Pipeline and RAG System

This article walks through the building of Code Inspect, a code intelligence platform for GitHub repositories, composed of an event-driven ingestion pipeline and RAG system.

**Ingestion pipeline** — clones, parses, and indexes a repo until it's marked `READY`, via Parse, Embedding, and Index Services.

**RAG system** — once `READY`, a compiled **LangGraph** state machine answers questions using hybrid vector-plus-keyword retrieval, grounding Claude's answer with file/symbol/line citations.

![Screenshot of the Code Inspect chat UI: a user question, a black CLI-style step trace with green checkmarks connected by arrows (Query Understanding → Hybrid Retrieval → Result Fusion → Reranker → Context Builder → Claude), the grounded answer text, and a collapsible Sources panel listing file/symbol/line citations.](./screenshot.png)

---

## Architecture Overview

![Architecture diagram: Frontend talks to Backend, which writes to its own Postgres and publishes to RabbitMQ; Retrieval Service consumes chat events, reads/writes Redis, reads the ingestion pipeline's Postgres tables for hybrid search, and calls the Claude LLM.](./architecture.png)

Once a project is `READY`, asking it a question kicks off a second, independent event-driven flow — same shape as ingestion (publish an event, a service picks it up, publishes the next one), but built around a **chat lifecycle** instead of a project lifecycle, with Redis added purely as an ephemeral live-progress cache.

**Frontend** (Next.js 16) — the chat UI on a project's page. `POST /api/chat {projectId, question}` returns a chat id; the browser immediately opens `ws://.../ws/chat?uuid={id}` and renders each step live as a dark, CLI-style trace, then the final answer with a collapsible Sources panel. Loads a project's prior conversation on mount, so a refresh never loses history, and reconnects the socket automatically if a chat was still running when the page reloaded.

**Backend** (NestJS 11, schema `backend`) — owns the `chats` table and is the *only* code path that writes its final `status`/`contents`. `ChatService.createChat` validates the project is `READY`, writes the row, seeds a Redis cache at `chat:{id}`, and publishes `code-inspect.chat.started`. `ChatGateway` is the WebSocket half: it polls that Redis key every 500ms and pushes diffs to the browser. `ChatEventsService` consumes `chat.completed`/`chat.failed` from Retrieval Service and is what actually finalizes the Postgres row.

**RabbitMQ** — the `code-inspect.chat` topic exchange, entirely separate from the ingestion pipeline's exchange. Backend publishes `.started`; Retrieval Service publishes `.completed`/`.failed`. Redis never carries these events — it's a cache the two ends of the WebSocket both happen to read and write, not a transport.

**Parse Service** (schema `parse`) — the ingestion-side owner of `parse.symbols`. Real Tree-sitter grammars for JavaScript, TypeScript, Go, and PHP extract classes/functions/methods/interfaces with exact line ranges, plus structural extractors for Kubernetes YAML and Markdown, and a best-effort dependency graph per symbol. Retrieval Service reads this table read-only, for the file/symbol/line metadata behind every citation.

**Index Service** (schema `index`) — the ingestion-side owner of `index.symbol_embeddings`, one row per chunked symbol holding both a `vector(384)` column and a generated `tsvector` column side by side. Populated once, during ingestion, by chunking `parse.symbols` and calling Embedding Service in batches. Retrieval Service reads this table read-only, at query time, for both halves of hybrid search.

**Retrieval Service** — subscribes to `code-inspect.chat.started` and runs the entire answer flow as one compiled LangGraph state machine, described below. Reads `index.symbol_embeddings` and `parse.symbols` directly via raw SQL, since reading them is the entire point of retrieval, but never writes to either — a command/query split across service boundaries, not a violation of schema ownership.

**Embedding Service** — the same self-hosted `BAAI/bge-small-en-v1.5` service the ingestion pipeline uses to embed code chunks. Retrieval Service calls it once per question, to embed the query into the same 384-dimensional space the stored chunks live in.

**Redis** — a live-progress cache only, keyed `chat:{uuid}`, with a 7200-second TTL and a 5-second grace window after completion before deletion (so the gateway's last poll still sees the final state before the key disappears).

---

## Step 1 — Designing the RAG Graph with LangGraph

The natural first draft of a "query understanding → retrieve → fuse → rerank → build context → answer" pipeline is six sequential `await` calls in a row. That's exactly how this started. It stayed that way right up until the requirements changed: skip reranking when there's nothing to rerank, and retry with a reformulated query when the first pass comes back weak. At that point a linear chain needs an `if` wrapped around a `while`, and a plain function stops being the easiest thing to reason about — a **graph**, where branching and looping are edges you declare rather than control flow you write, is.

The whole answer flow is one compiled `StateGraph`:

```
START -> query_understanding -> hybrid_retrieval -> fusion -> [route?]
             ^                                                  |
             |                                    reformulate   | skipRerank / rerank
             +---------------- advance_attempt <---+            |
                                                                 v
                                 skip_rerank / rerank -> context_builder -> generate_answer -> END
```

```typescript
build() {
  return new StateGraph(RetrievalState)
    .addNode('query_understanding', (state) => this.queryUnderstandingNode.run(state))
    .addNode('hybrid_retrieval', (state) => this.hybridRetrievalNode.run(state))
    .addNode('fusion', (state) => this.fusionNode.run(state))
    .addNode('advance_attempt', (state) => this.advanceAttemptNode.run(state))
    .addNode('skip_rerank', (state) => this.skipRerankNode.run(state))
    .addNode('rerank', (state) => this.rerankNode.run(state))
    .addNode('context_builder', (state) => this.contextBuilderNode.run(state))
    .addNode('generate_answer', (state) => this.answerNode.run(state))
    .addEdge(START, 'query_understanding')
    .addEdge('query_understanding', 'hybrid_retrieval')
    .addEdge('hybrid_retrieval', 'fusion')
    .addConditionalEdges('fusion', routeAfterFusion, {
      reformulate: 'advance_attempt',
      skipRerank: 'skip_rerank',
      rerank: 'rerank',
    })
    .addEdge('advance_attempt', 'query_understanding')
    .addEdge('skip_rerank', 'context_builder')
    .addEdge('rerank', 'context_builder')
    .addEdge('context_builder', 'generate_answer')
    .addEdge('generate_answer', END)
    .compile();
}
```

Every node is its own injected NestJS class with a single `run(state)` method — the same "class with `__call__`" shape a hand-rolled Python LangGraph node would use, just TypeScript's equivalent. State is a plain `Annotation.Root`:

```typescript
export const RetrievalState = Annotation.Root({
  chatId: Annotation<string>,
  projectId: Annotation<string>,
  question: Annotation<string>,
  expandedQuery: Annotation<string>,
  retrievalAttempts: Annotation<number>,
  vectorResults: Annotation<RetrievedChunk[]>,
  ftsResults: Annotation<RetrievedChunk[]>,
  fused: Annotation<RetrievedChunk[]>,
  // Defaulted: the skipRerank path never runs RerankNode, so reranked/usedCohere
  // must have a value before ContextBuilderNode reads them.
  reranked: Annotation<RetrievedChunk[]>({ reducer: (_left, right) => right, default: () => [] }),
  usedCohere: Annotation<boolean>({ reducer: (_left, right) => right, default: () => false }),
  prompt: Annotation<string>,
  citations: Annotation<ChatCitation[]>,
  answer: Annotation<string>,
});
```

Two fields carry an explicit `default` — every other field is guaranteed to be set by an earlier node on every path through the graph, but `reranked`/`usedCohere` are only ever written by *one* of two mutually-exclusive branches (`rerank` or `skip_rerank`), so `context_builder`, which always runs after either, needs a safe value regardless of which branch it took.

One naming collision is worth calling out because the error message doesn't obviously point at the cause: the final node is called `generate_answer`, not `answer`, because LangGraph rejects a node name that collides with a state channel name — and `answer` is already the state field holding the final answer text.

---

## Step 2 — Hybrid Retrieval: Vector and Keyword Search Over One Table

`hybrid_retrieval` embeds the (possibly reformulated) question through Embedding Service, then runs a vector search and a keyword search in parallel against the same `index.symbol_embeddings` table — one column, two search strategies, no separate keyword index to keep in sync:

```typescript
async vectorSearch(projectId: string, queryEmbedding: number[]): Promise<RetrievedChunk[]> {
  const vectorLiteral = `[${queryEmbedding.join(',')}]`;
  const rows = await this.dataSource.query(
    `SELECT id, symbol_id AS "symbolId", chunk_text AS "chunkText"
     FROM "index".symbol_embeddings
     WHERE project_id = $1
     ORDER BY embedding <=> $2::vector
     LIMIT ${CANDIDATE_LIMIT}`,
    [projectId, vectorLiteral],
  );
  /* ... */
}
```

No dedicated pgvector client library is involved — the query embedding is stringified into Postgres's array-literal text format (`[0.1,0.2,...]`) and passed as a plain parameter; `::vector` does the type conversion server-side. `embedding <=> $1` is pgvector's distance operator, ordering by cosine distance with no similarity threshold — which matters later, because it means vector search essentially always returns *something*, regardless of relevance.

The keyword side queries the same table's generated `search_vector tsvector` column, built via `GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED` when Index Service created the table — nothing here needs to keep two indexes in sync, because Postgres derives the keyword index from the same row automatically on every insert.

---

## Step 3 — Reciprocal Rank Fusion and a Conditional Reranker Skip

Vector search and keyword search produce two independently-ranked lists over the same candidate pool, on scales that aren't directly comparable — a cosine distance and a `ts_rank` score don't mean the same thing. Reciprocal Rank Fusion merges them without needing to reconcile the scales at all:

```typescript
const RRF_K = 60;

export function reciprocalRankFusion(vectorResults: RetrievedChunk[], ftsResults: RetrievedChunk[]): RetrievedChunk[] {
  const scores = new Map<number, number>();
  const chunksById = new Map<number, RetrievedChunk>();

  for (const list of [vectorResults, ftsResults]) {
    list.forEach((chunk, rank) => {
      chunksById.set(chunk.embeddingId, chunk);
      const score = (scores.get(chunk.embeddingId) ?? 0) + 1 / (RRF_K + rank + 1);
      scores.set(chunk.embeddingId, score);
    });
  }

  return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, FUSED_LIMIT).map(([id]) => chunksById.get(id)!);
}
```

A chunk's score is just the sum, over every list it appears in, of `1 / (k + rank)` — a chunk that ranks well on *either* signal scores well overall, and a chunk that ranks well on *both* scores even better, purely from rank position, never from the underlying score value.

`fusion` is also where the routing decision for the rest of the graph is made:

```typescript
export function routeAfterFusion(state: RetrievalStateType): FusionRoute {
  return state.ftsResults.length === 0 && state.retrievalAttempts < MAX_RETRIEVAL_ATTEMPTS
    ? 'reformulate'
    : state.fused.length <= SKIP_RERANK_THRESHOLD
      ? 'skipRerank'
      : 'rerank';
}
```

`skipRerank` exists because reranking a fused list that's already at or below the target size (5) changes nothing — Cohere would just hand back the same 5 candidates in a different order at best. Skipping it isn't an `if` inside the reranker node; it's a distinct node, `SkipRerankNode`, because a routing decision that changes *which node runs next* belongs in the graph's edges, not buried inside a node that then does nothing.

---

## Step 4 — A Free Heuristic Retry Instead of a Second LLM Call

The `reformulate` branch above only fires when `ftsResults.length === 0` — but getting that condition to mean anything took a real, empirically-found bug fix.

Postgres's `plainto_tsquery` (and `websearch_to_tsquery`) AND every word in the query together. A multi-word natural-language question like *"How is the geocoding functionality implemented?"* almost never has every one of those words appear together in a single short code chunk — tested against a real ingested project, that exact question returned **0** keyword-search rows, while the single word `geocode` alone returned **31**. Vector search has no such cliff (`ORDER BY distance LIMIT 50` always returns *something*), so before the fix, `ftsResults.length === 0` was true for almost every real question — not a rare fallback signal, but close to the default state.

The fix was switching from AND to OR semantics, building the `to_tsquery` string by hand instead of using Postgres's own natural-language query builders:

```typescript
// plainto_tsquery/websearch_to_tsquery both AND every word together, so a
// multi-word natural-language question almost never matches a short code
// chunk in full — verified empirically: real questions returned 0 FTS rows
// while the single word "geocode" alone returned 31. OR'ing the words via
// to_tsquery instead makes a match on ANY word count, turning ftsCount back
// into a meaningful "no keyword overlap at all" signal.
export function buildOrTsQuery(text: string): string {
  const words = text.match(/[a-zA-Z0-9]+/g) ?? [];
  return words.join(' | ');
}
```

With that fix, the same question returns real matches on the first pass, and the `reformulate` branch only fires on genuinely irrelevant input — verified by rerunning both a real question and a gibberish string against the live system afterward and confirming the counts (33 vs. 0) matched the intent.

The retry itself, when it does fire, is deliberately *not* a second Claude call:

```typescript
// Free (no LLM) fallback for when the first retrieval pass comes back empty —
// strips interrogative/stopword tokens so the remaining keywords give FTS a
// better shot.
export function reformulateQuery(question: string): string {
  const kept = question
    .replace(/[?.!]+$/, '')
    .split(/\s+/)
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word.toLowerCase()));
  const reformulated = kept.join(' ').trim();
  return reformulated.length > 0 ? reformulated : question;
}
```

The insight isn't really about `tsquery` — it's that a "smart" fallback should first be checked for whether it's cheap. Stripping question words is a one-line regex, costs nothing, and covers the actual failure mode observed (odd phrasing tripping up keyword matching); paying for a whole extra Claude round-trip to reword a question would have solved a problem a plain-text transform already solves for free. `AdvanceAttemptNode` — a dedicated node whose only job is `{ retrievalAttempts: state.retrievalAttempts + 1 }` — bumps the counter on the edge back into `query_understanding`, capping the loop at one retry.

---

## Step 5 — Grounded Answers and Graceful Degradation

The reranker is the one step in the graph that depends on a paid third-party API, and it's built to never take the whole chat down if that dependency isn't configured:

```typescript
async rerank(query: string, candidates: RetrievedChunk[], projectId: string): Promise<RerankResult> {
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) {
    this.logger.warn('RerankClientService.rerank: no COHERE_API_KEY, passing through top candidates unreranked', { projectId });
    return { chunks: candidates.slice(0, RERANK_TOP_N), usedCohere: false };
  }

  const res = await fetch(COHERE_RERANK_URL, { /* ... */ });
  if (!res.ok) {
    this.logger.error('RerankClientService.rerank: Cohere API call failed, falling back to unreranked', { projectId, status: res.status });
    return { chunks: candidates.slice(0, RERANK_TOP_N), usedCohere: false };
  }

  const body = (await res.json()) as { results: { index: number; relevance_score: number }[] };
  return { chunks: body.results.map((r) => candidates[r.index]), usedCohere: true };
}
```

Missing key and failed request take the *same* fallback path — the top 5 fused candidates, unreranked, with a log line marking which happened. Reranking is a quality optimization, not a hard dependency; a chat with `usedCohere: false` still answers correctly, just from a slightly less refined context.

Before the final Claude call, `context_builder` resolves each surviving chunk's `symbolId` against `parse.symbols` — a table it doesn't own — to build both the prompt and the citation list shown in the UI, entirely independently of the model:

```typescript
async build(chunks: RetrievedChunk[], projectId: string): Promise<BuiltContext> {
  const symbolIds = chunks.map((c) => c.symbolId);
  const rows: SymbolRow[] = await this.dataSource.query(
    `SELECT id, file_path AS "filePath", name, start_line AS "startLine"
     FROM "parse".symbols WHERE id = ANY($1::int[])`,
    [symbolIds],
  );
  const symbolsById = new Map(rows.map((r) => [r.id, r]));

  const sections: string[] = [];
  const citations: ChatCitation[] = [];
  for (const chunk of chunks) {
    const symbol = symbolsById.get(chunk.symbolId);
    sections.push(`File: ${symbol?.filePath}\nSymbol: ${symbol?.name} (line ${symbol?.startLine})\n\n${chunk.chunkText}`);
    citations.push({ file: symbol?.filePath ?? 'unknown', symbol: symbol?.name ?? 'unknown', line: symbol?.startLine ?? 0 });
  }
  return { prompt: sections.join('\n\n---\n\n'), citations };
}
```

The final node calls Claude directly through the official Anthropic SDK, with a system prompt that constrains both *what* it can say and *how* it renders:

```typescript
const SYSTEM_PROMPT =
  'You are a code intelligence assistant. Answer the question using only the provided code context. ' +
  'Be specific and reference file paths and symbol names from the context. If the context does not ' +
  'contain enough information to answer, say so plainly rather than guessing. ' +
  'Respond in plain prose only — the reply is rendered as plain text, not Markdown, so do not use ' +
  'headings, bold/italic asterisks, or bullet-point markup.';

const response = await this.client.messages.create({
  model: MODEL,
  max_tokens: MAX_TOKENS,
  thinking: { type: 'adaptive' },
  system: SYSTEM_PROMPT,
  messages: [{ role: 'user', content: `Question: ${question}\n\nCode context:\n\n${contextPrompt || '(no relevant context found)'}` }],
});

if (response.stop_reason === 'refusal') {
  throw new Error('Claude declined to answer this question');
}
```

The last sentence of the system prompt exists because the frontend renders `answer` as plain text (`whitespace-pre-wrap`), not through a Markdown renderer — without it, Claude's natural tendency to format with `##` headings and `**bold**` shows up as literal asterisks and hash marks in the chat bubble. `stop_reason === 'refusal'` is checked explicitly, because current-generation Claude models can decline a request with a normal HTTP 200 rather than an error — treating that as a thrown error routes it into the same `chat.failed` path as any other failure, rather than silently returning an empty answer.

Run against a real ingested project, asking *"Where is authentication handled?"* against a codebase that genuinely has no auth mechanism, the system does exactly what this prompt asks — it says so, with citations to the API-key-configuration files that *are* there, rather than inventing an authentication handler that doesn't exist.

---

## Step 6 — Streaming Progress: Redis as a Journal, Not a Broker

RabbitMQ is the only message broker in the platform — Redis's entire job is being a live-state cache that both sides of the WebSocket connection can see, keyed `chat:{uuid}`. Retrieval Service journals its own progress into it after every graph node, mirroring an "append thinking, then set reply" shape:

```typescript
async appendThinking(chatId: string, step: ChatStep, actor: string): Promise<void> {
  const cache = await this.load(chatId);
  if (!cache) return;
  const message: ChatMessage = { step, actor, status: 'isThinking', response: null };
  await this.save({ ...cache, messages: [...cache.messages, message] });
}

async setReply(chatId: string, step: ChatStep, response: unknown): Promise<void> {
  const cache = await this.load(chatId);
  if (!cache) return;
  const messages = [...cache.messages];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].step === step && messages[i].status === 'isThinking') {
      messages[i] = { ...messages[i], status: 'hasReplied', response };
      break;
    }
  }
  await this.save({ ...cache, messages });
}
```

Every node's `run()` calls `appendThinking` before doing its work and `setReply` after — the graph itself has no idea a WebSocket exists; it just journals to Redis, the same way it would if nothing were watching.

On the other side, Backend's WebSocket gateway polls that same key every 500ms and only sends a frame when the payload actually changed:

```typescript
const intervalId = setInterval(async () => {
  const cache = await this.redisService.getJson<ChatCache>(`chat:${uuid}`);
  if (!cache) return;

  const payload = JSON.stringify({ event: 'chat-update', data: cache });
  if (payload !== lastPayload) {
    lastPayload = payload;
    client.send(payload);
  }

  if (cache.status === 'completed' || cache.status === 'failed') {
    this.clearSubscription(client);
    client.send(JSON.stringify({ event: cache.status, data: { uuid } }));
    client.close(1000, `Chat ${cache.status}`);
  }
}, POLL_INTERVAL_MS);
```

A connecting client that asks for a chat already in a terminal state never touches Redis at all — `handleConnection` checks Postgres first and short-circuits straight to the terminal frame, since a finished chat's answer is already durable there. `@nestjs/platform-ws` routes WebSocket upgrades by an exact literal pathname match, which is why the chat id travels as a query parameter (`/ws/chat?uuid=...`) rather than a path segment — a dynamic path segment simply isn't something the adapter can match against.

`ChatEventsService` waits a 5-second grace window after persisting a chat's final state to Postgres before deleting its Redis key — without it, the gateway's next 500ms poll could find the key already gone right at the moment the frontend most needs the final `chat-update` frame.

---

## Step 7 — Frontend: CLI-Style Trace and Resumable Chat History

The chat UI's step trace deliberately doesn't look like the rest of the chat bubbles — it's a full-width, dark, monospace panel, styled to read like a build log rather than a message:

```tsx
function StepList({ steps }: { steps: ChatMessage[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5 font-mono text-xs">
      {steps.map((step, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span className="flex items-center gap-1.5">
            {step.status === "hasReplied" ? (
              <CheckCircle2 size={13} className="text-emerald-400" />
            ) : (
              <Loader2 size={13} className="animate-spin text-amber-400" />
            )}
            <span className={step.status === "hasReplied" ? "text-emerald-400" : "text-amber-400"}>
              {step.actor}
            </span>
          </span>
          {i < steps.length - 1 && <span className="text-sm font-bold text-white">→</span>}
        </span>
      ))}
    </div>
  );
}
```

Each step reads `Query Understanding → Hybrid Retrieval → Result Fusion → Reranker → Context Builder → Claude`, with a spinner on the running step and a checkmark on every one behind it — a direct visual readout of exactly which LangGraph node is executing, since that's literally what `step.actor` names.

Chat history isn't kept in component state alone. On mount, the component loads a project's full conversation from Postgres and, if the last turn was still `running` when the page loads (a refresh mid-answer), reconnects the same WebSocket rather than losing the in-flight response:

```typescript
useEffect(() => {
  listChats(projectId).then((chats) => {
    const loaded = chats.map((c) => ({ chatId: c.id, question: c.question, steps: c.contents, status: c.status, ...applyAnswerStep(c.contents) }));
    setTurns(loaded);

    const last = loaded[loaded.length - 1];
    if (last?.status === "running" && last.chatId) {
      setAsking(true);
      watchChat(last.chatId);
    }
  });
}, [projectId]);
```

This closes a gap that was easy to miss during development: the reply content was persisted correctly the entire time, but with no reload-on-mount logic, a page refresh looked exactly like the answer had never been saved. The bug was never data loss — it was that nothing ever asked the backend for what it already had.

---

## Key Design Decisions

**LangGraph over a hand-rolled sequential pipeline.** A "query understanding → retrieve → fuse → rerank → build context → answer" pipeline is naturally six sequential `await` calls, and that's exactly how it started. It stopped being adequate the moment two real requirements landed at once: skip reranking when fusion returns nothing worth reranking, and retry with a reformulated query when the first retrieval pass comes back weak. Both are control flow a plain function has to express as nested `if`s wrapped around a `while` — readable for a while, then not. A `StateGraph` makes both a first-class part of the pipeline's shape instead of logic buried inside it: `routeAfterFusion` is a pure function returning one of three branch names, and the retry loop is just an edge from `advance_attempt` back to `query_understanding`, bounded by an attempt counter in state. The graph is the pipeline's actual control-flow diagram, not a diagram drawn to describe code that no longer looks like it.

**CQRS across service boundaries: Index and Parse Services write, Retrieval Service reads.** `index.symbol_embeddings` and `parse.symbols` each have exactly one writer — Index Service and Parse Service, populating them during ingestion — but a second service, Retrieval Service, reads both directly via raw SQL to do hybrid search and resolve citations. That's a command/query split, not a violation of schema ownership: the write side stays single-owner and event-driven like every other stage, while the query side is free to read whatever data answering a question requires, without forcing every retrieval to round-trip through an HTTP call to the owning service. Retrieval Service itself writes to neither schema — it doesn't even write its own result. It publishes `chat.completed`/`chat.failed` back onto RabbitMQ, and `backend`'s `ChatEventsService` is what turns that into the final row in `chats`.

**OR-joined `to_tsquery`, not `plainto_tsquery`.** This was a bug caught by data, not a decision made up front. `plainto_tsquery` implicitly ANDs every word together, so a full multi-word question returned 0 rows from the keyword side of hybrid search while a single word pulled from it returned 31 — a gap only visible once real questions were run against real indexed data, not synthetic test queries. The fix is small (build an OR-joined `to_tsquery` string instead), but the lesson generalizes: a "natural language" query helper's default semantics can quietly turn one half of a hybrid retriever into dead weight, and the only way to catch that is checking actual row counts, not trusting the function name.

**Redis is a cache, not a transport.** Once Redis is in the stack for live-progress polling, it's tempting to reach for it as a pub/sub channel or a lightweight queue too. The rule held firm here: RabbitMQ is the only carrier either side of the chat flow "sends" an event through; Redis's `chat:{uuid}` key is something both Retrieval Service and the WebSocket gateway read and write, but never a signal one side waits on the other to produce. The payoff is failure isolation — if Redis is briefly unavailable, the gateway keeps polling and the LangGraph run keeps executing regardless, because nothing about whether the chat *completes* was ever routed through it.

**Cross-schema reads, never writes.** Retrieval Service reads `index.symbol_embeddings` and `parse.symbols` via raw SQL because hybrid retrieval depends on it — and writes to neither.

**One `.completed`/`.failed` pair per stage, not a shared failure event.** `checkout.failed`, `parse.failed`, `index.failed` let a consumer bind to the exact failure it cares about, instead of branching on a `stage` field.

**`code-inspect.project`** — the ingestion pipeline:

| Publisher | Routing key | Consumer · queue |
|---|---|---|
| backend | `code-inspect.project.started` | checkout-service · `code-inspect.checkout.queue` |
| checkout-service | `code-inspect.project.checkedout.completed` | backend · `code-inspect.backend.queue`; parse-service · `code-inspect.parse.queue` |
| checkout-service | `code-inspect.project.checkout.failed` | backend · `code-inspect.backend.queue` |
| parse-service | `code-inspect.project.parse.completed` | backend · `code-inspect.backend.queue`; index-service · `code-inspect.index.queue` |
| parse-service | `code-inspect.project.parse.failed` | backend · `code-inspect.backend.queue` |
| index-service | `code-inspect.project.index.completed` | backend · `code-inspect.backend.queue` |
| index-service | `code-inspect.project.index.failed` | backend · `code-inspect.backend.queue` |

**`code-inspect.chat`** — the RAG pipeline:

| Publisher | Routing key | Consumer · queue |
|---|---|---|
| backend | `code-inspect.chat.started` | retrieval-service · `code-inspect.retrieval.queue` |
| retrieval-service | `code-inspect.chat.completed` | backend · `code-inspect.backend.queue` |
| retrieval-service | `code-inspect.chat.failed` | backend · `code-inspect.backend.queue` |

**One queue per service, not one queue per event.** `code-inspect.backend.queue` is bound to all 8 routing keys above (6 on `code-inspect.project`, 2 on `code-inspect.chat`), since backend consumes far more events than any other service — one queue with many bindings, rather than eight single-purpose queues. Indexing is the last pipeline stage, so `code-inspect.project.index.completed` marks the project `READY` directly; there's no separate `.ready` event to consume.

---

## Source Code

```bash
git clone https://github.com/ngodinhloc/code-inspect.git
cd code-inspect
cp retrieval-service/.env.example retrieval-service/.env
# Add ANTHROPIC_API_KEY to retrieval-service/.env — COHERE_API_KEY is optional
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000), paste a public GitHub repository URL, and once it reaches `READY`, ask it a question about its own code.
