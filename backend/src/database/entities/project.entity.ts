import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ProjectStatus } from '../../projects/contracts/project.interface';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  uuid!: string;

  @Column({ name: 'repository_url', type: 'varchar', length: 500 })
  repositoryUrl!: string;

  @Column({ type: 'varchar', length: 200, default: 'main' })
  branch!: string;

  @Column({ type: 'varchar', length: 20, default: ProjectStatus.CREATED })
  status!: ProjectStatus;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
