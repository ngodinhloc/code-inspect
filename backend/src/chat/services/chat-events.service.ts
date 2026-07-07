import { Injectable, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../../rabbitmq/services/rabbitmq.service';
import { ChatService } from './chat.service';
import {
  CHAT_CACHE_CLEANUP_DELAY_MS,
  ChatCompletedEvent,
  ChatFailedEvent,
  EVENT_CHAT_COMPLETED,
  EVENT_CHAT_FAILED,
  EXCHANGE_CHAT,
  QUEUE_API_CHAT_COMPLETED,
  QUEUE_API_CHAT_FAILED,
} from '../contracts/chat.interface';

// The API service owns the `chats` table; retrieval-service only publishes
// progress into Redis and a terminal event here, so this is the one place
// that turns that terminal event back into a persisted Postgres row.
@Injectable()
export class ChatEventsService implements OnModuleInit {
  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly chatService: ChatService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitMQService.subscribe(EXCHANGE_CHAT, QUEUE_API_CHAT_COMPLETED, EVENT_CHAT_COMPLETED, (payload) => {
      const event = payload as unknown as ChatCompletedEvent;
      return this.finalizeAndCleanup(event.chatId, 'completed', null);
    });
    await this.rabbitMQService.subscribe(EXCHANGE_CHAT, QUEUE_API_CHAT_FAILED, EVENT_CHAT_FAILED, (payload) => {
      const event = payload as unknown as ChatFailedEvent;
      return this.finalizeAndCleanup(event.chatId, 'failed', event.reason);
    });
  }

  private async finalizeAndCleanup(chatId: string, status: 'completed' | 'failed', reason: string | null): Promise<void> {
    await this.chatService.finalize(chatId, status, reason);
    // Grace delay so the WS gateway's next poll can push the final Redis state
    // before it disappears — mirrors the sibling's REDIS_CLEANUP_DELAY_MS.
    setTimeout(() => {
      void this.chatService.deleteCache(chatId);
    }, CHAT_CACHE_CLEANUP_DELAY_MS);
  }
}
