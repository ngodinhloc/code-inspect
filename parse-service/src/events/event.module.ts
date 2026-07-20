import { Module } from '@nestjs/common';
import { ParseModule } from '../parse/parse.module';
import { ProjectCheckedOutHandler } from './handlers/project-checked-out.handler';
import { EVENT_REGISTRY, createEventRegistry } from './configs/event.config';
import { MessageProcessor } from './services/message.processor';
import { RabbitMqConsumer } from './services/rabbitmq.consumer';

@Module({
  imports: [ParseModule],
  providers: [
    ProjectCheckedOutHandler,
    MessageProcessor,
    RabbitMqConsumer,
    {
      provide: EVENT_REGISTRY,
      useFactory: createEventRegistry,
      inject: [ProjectCheckedOutHandler],
    },
  ],
})
export class EventModule {}
