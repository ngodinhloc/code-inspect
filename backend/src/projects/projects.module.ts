import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsController } from './controllers/projects.controller';
import { ProjectsService } from './services/projects.service';
import { ProjectEventsService } from './services/project-events.service';
import { Project } from '../database/entities/project.entity';
import { ProjectStatusHistory } from '../database/entities/project-status-history.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Project, ProjectStatusHistory])],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectEventsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
