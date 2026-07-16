import { parseAllDocuments } from 'yaml';
import { ExtractedSymbol } from '../types';

interface K8sLikeDocument {
  kind?: unknown;
  metadata?: { name?: unknown };
}

// Structural pass only, per PLANS.md Milestone 2 — no Tree-sitter grammar for
// YAML; each document that looks like a Kubernetes resource (has kind + metadata.name)
// becomes one `resource` symbol.
export function extractYamlSymbols(content: string): ExtractedSymbol[] {
  const symbols: ExtractedSymbol[] = [];
  let documents;
  try {
    documents = parseAllDocuments(content);
  } catch {
    return symbols;
  }

  for (const doc of documents) {
    const value = doc.toJS() as K8sLikeDocument | null;
    if (!value || typeof value !== 'object') continue;
    const kind = value.kind;
    const name = value.metadata?.name;
    if (typeof kind !== 'string' || typeof name !== 'string') continue;

    const range = doc.contents?.range;
    const [startOffset, endOffset] = range ?? [0, content.length];
    symbols.push({
      type: 'resource',
      name: `${kind}/${name}`,
      content: content.slice(startOffset, endOffset),
      startLine: lineAt(content, startOffset),
      endLine: lineAt(content, endOffset),
    });
  }

  return symbols;
}

// Each heading starts a section running until the next heading of equal or
// higher level (or end of file).
export function extractMarkdownSymbols(content: string): ExtractedSymbol[] {
  const lines = content.split('\n');
  const headingPattern = /^(#{1,6})\s+(.+?)\s*$/;

  const headings: { level: number; title: string; lineIndex: number }[] = [];
  lines.forEach((line, index) => {
    const match = headingPattern.exec(line);
    if (match)
      headings.push({
        level: match[1].length,
        title: match[2],
        lineIndex: index,
      });
  });

  const symbols: ExtractedSymbol[] = [];
  headings.forEach((heading, i) => {
    const next = headings.slice(i + 1).find((h) => h.level <= heading.level);
    const endLineIndex = next ? next.lineIndex - 1 : lines.length - 1;
    symbols.push({
      type: 'section',
      name: heading.title,
      content: lines.slice(heading.lineIndex, endLineIndex + 1).join('\n'),
      startLine: heading.lineIndex + 1,
      endLine: endLineIndex + 1,
    });
  });

  return symbols;
}

function lineAt(content: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === '\n') line++;
  }
  return line;
}
