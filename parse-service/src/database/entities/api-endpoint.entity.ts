import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { File } from './file.entity';

@Entity('api_endpoints')
export class ApiEndpoint {
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

  @Column({ type: 'varchar', length: 10 })
  method!: string;

  @Column({ type: 'varchar', length: 500 })
  path!: string;

  @Column({
    name: 'handler_name',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  handlerName!: string | null;

  @Column({ type: 'varchar', length: 40 })
  framework!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
