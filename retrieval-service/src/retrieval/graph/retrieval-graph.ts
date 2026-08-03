import { Injectable } from '@nestjs/common';
import { StateGraph, START, END } from '@langchain/langgraph';
import { RetrievalState } from './retrieval-state';
import { QueryUnderstandingNode } from '../nodes/query-understanding.node';
import { HybridRetrievalNode } from '../nodes/hybrid-retrieval.node';
import { FusionNode, routeAfterFusion } from '../nodes/fusion.node';
import { AdvanceAttemptNode } from '../nodes/advance-attempt.node';
import { SkipRerankNode } from '../nodes/skip-rerank.node';
import { RerankNode } from '../nodes/rerank.node';
import { ContextBuilderNode } from '../nodes/context-builder.node';
import { AnswerNode } from '../nodes/answer.node';

// Builds the LangGraph state machine that answers one chat question.
//
// Flow:
//
//   START -> query_understanding -> hybrid_retrieval -> fusion -> [route?]
//                ^                                                  |
//                |                                    reformulate   | skipRerank / rerank
//                +---------------- advance_attempt <---+            |
//                                                                    v
//                                    skip_rerank / rerank -> context_builder -> generate_answer -> END
//
// fusion routes to advance_attempt (then loops back to query_understanding)
// when the first retrieval pass came back empty — a free, heuristic query
// reformulation (see reformulate-query.ts), capped at one retry. Otherwise it
// routes straight to rerank, or to skip_rerank when the fused candidate set
// is already small enough that reranking wouldn't change anything.
//
// Node key is "generate_answer" rather than "answer" because LangGraph
// forbids a node name colliding with a state channel name, and "answer" is
// already the state field holding the final answer text.
@Injectable()
export class RetrievalGraph {
  constructor(
    private readonly queryUnderstandingNode: QueryUnderstandingNode,
    private readonly hybridRetrievalNode: HybridRetrievalNode,
    private readonly fusionNode: FusionNode,
    private readonly advanceAttemptNode: AdvanceAttemptNode,
    private readonly skipRerankNode: SkipRerankNode,
    private readonly rerankNode: RerankNode,
    private readonly contextBuilderNode: ContextBuilderNode,
    private readonly answerNode: AnswerNode,
  ) {}

  build() {
    return new StateGraph(RetrievalState)
      .addNode('query_understanding', (state) =>
        this.queryUnderstandingNode.run(state),
      )
      .addNode('hybrid_retrieval', (state) =>
        this.hybridRetrievalNode.run(state),
      )
      .addNode('fusion', (state) => this.fusionNode.run(state))
      .addNode('advance_attempt', (state) => this.advanceAttemptNode.run(state))
      .addNode('skip_rerank', (state) => this.skipRerankNode.run(state))
      .addNode('rerank', (state) => this.rerankNode.run(state))
      .addNode('context_builder', (state) => this.contextBuilderNode.run(state))
      .addNode('generate_answer', (state) => this.answerNode.run(state))
      .addEdge(START, 'query_understanding')
      .addEdge('query_understanding', 'hybrid_retrieval')
      .addEdge('hybrid_retrieval', 'fusion')
      .addConditionalEdges('fusion', routeAfterFusion, {
        reformulate: 'advance_attempt',
        skipRerank: 'skip_rerank',
        rerank: 'rerank',
      })
      .addEdge('advance_attempt', 'query_understanding')
      .addEdge('skip_rerank', 'context_builder')
      .addEdge('rerank', 'context_builder')
      .addEdge('context_builder', 'generate_answer')
      .addEdge('generate_answer', END)
      .compile();
  }
}
