import { EventHandler } from '../contracts/event.interfaces';
import { EVENT_PROJECT_STARTED } from '../../checkout/contracts/project.interface';
import { ProjectStartedHandler } from '../handlers/project-started.handler';

export const EVENT_REGISTRY = 'EVENT_REGISTRY';

export function createEventRegistry(
  projectStartedHandler: ProjectStartedHandler,
): Record<string, EventHandler> {
  return {
    [EVENT_PROJECT_STARTED]: projectStartedHandler,
  };
}
