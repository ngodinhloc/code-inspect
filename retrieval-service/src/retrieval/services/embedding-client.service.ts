import { Injectable, Logger } from '@nestjs/common';

const EMBEDDING_SERVICE_URL =
  process.env.EMBEDDING_SERVICE_URL ?? 'http://localhost:8000';

@Injectable()
export class EmbeddingClientService {
  private readonly logger = new Logger(EmbeddingClientService.name);

  async embed(text: string, projectId: string): Promise<number[]> {
    this.logger.log('EmbeddingClientService.embed: starting', {
      projectId,
      textLength: text.length,
    });
    const res = await fetch(`${EMBEDDING_SERVICE_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: [text] }),
    });
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
