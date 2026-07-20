import { Injectable } from '@nestjs/common';
import { ProjectsService } from '../../projects/services/projects.service';
import { AppLogger } from '../../common/logger/services/app-logger';
import { EventHandler } from '../contracts/event.interfaces';
import {
  ProjectFailedEvent,
  ProjectStatus,
} from '../../projects/contracts/project.interface';

@Injectable()
export class ProjectFailedHandler implements EventHandler {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly logger: AppLogger,
  ) {}

  async handle(payload: Record<string, unknown>): Promise<void> {
    const event = payload as unknown as ProjectFailedEvent;
    if (!event.projectId) {
      this.logger.warn('ProjectFailedHandler.handle: malformed event', {
        payload,
      });
      return;
    }
    await this.projectsService.updateStatus(
      event.projectId,
      ProjectStatus.FAILED,
      event.reason,
    );
  }
}
