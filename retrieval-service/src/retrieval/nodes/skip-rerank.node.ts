import { Injectable, Logger } from '@nestjs/common';
import { ChatManagerService } from '../services/chat-manager.service';
import { RetrievalStateType } from '../graph/retrieval-state';

const TOP_N = 5;

// Taken when fusion already produced <=5 candidates — reranking a set that
// small down to 5 buys nothing, so we skip the Cohere round-trip entirely.
// Still emits a 'rerank' thinking/reply pair so the frontend step list stays
// consistent regardless of which branch fusion took.
@Injectable()
export class SkipRerankNode {
  private readonly logger = new Logger(SkipRerankNode.name);

  constructor(private readonly chatManager: ChatManagerService) {}

  async run(state: RetrievalStateType): Promise<Partial<RetrievalStateType>> {
    this.logger.log(
      'SkipRerankNode.run: skipping Cohere, fused set already small',
      {
        projectId: state.projectId,
        chatId: state.chatId,
        fusedCount: state.fused.length,
      },
    );
    await this.chatManager.appendThinking(state.chatId, 'rerank', 'Reranker');
    const reranked = state.fused.slice(0, TOP_N);
    await this.chatManager.setReply(state.chatId, 'rerank', {
      rerankedCount: reranked.length,
      usedCohere: false,
      skipped: true,
    });
    return { reranked, usedCohere: false };
  }
}
