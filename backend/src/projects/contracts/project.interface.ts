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
export const EVENT_PROJECT_CHECKED_OUT = 'code-inspect.project.checked_out';
export const EVENT_PROJECT_PARSED = 'code-inspect.project.parsed';
export const EVENT_PROJECT_INDEXED = 'code-inspect.project.indexed';
export const EVENT_PROJECT_READY = 'code-inspect.project.ready';
export const EVENT_PROJECT_FAILED = 'code-inspect.project.failed';

// Durable queues this service (the API) binds for events it consumes back
// from downstream stages, to keep the `projects` table's status in sync.
export const QUEUE_API_CHECKED_OUT = 'api.project.checked_out';
export const QUEUE_API_PARSED = 'api.project.parsed';
export const QUEUE_API_INDEXED = 'api.project.indexed';
export const QUEUE_API_READY = 'api.project.ready';
export const QUEUE_API_FAILED = 'api.project.failed';

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
