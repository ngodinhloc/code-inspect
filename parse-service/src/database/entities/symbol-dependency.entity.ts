import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { CodeSymbol } from './symbol.entity';

@Entity('symbol_dependencies')
export class SymbolDependency {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ name: 'symbol_id' })
  symbolId!: number;

  @ManyToOne(() => CodeSymbol)
  @JoinColumn({ name: 'symbol_id' })
  symbol!: CodeSymbol;

  @Column({ name: 'dependency_name', type: 'varchar', length: 500 })
  dependencyName!: string;
}
