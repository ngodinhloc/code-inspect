import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AppLogger } from '../../common/logger/services/app-logger';
import { ANSWER_MODEL, AnswerResult } from '../contracts/chat.interface';
import { SYSTEM_PROMPT } from '../templates/answer.template';

const MAX_TOKENS = 4096;

@Injectable()
export class AnswerService {
  private readonly client = new Anthropic();

  constructor(private readonly logger: AppLogger) {}

  async answer(
    question: string,
    contextPrompt: string,
    projectId: string,
  ): Promise<AnswerResult> {
    this.logger.log('AnswerService.answer: calling Claude', {
      projectId,
      model: ANSWER_MODEL,
      contextLength: contextPrompt.length,
    });
    const response = await this.client.messages.create({
      model: ANSWER_MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive' },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Question: ${question}\n\nCode context:\n\n${contextPrompt || '(no relevant context found)'}`,
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      this.logger.warn('AnswerService.answer: Claude refused to answer', {
        projectId,
      });
      throw new Error('Claude declined to answer this question');
    }

    const textBlock = response.content.find((block) => block.type === 'text');
    const answer = textBlock && textBlock.type === 'text' ? textBlock.text : '';
    this.logger.log('AnswerService.answer: done', {
      projectId,
      stopReason: response.stop_reason,
      answerLength: answer.length,
    });
    return { answer };
  }
}
