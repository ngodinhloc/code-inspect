import { Injectable, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../../rabbitmq/services/rabbitmq.service';
import { MessageProcessor } from './message.processor';
import {
  EVENT_PROJECT_CHECKED_OUT,
  EVENT_PROJECT_FAILED,
  EVENT_PROJECT_INDEXED,
  EVENT_PROJECT_PARSED,
  EVENT_PROJECT_READY,
  EXCHANGE_PROJECT,
  QUEUE_API_CHECKED_OUT,
  QUEUE_API_FAILED,
  QUEUE_API_INDEXED,
  QUEUE_API_PARSED,
  QUEUE_API_READY,
} from '../../projects/contracts/project.interface';
import {
  EVENT_CHAT_COMPLETED,
  EVENT_CHAT_FAILED,
  EXCHANGE_CHAT,
  QUEUE_API_CHAT_COMPLETED,
  QUEUE_API_CHAT_FAILED,
} from '../../chat/contracts/chat.interface';

// The API service owns the `projects` and `chats` tables; every downstream
// stage (checkout, parse, index, retrieval) only publishes events, so this is
// the one place that turns those events back into Postgres status updates
// (via the registered handlers).
@Injectable()
export class RabbitMqConsumer implements OnModuleInit {
  constructor(
    private readonly messageProcessor: MessageProcessor,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async onModuleInit(): Promise<void> {
    const subscriptions: Array<
      [exchange: string, queue: string, eventName: string]
    > = [
      [EXCHANGE_PROJECT, QUEUE_API_CHECKED_OUT, EVENT_PROJECT_CHECKED_OUT],
      [EXCHANGE_PROJECT, QUEUE_API_PARSED, EVENT_PROJECT_PARSED],
      [EXCHANGE_PROJECT, QUEUE_API_INDEXED, EVENT_PROJECT_INDEXED],
      [EXCHANGE_PROJECT, QUEUE_API_READY, EVENT_PROJECT_READY],
      [EXCHANGE_PROJECT, QUEUE_API_FAILED, EVENT_PROJECT_FAILED],
      [EXCHANGE_CHAT, QUEUE_API_CHAT_COMPLETED, EVENT_CHAT_COMPLETED],
      [EXCHANGE_CHAT, QUEUE_API_CHAT_FAILED, EVENT_CHAT_FAILED],
    ];

    for (const [exchange, queue, eventName] of subscriptions) {
      await this.rabbitMQService.subscribe(
        exchange,
        queue,
        eventName,
        (payload) => this.messageProcessor.process({ ...payload, eventName }),
      );
    }
  }
}
