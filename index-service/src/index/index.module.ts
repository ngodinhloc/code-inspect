import { Module } from '@nestjs/common';
import { IndexService } from './services/index.service';
import { SymbolsReaderService } from './services/symbols-reader.service';
import { EmbeddingClientService } from './services/embedding-client.service';
import { SymbolEmbeddingsSchemaService } from './services/symbol-embeddings-schema.service';

@Module({
  providers: [IndexService, SymbolsReaderService, EmbeddingClientService, SymbolEmbeddingsSchemaService],
})
export class IndexModule {}
