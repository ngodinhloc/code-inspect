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

export const EVENT_PROJECT_CHECKED_OUT = 'code-inspect.project.checked_out';
export const EVENT_PROJECT_PARSED = 'code-inspect.project.parsed';
export const EVENT_PROJECT_FAILED = 'code-inspect.project.failed';

export const QUEUE_PARSE_CHECKED_OUT = 'parse.project.checked_out';

export interface ProjectCheckedOutEvent {
  projectId: string;
  repoPath: string;
}

export interface ProjectParsedEvent {
  projectId: string;
}

export interface ProjectFailedEvent {
  projectId: string;
  stage: ProjectStatus;
  reason: string;
}

// Symbol kinds this service can extract. `section` covers Markdown headings and
// `resource` covers Kubernetes-style YAML resources — neither is a programming-language
// symbol, but both fit the same "named, located, has content" shape.
export type SymbolKind =
  'class' | 'function' | 'method' | 'interface' | 'section' | 'resource';
