import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../common/logger/services/app-logger';
import { RetrievalStateType } from '../graph/retrieval-state';

// Mirrors the sibling candidate-agent's AdvanceRoundNode: a dedicated
// single-purpose node that bumps the loop counter on the edge back into
// query_understanding, keeping FusionNode's routing logic free of side effects.
@Injectable()
export class AdvanceAttemptNode {
  constructor(private readonly logger: AppLogger) {}

  run(state: RetrievalStateType): Partial<RetrievalStateType> {
    const retrievalAttempts = state.retrievalAttempts + 1;
    this.logger.log('AdvanceAttemptNode.run: retrying retrieval', {
      projectId: state.projectId,
      chatId: state.chatId,
      retrievalAttempts,
    });
    return { retrievalAttempts };
  }
}
