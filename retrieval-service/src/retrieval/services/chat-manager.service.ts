import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/services/redis.service';
import { CHAT_CACHE_TTL_SECONDS, ChatCache, ChatMessage, ChatStep } from '../contracts/chat.interface';

// Load/mutate the shared ChatCache stored in Redis at chat:{chatId} — mirrors
// the sibling's candidate-agent ExperimentManager (append_thinking/set_reply).
// No locking: safe here because one chat's steps always run strictly in order
// within a single handler invocation, never fanned out in parallel.
@Injectable()
export class ChatManagerService {
  private readonly logger = new Logger(ChatManagerService.name);

  constructor(private readonly redisService: RedisService) {}

  private key(chatId: string): string {
    return `chat:${chatId}`;
  }

  async load(chatId: string): Promise<ChatCache | null> {
    const cache = await this.redisService.getJson<ChatCache>(this.key(chatId));
    if (!cache) {
      this.logger.warn('ChatManagerService.load: cache not found', { chatId });
    }
    return cache;
  }

  async save(cache: ChatCache): Promise<void> {
    const updated: ChatCache = { ...cache, updatedAt: new Date().toISOString() };
    await this.redisService.setJson(this.key(cache.chatId), updated, CHAT_CACHE_TTL_SECONDS);
  }

  async appendThinking(chatId: string, step: ChatStep, actor: string): Promise<void> {
    const cache = await this.load(chatId);
    if (!cache) return;
    const message: ChatMessage = { step, actor, status: 'isThinking', response: null };
    await this.save({ ...cache, messages: [...cache.messages, message] });
  }

  async setReply(chatId: string, step: ChatStep, response: unknown): Promise<void> {
    const cache = await this.load(chatId);
    if (!cache) return;
    const messages = [...cache.messages];
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].step === step && messages[i].status === 'isThinking') {
        messages[i] = { ...messages[i], status: 'hasReplied', response };
        break;
      }
    }
    await this.save({ ...cache, messages });
  }

  async markTerminal(chatId: string, status: 'completed' | 'failed'): Promise<void> {
    const cache = await this.load(chatId);
    if (!cache) return;
    await this.save({ ...cache, status });
  }
}
