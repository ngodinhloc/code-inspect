import { EventHandler } from '../contracts/event.interfaces';
import { EVENT_PROJECT_PARSED } from '../../index/contracts/project.interface';
import { ProjectParsedHandler } from '../handlers/project-parsed.handler';

export const EVENT_REGISTRY = 'EVENT_REGISTRY';

export function createEventRegistry(
  projectParsedHandler: ProjectParsedHandler,
): Record<string, EventHandler> {
  return {
    [EVENT_PROJECT_PARSED]: projectParsedHandler,
  };
}
