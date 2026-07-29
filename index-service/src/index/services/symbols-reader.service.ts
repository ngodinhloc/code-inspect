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
      `SELECT s.id, f.path AS "filePath", s.type, s.name, s.language, s.content, s.start_line AS "startLine", s.end_line AS "endLine"
       FROM "parse".symbols s
       JOIN "parse".files f ON f.id = s.file_id
       WHERE s.project_id = $1
       ORDER BY f.path, s.start_line`,
      [projectId],
    );
  }
}
