import { Injectable, Logger } from '@nestjs/common';
import { ChatManagerService } from '../services/chat-manager.service';
import { RerankClientService } from '../services/rerank-client.service';
import { RetrievalStateType } from '../graph/retrieval-state';

@Injectable()
export class RerankNode {
  private readonly logger = new Logger(RerankNode.name);

  constructor(
    private readonly chatManager: ChatManagerService,
    private readonly rerankClient: RerankClientService,
  ) {}

  async run(state: RetrievalStateType): Promise<Partial<RetrievalStateType>> {
    this.logger.log('RerankNode.run: starting', {
      projectId: state.projectId,
      chatId: state.chatId,
      candidateCount: state.fused.length,
    });
    await this.chatManager.appendThinking(state.chatId, 'rerank', 'Reranker');
    const { chunks: reranked, usedCohere } = await this.rerankClient.rerank(
      state.expandedQuery,
      state.fused,
      state.projectId,
    );
    await this.chatManager.setReply(state.chatId, 'rerank', {
      rerankedCount: reranked.length,
      usedCohere,
    });
    this.logger.log('RerankNode.run: done', {
      projectId: state.projectId,
      chatId: state.chatId,
      rerankedCount: reranked.length,
      usedCohere,
      reranked: reranked.map(({ embeddingId, symbolId }) => ({
        embeddingId,
        symbolId,
      })),
    });
    return { reranked, usedCohere };
  }
}
