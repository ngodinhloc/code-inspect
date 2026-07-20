import { Injectable, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../../rabbitmq/services/rabbitmq.service';
import { MessageProcessor } from './message.processor';
import {
  EVENT_PROJECT_STARTED,
  EXCHANGE_PROJECT,
  QUEUE_CHECKOUT_STARTED,
} from '../../checkout/contracts/project.interface';

@Injectable()
export class RabbitMqConsumer implements OnModuleInit {
  constructor(
    private readonly messageProcessor: MessageProcessor,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitMQService.subscribe(
      EXCHANGE_PROJECT,
      QUEUE_CHECKOUT_STARTED,
      EVENT_PROJECT_STARTED,
      (payload) =>
        this.messageProcessor.process({
          ...payload,
          eventName: EVENT_PROJECT_STARTED,
        }),
    );
  }
}
