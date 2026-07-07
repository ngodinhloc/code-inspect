import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { File } from './entities/file.entity';
import { CodeSymbol } from './entities/symbol.entity';
import { SymbolDependency } from './entities/symbol-dependency.entity';
import { ApiEndpoint } from './entities/api-endpoint.entity';
import { ensureSchemaExists } from './ensure-schema';

const ENTITIES = [File, CodeSymbol, SymbolDependency, ApiEndpoint];
const DATABASE_SCHEMA = process.env.DATABASE_SCHEMA ?? 'parse';

// backend, parse-service, and index-service share one Postgres instance but
// each owns its own schema (backend/parse/index) rather than its own database.
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async () => {
        await ensureSchemaExists(process.env.DATABASE_URL!, DATABASE_SCHEMA);
        return {
          type: 'postgres',
          url: process.env.DATABASE_URL,
          schema: DATABASE_SCHEMA,
          entities: ENTITIES,
          synchronize: true,
          logging: false,
        };
      },
    }),
    TypeOrmModule.forFeature(ENTITIES),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
