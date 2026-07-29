export enum ProjectStatus {
  CREATED = 'CREATED',
  CHECKED_OUT = 'CHECKED_OUT',
  PARSED = 'PARSED',
  INDEXED = 'INDEXED',
  READY = 'READY',
  FAILED = 'FAILED',
}

// Single topic exchange for the whole project lifecycle; routing key = event name,
// so a new consumer just binds its own durable queue to the routing key it cares about.
export const EXCHANGE_PROJECT = 'code-inspect.project';

export const EVENT_PROJECT_STARTED = 'code-inspect.project.started';
export const EVENT_PROJECT_CHECKOUT_COMPLETED =
  'code-inspect.project.checkedout.completed';
export const EVENT_PROJECT_CHECKOUT_FAILED =
  'code-inspect.project.checkout.failed';
export const EVENT_PROJECT_PARSE_COMPLETED =
  'code-inspect.project.parse.completed';
export const EVENT_PROJECT_PARSE_FAILED = 'code-inspect.project.parse.failed';
export const EVENT_PROJECT_INDEX_COMPLETED =
  'code-inspect.project.index.completed';
export const EVENT_PROJECT_INDEX_FAILED = 'code-inspect.project.index.failed';

export interface ProjectStartedEvent {
  projectId: string;
  repositoryUrl: string;
  branch: string;
}

export interface ProjectCheckedOutEvent {
  projectId: string;
  repoPath: string;
}

export interface ProjectParsedEvent {
  projectId: string;
}

// Indexing is the last pipeline stage, so its completion event marks the
// project READY directly — there's no separate "indexed" status/event anymore.
export interface ProjectIndexCompletedEvent {
  projectId: string;
}

export interface ProjectFailedEvent {
  projectId: string;
  stage: ProjectStatus;
  reason: string;
}
