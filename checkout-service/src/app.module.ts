import { Module } from '@nestjs/common';
import { LoggerModule } from './common/logger/logger.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { EventModule } from './events/event.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [LoggerModule, RabbitMQModule, EventModule, HealthModule],
})
export class AppModule {}
