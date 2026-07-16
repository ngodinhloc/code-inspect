import { Injectable, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../../rabbitmq/services/rabbitmq.service';
import { ProjectsService } from './projects.service';
import {
  EVENT_PROJECT_CHECKED_OUT,
  EVENT_PROJECT_FAILED,
  EVENT_PROJECT_INDEXED,
  EVENT_PROJECT_PARSED,
  EVENT_PROJECT_READY,
  EXCHANGE_PROJECT,
  ProjectCheckedOutEvent,
  ProjectFailedEvent,
  ProjectIndexedEvent,
  ProjectParsedEvent,
  ProjectReadyEvent,
  ProjectStatus,
  QUEUE_API_CHECKED_OUT,
  QUEUE_API_FAILED,
  QUEUE_API_INDEXED,
  QUEUE_API_PARSED,
  QUEUE_API_READY,
} from '../contracts/project.interface';

// The API service owns the `projects` table; every downstream stage (checkout,
// parse, index) only publishes events, so this is the one place that turns
// those events back into a Postgres status update.
@Injectable()
export class ProjectEventsService implements OnModuleInit {
  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly projectsService: ProjectsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitMQService.subscribe(
      EXCHANGE_PROJECT,
      QUEUE_API_CHECKED_OUT,
      EVENT_PROJECT_CHECKED_OUT,
      (payload) => {
        const event = payload as unknown as ProjectCheckedOutEvent;
        return this.projectsService.updateStatus(
          event.projectId,
          ProjectStatus.CHECKED_OUT,
        );
      },
    );
    await this.rabbitMQService.subscribe(
      EXCHANGE_PROJECT,
      QUEUE_API_PARSED,
      EVENT_PROJECT_PARSED,
      (payload) => {
        const event = payload as unknown as ProjectParsedEvent;
        return this.projectsService.updateStatus(
          event.projectId,
          ProjectStatus.PARSED,
        );
      },
    );
    await this.rabbitMQService.subscribe(
      EXCHANGE_PROJECT,
      QUEUE_API_INDEXED,
      EVENT_PROJECT_INDEXED,
      (payload) => {
        const event = payload as unknown as ProjectIndexedEvent;
        return this.projectsService.updateStatus(
          event.projectId,
          ProjectStatus.INDEXED,
        );
      },
    );
    await this.rabbitMQService.subscribe(
      EXCHANGE_PROJECT,
      QUEUE_API_READY,
      EVENT_PROJECT_READY,
      (payload) => {
        const event = payload as unknown as ProjectReadyEvent;
        return this.projectsService.updateStatus(
          event.projectId,
          ProjectStatus.READY,
        );
      },
    );
    await this.rabbitMQService.subscribe(
      EXCHANGE_PROJECT,
      QUEUE_API_FAILED,
      EVENT_PROJECT_FAILED,
      (payload) => {
        const event = payload as unknown as ProjectFailedEvent;
        return this.projectsService.updateStatus(
          event.projectId,
          ProjectStatus.FAILED,
          event.reason,
        );
      },
    );
  }
}
