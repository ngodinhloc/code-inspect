import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// Runs once at boot to create this service's own schema/table/indexes via raw
// DDL — see database.module.ts for why this bypasses TypeORM's `synchronize`.
// No ANN index (ivfflat/hnsw) yet: brute-force `<=>` scans are fine at MVP
// scale; add one once collection sizes make it worth the recall/build tradeoff.
@Injectable()
export class SymbolEmbeddingsSchemaService implements OnModuleInit {
  private readonly logger = new Logger(SymbolEmbeddingsSchemaService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS vector');
    await this.dataSource.query('CREATE SCHEMA IF NOT EXISTS "index"');
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "index".symbol_embeddings (
        id SERIAL PRIMARY KEY,
        project_id UUID NOT NULL,
        symbol_id INTEGER NOT NULL,
        chunk_index INTEGER NOT NULL DEFAULT 0,
        chunk_text TEXT NOT NULL,
        embedding vector(384) NOT NULL,
        model VARCHAR(100) NOT NULL,
        search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await this.dataSource.query(
      'CREATE INDEX IF NOT EXISTS idx_symbol_embeddings_project ON "index".symbol_embeddings (project_id)',
    );
    await this.dataSource.query(
      'CREATE INDEX IF NOT EXISTS idx_symbol_embeddings_fts ON "index".symbol_embeddings USING GIN (search_vector)',
    );
    this.logger.log('SymbolEmbeddingsSchemaService.onModuleInit: schema ready');
  }
}
