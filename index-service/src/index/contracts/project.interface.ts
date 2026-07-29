// Mirrors backend/src/projects/contracts/project.interface.ts — kept in sync by hand.
// A field added on either side must be mirrored here, or the two services will
// silently disagree about the shape of an event.

export enum ProjectStatus {
  CREATED = 'CREATED',
  CHECKED_OUT = 'CHECKED_OUT',
  PARSED = 'PARSED',
  INDEXED = 'INDEXED',
  READY = 'READY',
  FAILED = 'FAILED',
}

export const EXCHANGE_PROJECT = 'code-inspect.project';

export const EVENT_PROJECT_PARSE_COMPLETED =
  'code-inspect.project.parse.completed';
export const EVENT_PROJECT_INDEX_COMPLETED =
  'code-inspect.project.index.completed';
export const EVENT_PROJECT_INDEX_FAILED = 'code-inspect.project.index.failed';

export const QUEUE_INDEX_PARSED = 'code-inspect.index.queue';

export interface ProjectParsedEvent {
  projectId: string;
}

// Indexing (embedding + persisting to index.symbol_embeddings) is the last
// pipeline stage, so its completion event marks the project READY directly —
// there's no separate "indexed" status anymore.
export interface ProjectIndexCompletedEvent {
  projectId: string;
}

export interface ProjectFailedEvent {
  projectId: string;
  stage: ProjectStatus;
  reason: string;
}
