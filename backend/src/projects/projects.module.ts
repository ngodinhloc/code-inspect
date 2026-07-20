import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsController } from './controllers/projects.controller';
import { ProjectsService } from './services/projects.service';
import { Project } from '../database/entities/project.entity';
import { ProjectStatusHistory } from '../database/entities/project-status-history.entity';

// Domain support for the project lifecycle — HTTP surface plus the
// `projects`/`project_status_history` repositories. Consumed by EventModule's
// project-lifecycle handlers; this module owns no event-dispatch logic itself.
@Module({
  imports: [TypeOrmModule.forFeature([Project, ProjectStatusHistory])],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
