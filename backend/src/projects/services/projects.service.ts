import {
  BadRequestException,
  Injectable,
  MessageEvent,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  distinctUntilChanged,
  from,
  map,
  Observable,
  switchMap,
  takeWhile,
  timer,
} from 'rxjs';
import { RabbitMQService } from '../../rabbitmq/services/rabbitmq.service';
import { AppLogger } from '../../common/logger/services/app-logger';
import { Project } from '../../database/entities/project.entity';
import { ProjectStatusHistory } from '../../database/entities/project-status-history.entity';
import { CreateProjectDto } from '../dto/create-project.dto';
import {
  EVENT_PROJECT_STARTED,
  EXCHANGE_PROJECT,
  ProjectStartedEvent,
  ProjectStatus,
} from '../contracts/project.interface';

const POLL_INTERVAL_MS = 2000;
const TERMINAL_STATUSES: ProjectStatus[] = [
  ProjectStatus.READY,
  ProjectStatus.FAILED,
];

const GITHUB_URL_PATTERN = /^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)\/?$/;

export interface ProjectResponse {
  id: string;
  repositoryUrl: string;
  branch: string;
  status: ProjectStatus;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(ProjectStatusHistory)
    private readonly historyRepo: Repository<ProjectStatusHistory>,
    private readonly rabbitMQService: RabbitMQService,
    private readonly logger: AppLogger,
  ) {}

  async createProject(dto: CreateProjectDto): Promise<ProjectResponse> {
    const match = GITHUB_URL_PATTERN.exec(dto.repositoryUrl.trim());
    if (!match) {
      throw new BadRequestException(
        'repositoryUrl must be a public GitHub repository URL, e.g. https://github.com/org/repo',
      );
    }
    const [, owner, repo] = match;
    await this.assertPublicRepoExists(owner, repo);

    const uuid = uuidv4();
    const branch = dto.branch?.trim() || 'main';

    const project = this.projectRepo.create({
      uuid,
      repositoryUrl: dto.repositoryUrl.trim(),
      branch,
      status: ProjectStatus.CREATED,
    });
    await this.projectRepo.save(project);
    await this.recordHistory(project, ProjectStatus.CREATED, null);

    const event: ProjectStartedEvent = {
      projectId: uuid,
      repositoryUrl: project.repositoryUrl,
      branch,
    };
    await this.rabbitMQService.publish(
      EXCHANGE_PROJECT,
      EVENT_PROJECT_STARTED,
      event,
    );

    return this.toResponse(project);
  }

  async getProject(uuid: string): Promise<ProjectResponse> {
    const project = await this.findByUuidOrThrow(uuid);
    return this.toResponse(project);
  }

  // Polls Postgres every 2s and emits only on status change; closes the stream
  // once the project reaches a terminal status (READY/FAILED).
  streamProjectEvents(uuid: string): Observable<MessageEvent> {
    return timer(0, POLL_INTERVAL_MS).pipe(
      switchMap(() => from(this.getProject(uuid))),
      distinctUntilChanged((a, b) => a.status === b.status),
      takeWhile((project) => !TERMINAL_STATUSES.includes(project.status), true),
      map((project): MessageEvent => ({ data: project })),
    );
  }

  async updateStatus(
    uuid: string,
    status: ProjectStatus,
    reason: string | null = null,
  ): Promise<void> {
    const project = await this.projectRepo.findOne({ where: { uuid } });
    if (!project) {
      this.logger.warn('ProjectsService.updateStatus: project not found', {
        uuid,
        status,
      });
      return;
    }
    project.status = status;
    project.failureReason = reason;
    await this.projectRepo.save(project);
    await this.recordHistory(project, status, reason);
  }

  private async assertPublicRepoExists(
    owner: string,
    repo: string,
  ): Promise<void> {
    let res: Response;
    try {
      res = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
    } catch {
      throw new BadRequestException(
        `Unable to reach GitHub to validate ${owner}/${repo}`,
      );
    }
    if (res.status === 404) {
      throw new BadRequestException(
        `GitHub repository ${owner}/${repo} was not found or is not public`,
      );
    }
    if (!res.ok) {
      throw new BadRequestException(
        `Unable to validate repository ${owner}/${repo} (GitHub returned ${res.status})`,
      );
    }
  }

  private async findByUuidOrThrow(uuid: string): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { uuid } });
    if (!project) throw new NotFoundException(`Project ${uuid} not found`);
    return project;
  }

  private async recordHistory(
    project: Project,
    status: ProjectStatus,
    reason: string | null,
  ): Promise<void> {
    const history = this.historyRepo.create({
      projectId: project.id,
      status,
      reason,
    });
    await this.historyRepo.save(history);
  }

  private toResponse(project: Project): ProjectResponse {
    return {
      id: project.uuid,
      repositoryUrl: project.repositoryUrl,
      branch: project.branch,
      status: project.status,
      failureReason: project.failureReason,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }
}
