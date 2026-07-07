import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './controllers/chat.controller';
import { ChatService } from './services/chat.service';
import { ChatEventsService } from './services/chat-events.service';
import { ChatGateway } from './gateways/chat.gateway';
import { Chat } from '../database/entities/chat.entity';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [TypeOrmModule.forFeature([Chat]), ProjectsModule],
  controllers: [ChatController],
  providers: [ChatService, ChatEventsService, ChatGateway],
})
export class ChatModule {}
