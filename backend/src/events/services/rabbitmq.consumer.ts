import { Injectable, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../../rabbitmq/services/rabbitmq.service';
import { Binding } from '../../rabbitmq/contracts/rabbitmq.interfaces';
import { MessageProcessor } from './message.processor';
import { QUEUE_BACKEND } from '../contracts/event.interfaces';
import {
  EVENT_PROJECT_CHECKOUT_COMPLETED,
  EVENT_PROJECT_CHECKOUT_FAILED,
  EVENT_PROJECT_PARSE_COMPLETED,
  EVENT_PROJECT_PARSE_FAILED,
  EVENT_PROJECT_INDEX_COMPLETED,
  EVENT_PROJECT_INDEX_FAILED,
  EXCHANGE_PROJECT,
} from '../../projects/contracts/project.interface';
import {
  EVENT_CHAT_COMPLETED,
  EVENT_CHAT_FAILED,
  EXCHANGE_CHAT,
} from '../../chat/contracts/chat.interface';

// The API service owns the `projects` and `chats` tables; every downstream
// stage (checkout, parse, index, retrieval) only publishes events, so this is
// the one place that turns those events back into Postgres status updates
// (via the registered handlers). All of it flows through one durable queue
// bound to every routing key this service cares about, rather than a queue
// per event.
@Injectable()
export class RabbitMqConsumer implements OnModuleInit {
  constructor(
    private readonly messageProcessor: MessageProcessor,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async onModuleInit(): Promise<void> {
    const bindings: Binding[] = [
      {
        exchange: EXCHANGE_PROJECT,
        routingKey: EVENT_PROJECT_CHECKOUT_COMPLETED,
      },
      { exchange: EXCHANGE_PROJECT, routingKey: EVENT_PROJECT_CHECKOUT_FAILED },
      { exchange: EXCHANGE_PROJECT, routingKey: EVENT_PROJECT_PARSE_COMPLETED },
      { exchange: EXCHANGE_PROJECT, routingKey: EVENT_PROJECT_PARSE_FAILED },
      { exchange: EXCHANGE_PROJECT, routingKey: EVENT_PROJECT_INDEX_COMPLETED },
      { exchange: EXCHANGE_PROJECT, routingKey: EVENT_PROJECT_INDEX_FAILED },
      { exchange: EXCHANGE_CHAT, routingKey: EVENT_CHAT_COMPLETED },
      { exchange: EXCHANGE_CHAT, routingKey: EVENT_CHAT_FAILED },
    ];

    await this.rabbitMQService.subscribe(
      QUEUE_BACKEND,
      bindings,
      (payload, eventName) =>
        this.messageProcessor.process({ ...payload, eventName }),
    );
  }
}
