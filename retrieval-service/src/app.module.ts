import { Module } from '@nestjs/common';
import { EnvModule } from './common/env/env.module';
import { LoggerModule } from './common/logger/logger.module';
import { DatabaseModule } from './database/database.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { RedisModule } from './redis/redis.module';
import { EventModule } from './events/event.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    EnvModule,
    LoggerModule,
    DatabaseModule,
    RabbitMQModule,
    RedisModule,
    EventModule,
    HealthModule,
  ],
})
export class AppModule {}
