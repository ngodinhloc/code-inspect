export type ProjectStatus = "CREATED" | "CHECKED_OUT" | "PARSED" | "INDEXED" | "READY" | "FAILED";

export interface Project {
  id: string;
  repositoryUrl: string;
  branch: string;
  status: ProjectStatus;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  repositoryUrl: string;
  branch?: string;
}

export interface QueryCitation {
  file: string;
  symbol?: string;
  line?: number;
}

export type ChatStep =
  | "query_understanding"
  | "hybrid_retrieval"
  | "fusion"
  | "rerank"
  | "context_builder"
  | "answer";
export type ChatMessageStatus = "isThinking" | "hasReplied";
export type ChatRunStatus = "running" | "completed" | "failed";

export interface ChatMessage {
  step: ChatStep;
  actor: string;
  status: ChatMessageStatus;
  response: unknown | null;
}

export interface ChatResponse {
  id: string;
  projectId: string;
  question: string;
  contents: ChatMessage[];
  status: ChatRunStatus;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnswerStepResponse {
  answer: string;
  citations: QueryCitation[];
}

export interface QueryTurn {
  chatId?: string;
  question: string;
  steps: ChatMessage[];
  status: ChatRunStatus;
  answer?: string;
  citations?: QueryCitation[];
  error?: string;
}
