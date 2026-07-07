import { Injectable, Logger } from '@nestjs/common';
import { ChatManagerService } from '../services/chat-manager.service';
import { ContextBuilderService } from '../services/context-builder.service';
import { RetrievalStateType } from '../graph/retrieval-state';

@Injectable()
export class ContextBuilderNode {
  private readonly logger = new Logger(ContextBuilderNode.name);

  constructor(
    private readonly chatManager: ChatManagerService,
    private readonly contextBuilder: ContextBuilderService,
  ) {}

  async run(state: RetrievalStateType): Promise<Partial<RetrievalStateType>> {
    this.logger.log('ContextBuilderNode.run: starting', {
      projectId: state.projectId,
      chatId: state.chatId,
      chunkCount: state.reranked.length,
    });
    await this.chatManager.appendThinking(state.chatId, 'context_builder', 'Context Builder');
    const { prompt, citations } = await this.contextBuilder.build(state.reranked, state.projectId);
    await this.chatManager.setReply(state.chatId, 'context_builder', { chunkCount: state.reranked.length });
    this.logger.log('ContextBuilderNode.run: done', {
      projectId: state.projectId,
      chatId: state.chatId,
      citationCount: citations.length,
    });
    return { prompt, citations };
  }
}
