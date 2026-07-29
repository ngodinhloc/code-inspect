import { Injectable, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../../rabbitmq/services/rabbitmq.service';
import { Binding } from '../../rabbitmq/contracts/rabbitmq.interfaces';
import { MessageProcessor } from './message.processor';
import {
  EVENT_PROJECT_PARSE_COMPLETED,
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
    const bindings: Binding[] = [
      { exchange: EXCHANGE_PROJECT, routingKey: EVENT_PROJECT_PARSE_COMPLETED },
    ];

    await this.rabbitMQService.subscribe(
      QUEUE_INDEX_PARSED,
      bindings,
      (payload, eventName) =>
        this.messageProcessor.process({ ...payload, eventName }),
    );
  }
}
