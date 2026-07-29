import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EnvService {
  constructor(private readonly configService: ConfigService) {}

  getEmbeddingModelId(): string {
    return (
      this.configService.get<string>('EMBEDDING_MODEL_ID') ??
      'Xenova/bge-small-en-v1.5'
    );
  }
}
