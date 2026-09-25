import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { SystemRole } from './system-role.entity';

@Entity('user_roles')
export class UserRole {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ name: 'user_id' })
  userId?: number;

  @Column({ name: 'role_id' })
  roleId?: number;

  /** true if the role was auto-assigned (e.g. default on signup) vs manually set. */
  @Column({ name: 'auto_role', type: 'tinyint', default: 0 })
  autoRole?: boolean;

  /** Master switch: does data masking apply to this user at all. */
  @Column({ name: 'mask_data', type: 'tinyint', default: 0 })
  maskData?: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;

  @ManyToOne(() => User, (user) => user.userRole)
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ManyToOne(() => SystemRole, (role) => role.userRoles)
  @JoinColumn({ name: 'role_id' })
  role?: SystemRole;
}
