import { Module } from '@nestjs/common';
import { SymbolsReaderService } from './services/symbols-reader.service';
import { EmbeddingClientService } from './services/embedding-client.service';
import { SymbolEmbeddingsSchemaService } from './services/symbol-embeddings-schema.service';

// Domain support for the index pipeline stage — reading parsed symbols,
// calling out to Embedding Service, and bootstrapping this service's own
// `index.symbol_embeddings` schema at startup. Consumed by EventModule's
// ProjectParsedHandler; this module owns no event-dispatch logic itself.
@Module({
  providers: [
    SymbolsReaderService,
    EmbeddingClientService,
    SymbolEmbeddingsSchemaService,
  ],
  exports: [SymbolsReaderService, EmbeddingClientService],
})
export class IndexModule {}
