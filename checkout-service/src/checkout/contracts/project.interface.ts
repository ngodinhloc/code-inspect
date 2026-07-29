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

export const EVENT_PROJECT_STARTED = 'code-inspect.project.started';
export const EVENT_PROJECT_CHECKOUT_COMPLETED =
  'code-inspect.project.checkedout.completed';
export const EVENT_PROJECT_CHECKOUT_FAILED =
  'code-inspect.project.checkout.failed';

export const QUEUE_CHECKOUT_STARTED = 'code-inspect.checkout.queue';

export interface ProjectStartedEvent {
  projectId: string;
  repositoryUrl: string;
  branch: string;
}

export interface ProjectCheckedOutEvent {
  projectId: string;
  repoPath: string;
}

export interface ProjectFailedEvent {
  projectId: string;
  stage: ProjectStatus;
  reason: string;
}
