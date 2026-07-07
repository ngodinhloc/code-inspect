CodeInspect
AI-Powered Code Intelligence Platform for GitHub Repositories

CodeInspect is a distributed code intelligence platform that continuously ingests GitHub repositories and enables developers to understand, explore, and query large codebases using LLM-powered semantic search, hybrid RAG retrieval, and graph-aware code analysis.

Instead of treating source code as plain text, CodeInspect builds a structured understanding of a repository by analyzing files, extracting code symbols, mapping relationships, and combining traditional search techniques with modern AI retrieval.

Users can connect a GitHub repository and ask questions such as:

"Where is authentication handled?"
"What happens when a background job fails?"
"Explain the architecture of this microservice system."
"Which services depend on this database?"
"Where is the retry logic implemented?"
Key Features

1. GitHub Repository Ingestion

Users provide a GitHub repository URL.

Example:

https://github.com/company/project

CodeInspect will:

Validate repository URL
Create an analysis project
Clone the repository
Parse and index the codebase
Build an AI-searchable representation

The ingestion pipeline is fully asynchronous and event-driven.

High-Level Architecture
                         ┌──────────────────┐
                         │    Frontend      │
                         │    Next.js       │
                         └────────┬─────────┘
                                  │
                                  ▼

                         ┌──────────────────┐
                         │   API Service    │
                         │    NestJS        │
                         └────────┬─────────┘
                                  │
                                  │
                    code-inspect.project.started
                                  │
                                  ▼

                         ┌──────────────────┐
                         │ Checkout Service │
                         │                  │
                         │ Clone Repository │
                         └────────┬─────────┘
                                  │
                                  │
             code-inspect.project.checked_out
                                  │
                                  ▼

                         ┌──────────────────┐
                         │  Parse Service   │
                         │                  │
                         │ Tree-sitter AST │
                         └────────┬─────────┘
                                  │
                                  │
                 code-inspect.project.parsed
                                  │
                                  ▼

                         ┌──────────────────┐
                         │  Index Service   │
                         │                  │
                         │ Embeddings      │
                         │ Vector Search   │
                         │ BM25 Index      │
                         └────────┬─────────┘
                                  │
                                  │
                 code-inspect.project.indexed
                                  │
                                  ▼

                         ┌──────────────────┐
                         │ Retrieval API   │
                         │                  │
                         │ Hybrid Search   │
                         │ Reranking       │
                         │ Context Builder │
                         └────────┬─────────┘
                                  │
                                  ▼

                              LLM Agent
Event-Driven Workflow

CodeInspect uses asynchronous events to decouple services.

Project Lifecycle
CREATED

   ↓

code-inspect.project.started

   ↓

CHECKED_OUT

   ↓

code-inspect.project.checked_out

   ↓

PARSED

   ↓

code-inspect.project.parsed

   ↓

INDEXED

   ↓

code-inspect.project.indexed

   ↓

READY

   ↓

code-inspect.project.ready

The final READY state allows future indexing stages to be added without changing the user experience.

Example future stages:

parsed

↓

embedded

↓

keyword_indexed

↓

dependency_graph_built

↓

ready

Services
1. API Service

Technology

Node.js
NestJS
PostgreSQL

Responsibilities:

Receive GitHub repository URL
Validate repository information
Create analysis project
Track project status
Publish ingestion events

Example event:

{
  "event": "code-inspect.project.started",
  "projectId": "12345",
  "repositoryUrl": "https://github.com/org/repo",
  "branch": "main"
}
2. Checkout Service

Consumes:

code-inspect.project.started

Responsibilities:

Clone repository
Checkout branch
Store repository snapshot
Publish completion event

Technology:

Node.js worker
simple-git
Docker volume/object storage

Produces:

code-inspect.project.checked_out

Example:

{
  "projectId": "12345",
  "repoPath": "/repositories/12345"
}
3. Parse Service

Consumes:

code-inspect.project.checked_out

Responsible for transforming source code into structured knowledge.

Supported Languages

Initially:

JavaScript
TypeScript
PHP
Go
YAML
Markdown
File Filtering

Included:

.js
.ts
.php
.go
.yaml
.yml
.md

Excluded:

.git
node_modules
vendor
dist
build
coverage
binary files
AST-Based Parsing

Technology:

Tree-sitter

Instead of simple text chunking, CodeInspect extracts:

Classes
Functions
Methods
Interfaces
Controllers
API endpoints
Kubernetes resources
Configuration blocks

Example:

{
  "type": "function",
  "name": "validateToken",
  "language": "php",
  "file": "Auth/JWTService.php",
  "content": "...",
  "dependencies": [
    "Redis",
    "JWT"
  ]
}
Code Intelligence Model

CodeInspect stores source code as structured entities.

Repository

 ├── Files

 ├── Symbols
 │
 │    ├── Classes
 │    ├── Functions
 │    ├── Methods
 │    └── Interfaces
 │
 ├── Imports
 │
 ├── Dependencies
 │
 ├── API Endpoints
 │
 └── Infrastructure Resources

This enables code-aware retrieval instead of document-based search.

4. Index Service

Consumes:

code-inspect.project.parsed

Responsibilities:

Embedding Generation

Generate semantic vectors for:

code chunks
symbols
documentation

Models:

OpenAI embeddings
BGE embeddings
E5 embeddings
Vector Index

Stores embeddings for semantic search.

Options:

PostgreSQL + pgvector
Weaviate
Pinecone
Keyword Index

Build BM25 search index.

Options:

Elasticsearch
OpenSearch
PostgreSQL Full Text Search

Produces:

code-inspect.project.indexed

5. Retrieval Service

Responsible for answering questions.

Architecture:

User Question

       │

       ▼

Query Understanding

       │

       ▼

Hybrid Retrieval

       │
       ├── Vector Search
       │
       └── BM25 Search

       │

       ▼

Result Fusion

       │

       ▼

Reranker

       │

       ▼

Context Builder

       │

       ▼

LLM Response

Hybrid Retrieval

Combines:

Semantic Search

Understands concepts:

Example:

"user login"

matches:

authenticate()
validateToken()
JWT middleware
Keyword Search

Finds exact matches:

Example:

JWTService
AuthController
validateToken
Reranking

Improve precision using:

Cohere Rerank
BGE Reranker
LLM-based ranking

Pipeline:

100 candidates

↓

Hybrid scoring

↓

20 candidates

↓

Reranker

↓

5 context chunks

↓

LLM
Graph-Aware Code Intelligence (Future)

Build a repository relationship graph.

Example:

AuthController

      |
      v

JWTService

      |
      v

RedisSessionStore

Possible technologies:

Neo4j
PostgreSQL graph tables

Enables questions like:

"What services are affected if authentication changes?"

"Trace the lifecycle of a background job."