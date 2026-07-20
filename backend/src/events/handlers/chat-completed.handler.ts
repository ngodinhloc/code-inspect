import { Injectable } from '@nestjs/common';
import { ChatService } from '../../chat/services/chat.service';
import { AppLogger } from '../../common/logger/services/app-logger';
import { EventHandler } from '../contracts/event.interfaces';
import {
  CHAT_CACHE_CLEANUP_DELAY_MS,
  ChatCompletedEvent,
} from '../../chat/contracts/chat.interface';

@Injectable()
export class ChatCompletedHandler implements EventHandler {
  constructor(
    private readonly chatService: ChatService,
    private readonly logger: AppLogger,
  ) {}

  async handle(payload: Record<string, unknown>): Promise<void> {
    const event = payload as unknown as ChatCompletedEvent;
    if (!event.chatId) {
      this.logger.warn('ChatCompletedHandler.handle: malformed event', {
        payload,
      });
      return;
    }

    await this.chatService.finalize(event.chatId, 'completed', null);
    // Grace delay so the WS gateway's next poll can push the final Redis state
    // before it disappears — mirrors the sibling's REDIS_CLEANUP_DELAY_MS.
    setTimeout(() => {
      void this.chatService.deleteCache(event.chatId);
    }, CHAT_CACHE_CLEANUP_DELAY_MS);
  }
}
