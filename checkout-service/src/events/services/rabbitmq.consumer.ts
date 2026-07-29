import { Injectable, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../../rabbitmq/services/rabbitmq.service';
import { Binding } from '../../rabbitmq/contracts/rabbitmq.interfaces';
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
    const bindings: Binding[] = [
      { exchange: EXCHANGE_PROJECT, routingKey: EVENT_PROJECT_STARTED },
    ];

    await this.rabbitMQService.subscribe(
      QUEUE_CHECKOUT_STARTED,
      bindings,
      (payload, eventName) =>
        this.messageProcessor.process({ ...payload, eventName }),
    );
  }
}
