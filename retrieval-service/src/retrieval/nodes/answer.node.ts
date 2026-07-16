import { Injectable, Logger } from '@nestjs/common';
import { ChatManagerService } from '../services/chat-manager.service';
import { AnswerService } from '../services/answer.service';
import { RetrievalStateType } from '../graph/retrieval-state';

@Injectable()
export class AnswerNode {
  private readonly logger = new Logger(AnswerNode.name);

  constructor(
    private readonly chatManager: ChatManagerService,
    private readonly answerService: AnswerService,
  ) {}

  async run(state: RetrievalStateType): Promise<Partial<RetrievalStateType>> {
    this.logger.log('AnswerNode.run: calling Claude', {
      projectId: state.projectId,
      chatId: state.chatId,
      contextLength: state.prompt.length,
    });
    await this.chatManager.appendThinking(state.chatId, 'answer', 'Claude');
    const { answer } = await this.answerService.answer(
      state.question,
      state.prompt,
      state.projectId,
    );
    await this.chatManager.setReply(state.chatId, 'answer', {
      answer,
      citations: state.citations,
    });
    this.logger.log('AnswerNode.run: done', {
      projectId: state.projectId,
      chatId: state.chatId,
      answerLength: answer.length,
    });
    return { answer };
  }
}
