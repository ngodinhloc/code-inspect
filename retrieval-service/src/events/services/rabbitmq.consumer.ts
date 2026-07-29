import { Injectable, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../../rabbitmq/services/rabbitmq.service';
import { Binding } from '../../rabbitmq/contracts/rabbitmq.interfaces';
import { MessageProcessor } from './message.processor';
import {
  EVENT_CHAT_STARTED,
  EXCHANGE_CHAT,
  QUEUE_RETRIEVAL_CHAT_STARTED,
} from '../../retrieval/contracts/chat.interface';

@Injectable()
export class RabbitMqConsumer implements OnModuleInit {
  constructor(
    private readonly messageProcessor: MessageProcessor,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async onModuleInit(): Promise<void> {
    const bindings: Binding[] = [
      { exchange: EXCHANGE_CHAT, routingKey: EVENT_CHAT_STARTED },
    ];

    await this.rabbitMQService.subscribe(
      QUEUE_RETRIEVAL_CHAT_STARTED,
      bindings,
      (payload, eventName) =>
        this.messageProcessor.process({ ...payload, eventName }),
    );
  }
}
