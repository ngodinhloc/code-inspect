import { Module } from '@nestjs/common';
import { EmbeddingController } from './controllers/embedding.controller';
import { EmbeddingService } from './services/embedding.service';

@Module({
  controllers: [EmbeddingController],
  providers: [EmbeddingService],
})
export class EmbeddingModule {}
