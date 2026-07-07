import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('files')
export class File {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Column({ type: 'varchar', length: 1000 })
  path!: string;

  @Column({ type: 'varchar', length: 40 })
  language!: string;

  @Column({ type: 'int' })
  size!: number;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
