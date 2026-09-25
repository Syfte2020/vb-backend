import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface PermissionModuleDto {
  key: string;
  actions: string[];
}

export interface RolePresetDto {
  id: string;      // role slug
  label: string;   // role name
  base: string;    // base_slug, or the role's own slug for builtins
  custom: boolean;
  builtin: boolean;
  desc: string | null;
}

// role slug -> module key -> allowed actions
export type RolePermissionsDto = Record<string, Record<string, string[]>>;

@Injectable()
export class RoleCatalogService {
  constructor(private readonly dataSource: DataSource) {}

  /** Modules + their available actions, derived from permissions.slug (e.g. "reservations.view" -> module "reservations", action "view"). */
  async getPermissionModules(): Promise<PermissionModuleDto[]> {
    const rows: Array<{ module: string; slug: string }> = await this.dataSource.query(
      `SELECT module, slug FROM permissions ORDER BY module, id`,
    );

    const byModule = new Map<string, string[]>();
    for (const row of rows) {
      const action = row.slug.split('.').pop() as string;
      const actions = byModule.get(row.module) ?? [];
      if (!actions.includes(action)) actions.push(action);
      byModule.set(row.module, actions);
    }

    return Array.from(byModule.entries()).map(([key, actions]) => ({ key, actions }));
  }

  /** The roles available for one team: the builtins plus any custom roles created for it. */
  async getRolePresets(teamId: number): Promise<RolePresetDto[]> {
    const rows: Array<{
      id: string;
      slug: string;
      name: string;
      description: string | null;
      is_builtin: number;
      base_slug: string | null;
    }> = await this.dataSource.query(
      `SELECT id,slug, name, description, is_builtin, base_slug
       FROM team_roles
       WHERE team_id = ?
       ORDER BY is_builtin DESC, name ASC`,
      [teamId],
    );

    return rows.map((r) => ({
      id: r.id,
      label: r.name,
      base: r.base_slug ?? r.slug,
      custom: !r.is_builtin,
      builtin: !!r.is_builtin,
      desc: r.description,
    }));
  }

  /**
   * Each role's actual assigned permissions for this team, grouped by module.
   * This is the real, always-current equivalent of ROLE_DEFAULT_PERMISSIONS —
   * it intentionally does NOT compress to a "*" wildcard shorthand, since that
   * was a hand-maintained frontend convenience, not a real DB concept, and
   * would silently go stale the moment a module is added or a role edited.
   */
  async getRolePermissions(teamId: number): Promise<RolePermissionsDto> {
    const rows: Array<{ role_slug: string; module: string; action_slug: string }> =
      await this.dataSource.query(
        `SELECT tr.slug AS role_slug, p.module AS module, p.slug AS action_slug
         FROM system_role_permissions srp
         JOIN team_roles tr ON tr.id = srp.role_id
         JOIN permissions p ON p.id = srp.permission_id
         WHERE tr.team_id = ? AND srp.is_allowed = 1`,
        [teamId],
      );

    const result: RolePermissionsDto = {};
    for (const row of rows) {
      const action = row.action_slug.split('.').pop() as string;
      result[row.role_slug] ??= {};
      result[row.role_slug][row.module] ??= [];
      result[row.role_slug][row.module].push(action);
    }
    return result;
  }

  /** Convenience: everything the team management page needs, in one round trip. */
  async getRoleCatalog(teamId: number) {
    const [permissionModules, rolePresets, rolePermissions] = await Promise.all([
      this.getPermissionModules(),
      this.getRolePresets(teamId),
      this.getRolePermissions(teamId),
    ]);
    return { permissionModules, rolePresets, rolePermissions };
  }
}