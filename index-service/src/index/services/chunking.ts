const MAX_CHUNK_CHARS = 2000;
const CHUNK_OVERLAP_CHARS = 200;

// Symbols usually fit in one chunk; oversized ones (e.g. a very long function)
// are split with overlap so a boundary doesn't cut a relevant passage in half.
export function chunkContent(content: string): string[] {
  if (content.length <= MAX_CHUNK_CHARS) return [content];

  const chunks: string[] = [];
  let start = 0;
  while (start < content.length) {
    const end = Math.min(start + MAX_CHUNK_CHARS, content.length);
    chunks.push(content.slice(start, end));
    if (end >= content.length) break;
    start = end - CHUNK_OVERLAP_CHARS;
  }
  return chunks;
}
