import { Injectable } from '@nestjs/common';
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScriptLanguages from 'tree-sitter-typescript';
import Php from 'tree-sitter-php';
import Go from 'tree-sitter-go';
import { SymbolKind } from '../contracts/project.interface';
import { ExtractedSymbol } from '../types';

// Plain JavaScript has no `interface_declaration` node — that's TS-only, so it
// needs its own (shorter) query rather than sharing one with TypeScript.
const JS_SYMBOL_QUERY = `
(function_declaration name: (identifier) @name) @symbol
(class_declaration name: (identifier) @name) @symbol
(method_definition name: (property_identifier) @name) @symbol
`;
const JS_SYMBOL_TYPES: SymbolKind[] = ['function', 'class', 'method'];

const TS_SYMBOL_QUERY = `
(function_declaration name: (identifier) @name) @symbol
(class_declaration name: (type_identifier) @name) @symbol
(interface_declaration name: (type_identifier) @name) @symbol
(method_definition name: (property_identifier) @name) @symbol
`;
const TS_SYMBOL_TYPES: SymbolKind[] = [
  'function',
  'class',
  'interface',
  'method',
];

const JS_TS_IMPORT_QUERY = `
(import_specifier name: (identifier) @name)
(import_clause (identifier) @name)
`;

const GO_SYMBOL_QUERY = `
(function_declaration name: (identifier) @name) @symbol
(method_declaration name: (field_identifier) @name) @symbol
(type_spec name: (type_identifier) @name type: (interface_type)) @symbol
(type_spec name: (type_identifier) @name type: (struct_type)) @symbol
`;
const GO_SYMBOL_TYPES: SymbolKind[] = [
  'function',
  'method',
  'interface',
  'class',
];
const GO_IMPORT_QUERY = `
(import_spec path: (interpreted_string_literal) @path)
`;

const PHP_SYMBOL_QUERY = `
(function_definition name: (name) @name) @symbol
(class_declaration name: (name) @name) @symbol
(interface_declaration name: (name) @name) @symbol
(method_declaration name: (name) @name) @symbol
`;
const PHP_SYMBOL_TYPES: SymbolKind[] = [
  'function',
  'class',
  'interface',
  'method',
];
const PHP_IMPORT_QUERY = `
(namespace_use_clause (name) @name)
(namespace_use_clause (qualified_name) @name)
`;

interface LanguageSpec {
  parser: Parser;
  symbolQuery: Parser.Query;
  symbolTypesByPattern: SymbolKind[];
  importQuery: Parser.Query | null;
}

interface ExtractResult {
  symbols: ExtractedSymbol[];
  imports: string[];
}

function buildSpec(
  language: unknown,
  symbolQueryString: string,
  symbolTypesByPattern: SymbolKind[],
  importQueryString: string | null,
): LanguageSpec {
  const parser = new Parser();
  parser.setLanguage(language);
  return {
    parser,
    symbolQuery: new Parser.Query(language, symbolQueryString),
    symbolTypesByPattern,
    importQuery: importQueryString
      ? new Parser.Query(language, importQueryString)
      : null,
  };
}

// Tree-sitter grammars for JS/TS/PHP/Go, per PLANS.md Milestone 2. Extraction is a
// "first pass" — top-level functions/classes/interfaces/methods only, not a full
// semantic analysis (no generics, decorators, or nested closures tracked).
@Injectable()
export class TreeSitterExtractorService {
  private readonly specs: Record<string, LanguageSpec>;

  constructor() {
    this.specs = {
      javascript: buildSpec(
        JavaScript,
        JS_SYMBOL_QUERY,
        JS_SYMBOL_TYPES,
        JS_TS_IMPORT_QUERY,
      ),
      typescript: buildSpec(
        TypeScriptLanguages.typescript,
        TS_SYMBOL_QUERY,
        TS_SYMBOL_TYPES,
        JS_TS_IMPORT_QUERY,
      ),
      go: buildSpec(Go, GO_SYMBOL_QUERY, GO_SYMBOL_TYPES, GO_IMPORT_QUERY),
      php: buildSpec(
        Php.php,
        PHP_SYMBOL_QUERY,
        PHP_SYMBOL_TYPES,
        PHP_IMPORT_QUERY,
      ),
    };
  }

  supports(language: string): boolean {
    return language in this.specs;
  }

  extract(language: string, content: string): ExtractResult {
    const spec = this.specs[language];
    if (!spec) return { symbols: [], imports: [] };

    let tree: Parser.Tree;
    try {
      tree = spec.parser.parse(content);
    } catch {
      return { symbols: [], imports: [] };
    }

    const symbols: ExtractedSymbol[] = [];
    for (const match of spec.symbolQuery.matches(tree.rootNode)) {
      const symbolNode = match.captures.find((c) => c.name === 'symbol')?.node;
      const nameNode = match.captures.find((c) => c.name === 'name')?.node;
      if (!symbolNode || !nameNode) continue;
      symbols.push({
        type: spec.symbolTypesByPattern[match.pattern],
        name: nameNode.text,
        content: symbolNode.text,
        startLine: symbolNode.startPosition.row + 1,
        endLine: symbolNode.endPosition.row + 1,
      });
    }

    const imports = new Set<string>();
    if (spec.importQuery) {
      for (const match of spec.importQuery.matches(tree.rootNode)) {
        for (const capture of match.captures) {
          imports.add(this.normalizeImportName(language, capture.node.text));
        }
      }
    }

    return { symbols, imports: Array.from(imports) };
  }

  private normalizeImportName(language: string, raw: string): string {
    if (language === 'go') {
      const segments = raw.replace(/^"|"$/g, '').split('/');
      return segments[segments.length - 1];
    }
    if (language === 'php') {
      const segments = raw.split('\\');
      return segments[segments.length - 1];
    }
    return raw;
  }
}
