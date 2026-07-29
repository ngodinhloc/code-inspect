import { Module } from '@nestjs/common';
import { SymbolsReaderService } from './services/symbols-reader.service';
import { EmbeddingClientService } from './services/embedding-client.service';

// Domain support for the index pipeline stage — reading parsed symbols and
// calling out to Embedding Service. `index.symbol_embeddings` schema setup now
// runs via DatabaseModule's migrations, not a bootstrapping service here.
// Consumed by EventModule's ProjectParsedHandler; this module owns no
// event-dispatch logic itself.
@Module({
  providers: [SymbolsReaderService, EmbeddingClientService],
  exports: [SymbolsReaderService, EmbeddingClientService],
})
export class IndexModule {}
