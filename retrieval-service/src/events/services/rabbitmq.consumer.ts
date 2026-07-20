import { Injectable, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../../rabbitmq/services/rabbitmq.service';
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
    await this.rabbitMQService.subscribe(
      EXCHANGE_CHAT,
      QUEUE_RETRIEVAL_CHAT_STARTED,
      EVENT_CHAT_STARTED,
      (payload) =>
        this.messageProcessor.process({
          ...payload,
          eventName: EVENT_CHAT_STARTED,
        }),
    );
  }
}
