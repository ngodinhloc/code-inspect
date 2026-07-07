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

export const EVENT_PROJECT_PARSED = 'code-inspect.project.parsed';
export const EVENT_PROJECT_INDEXED = 'code-inspect.project.indexed';
export const EVENT_PROJECT_READY = 'code-inspect.project.ready';
export const EVENT_PROJECT_FAILED = 'code-inspect.project.failed';

export const QUEUE_INDEX_PARSED = 'index.project.parsed';

export interface ProjectParsedEvent {
  projectId: string;
}

export interface ProjectIndexedEvent {
  projectId: string;
}

export interface ProjectReadyEvent {
  projectId: string;
}

export interface ProjectFailedEvent {
  projectId: string;
  stage: ProjectStatus;
  reason: string;
}
