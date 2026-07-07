import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface SymbolRow {
  id: number;
  filePath: string;
  type: string;
  name: string;
  language: string;
  content: string;
  startLine: number;
  endLine: number;
}

// Reads parse-service's `parse.symbols` table directly rather than mirroring
// its entity — this service only ever reads it, never writes.
@Injectable()
export class SymbolsReaderService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findByProject(projectId: string): Promise<SymbolRow[]> {
    return this.dataSource.query(
      `SELECT id, file_path AS "filePath", type, name, language, content, start_line AS "startLine", end_line AS "endLine"
       FROM "parse".symbols
       WHERE project_id = $1
       ORDER BY file_path, start_line`,
      [projectId],
    );
  }
}
