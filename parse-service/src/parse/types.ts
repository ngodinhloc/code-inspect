import { SymbolKind } from './contracts/project.interface';

export interface ExtractedSymbol {
  type: SymbolKind;
  name: string;
  content: string;
  startLine: number;
  endLine: number;
}

export interface ExtractedEndpoint {
  method: string;
  path: string;
  handlerName: string | null;
  framework: string;
}

export interface ParsedFile {
  relativePath: string;
  language: string;
  content: string;
  symbols: ExtractedSymbol[];
  imports: string[];
  endpoints: ExtractedEndpoint[];
}
