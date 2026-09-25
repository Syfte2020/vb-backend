import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { SystemRole } from './system-role.entity';
import { Permission } from './permission.entity';

@Entity('system_role_permissions')
export class SystemRolePermission {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ name: 'role_id' })
  roleId?: number;

  @Column({ name: 'permission_id' })
  permissionId?: number;

  @Column({ name: 'is_allowed', type: 'tinyint', default: 0 })
  isAllowed?: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date;

  @ManyToOne(() => SystemRole, (role) => role.permissions)
  @JoinColumn({ name: 'role_id' })
  role?: SystemRole;

  @ManyToOne(() => Permission)
  @JoinColumn({ name: 'permission_id' })
  permission?: Permission;
}
