import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// No entities: this service only reads parse-service's and index-service's
// tables via raw SQL (same reasoning as index-service's own DatabaseModule —
// it doesn't own either schema, and index.symbol_embeddings has a pgvector
// column TypeORM can't model as an entity anyway). synchronize: false because
// there's nothing to sync.
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
