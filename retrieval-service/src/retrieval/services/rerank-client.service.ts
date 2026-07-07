import { Injectable, Logger } from '@nestjs/common';
import { RetrievedChunk } from './hybrid-retrieval.service';

const COHERE_RERANK_URL = 'https://api.cohere.com/v2/rerank';
const COHERE_MODEL = 'rerank-v4.0-pro';
const RERANK_TOP_N = 5;

export interface RerankResult {
  chunks: RetrievedChunk[];
  usedCohere: boolean;
}

@Injectable()
export class RerankClientService {
  private readonly logger = new Logger(RerankClientService.name);

  async rerank(query: string, candidates: RetrievedChunk[], projectId: string): Promise<RerankResult> {
    const apiKey = process.env.COHERE_API_KEY;
    if (!apiKey) {
      this.logger.warn('RerankClientService.rerank: no COHERE_API_KEY, passing through top candidates unreranked', {
        projectId,
      });
      return { chunks: candidates.slice(0, RERANK_TOP_N), usedCohere: false };
    }

    const res = await fetch(COHERE_RERANK_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: COHERE_MODEL,
        query,
        documents: candidates.map((c) => c.chunkText),
        top_n: RERANK_TOP_N,
      }),
    });

    if (!res.ok) {
      this.logger.error('RerankClientService.rerank: Cohere API call failed, falling back to unreranked', {
        projectId,
        status: res.status,
      });
      return { chunks: candidates.slice(0, RERANK_TOP_N), usedCohere: false };
    }

    const body = (await res.json()) as { results: { index: number; relevance_score: number }[] };
    this.logger.log('RerankClientService.rerank: done', { projectId, rerankedCount: body.results.length });
    return { chunks: body.results.map((r) => candidates[r.index]), usedCohere: true };
  }
}
