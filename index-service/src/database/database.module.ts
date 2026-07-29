import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvService } from '../common/env/services/env.service';

// No entities registered: TypeORM has no native column type for pgvector's
// `vector` or Postgres's generated `tsvector` columns, so this service manages
// its own `index.symbol_embeddings` table via migrations instead of entities,
// and reads parse-service's `parse.symbols` table via raw queries instead of
// mirroring its entity. `synchronize: false` because there's nothing to sync.
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [EnvService],
      useFactory: (envService: EnvService) => ({
        type: 'postgres',
        url: envService.getDatabaseUrl(),
        schema: envService.getDatabaseSchema(),
        entities: [],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun: true,
        synchronize: false,
        logging: false,
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
