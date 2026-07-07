import { Annotation } from '@langchain/langgraph';
import { RetrievedChunk } from '../services/hybrid-retrieval.service';
import { ChatCitation } from '../contracts/chat.interface';

// Shared state threaded through the LangGraph retrieval graph (see
// retrieval-graph.ts). Every field a node reads must either be part of the
// initial `graph.invoke()` call or be set by a node that runs before it.
export const RetrievalState = Annotation.Root({
  chatId: Annotation<string>,
  projectId: Annotation<string>,
  question: Annotation<string>,
  expandedQuery: Annotation<string>,
  // Bumped by AdvanceAttemptNode each time fusion routes back to
  // query_understanding for a heuristic retry. Capped in routeAfterFusion.
  retrievalAttempts: Annotation<number>,
  vectorResults: Annotation<RetrievedChunk[]>,
  ftsResults: Annotation<RetrievedChunk[]>,
  fused: Annotation<RetrievedChunk[]>,
  // Defaulted: the skipRerank path (small fused set) never runs RerankNode,
  // so reranked/usedCohere must have a value before ContextBuilderNode reads them.
  reranked: Annotation<RetrievedChunk[]>({ reducer: (_left, right) => right, default: () => [] }),
  usedCohere: Annotation<boolean>({ reducer: (_left, right) => right, default: () => false }),
  prompt: Annotation<string>,
  citations: Annotation<ChatCitation[]>,
  answer: Annotation<string>,
});

export type RetrievalStateType = typeof RetrievalState.State;
