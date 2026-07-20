import { EventHandler } from '../contracts/event.interfaces';
import {
  EVENT_PROJECT_CHECKED_OUT,
  EVENT_PROJECT_FAILED,
  EVENT_PROJECT_INDEXED,
  EVENT_PROJECT_PARSED,
  EVENT_PROJECT_READY,
} from '../../projects/contracts/project.interface';
import {
  EVENT_CHAT_COMPLETED,
  EVENT_CHAT_FAILED,
} from '../../chat/contracts/chat.interface';
import { ProjectCheckedOutHandler } from '../handlers/project-checked-out.handler';
import { ProjectParsedHandler } from '../handlers/project-parsed.handler';
import { ProjectIndexedHandler } from '../handlers/project-indexed.handler';
import { ProjectReadyHandler } from '../handlers/project-ready.handler';
import { ProjectFailedHandler } from '../handlers/project-failed.handler';
import { ChatCompletedHandler } from '../handlers/chat-completed.handler';
import { ChatFailedHandler } from '../handlers/chat-failed.handler';

export const EVENT_REGISTRY = 'EVENT_REGISTRY';

export function createEventRegistry(
  projectCheckedOutHandler: ProjectCheckedOutHandler,
  projectParsedHandler: ProjectParsedHandler,
  projectIndexedHandler: ProjectIndexedHandler,
  projectReadyHandler: ProjectReadyHandler,
  projectFailedHandler: ProjectFailedHandler,
  chatCompletedHandler: ChatCompletedHandler,
  chatFailedHandler: ChatFailedHandler,
): Record<string, EventHandler> {
  return {
    [EVENT_PROJECT_CHECKED_OUT]: projectCheckedOutHandler,
    [EVENT_PROJECT_PARSED]: projectParsedHandler,
    [EVENT_PROJECT_INDEXED]: projectIndexedHandler,
    [EVENT_PROJECT_READY]: projectReadyHandler,
    [EVENT_PROJECT_FAILED]: projectFailedHandler,
    [EVENT_CHAT_COMPLETED]: chatCompletedHandler,
    [EVENT_CHAT_FAILED]: chatFailedHandler,
  };
}
