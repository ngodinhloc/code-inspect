import { Injectable, Logger } from '@nestjs/common';
import { RetrievalStateType } from '../graph/retrieval-state';

// Mirrors the sibling candidate-agent's AdvanceRoundNode: a dedicated
// single-purpose node that bumps the loop counter on the edge back into
// query_understanding, keeping FusionNode's routing logic free of side effects.
@Injectable()
export class AdvanceAttemptNode {
  private readonly logger = new Logger(AdvanceAttemptNode.name);

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
