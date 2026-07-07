import { Module } from '@nestjs/common';
import { RetrievalService } from './services/retrieval.service';
import { ChatManagerService } from './services/chat-manager.service';
import { EmbeddingClientService } from './services/embedding-client.service';
import { HybridRetrievalService } from './services/hybrid-retrieval.service';
import { RerankClientService } from './services/rerank-client.service';
import { ContextBuilderService } from './services/context-builder.service';
import { AnswerService } from './services/answer.service';
import { RetrievalGraph } from './graph/retrieval-graph';
import { QueryUnderstandingNode } from './nodes/query-understanding.node';
import { HybridRetrievalNode } from './nodes/hybrid-retrieval.node';
import { FusionNode } from './nodes/fusion.node';
import { AdvanceAttemptNode } from './nodes/advance-attempt.node';
import { SkipRerankNode } from './nodes/skip-rerank.node';
import { RerankNode } from './nodes/rerank.node';
import { ContextBuilderNode } from './nodes/context-builder.node';
import { AnswerNode } from './nodes/answer.node';

@Module({
  providers: [
    RetrievalService,
    RetrievalGraph,
    ChatManagerService,
    EmbeddingClientService,
    HybridRetrievalService,
    RerankClientService,
    ContextBuilderService,
    AnswerService,
    QueryUnderstandingNode,
    HybridRetrievalNode,
    FusionNode,
    AdvanceAttemptNode,
    SkipRerankNode,
    RerankNode,
    ContextBuilderNode,
    AnswerNode,
  ],
})
export class RetrievalModule {}
