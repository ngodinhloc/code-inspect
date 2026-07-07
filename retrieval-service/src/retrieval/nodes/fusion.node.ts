import { Injectable, Logger } from '@nestjs/common';
import { ChatManagerService } from '../services/chat-manager.service';
import { reciprocalRankFusion } from '../services/fusion';
import { RetrievalStateType } from '../graph/retrieval-state';

// Below this, reranking a handful of candidates down to 5 buys nothing.
const SKIP_RERANK_THRESHOLD = 5;
// One heuristic reformulate-and-retry pass, then give up and let the answer
// step be honest about the lack of context — see reformulate-query.ts.
const MAX_RETRIEVAL_ATTEMPTS = 1;

@Injectable()
export class FusionNode {
  private readonly logger = new Logger(FusionNode.name);

  constructor(private readonly chatManager: ChatManagerService) {}

  async run(state: RetrievalStateType): Promise<Partial<RetrievalStateType>> {
    this.logger.log('FusionNode.run: starting', {
      projectId: state.projectId,
      chatId: state.chatId,
      vectorCount: state.vectorResults.length,
      ftsCount: state.ftsResults.length,
    });
    await this.chatManager.appendThinking(state.chatId, 'fusion', 'Result Fusion');
    const fused = reciprocalRankFusion(state.vectorResults, state.ftsResults);
    await this.chatManager.setReply(state.chatId, 'fusion', { candidateCount: fused.length });
    this.logger.log('FusionNode.run: done', {
      projectId: state.projectId,
      chatId: state.chatId,
      candidateCount: fused.length,
    });
    return { fused };
  }
}

export type FusionRoute = 'reformulate' | 'skipRerank' | 'rerank';

const routerLogger = new Logger('routeAfterFusion');

// vectorSearch has no similarity filter (ORDER BY distance LIMIT 50), so it
// always returns candidates regardless of relevance — fused.length is never
// actually 0. ftsResults (plainto_tsquery) is the signal that can genuinely
// come back empty, so that's what "this pass came back weak" means here.
export function routeAfterFusion(state: RetrievalStateType): FusionRoute {
  const route: FusionRoute =
    state.ftsResults.length === 0 && state.retrievalAttempts < MAX_RETRIEVAL_ATTEMPTS
      ? 'reformulate'
      : state.fused.length <= SKIP_RERANK_THRESHOLD
        ? 'skipRerank'
        : 'rerank';
  routerLogger.log('routeAfterFusion: routing', {
    projectId: state.projectId,
    chatId: state.chatId,
    route,
    fusedCount: state.fused.length,
    ftsCount: state.ftsResults.length,
    retrievalAttempts: state.retrievalAttempts,
  });
  return route;
}
