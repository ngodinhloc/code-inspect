import { Module } from '@nestjs/common';
import { IndexModule } from '../index/index.module';
import { ProjectParsedHandler } from './handlers/project-parsed.handler';
import { EVENT_REGISTRY, createEventRegistry } from './configs/event.config';
import { MessageProcessor } from './services/message.processor';
import { RabbitMqConsumer } from './services/rabbitmq.consumer';

@Module({
  imports: [IndexModule],
  providers: [
    ProjectParsedHandler,
    MessageProcessor,
    RabbitMqConsumer,
    {
      provide: EVENT_REGISTRY,
      useFactory: createEventRegistry,
      inject: [ProjectParsedHandler],
    },
  ],
})
export class EventModule {}
