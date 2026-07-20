import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileWalkerService } from './services/file-walker.service';
import { TreeSitterExtractorService } from './services/tree-sitter-extractor.service';
import { File } from '../database/entities/file.entity';
import { CodeSymbol } from '../database/entities/symbol.entity';
import { SymbolDependency } from '../database/entities/symbol-dependency.entity';
import { ApiEndpoint } from '../database/entities/api-endpoint.entity';

// Domain support for the parse pipeline stage — file walking, Tree-sitter
// extraction, and this service's repositories. Consumed by EventModule's
// ProjectCheckedOutHandler; this module owns no event-dispatch logic itself.
@Module({
  imports: [
    TypeOrmModule.forFeature([File, CodeSymbol, SymbolDependency, ApiEndpoint]),
  ],
  providers: [FileWalkerService, TreeSitterExtractorService],
  exports: [TypeOrmModule, FileWalkerService, TreeSitterExtractorService],
})
export class ParseModule {}
