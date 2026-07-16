import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { RedisModule } from './redis/redis.module';
import { ProjectsModule } from './projects/projects.module';
import { ChatModule } from './chat/chat.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    DatabaseModule,
    RabbitMQModule,
    RedisModule,
    ProjectsModule,
    ChatModule,
    HealthModule,
  ],
})
export class AppModule {}
