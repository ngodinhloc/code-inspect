import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { buildOrTsQuery } from './build-fts-query';
import { AppLogger } from '../../common/logger/services/app-logger';

const CANDIDATE_LIMIT = 50;

export interface RetrievedChunk {
  embeddingId: number;
  symbolId: number;
  chunkText: string;
}

// Reads index-service's `index.symbol_embeddings` table directly — this
// service only ever reads it, never writes.
@Injectable()
export class HybridRetrievalService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly logger: AppLogger,
  ) {}

  async vectorSearch(
    projectId: string,
    queryEmbedding: number[],
  ): Promise<RetrievedChunk[]> {
    const vectorLiteral = `[${queryEmbedding.join(',')}]`;
    const rows = await this.dataSource.query(
      `SELECT id, symbol_id AS "symbolId", chunk_text AS "chunkText"
       FROM "index".symbol_embeddings
       WHERE project_id = $1
       ORDER BY embedding <=> $2::vector
       LIMIT ${CANDIDATE_LIMIT}`,
      [projectId, vectorLiteral],
    );
    const chunks = rows.map(
      (r: { id: number; symbolId: number; chunkText: string }) => ({
        embeddingId: r.id,
        symbolId: r.symbolId,
        chunkText: r.chunkText,
      }),
    );
    this.logger.log('HybridRetrievalService.vectorSearch: done', {
      projectId,
      count: chunks.length,
    });
    return chunks;
  }

  async ftsSearch(projectId: string, query: string): Promise<RetrievedChunk[]> {
    const tsQuery = buildOrTsQuery(query);
    if (!tsQuery) {
      this.logger.log(
        'HybridRetrievalService.ftsSearch: no lexemes in query, skipping',
        { projectId },
      );
      return [];
    }

    const rows = await this.dataSource.query(
      `SELECT id, symbol_id AS "symbolId", chunk_text AS "chunkText"
       FROM "index".symbol_embeddings
       WHERE project_id = $1 AND search_vector @@ to_tsquery('english', $2)
       ORDER BY ts_rank(search_vector, to_tsquery('english', $2)) DESC
       LIMIT ${CANDIDATE_LIMIT}`,
      [projectId, tsQuery],
    );
    const chunks = rows.map(
      (r: { id: number; symbolId: number; chunkText: string }) => ({
        embeddingId: r.id,
        symbolId: r.symbolId,
        chunkText: r.chunkText,
      }),
    );
    this.logger.log('HybridRetrievalService.ftsSearch: done', {
      projectId,
      count: chunks.length,
      symbols: chunks.map((c) => c.symbolId),
    });
    return chunks;
  }
}
