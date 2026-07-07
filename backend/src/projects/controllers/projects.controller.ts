import { Body, Controller, Get, MessageEvent, Param, ParseUUIDPipe, Post, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ProjectsService } from '../services/projects.service';
import { CreateProjectDto } from '../dto/create-project.dto';

@Controller('api')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post('projects')
  createProject(@Body() dto: CreateProjectDto) {
    return this.projectsService.createProject(dto);
  }

  @Get('projects/:id')
  getProject(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.getProject(id);
  }

  @Sse('projects/:id/events')
  streamProjectEvents(@Param('id', ParseUUIDPipe) id: string): Observable<MessageEvent> {
    return this.projectsService.streamProjectEvents(id);
  }
}
