// Mirrors retrieval-service/src/retrieval/contracts/chat.interface.ts — kept in
// sync by hand, same convention as the project.interface.ts event contracts.

export const EXCHANGE_CHAT = 'code-inspect.chat';

export const EVENT_CHAT_STARTED = 'code-inspect.chat.started';
export const EVENT_CHAT_COMPLETED = 'code-inspect.chat.completed';
export const EVENT_CHAT_FAILED = 'code-inspect.chat.failed';

export const QUEUE_API_CHAT_COMPLETED = 'api.chat.completed';
export const QUEUE_API_CHAT_FAILED = 'api.chat.failed';

// Redis key for the live cache is `chat:{chatId}` (chatId === Chat.uuid).
export const CHAT_CACHE_TTL_SECONDS = 7200;
// Grace window between chat.completed/.failed and deleting the Redis key, so
// the WS gateway's next poll can push the final state before it disappears.
export const CHAT_CACHE_CLEANUP_DELAY_MS = 5000;

export type ChatStep = 'query_understanding' | 'hybrid_retrieval' | 'fusion' | 'rerank' | 'context_builder' | 'answer';
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
