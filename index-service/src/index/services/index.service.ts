import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RabbitMQService } from '../../rabbitmq/services/rabbitmq.service';
import { SymbolsReaderService, SymbolRow } from './symbols-reader.service';
import { EmbeddingClientService } from './embedding-client.service';
import { chunkContent } from './chunking';
import {
  EVENT_PROJECT_FAILED,
  EVENT_PROJECT_INDEXED,
  EVENT_PROJECT_PARSED,
  EVENT_PROJECT_READY,
  EXCHANGE_PROJECT,
  ProjectFailedEvent,
  ProjectIndexedEvent,
  ProjectParsedEvent,
  ProjectReadyEvent,
  ProjectStatus,
  QUEUE_INDEX_PARSED,
} from '../contracts/project.interface';

interface Chunk {
  symbolId: number;
  chunkIndex: number;
  chunkText: string;
}

@Injectable()
export class IndexService implements OnModuleInit {
  private readonly logger = new Logger(IndexService.name);

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly symbolsReader: SymbolsReaderService,
    private readonly embeddingClient: EmbeddingClientService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitMQService.subscribe(
      EXCHANGE_PROJECT,
      QUEUE_INDEX_PARSED,
      EVENT_PROJECT_PARSED,
      (payload) =>
        this.handleProjectParsed(payload as unknown as ProjectParsedEvent),
    );
  }

  private async handleProjectParsed(event: ProjectParsedEvent): Promise<void> {
    this.logger.log('IndexService.handleProjectParsed: indexing', {
      projectId: event.projectId,
    });

    try {
      const symbols = await this.symbolsReader.findByProject(event.projectId);
      const chunks = this.buildChunks(symbols);
      const model = await this.embedAndStore(event.projectId, chunks);

      const indexed: ProjectIndexedEvent = { projectId: event.projectId };
      await this.rabbitMQService.publish(
        EXCHANGE_PROJECT,
        EVENT_PROJECT_INDEXED,
        indexed,
      );

      // No further stages yet — READY follows INDEXED immediately, per SPECS'
      // design intent that future stages slot in without changing this contract.
      const ready: ProjectReadyEvent = { projectId: event.projectId };
      await this.rabbitMQService.publish(
        EXCHANGE_PROJECT,
        EVENT_PROJECT_READY,
        ready,
      );

      this.logger.log('IndexService.handleProjectParsed: indexed', {
        projectId: event.projectId,
        symbols: symbols.length,
        chunks: chunks.length,
        model,
      });
    } catch (err) {
      this.logger.error('IndexService.handleProjectParsed: indexing failed', {
        projectId: event.projectId,
        error: String(err),
      });
      const failed: ProjectFailedEvent = {
        projectId: event.projectId,
        stage: ProjectStatus.INDEXED,
        reason: `Failed to index project: ${String(err)}`,
      };
      await this.rabbitMQService.publish(
        EXCHANGE_PROJECT,
        EVENT_PROJECT_FAILED,
        failed,
      );
    }
  }

  // One chunk per symbol (doc sections and YAML resources are already rows in
  // `symbols`, so no separate pass is needed for them); oversized symbols
  // split into multiple overlapping chunks by chunkContent().
  private buildChunks(symbols: SymbolRow[]): Chunk[] {
    const chunks: Chunk[] = [];
    for (const symbol of symbols) {
      const header = `${symbol.type} ${symbol.name} (${symbol.filePath})`;
      chunkContent(symbol.content).forEach((piece, chunkIndex) => {
        chunks.push({
          symbolId: symbol.id,
          chunkIndex,
          chunkText: `${header}\n\n${piece}`,
        });
      });
    }
    return chunks;
  }

  // Re-indexing a project replaces its rows rather than duplicating them.
  private async embedAndStore(
    projectId: string,
    chunks: Chunk[],
  ): Promise<string> {
    await this.dataSource.query(
      'DELETE FROM "index".symbol_embeddings WHERE project_id = $1',
      [projectId],
    );
    if (chunks.length === 0) return '';

    const { embeddings, model } = await this.embeddingClient.embedAll(
      chunks.map((c) => c.chunkText),
    );

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const vectorLiteral = `[${embeddings[i].join(',')}]`;
      await this.dataSource.query(
        `INSERT INTO "index".symbol_embeddings (project_id, symbol_id, chunk_index, chunk_text, embedding, model)
         VALUES ($1, $2, $3, $4, $5::vector, $6)`,
        [
          projectId,
          chunk.symbolId,
          chunk.chunkIndex,
          chunk.chunkText,
          vectorLiteral,
          model,
        ],
      );
    }
    return model;
  }
}
