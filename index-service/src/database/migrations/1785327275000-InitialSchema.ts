import { MigrationInterface, QueryRunner } from 'typeorm';

// Replaces SymbolEmbeddingsSchemaService's raw DDL-on-every-boot approach with
// a tracked, one-time migration — see database.module.ts for why this service
// bypasses TypeORM entities/synchronize (pgvector's `vector` type and
// Postgres's generated `tsvector` column have no TypeORM entity mapping).
export class InitialSchema1785327275000 implements MigrationInterface {
  name = 'InitialSchema1785327275000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "index"`);

    await queryRunner.query(`
      CREATE TABLE "index"."symbol_embeddings" (
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
    await queryRunner.query(
      `CREATE INDEX "idx_symbol_embeddings_project" ON "index"."symbol_embeddings" (project_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_symbol_embeddings_fts" ON "index"."symbol_embeddings" USING GIN (search_vector)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "index"."symbol_embeddings"`);
  }
}
