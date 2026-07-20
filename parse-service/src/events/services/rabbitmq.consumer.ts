import { Injectable, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../../rabbitmq/services/rabbitmq.service';
import { MessageProcessor } from './message.processor';
import {
  EVENT_PROJECT_CHECKED_OUT,
  EXCHANGE_PROJECT,
  QUEUE_PARSE_CHECKED_OUT,
} from '../../parse/contracts/project.interface';

@Injectable()
export class RabbitMqConsumer implements OnModuleInit {
  constructor(
    private readonly messageProcessor: MessageProcessor,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitMQService.subscribe(
      EXCHANGE_PROJECT,
      QUEUE_PARSE_CHECKED_OUT,
      EVENT_PROJECT_CHECKED_OUT,
      (payload) =>
        this.messageProcessor.process({
          ...payload,
          eventName: EVENT_PROJECT_CHECKED_OUT,
        }),
    );
  }
}
