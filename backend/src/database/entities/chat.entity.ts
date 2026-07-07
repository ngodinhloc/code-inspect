import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ChatMessage, ChatRunStatus } from '../../chat/contracts/chat.interface';

@Entity('chats')
export class Chat {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  uuid!: string;

  @Index()
  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Column({ type: 'text' })
  question!: string;

  // Populated once the run completes — mirrors the sibling's experiments/results
  // split (Postgres holds the final state, Redis holds the live one).
  @Column({ type: 'jsonb', default: () => "'[]'" })
  contents!: ChatMessage[];

  @Column({ type: 'varchar', length: 20, default: 'running' })
  status!: ChatRunStatus;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
