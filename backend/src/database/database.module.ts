import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { ProjectStatusHistory } from './entities/project-status-history.entity';
import { Chat } from './entities/chat.entity';
import { ensureSchemaExists } from './ensure-schema';
import { EnvService } from '../common/env/services/env.service';

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
