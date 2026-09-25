import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from './user-role.entity';
import { SystemRolePermission } from './system-role-permission.entity';

@Entity('system_roles')
export class SystemRole {
  @PrimaryGeneratedColumn()
  id?: number;

  /** Stable slug, e.g. 'owner' | 'admin' | 'manager' ... matches frontend ROLES[].id */
  @Column({ unique: true })
  rid?: string;

  /** Display label, e.g. "Operations" */
  @Column()
  name?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  /** 0-100, drives the frontend's "access level" progress bar. */
  @Column({ type: 'int', default: 0 })
  level?: number;

  @Column({ type: 'enum', enum: ['active', 'inactive'], default: 'active' })
  status?: 'active' | 'inactive';

  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;

  @OneToMany(() => UserRole, (ur) => ur.role)
  userRoles?: UserRole[];

  @OneToMany(() => SystemRolePermission, (p) => p.role)
  permissions?: SystemRolePermission[];
}
