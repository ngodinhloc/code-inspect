# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Code Inspect is an event-driven RAG pipeline for GitHub repositories: point it at a public repo and it clones, parses (via Tree-sitter), embeds, and indexes the codebase through a chain of independent NestJS services with no central orchestrator. Once a project reaches `READY`, questions are answered by a LangGraph state machine grounded in the parsed code, with file/line citations, streamed live over WebSocket.

Read [README.md](README.md) first — it documents the full architecture, RabbitMQ topology, Postgres schema ownership, and each service's responsibilities in detail (including a worked end-to-end example with real parser/index/RAG output). This file only adds what the README doesn't: commands and cross-cutting conventions.

## Running the stack

```bash
docker compose up --build
```

Every ingestion service is self-hosted, no API key required. To ask questions once a project is `READY`, Retrieval Service needs Anthropic:

```bash
cp retrieval-service/.env.example retrieval-service/.env
# set ANTHROPIC_API_KEY=sk-ant-... — COHERE_API_KEY is optional (reranker falls back gracefully if unset)
```

- Frontend: http://localhost:3000
- RabbitMQ management UI: http://localhost:15672 (`guest`/`guest`)
- Per-service health checks: `GET http://localhost:800{0..5}/api/health`

## Development commands

Each backend service (`backend`, `checkout-service`, `parse-service`, `embedding-service`, `index-service`, `retrieval-service`) is an independent NestJS 11 app with the same scripts — run from that service's directory:

```bash
npm run start:dev   # nest start --watch
npm run build        # nest build
npm run lint          # eslint src --ext .ts
```

Frontend (`frontend/`, Next.js 16 / React 19):

```bash
npm run dev     # next dev --webpack
npm run build
npm run lint
```

There is no automated test suite in this repo (no `test` script, no Jest config in any service) — verification is done by running the stack and exercising it end-to-end (see the `verify` and `run` skills), or by checking a single service's `/api/health` after `npm run start:dev` against the shared docker-compose infra (Postgres/RabbitMQ/Redis).

## Cross-cutting architectural conventions

These apply across every service and are easy to violate by copying a pattern from a different codebase — check the README's per-service sections for the specifics before changing any of this:

- **No central orchestrator.** Every stage of both the ingestion pipeline and the RAG pipeline is triggered by consuming a RabbitMQ event and completes by publishing the next one. A service never calls another service's HTTP API to advance the pipeline (Embedding Service is the one exception — it's a stateless HTTP utility, not a pipeline stage).
- **Schema-per-service Postgres, one shared instance.** `backend`, `parse`, and `index` schemas each have exactly one owning service that writes to them. Index Service and Retrieval Service are the only cross-schema *readers* (both read `parse.symbols` via raw SQL; Retrieval Service also reads `index.symbol_embeddings`) — neither ever writes outside its own schema. Never add a write to a table owned by another service.
- **Event contracts are hand-duplicated, not shared.** Each service defines its own `*/contracts/*.interface.ts` matching the event shape it consumes/publishes — there's no shared npm package. If you change a published event's shape, you must manually update the interface in every consuming service.
- **Only the API service (`backend`) writes lifecycle status.** Checkout/Parse/Index services never touch the `projects` or `chats` tables to report progress — they just publish an event and move on. `ProjectEventsService` and `ChatEventsService` in `backend` are the sole writers of `projects.status` and `chats.status`/`contents` respectively.
- **Redis is a live-progress cache, never a message broker.** RabbitMQ is the only carrier of events; Redis (`chat:{uuid}` keys) exists purely so the WebSocket gateway has something cheap to poll every 500ms while the RAG graph runs.
- **Idempotent re-processing.** Redelivered events must not duplicate work — e.g. Checkout Service removes any partial clone before re-cloning; Parse Service deletes and rewrites a project's rows rather than appending.
- **Graceful degradation over hard failure for optional dependencies.** No `COHERE_API_KEY` → rerank step logs a warning and passes through the top-5 fused candidates unreranked; the chat still completes rather than failing.

## Key docs in this repo

- [README.md](README.md) — architecture, RabbitMQ topology, Postgres schema table, per-service API/behavior reference, and a real captured parse/index/RAG run.
- [SPECS.md](SPECS.md) — the code intelligence data model (symbol types per language, dependency extraction rules) that Parse Service implements.
- [PLANS.md](PLANS.md) — milestone breakdown; check here before assuming a feature is unbuilt vs. deliberately deferred (e.g. the roadmap explicitly calls out what's not yet built).
