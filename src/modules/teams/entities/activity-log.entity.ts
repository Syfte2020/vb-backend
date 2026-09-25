import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('activity_logs')
export class ActivityLog {
  @PrimaryGeneratedColumn()
  id?: number;

  @Index()
  @Column({ name: 'user_id' })
  userId?: number;

  /** e.g. 'reservations', 'finance' — usually matches a PERMISSION_MODULES key */
  @Column()
  module?: string;

  /** e.g. 'edit', 'approve', 'export', 'create', 'view' */
  @Column()
  action?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'reference_type', nullable: true })
  referenceType?: string;

  @Column({ name: 'reference_id', nullable: true })
  referenceId?: number;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress?: string;

  @Column({ name: 'module_id', nullable: true })
  moduleId?: number;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @Column({ name: 'user_agent', nullable: true, type: 'text' })
  userAgent?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date;

  @ManyToOne(() => User, (u) => u.activityLogs)
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
