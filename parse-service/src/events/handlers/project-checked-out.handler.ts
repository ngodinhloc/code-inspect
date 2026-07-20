import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { readFile } from 'fs/promises';
import { RabbitMQService } from '../../rabbitmq/services/rabbitmq.service';
import { AppLogger } from '../../common/logger/services/app-logger';
import { File } from '../../database/entities/file.entity';
import { CodeSymbol } from '../../database/entities/symbol.entity';
import { SymbolDependency } from '../../database/entities/symbol-dependency.entity';
import { ApiEndpoint } from '../../database/entities/api-endpoint.entity';
import {
  FileWalkerService,
  detectLanguage,
} from '../../parse/services/file-walker.service';
import { TreeSitterExtractorService } from '../../parse/services/tree-sitter-extractor.service';
import {
  extractYamlSymbols,
  extractMarkdownSymbols,
} from '../../parse/services/text-extractors';
import { extractApiEndpoints } from '../../parse/services/api-endpoint-extractor';
import { ParsedFile } from '../../parse/types';
import { EventHandler } from '../contracts/event.interfaces';
import {
  EVENT_PROJECT_FAILED,
  EVENT_PROJECT_PARSED,
  EXCHANGE_PROJECT,
  ProjectCheckedOutEvent,
  ProjectFailedEvent,
  ProjectParsedEvent,
  ProjectStatus,
} from '../../parse/contracts/project.interface';

@Injectable()
export class ProjectCheckedOutHandler implements EventHandler {
  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly logger: AppLogger,
    private readonly fileWalker: FileWalkerService,
    private readonly treeSitterExtractor: TreeSitterExtractorService,
    @InjectRepository(File) private readonly fileRepo: Repository<File>,
    @InjectRepository(CodeSymbol)
    private readonly symbolRepo: Repository<CodeSymbol>,
    @InjectRepository(SymbolDependency)
    private readonly dependencyRepo: Repository<SymbolDependency>,
    @InjectRepository(ApiEndpoint)
    private readonly endpointRepo: Repository<ApiEndpoint>,
  ) {}

  async handle(payload: Record<string, unknown>): Promise<void> {
    const event = payload as unknown as ProjectCheckedOutEvent;
    if (!event.projectId || !event.repoPath) {
      this.logger.warn('ProjectCheckedOutHandler.handle: malformed event', {
        payload,
      });
      return;
    }

    this.logger.log('ProjectCheckedOutHandler.handle: parsing', {
      projectId: event.projectId,
      repoPath: event.repoPath,
    });

    try {
      const parsedFiles = await this.parseRepository(event.repoPath);
      await this.persist(event.projectId, parsedFiles);

      const parsed: ProjectParsedEvent = { projectId: event.projectId };
      await this.rabbitMQService.publish(
        EXCHANGE_PROJECT,
        EVENT_PROJECT_PARSED,
        parsed,
      );
      this.logger.log('ProjectCheckedOutHandler.handle: parsed', {
        projectId: event.projectId,
        files: parsedFiles.length,
        symbols: parsedFiles.reduce((sum, f) => sum + f.symbols.length, 0),
      });
    } catch (err) {
      this.logger.error('ProjectCheckedOutHandler.handle: parse failed', {
        projectId: event.projectId,
        error: String(err),
      });
      const failed: ProjectFailedEvent = {
        projectId: event.projectId,
        stage: ProjectStatus.PARSED,
        reason: `Failed to parse repository: ${String(err)}`,
      };
      await this.rabbitMQService.publish(
        EXCHANGE_PROJECT,
        EVENT_PROJECT_FAILED,
        failed,
      );
    }
  }

  private async parseRepository(repoPath: string): Promise<ParsedFile[]> {
    const walked = await this.fileWalker.walk(repoPath);
    const parsedFiles: ParsedFile[] = [];

    for (const file of walked) {
      if (!(await this.fileWalker.isEligible(file.absolutePath))) continue;

      const content = await readFile(file.absolutePath, 'utf8');
      const language = detectLanguage(file.extension);

      let symbols;
      let imports: string[] = [];
      if (this.treeSitterExtractor.supports(language)) {
        const result = this.treeSitterExtractor.extract(language, content);
        symbols = result.symbols;
        imports = result.imports;
      } else if (language === 'yaml') {
        symbols = extractYamlSymbols(content);
      } else if (language === 'markdown') {
        symbols = extractMarkdownSymbols(content);
      } else {
        symbols = [];
      }

      parsedFiles.push({
        relativePath: file.relativePath,
        language,
        content,
        symbols,
        imports,
        endpoints: extractApiEndpoints(content, language),
      });
    }

    return parsedFiles;
  }

  // Re-parsing a project (redelivered event, or a manual re-run) should replace
  // its rows rather than duplicate them.
  private async persist(
    projectId: string,
    parsedFiles: ParsedFile[],
  ): Promise<void> {
    await this.clearProject(projectId);

    if (parsedFiles.length > 0) {
      await this.fileRepo.save(
        parsedFiles.map((f) =>
          this.fileRepo.create({
            projectId,
            path: f.relativePath,
            language: f.language,
            size: Buffer.byteLength(f.content),
            content: f.content,
          }),
        ),
      );
    }

    const endpointEntities = parsedFiles.flatMap((f) =>
      f.endpoints.map((e) =>
        this.endpointRepo.create({
          projectId,
          filePath: f.relativePath,
          method: e.method,
          path: e.path,
          handlerName: e.handlerName,
          framework: e.framework,
        }),
      ),
    );
    if (endpointEntities.length > 0)
      await this.endpointRepo.save(endpointEntities);

    for (const file of parsedFiles) {
      if (file.symbols.length === 0) continue;

      const savedSymbols = await this.symbolRepo.save(
        file.symbols.map((s) =>
          this.symbolRepo.create({
            projectId,
            filePath: file.relativePath,
            type: s.type,
            name: s.name,
            language: file.language,
            content: s.content,
            startLine: s.startLine,
            endLine: s.endLine,
          }),
        ),
      );

      const dependencyEntities = savedSymbols.flatMap((symbol) => {
        const matchedImports = file.imports.filter((name) =>
          wordBoundaryMatch(name, symbol.content),
        );
        return matchedImports.map((name) =>
          this.dependencyRepo.create({
            symbolId: symbol.id,
            dependencyName: name,
          }),
        );
      });
      if (dependencyEntities.length > 0)
        await this.dependencyRepo.save(dependencyEntities);
    }
  }

  private async clearProject(projectId: string): Promise<void> {
    const existingSymbols = await this.symbolRepo.find({
      where: { projectId },
      select: ['id'],
    });
    const symbolIds = existingSymbols.map((s) => s.id);
    if (symbolIds.length > 0) {
      await this.dependencyRepo.delete({ symbolId: In(symbolIds) });
    }
    await this.symbolRepo.delete({ projectId });
    await this.fileRepo.delete({ projectId });
    await this.endpointRepo.delete({ projectId });
  }
}

function wordBoundaryMatch(name: string, content: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`).test(content);
}
