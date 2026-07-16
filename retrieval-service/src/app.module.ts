import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { RedisModule } from './redis/redis.module';
import { RetrievalModule } from './retrieval/retrieval.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    DatabaseModule,
    RabbitMQModule,
    RedisModule,
    RetrievalModule,
    HealthModule,
  ],
})
export class AppModule {}
