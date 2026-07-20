import { EventHandler } from '../contracts/event.interfaces';
import { EVENT_PROJECT_CHECKED_OUT } from '../../parse/contracts/project.interface';
import { ProjectCheckedOutHandler } from '../handlers/project-checked-out.handler';

export const EVENT_REGISTRY = 'EVENT_REGISTRY';

export function createEventRegistry(
  projectCheckedOutHandler: ProjectCheckedOutHandler,
): Record<string, EventHandler> {
  return {
    [EVENT_PROJECT_CHECKED_OUT]: projectCheckedOutHandler,
  };
}
