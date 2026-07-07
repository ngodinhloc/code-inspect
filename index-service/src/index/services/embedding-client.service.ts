import { Injectable } from '@nestjs/common';

const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL ?? 'http://localhost:8000';
const EMBED_BATCH_SIZE = 64;

export interface EmbedBatchResult {
  embeddings: number[][];
  model: string;
}

// Thin HTTP client for the Embedding Service — batches requests to stay under
// its per-request text cap and to keep memory bounded on large projects.
@Injectable()
export class EmbeddingClientService {
  async embedAll(texts: string[]): Promise<EmbedBatchResult> {
    const embeddings: number[][] = [];
    let model = '';
    for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
      const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
      const result = await this.embedBatch(batch);
      embeddings.push(...result.embeddings);
      model = result.model;
    }
    return { embeddings, model };
  }

  private async embedBatch(texts: string[]): Promise<EmbedBatchResult> {
    const res = await fetch(`${EMBEDDING_SERVICE_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts }),
    });
    if (!res.ok) {
      throw new Error(`Embedding service returned ${res.status}`);
    }
    return (await res.json()) as EmbedBatchResult;
  }
}
