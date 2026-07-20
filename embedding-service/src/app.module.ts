import { Module } from '@nestjs/common';
import { LoggerModule } from './common/logger/logger.module';
import { EmbeddingModule } from './embedding/embedding.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [LoggerModule, EmbeddingModule, HealthModule],
})
export class AppModule {}
