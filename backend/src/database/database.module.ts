import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { ProjectStatusHistory } from './entities/project-status-history.entity';
import { Chat } from './entities/chat.entity';
import { ensureSchemaExists } from './ensure-schema';

const DATABASE_SCHEMA = process.env.DATABASE_SCHEMA ?? 'backend';

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
          entities: [Project, ProjectStatusHistory, Chat],
          synchronize: true,
          logging: false,
        };
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
