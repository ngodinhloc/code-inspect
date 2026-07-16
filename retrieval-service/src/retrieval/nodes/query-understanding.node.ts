import { Injectable, Logger } from '@nestjs/common';
import { ChatManagerService } from '../services/chat-manager.service';
import { reformulateQuery } from '../services/reformulate-query';
import { RetrievalStateType } from '../graph/retrieval-state';

@Injectable()
export class QueryUnderstandingNode {
  private readonly logger = new Logger(QueryUnderstandingNode.name);

  constructor(private readonly chatManager: ChatManagerService) {}

  async run(state: RetrievalStateType): Promise<Partial<RetrievalStateType>> {
    this.logger.log('QueryUnderstandingNode.run: starting', {
      projectId: state.projectId,
      chatId: state.chatId,
      attempt: state.retrievalAttempts,
    });
    await this.chatManager.appendThinking(
      state.chatId,
      'query_understanding',
      'Query Understanding',
    );

    const expandedQuery =
      state.retrievalAttempts === 0
        ? state.question
        : reformulateQuery(state.question);

    await this.chatManager.setReply(state.chatId, 'query_understanding', {
      expandedQuery,
      attempt: state.retrievalAttempts,
    });
    this.logger.log('QueryUnderstandingNode.run: done', {
      projectId: state.projectId,
      chatId: state.chatId,
      expandedQuery,
    });
    return { expandedQuery };
  }
}
