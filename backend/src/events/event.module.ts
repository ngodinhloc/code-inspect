import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { ChatModule } from '../chat/chat.module';
import { ProjectCheckedOutHandler } from './handlers/project-checked-out.handler';
import { ProjectParsedHandler } from './handlers/project-parsed.handler';
import { ProjectIndexedHandler } from './handlers/project-indexed.handler';
import { ProjectReadyHandler } from './handlers/project-ready.handler';
import { ProjectFailedHandler } from './handlers/project-failed.handler';
import { ChatCompletedHandler } from './handlers/chat-completed.handler';
import { ChatFailedHandler } from './handlers/chat-failed.handler';
import { EVENT_REGISTRY, createEventRegistry } from './configs/event.config';
import { MessageProcessor } from './services/message.processor';
import { RabbitMqConsumer } from './services/rabbitmq.consumer';

@Module({
  imports: [ProjectsModule, ChatModule],
  providers: [
    ProjectCheckedOutHandler,
    ProjectParsedHandler,
    ProjectIndexedHandler,
    ProjectReadyHandler,
    ProjectFailedHandler,
    ChatCompletedHandler,
    ChatFailedHandler,
    MessageProcessor,
    RabbitMqConsumer,
    {
      provide: EVENT_REGISTRY,
      useFactory: createEventRegistry,
      inject: [
        ProjectCheckedOutHandler,
        ProjectParsedHandler,
        ProjectIndexedHandler,
        ProjectReadyHandler,
        ProjectFailedHandler,
        ChatCompletedHandler,
        ChatFailedHandler,
      ],
    },
  ],
})
export class EventModule {}
