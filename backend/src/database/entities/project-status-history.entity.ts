import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Project } from './project.entity';
import { ProjectStatus } from '../../projects/contracts/project.interface';

@Entity('project_status_history')
export class ProjectStatusHistory {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ name: 'project_id' })
  projectId!: number;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @Column({ type: 'varchar', length: 20 })
  status!: ProjectStatus;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
