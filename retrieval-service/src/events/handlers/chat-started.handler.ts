import { Injectable } from '@nestjs/common';
import { RabbitMQService } from '../../rabbitmq/services/rabbitmq.service';
import { ChatManagerService } from '../../retrieval/services/chat-manager.service';
import { RetrievalGraph } from '../../retrieval/graph/retrieval-graph';
import { AppLogger } from '../../common/logger/services/app-logger';
import { EventHandler } from '../contracts/event.interfaces';
import {
  ChatCompletedEvent,
  ChatFailedEvent,
  ChatStartedEvent,
  EVENT_CHAT_COMPLETED,
  EVENT_CHAT_FAILED,
  EXCHANGE_CHAT,
} from '../../retrieval/contracts/chat.interface';

@Injectable()
export class ChatStartedHandler implements EventHandler {
  private readonly graph: ReturnType<RetrievalGraph['build']>;

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly chatManager: ChatManagerService,
    private readonly logger: AppLogger,
    retrievalGraph: RetrievalGraph,
  ) {
    this.graph = retrievalGraph.build();
  }

  async handle(payload: Record<string, unknown>): Promise<void> {
    const event = payload as unknown as ChatStartedEvent;
    if (!event.chatId || !event.projectId || !event.question) {
      this.logger.warn('ChatStartedHandler.handle: malformed event', {
        payload,
      });
      return;
    }

    const { chatId, projectId, question } = event;
    this.logger.log('ChatStartedHandler.handle: answering', {
      projectId,
      chatId,
    });

    try {
      const result = await this.graph.invoke({
        chatId,
        projectId,
        question,
        expandedQuery: question,
        retrievalAttempts: 0,
      });

      await this.chatManager.markTerminal(chatId, 'completed');
      const completed: ChatCompletedEvent = { chatId, projectId };
      await this.rabbitMQService.publish(
        EXCHANGE_CHAT,
        EVENT_CHAT_COMPLETED,
        completed,
      );

      this.logger.log('ChatStartedHandler.handle: answered', {
        projectId,
        chatId,
        citations: (result.citations ?? []).length,
      });
    } catch (err) {
      this.logger.error('ChatStartedHandler.handle: failed', {
        projectId,
        chatId,
        error: String(err),
      });
      await this.chatManager.markTerminal(chatId, 'failed');
      const failed: ChatFailedEvent = {
        chatId,
        projectId,
        reason: `Failed to answer question: ${String(err)}`,
      };
      await this.rabbitMQService.publish(
        EXCHANGE_CHAT,
        EVENT_CHAT_FAILED,
        failed,
      );
    }
  }
}
