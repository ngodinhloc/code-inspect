import { Module } from '@nestjs/common';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { ChatStartedHandler } from './handlers/chat-started.handler';
import { EVENT_REGISTRY, createEventRegistry } from './configs/event.config';
import { MessageProcessor } from './services/message.processor';
import { RabbitMqConsumer } from './services/rabbitmq.consumer';

@Module({
  imports: [RetrievalModule],
  providers: [
    ChatStartedHandler,
    MessageProcessor,
    RabbitMqConsumer,
    {
      provide: EVENT_REGISTRY,
      useFactory: createEventRegistry,
      inject: [ChatStartedHandler],
    },
  ],
})
export class EventModule {}
