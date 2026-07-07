import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ChatService } from '../services/chat.service';
import { CreateChatDto } from '../dto/create-chat.dto';

@Controller('api')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('chat')
  createChat(@Body() dto: CreateChatDto) {
    return this.chatService.createChat(dto);
  }

  @Get('chat/:uuid')
  getChat(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.chatService.getChat(uuid);
  }

  @Get('projects/:projectId/chats')
  listChats(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.chatService.listByProject(projectId);
  }
}
