import 'reflect-metadata';
import { DataSource } from 'typeorm';

// Standalone DataSource for the TypeORM CLI (migration:generate/run/revert) —
// the NestJS runtime uses DatabaseModule's forRootAsync instead, since that
// one needs EnvService/DI. Read directly from process.env here since the CLI
// runs outside Nest's DI container. No entities: this service manages
// `index.symbol_embeddings` entirely via migrations (pgvector's `vector` type
// and Postgres's generated `tsvector` column have no TypeORM entity mapping).
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/codeinspect',
  schema: process.env.DATABASE_SCHEMA ?? 'index',
  entities: [],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
});
