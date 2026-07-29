import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { File } from './entities/file.entity';
import { CodeSymbol } from './entities/symbol.entity';
import { SymbolDependency } from './entities/symbol-dependency.entity';
import { ApiEndpoint } from './entities/api-endpoint.entity';
import { ensureSchemaExists } from './ensure-schema';
import { EnvService } from '../common/env/services/env.service';

const ENTITIES = [File, CodeSymbol, SymbolDependency, ApiEndpoint];

// backend, parse-service, and index-service share one Postgres instance but
// each owns its own schema (backend/parse/index) rather than its own database.
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [EnvService],
      useFactory: async (envService: EnvService) => {
        const databaseUrl = envService.getDatabaseUrl();
        const schema = envService.getDatabaseSchema();
        await ensureSchemaExists(databaseUrl, schema);
        return {
          type: 'postgres',
          url: databaseUrl,
          schema,
          entities: ENTITIES,
          migrations: [__dirname + '/migrations/*{.ts,.js}'],
          migrationsRun: true,
          synchronize: false,
          logging: false,
        };
      },
    }),
    TypeOrmModule.forFeature(ENTITIES),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
