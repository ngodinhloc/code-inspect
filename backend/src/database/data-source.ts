import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Project } from './entities/project.entity';
import { ProjectStatusHistory } from './entities/project-status-history.entity';
import { Chat } from './entities/chat.entity';

// Standalone DataSource for the TypeORM CLI (migration:generate/run/revert) —
// the NestJS runtime uses DatabaseModule's forRootAsync instead, since that
// one needs EnvService/DI. Read directly from process.env here since the CLI
// runs outside Nest's DI container.
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/codeinspect',
  schema: process.env.DATABASE_SCHEMA ?? 'backend',
  entities: [Project, ProjectStatusHistory, Chat],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
});
