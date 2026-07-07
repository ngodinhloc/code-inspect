import { Injectable } from '@nestjs/common';
import { open, readdir, stat } from 'fs/promises';
import { extname, join, relative } from 'path';

const INCLUDED_EXTENSIONS = new Set(['.js', '.ts', '.php', '.go', '.yaml', '.yml', '.md']);
const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'vendor', 'dist', 'build', 'coverage']);
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const BINARY_SNIFF_BYTES = 512;

export function detectLanguage(extension: string): string {
  switch (extension) {
    case '.js':
      return 'javascript';
    case '.ts':
      return 'typescript';
    case '.php':
      return 'php';
    case '.go':
      return 'go';
    case '.yaml':
    case '.yml':
      return 'yaml';
    case '.md':
      return 'markdown';
    default:
      return 'unknown';
  }
}

export interface WalkedFile {
  absolutePath: string;
  relativePath: string;
  extension: string;
}

@Injectable()
export class FileWalkerService {
  async walk(rootDir: string): Promise<WalkedFile[]> {
    const results: WalkedFile[] = [];
    await this.walkDir(rootDir, rootDir, results);
    return results;
  }

  // Files too large to be worth embedding, or that fail the binary sniff, are
  // skipped rather than failing the whole project — one huge generated file
  // shouldn't block indexing the rest of the repo.
  async isEligible(absolutePath: string): Promise<boolean> {
    const stats = await stat(absolutePath);
    if (stats.size === 0 || stats.size > MAX_FILE_SIZE_BYTES) return false;
    return !(await this.looksBinary(absolutePath, stats.size));
  }

  private async walkDir(rootDir: string, currentDir: string, results: WalkedFile[]): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        await this.walkDir(rootDir, join(currentDir, entry.name), results);
        continue;
      }
      if (!entry.isFile()) continue;

      const extension = extname(entry.name).toLowerCase();
      if (!INCLUDED_EXTENSIONS.has(extension)) continue;

      const absolutePath = join(currentDir, entry.name);
      results.push({ absolutePath, relativePath: relative(rootDir, absolutePath), extension });
    }
  }

  private async looksBinary(absolutePath: string, size: number): Promise<boolean> {
    const fd = await open(absolutePath, 'r');
    try {
      const buffer = Buffer.alloc(Math.min(BINARY_SNIFF_BYTES, size));
      await fd.read(buffer, 0, buffer.length, 0);
      return buffer.includes(0);
    } finally {
      await fd.close();
    }
  }
}
