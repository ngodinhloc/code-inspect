import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './controllers/chat.controller';
import { ChatService } from './services/chat.service';
import { ChatGateway } from './gateways/chat.gateway';
import { Chat } from '../database/entities/chat.entity';
import { ProjectsModule } from '../projects/projects.module';

// Domain support for the chat lifecycle — HTTP/WS surface plus the `chats`
// repository. Consumed by EventModule's chat-lifecycle handlers; this module
// owns no event-dispatch logic itself.
@Module({
  imports: [TypeOrmModule.forFeature([Chat]), ProjectsModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
