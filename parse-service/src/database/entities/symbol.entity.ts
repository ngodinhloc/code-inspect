import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';
import { SymbolKind } from '../../parse/contracts/project.interface';

// Named CodeSymbol (not `Symbol`) to avoid shadowing the built-in global.
@Entity('symbols')
export class CodeSymbol {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Column({ name: 'file_path', type: 'varchar', length: 1000 })
  filePath!: string;

  @Column({ type: 'varchar', length: 20 })
  type!: SymbolKind;

  @Column({ type: 'varchar', length: 500 })
  name!: string;

  @Column({ type: 'varchar', length: 40 })
  language!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'start_line', type: 'int' })
  startLine!: number;

  @Column({ name: 'end_line', type: 'int' })
  endLine!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
