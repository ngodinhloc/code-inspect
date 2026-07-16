import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('api_endpoints')
export class ApiEndpoint {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Column({ name: 'file_path', type: 'varchar', length: 1000 })
  filePath!: string;

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
