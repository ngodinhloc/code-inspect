import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AppLogger } from '../../common/logger/services/app-logger';

const MODEL = 'claude-opus-4-8';
const MAX_TOKENS = 4096;

const SYSTEM_PROMPT =
  'You are a code intelligence assistant. Answer the question using only the provided code context. ' +
  'Be specific and reference file paths and symbol names from the context. If the context does not ' +
  'contain enough information to answer, say so plainly rather than guessing. ' +
  'Respond in plain prose only — the reply is rendered as plain text, not Markdown, so do not use ' +
  'headings, bold/italic asterisks, or bullet-point markup.';

export interface AnswerResult {
  answer: string;
}

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
      model: MODEL,
      contextLength: contextPrompt.length,
    });
    const response = await this.client.messages.create({
      model: MODEL,
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
