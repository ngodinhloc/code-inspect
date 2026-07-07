import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../../rabbitmq/services/rabbitmq.service';
import { ChatManagerService } from './chat-manager.service';
import { RetrievalGraph } from '../graph/retrieval-graph';
import {
  ChatCompletedEvent,
  ChatFailedEvent,
  ChatStartedEvent,
  EVENT_CHAT_COMPLETED,
  EVENT_CHAT_FAILED,
  EVENT_CHAT_STARTED,
  EXCHANGE_CHAT,
  QUEUE_RETRIEVAL_CHAT_STARTED,
} from '../contracts/chat.interface';

@Injectable()
export class RetrievalService implements OnModuleInit {
  private readonly logger = new Logger(RetrievalService.name);
  private readonly graph: ReturnType<RetrievalGraph['build']>;

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly chatManager: ChatManagerService,
    retrievalGraph: RetrievalGraph,
  ) {
    this.graph = retrievalGraph.build();
  }

  async onModuleInit(): Promise<void> {
    await this.rabbitMQService.subscribe(EXCHANGE_CHAT, QUEUE_RETRIEVAL_CHAT_STARTED, EVENT_CHAT_STARTED, (payload) =>
      this.handleChatStarted(payload as unknown as ChatStartedEvent),
    );
  }

  private async handleChatStarted(event: ChatStartedEvent): Promise<void> {
    const { chatId, projectId, question } = event;
    this.logger.log('RetrievalService.handleChatStarted: answering', { projectId, chatId });

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
      await this.rabbitMQService.publish(EXCHANGE_CHAT, EVENT_CHAT_COMPLETED, completed);

      this.logger.log('RetrievalService.handleChatStarted: answered', {
        projectId,
        chatId,
        citations: (result.citations ?? []).length,
      });
    } catch (err) {
      this.logger.error('RetrievalService.handleChatStarted: failed', { projectId, chatId, error: String(err) });
      await this.chatManager.markTerminal(chatId, 'failed');
      const failed: ChatFailedEvent = { chatId, projectId, reason: `Failed to answer question: ${String(err)}` };
      await this.rabbitMQService.publish(EXCHANGE_CHAT, EVENT_CHAT_FAILED, failed);
    }
  }
}
