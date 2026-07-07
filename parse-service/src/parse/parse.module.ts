import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParseService } from './services/parse.service';
import { FileWalkerService } from './services/file-walker.service';
import { TreeSitterExtractorService } from './services/tree-sitter-extractor.service';
import { File } from '../database/entities/file.entity';
import { CodeSymbol } from '../database/entities/symbol.entity';
import { SymbolDependency } from '../database/entities/symbol-dependency.entity';
import { ApiEndpoint } from '../database/entities/api-endpoint.entity';

@Module({
  imports: [TypeOrmModule.forFeature([File, CodeSymbol, SymbolDependency, ApiEndpoint])],
  providers: [ParseService, FileWalkerService, TreeSitterExtractorService],
})
export class ParseModule {}
