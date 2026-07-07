import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { ParseModule } from './parse/parse.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [DatabaseModule, RabbitMQModule, ParseModule, HealthModule],
})
export class AppModule {}
