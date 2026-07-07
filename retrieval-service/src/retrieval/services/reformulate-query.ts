// Free (no LLM) fallback for when the first retrieval pass comes back empty —
// strips interrogative/stopword tokens so the remaining keywords give FTS a
// better shot (plainto_tsquery is the search that actually returns zero rows
// on odd phrasing; vector search almost always returns *something*).
const STOP_WORDS = new Set([
  'what',
  'where',
  'when',
  'why',
  'who',
  'which',
  'how',
  'is',
  'are',
  'was',
  'were',
  'do',
  'does',
  'did',
  'can',
  'could',
  'should',
  'would',
  'the',
  'a',
  'an',
  'to',
  'of',
  'this',
  'in',
]);

export function reformulateQuery(question: string): string {
  const kept = question
    .replace(/[?.!]+$/, '')
    .split(/\s+/)
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word.toLowerCase()));

  const reformulated = kept.join(' ').trim();
  return reformulated.length > 0 ? reformulated : question;
}
