import { PDFParse } from 'pdf-parse';
import { ExtractedSymbol } from '../types';

export interface ExtractedPdf {
  content: string;
  symbols: ExtractedSymbol[];
}

// PDFs have no AST, so — mirroring how extractMarkdownSymbols splits on headings —
// each non-blank page becomes one `section` symbol. getText() (called with no
// pageJoiner option) builds its concatenated `text` — which we store verbatim as
// the file content — by appending `page.text + '\n\n'` for each page in order, so
// startLine/endLine are computed against that same running offset to stay in sync
// with the stored content, rather than reusing the page number as a fake line range.
// Corrupt/encrypted/image-only PDFs degrade to an empty file rather than failing the
// whole project.
export async function extractPdfSymbols(buffer: Buffer): Promise<ExtractedPdf> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const symbols: ExtractedSymbol[] = [];
    let line = 1;
    for (const page of result.pages) {
      const pageLineCount = page.text.split('\n').length;
      const startLine = line;
      const endLine = line + pageLineCount - 1;
      line = endLine + 2; // account for the '\n\n' separator getText() inserts between pages

      if (page.text.trim().length === 0) continue;
      symbols.push({
        type: 'section',
        name: `Page ${page.num}`,
        content: page.text,
        startLine,
        endLine,
      });
    }
    return { content: result.text, symbols };
  } catch {
    return { content: '', symbols: [] };
  } finally {
    await parser.destroy();
  }
}
