import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { SymbolKind } from '../../parse/contracts/project.interface';
import { File } from './file.entity';

// Named CodeSymbol (not `Symbol`) to avoid shadowing the built-in global.
@Entity('symbols')
export class CodeSymbol {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Index()
  @Column({ name: 'file_id' })
  fileId!: number;

  @ManyToOne(() => File)
  @JoinColumn({ name: 'file_id' })
  file!: File;

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
