import { Module } from '@nestjs/common';
import { EnvModule } from './common/env/env.module';
import { LoggerModule } from './common/logger/logger.module';
import { EmbeddingModule } from './embedding/embedding.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [EnvModule, LoggerModule, EmbeddingModule, HealthModule],
})
export class AppModule {}
