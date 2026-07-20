import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RetrievedChunk } from './hybrid-retrieval.service';
import { AppLogger } from '../../common/logger/services/app-logger';
import { ChatCitation } from '../contracts/chat.interface';

export interface BuiltContext {
  prompt: string;
  citations: ChatCitation[];
}

interface SymbolRow {
  id: number;
  filePath: string;
  name: string;
  startLine: number;
}

@Injectable()
export class ContextBuilderService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly logger: AppLogger,
  ) {}

  async build(
    chunks: RetrievedChunk[],
    projectId: string,
  ): Promise<BuiltContext> {
    if (chunks.length === 0) {
      this.logger.warn(
        'ContextBuilderService.build: no chunks to build context from',
        { projectId },
      );
      return { prompt: '', citations: [] };
    }

    const symbolIds = chunks.map((c) => c.symbolId);
    const rows: SymbolRow[] = await this.dataSource.query(
      `SELECT id, file_path AS "filePath", name, start_line AS "startLine"
       FROM "parse".symbols
       WHERE id = ANY($1::int[])`,
      [symbolIds],
    );
    this.logger.log('ContextBuilderService.build: symbols resolved', {
      projectId,
      symbols: rows,
    });
    const symbolsById = new Map(rows.map((r) => [r.id, r]));

    const sections: string[] = [];
    const citations: ChatCitation[] = [];

    for (const chunk of chunks) {
      const symbol = symbolsById.get(chunk.symbolId);
      const filePath = symbol?.filePath ?? 'unknown';
      const symbolName = symbol?.name ?? 'unknown';
      const startLine = symbol?.startLine ?? 0;

      sections.push(
        `File: ${filePath}\nSymbol: ${symbolName} (line ${startLine})\n\n${chunk.chunkText}`,
      );
      citations.push({ file: filePath, symbol: symbolName, line: startLine });
    }

    this.logger.log('ContextBuilderService.build: done', {
      projectId,
      citationCount: citations.length,
      citations,
    });
    return { prompt: sections.join('\n\n---\n\n'), citations };
  }
}
