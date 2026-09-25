import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('login_history')
export class LoginHistory {
  @PrimaryGeneratedColumn()
  id?: number;

  @Index()
  @Column({ name: 'user_id' })
  userId?: number;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress?: string;

  /** e.g. 'MacBook Pro', 'iPhone 15', 'Android' — used to pick a device icon client-side */
  @Column({ nullable: true })
  device?: string;

  @Column({ nullable: true })
  browser?: string;

  @Column({ name: 'login_status', type: 'enum', enum: ['success', 'failed'], default: 'success' })
  loginStatus?: 'success' | 'failed';

  @Column({ name: 'login_time', type: 'datetime', nullable: true })
  loginTime?: Date;

  @Column({ name: 'logout_time', type: 'datetime', nullable: true })
  logoutTime?: Date;

  @ManyToOne(() => User, (u) => u.loginHistory)
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
