// Mirrors backend/src/chat/contracts/chat.interface.ts — kept in sync by hand.
// A field added on either side must be mirrored here, or the two services will
// silently disagree about the shape of an event.

export const EXCHANGE_CHAT = 'code-inspect.chat';

export const EVENT_CHAT_STARTED = 'code-inspect.chat.started';
export const EVENT_CHAT_COMPLETED = 'code-inspect.chat.completed';
export const EVENT_CHAT_FAILED = 'code-inspect.chat.failed';

export const QUEUE_RETRIEVAL_CHAT_STARTED = 'retrieval.chat.started';

export const CHAT_CACHE_TTL_SECONDS = 7200;

export type ChatStep =
  | 'query_understanding'
  | 'hybrid_retrieval'
  | 'fusion'
  | 'rerank'
  | 'context_builder'
  | 'answer';
export type ChatMessageStatus = 'isThinking' | 'hasReplied';
export type ChatRunStatus = 'running' | 'completed' | 'failed';

export interface ChatCitation {
  file: string;
  symbol: string;
  line: number;
}

export interface ChatMessage {
  step: ChatStep;
  actor: string;
  status: ChatMessageStatus;
  response: unknown | null;
}

// Stored in Redis at chat:{chatId}
export interface ChatCache {
  eventName: string;
  chatId: string;
  projectId: string;
  question: string;
  messages: ChatMessage[];
  status: ChatRunStatus;
  updatedAt: string;
}

export interface ChatStartedEvent {
  chatId: string;
  projectId: string;
  question: string;
}

export interface ChatCompletedEvent {
  chatId: string;
  projectId: string;
}

export interface ChatFailedEvent {
  chatId: string;
  projectId: string;
  reason: string;
}
