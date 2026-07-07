import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// No entities registered: TypeORM has no native column type for pgvector's
// `vector` or Postgres's generated `tsvector` columns, so this service manages
// its own `index.symbol_embeddings` table via raw DDL (see SchemaService) and
// reads parse-service's `parse.symbols` table via raw queries instead of
// mirroring its entity. `synchronize: false` because there's nothing to sync.
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        entities: [],
        synchronize: false,
        logging: false,
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
