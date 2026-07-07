import { Module } from '@nestjs/common';
import { EmbeddingModule } from './embedding/embedding.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [EmbeddingModule, HealthModule],
})
export class AppModule {}
