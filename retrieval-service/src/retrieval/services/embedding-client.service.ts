import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../common/logger/services/app-logger';
import { EnvService } from '../../common/env/services/env.service';

@Injectable()
export class EmbeddingClientService {
  constructor(
    private readonly logger: AppLogger,
    private readonly envService: EnvService,
  ) {}

  async embed(text: string, projectId: string): Promise<number[]> {
    this.logger.log('EmbeddingClientService.embed: starting', {
      projectId,
      textLength: text.length,
    });
    const res = await fetch(
      `${this.envService.getEmbeddingServiceUrl()}/api/embed`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: [text] }),
      },
    );
    if (!res.ok) {
      this.logger.error('EmbeddingClientService.embed: request failed', {
        projectId,
        status: res.status,
      });
      throw new Error(`Embedding service returned ${res.status}`);
    }
    const body = (await res.json()) as { embeddings: number[][] };
    this.logger.log('EmbeddingClientService.embed: done', {
      projectId,
      dimensions: body.embeddings[0].length,
    });
    return body.embeddings[0];
  }
}
