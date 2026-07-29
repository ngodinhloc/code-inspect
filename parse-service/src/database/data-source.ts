import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { File } from './entities/file.entity';
import { CodeSymbol } from './entities/symbol.entity';
import { SymbolDependency } from './entities/symbol-dependency.entity';
import { ApiEndpoint } from './entities/api-endpoint.entity';

// Standalone DataSource for the TypeORM CLI (migration:generate/run/revert) —
// the NestJS runtime uses DatabaseModule's forRootAsync instead, since that
// one needs EnvService/DI. Read directly from process.env here since the CLI
// runs outside Nest's DI container.
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/codeinspect',
  schema: process.env.DATABASE_SCHEMA ?? 'parse',
  entities: [File, CodeSymbol, SymbolDependency, ApiEndpoint],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
});
