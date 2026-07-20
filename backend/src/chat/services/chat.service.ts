import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { RabbitMQService } from '../../rabbitmq/services/rabbitmq.service';
import { RedisService } from '../../redis/services/redis.service';
import { AppLogger } from '../../common/logger/services/app-logger';
import { ProjectsService } from '../../projects/services/projects.service';
import { ProjectStatus } from '../../projects/contracts/project.interface';
import { Chat } from '../../database/entities/chat.entity';
import { CreateChatDto } from '../dto/create-chat.dto';
import {
  CHAT_CACHE_TTL_SECONDS,
  ChatCache,
  ChatMessage,
  ChatRunStatus,
  EVENT_CHAT_STARTED,
  EXCHANGE_CHAT,
  ChatStartedEvent,
} from '../contracts/chat.interface';

export interface ChatResponse {
  id: string;
  projectId: string;
  question: string;
  contents: ChatMessage[];
  status: ChatRunStatus;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Chat) private readonly chatRepo: Repository<Chat>,
    private readonly rabbitMQService: RabbitMQService,
    private readonly redisService: RedisService,
    private readonly projectsService: ProjectsService,
    private readonly logger: AppLogger,
  ) {}

  async createChat(dto: CreateChatDto): Promise<{ id: string }> {
    const project = await this.projectsService.getProject(dto.projectId);
    if (project.status !== ProjectStatus.READY) {
      throw new BadRequestException(
        `Project ${dto.projectId} is not READY (status: ${project.status})`,
      );
    }

    const uuid = uuidv4();
    const chat = this.chatRepo.create({
      uuid,
      projectId: dto.projectId,
      question: dto.question,
      contents: [],
      status: 'running',
    });
    await this.chatRepo.save(chat);

    const cache: ChatCache = {
      eventName: EVENT_CHAT_STARTED,
      chatId: uuid,
      projectId: dto.projectId,
      question: dto.question,
      messages: [],
      status: 'running',
      updatedAt: new Date().toISOString(),
    };
    await this.redisService.setJson(
      this.cacheKey(uuid),
      cache,
      CHAT_CACHE_TTL_SECONDS,
    );

    const event: ChatStartedEvent = {
      chatId: uuid,
      projectId: dto.projectId,
      question: dto.question,
    };
    await this.rabbitMQService.publish(
      EXCHANGE_CHAT,
      EVENT_CHAT_STARTED,
      event,
    );

    return { id: uuid };
  }

  async getChat(uuid: string): Promise<ChatResponse> {
    const chat = await this.chatRepo.findOne({ where: { uuid } });
    if (!chat) throw new NotFoundException(`Chat ${uuid} not found`);
    return this.toResponse(chat);
  }

  async listByProject(projectId: string): Promise<ChatResponse[]> {
    const chats = await this.chatRepo.find({
      where: { projectId },
      order: { createdAt: 'ASC' },
    });
    return chats.map((chat) => this.toResponse(chat));
  }

  // Called by ChatCompletedHandler/ChatFailedHandler once retrieval-service
  // publishes chat.completed or chat.failed — persists the live Redis state
  // as the final Postgres row.
  async finalize(
    uuid: string,
    status: 'completed' | 'failed',
    reason: string | null,
  ): Promise<void> {
    const chat = await this.chatRepo.findOne({ where: { uuid } });
    if (!chat) {
      this.logger.warn('ChatService.finalize: chat not found', {
        uuid,
        status,
      });
      return;
    }
    const cache = await this.redisService.getJson<ChatCache>(
      this.cacheKey(uuid),
    );
    chat.contents = cache?.messages ?? [];
    chat.status = status;
    chat.failureReason = reason;
    await this.chatRepo.save(chat);
  }

  async deleteCache(uuid: string): Promise<void> {
    await this.redisService.del(this.cacheKey(uuid));
  }

  private cacheKey(uuid: string): string {
    return `chat:${uuid}`;
  }

  private toResponse(chat: Chat): ChatResponse {
    return {
      id: chat.uuid,
      projectId: chat.projectId,
      question: chat.question,
      contents: chat.contents,
      status: chat.status,
      failureReason: chat.failureReason,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    };
  }
}
