import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  OneToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from './user-role.entity';
import { SystemUserVenue } from './system-user-venue.entity';
import { ActivityLog } from './activity-log.entity';
import { LoginHistory } from './login-history.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  name?: string;

  @Column({ name: 'vendor_id', nullable: true })
  vendorId?: number;

  @Column({ nullable: true })
  logo?: string;

  @Column({ name: 'role_id', nullable: true })
  roleId?: number;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: number;

  @Column({ unique: true })
  email?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ nullable: true })
  state?: string;

  @Column({ nullable: true })
  country?: string;

  /** e.g. 'vendor' | 'staff' | 'system' — distinct from system_roles.rid */
  @Column({ name: 'role_type', nullable: true })
  roleType?: string;

  @Column({ select: false })
  password?: string;

  @Column({ name: 'is_online', type: 'tinyint', default: 0 })
  isOnline?: boolean;

  @Column({ name: 'last_login', type: 'datetime', nullable: true })
  lastLogin?: Date | null;

  @Column({ name: 'last_logout', type: 'datetime', nullable: true })
  lastLogout?: Date | null;

  @Column({ name: 'last_seen', type: 'datetime', nullable: true })
  lastSeen?: Date | null;

  @Column({ name: 'socket_id', nullable: true })
  socketId?: string;

  /**
   * ASSUMPTION: not present in the tables you listed. The frontend needs a
   * lifecycle status (active/suspended/pending) independent of is_online.
   * Add this column (or map it from wherever it actually lives) —
   * e.g. `status enum('active','suspended','pending') default 'pending'`.
   */
  @Column({ type: 'enum', enum: ['active', 'suspended', 'pending'], default: 'pending' })
  status?: 'active' | 'suspended' | 'pending';

  /** ASSUMPTION: tracks invite lifecycle for members who haven't logged in yet. */
  @Column({ name: 'invite_status', type: 'enum', enum: ['invited', 'accepted', 'expired'], default: 'accepted' })
  inviteStatus?: 'invited' | 'accepted' | 'expired';

  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;

  @OneToOne(() => UserRole, (userRole) => userRole.user)
  userRole?: UserRole;

  @OneToMany(() => SystemUserVenue, (v) => v.user)
  venueAssignments?: SystemUserVenue[];

  @OneToMany(() => ActivityLog, (a) => a.user)
  activityLogs?: ActivityLog[];

  @OneToMany(() => LoginHistory, (l) => l.user)
  loginHistory?: LoginHistory[];
}
