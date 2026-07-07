import { RetrievedChunk } from './hybrid-retrieval.service';

const RRF_K = 60;
const FUSED_LIMIT = 20;

// Reciprocal rank fusion: a chunk's score is the sum, over every ranked list
// it appears in, of 1/(k + rank) — rewards items ranked well by either
// signal without needing the two scores to be on the same scale.
export function reciprocalRankFusion(vectorResults: RetrievedChunk[], ftsResults: RetrievedChunk[]): RetrievedChunk[] {
  const scores = new Map<number, number>();
  const chunksById = new Map<number, RetrievedChunk>();

  for (const list of [vectorResults, ftsResults]) {
    list.forEach((chunk, rank) => {
      chunksById.set(chunk.embeddingId, chunk);
      const score = (scores.get(chunk.embeddingId) ?? 0) + 1 / (RRF_K + rank + 1);
      scores.set(chunk.embeddingId, score);
    });
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, FUSED_LIMIT)
    .map(([embeddingId]) => chunksById.get(embeddingId)!);
}
