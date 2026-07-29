import { EventHandler } from '../contracts/event.interfaces';
import {
  EVENT_PROJECT_CHECKOUT_COMPLETED,
  EVENT_PROJECT_CHECKOUT_FAILED,
  EVENT_PROJECT_PARSE_COMPLETED,
  EVENT_PROJECT_PARSE_FAILED,
  EVENT_PROJECT_INDEX_COMPLETED,
  EVENT_PROJECT_INDEX_FAILED,
} from '../../projects/contracts/project.interface';
import {
  EVENT_CHAT_COMPLETED,
  EVENT_CHAT_FAILED,
} from '../../chat/contracts/chat.interface';
import { ProjectCheckedOutHandler } from '../handlers/project-checked-out.handler';
import { ProjectParsedHandler } from '../handlers/project-parsed.handler';
import { ProjectIndexCompletedHandler } from '../handlers/project-index-completed.handler';
import { ProjectFailedHandler } from '../handlers/project-failed.handler';
import { ChatCompletedHandler } from '../handlers/chat-completed.handler';
import { ChatFailedHandler } from '../handlers/chat-failed.handler';

export const EVENT_REGISTRY = 'EVENT_REGISTRY';

export function createEventRegistry(
  projectCheckedOutHandler: ProjectCheckedOutHandler,
  projectParsedHandler: ProjectParsedHandler,
  projectIndexCompletedHandler: ProjectIndexCompletedHandler,
  projectFailedHandler: ProjectFailedHandler,
  chatCompletedHandler: ChatCompletedHandler,
  chatFailedHandler: ChatFailedHandler,
): Record<string, EventHandler> {
  return {
    [EVENT_PROJECT_CHECKOUT_COMPLETED]: projectCheckedOutHandler,
    [EVENT_PROJECT_PARSE_COMPLETED]: projectParsedHandler,
    [EVENT_PROJECT_INDEX_COMPLETED]: projectIndexCompletedHandler,
    [EVENT_PROJECT_CHECKOUT_FAILED]: projectFailedHandler,
    [EVENT_PROJECT_PARSE_FAILED]: projectFailedHandler,
    [EVENT_PROJECT_INDEX_FAILED]: projectFailedHandler,
    [EVENT_CHAT_COMPLETED]: chatCompletedHandler,
    [EVENT_CHAT_FAILED]: chatFailedHandler,
  };
}
