import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync } from 'fs';
import { mkdir, rm } from 'fs/promises';
import { simpleGit } from 'simple-git';
import { RabbitMQService } from '../../rabbitmq/services/rabbitmq.service';
import {
  EVENT_PROJECT_CHECKED_OUT,
  EVENT_PROJECT_FAILED,
  EVENT_PROJECT_STARTED,
  EXCHANGE_PROJECT,
  ProjectCheckedOutEvent,
  ProjectFailedEvent,
  ProjectStartedEvent,
  ProjectStatus,
  QUEUE_CHECKOUT_STARTED,
} from '../contracts/project.interface';

const REPOSITORIES_DIR = process.env.REPOSITORIES_DIR ?? '/repositories';
const CLONE_TIMEOUT_MS = 5 * 60 * 1000;

@Injectable()
export class CheckoutService implements OnModuleInit {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(private readonly rabbitMQService: RabbitMQService) {}

  async onModuleInit(): Promise<void> {
    await mkdir(REPOSITORIES_DIR, { recursive: true });
    await this.rabbitMQService.subscribe(EXCHANGE_PROJECT, QUEUE_CHECKOUT_STARTED, EVENT_PROJECT_STARTED, (payload) =>
      this.handleProjectStarted(payload as unknown as ProjectStartedEvent),
    );
  }

  private async handleProjectStarted(event: ProjectStartedEvent): Promise<void> {
    const repoPath = `${REPOSITORIES_DIR}/${event.projectId}`;
    this.logger.log('CheckoutService.handleProjectStarted: cloning', {
      projectId: event.projectId,
      repositoryUrl: event.repositoryUrl,
      branch: event.branch,
    });

    try {
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

      const checkedOut: ProjectCheckedOutEvent = { projectId: event.projectId, repoPath };
      await this.rabbitMQService.publish(EXCHANGE_PROJECT, EVENT_PROJECT_CHECKED_OUT, checkedOut);
      this.logger.log('CheckoutService.handleProjectStarted: checked out', {
        projectId: event.projectId,
        repoPath,
      });
    } catch (err) {
      this.logger.error('CheckoutService.handleProjectStarted: clone failed', {
        projectId: event.projectId,
        error: String(err),
      });

      const failed: ProjectFailedEvent = {
        projectId: event.projectId,
        stage: ProjectStatus.CHECKED_OUT,
        reason: `Failed to clone ${event.repositoryUrl}#${event.branch}: ${String(err)}`,
      };
      await this.rabbitMQService.publish(EXCHANGE_PROJECT, EVENT_PROJECT_FAILED, failed);
    }
  }
}
