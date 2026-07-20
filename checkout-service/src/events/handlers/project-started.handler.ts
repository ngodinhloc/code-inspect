import { Injectable } from '@nestjs/common';
import { existsSync } from 'fs';
import { mkdir, rm } from 'fs/promises';
import { simpleGit } from 'simple-git';
import { RabbitMQService } from '../../rabbitmq/services/rabbitmq.service';
import { AppLogger } from '../../common/logger/services/app-logger';
import { EventHandler } from '../contracts/event.interfaces';
import {
  EVENT_PROJECT_CHECKED_OUT,
  EVENT_PROJECT_FAILED,
  EXCHANGE_PROJECT,
  ProjectCheckedOutEvent,
  ProjectFailedEvent,
  ProjectStartedEvent,
  ProjectStatus,
} from '../../checkout/contracts/project.interface';

const REPOSITORIES_DIR = process.env.REPOSITORIES_DIR ?? '/repositories';
const CLONE_TIMEOUT_MS = 5 * 60 * 1000;

@Injectable()
export class ProjectStartedHandler implements EventHandler {
  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly logger: AppLogger,
  ) {}

  async handle(payload: Record<string, unknown>): Promise<void> {
    const event = payload as unknown as ProjectStartedEvent;
    if (!event.projectId || !event.repositoryUrl || !event.branch) {
      this.logger.warn('ProjectStartedHandler.handle: malformed event', {
        payload,
      });
      return;
    }

    const repoPath = `${REPOSITORIES_DIR}/${event.projectId}`;
    this.logger.log('ProjectStartedHandler.handle: cloning', {
      projectId: event.projectId,
      repositoryUrl: event.repositoryUrl,
      branch: event.branch,
    });

    try {
      await mkdir(REPOSITORIES_DIR, { recursive: true });
      // A redelivered event (e.g. after a crash before ack) would otherwise fail
      // because `git clone` refuses to clone into a non-empty directory.
      if (existsSync(repoPath)) {
        await rm(repoPath, { recursive: true, force: true });
      }

      const git = simpleGit({ timeout: { block: CLONE_TIMEOUT_MS } });
      await git.clone(event.repositoryUrl, repoPath, [
        '--branch',
        event.branch,
        '--single-branch',
        '--depth',
        '1',
      ]);

      const checkedOut: ProjectCheckedOutEvent = {
        projectId: event.projectId,
        repoPath,
      };
      await this.rabbitMQService.publish(
        EXCHANGE_PROJECT,
        EVENT_PROJECT_CHECKED_OUT,
        checkedOut,
      );
      this.logger.log('ProjectStartedHandler.handle: checked out', {
        projectId: event.projectId,
        repoPath,
      });
    } catch (err) {
      this.logger.error('ProjectStartedHandler.handle: clone failed', {
        projectId: event.projectId,
        error: String(err),
      });

      const failed: ProjectFailedEvent = {
        projectId: event.projectId,
        stage: ProjectStatus.CHECKED_OUT,
        reason: `Failed to clone ${event.repositoryUrl}#${event.branch}: ${String(err)}`,
      };
      await this.rabbitMQService.publish(
        EXCHANGE_PROJECT,
        EVENT_PROJECT_FAILED,
        failed,
      );
    }
  }
}
