import { Injectable, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../../rabbitmq/services/rabbitmq.service';
import { MessageProcessor } from './message.processor';
import {
  EVENT_PROJECT_PARSED,
  EXCHANGE_PROJECT,
  QUEUE_INDEX_PARSED,
} from '../../index/contracts/project.interface';

@Injectable()
export class RabbitMqConsumer implements OnModuleInit {
  constructor(
    private readonly messageProcessor: MessageProcessor,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitMQService.subscribe(
      EXCHANGE_PROJECT,
      QUEUE_INDEX_PARSED,
      EVENT_PROJECT_PARSED,
      (payload) =>
        this.messageProcessor.process({
          ...payload,
          eventName: EVENT_PROJECT_PARSED,
        }),
    );
  }
}
