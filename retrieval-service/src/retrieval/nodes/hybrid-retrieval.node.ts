import { Injectable, Logger } from '@nestjs/common';
import { ChatManagerService } from '../services/chat-manager.service';
import { EmbeddingClientService } from '../services/embedding-client.service';
import { HybridRetrievalService } from '../services/hybrid-retrieval.service';
import { RetrievalStateType } from '../graph/retrieval-state';

@Injectable()
export class HybridRetrievalNode {
  private readonly logger = new Logger(HybridRetrievalNode.name);

  constructor(
    private readonly chatManager: ChatManagerService,
    private readonly embeddingClient: EmbeddingClientService,
    private readonly hybridRetrieval: HybridRetrievalService,
  ) {}

  async run(state: RetrievalStateType): Promise<Partial<RetrievalStateType>> {
    this.logger.log('HybridRetrievalNode.run: starting', {
      projectId: state.projectId,
      chatId: state.chatId,
      query: state.expandedQuery,
    });
    await this.chatManager.appendThinking(state.chatId, 'hybrid_retrieval', 'Hybrid Retrieval');

    const queryEmbedding = await this.embeddingClient.embed(state.expandedQuery, state.projectId);
    const [vectorResults, ftsResults] = await Promise.all([
      this.hybridRetrieval.vectorSearch(state.projectId, queryEmbedding),
      this.hybridRetrieval.ftsSearch(state.projectId, state.expandedQuery),
    ]);

    await this.chatManager.setReply(state.chatId, 'hybrid_retrieval', {
      vectorCount: vectorResults.length,
      ftsCount: ftsResults.length,
    });
    this.logger.log('HybridRetrievalNode.run: done', {
      projectId: state.projectId,
      chatId: state.chatId,
      vectorCount: vectorResults.length,
      ftsCount: ftsResults.length,
    });
    return { vectorResults, ftsResults };
  }
}
