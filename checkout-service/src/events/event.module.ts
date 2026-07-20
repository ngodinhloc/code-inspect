import { Module } from '@nestjs/common';
import { ProjectStartedHandler } from './handlers/project-started.handler';
import { EVENT_REGISTRY, createEventRegistry } from './configs/event.config';
import { MessageProcessor } from './services/message.processor';
import { RabbitMqConsumer } from './services/rabbitmq.consumer';

@Module({
  providers: [
    ProjectStartedHandler,
    MessageProcessor,
    RabbitMqConsumer,
    {
      provide: EVENT_REGISTRY,
      useFactory: createEventRegistry,
      inject: [ProjectStartedHandler],
    },
  ],
})
export class EventModule {}
