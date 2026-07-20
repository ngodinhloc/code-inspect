import { EventHandler } from '../contracts/event.interfaces';
import { EVENT_CHAT_STARTED } from '../../retrieval/contracts/chat.interface';
import { ChatStartedHandler } from '../handlers/chat-started.handler';

export const EVENT_REGISTRY = 'EVENT_REGISTRY';

export function createEventRegistry(
  chatStartedHandler: ChatStartedHandler,
): Record<string, EventHandler> {
  return {
    [EVENT_CHAT_STARTED]: chatStartedHandler,
  };
}
