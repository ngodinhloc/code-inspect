import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { IndexModule } from './index/index.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [DatabaseModule, RabbitMQModule, IndexModule, HealthModule],
})
export class AppModule {}
