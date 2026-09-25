import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';
import type { ModuleKey, ActionKey } from '../constants/team.constants';

/**
 * ASSUMPTION: system_role_permissions.permission_id needs to resolve to a
 * (module, action) pair — e.g. ('reservations', 'approve') — to build the
 * per-module toggle grid the frontend renders (PERMISSION_MODULES).
 * If you already store module/action directly on system_role_permissions,
 * delete this entity and add `module`/`action` columns there instead.
 *
 * NOTE: module/action are string-literal union types (compile-time only),
 * so we give @Column an explicit `type: 'varchar'` instead of letting
 * emitDecoratorMetadata try to reflect the (erased) union type at runtime.
 */
@Entity('permissions')
@Unique(['module', 'action'])
export class Permission {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ type: 'varchar' })
  module?: ModuleKey;

  @Column({ type: 'varchar' })
  action?: ActionKey;
}