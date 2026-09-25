import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ConflictException,
  UnauthorizedException
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { MailService } from '../../mail/mail.service';
import { emailVerifyTemplate } from '../../common/email/templates/email-verify.template';


import { randomBytes } from 'crypto';

import {
  DEFAULT_TEAM_ROLES,
  ROLE_PERMISSION_MATRIX,
} from './permission-matrix';

import type { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.entity';
import { SystemRole } from './entities/system-role.entity';
import { SystemUserVenue } from './entities/system-user-venue.entity';
import { ActivityLog } from './entities/activity-log.entity';
import { LoginHistory } from './entities/login-history.entity';
import { Venue } from './entities/venue.entity';

import { QueryMembersDto } from './dto/query-members.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import {
  UpdateMemberPermissionsDto,
  UpdateMaskingRulesDto,
  CreateRolePresetDto,
  UpdateRolePresetInfoDto,
  UpdateRolePresetPermissionsDto,
} from './dto/permissions.dto';

import { toTeamMemberDto, TeamMemberDto } from './mappers/team-member.mapper';
import {
  MASKABLE_FIELDS,
  PERMISSION_MODULES,
  ROLE_DEFAULT_PERMISSIONS,
  RoleId,
  ActionKey,
  ModuleKey,
  ROLE_IDS
} from './constants/team.constants';



export interface CreateTeamResult {
  teamId: number;
  ownerId: number;
  rolesCreated: number;
  permissionsAssigned: boolean;
}

interface RawTeamMember {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: string;
  isOnline: boolean;
  lastLogin: Date | null;
  lastSeen: string | null;
  createdAt: string;
  inviteStatus: string;
}

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(SystemRole)
    private readonly systemRoleRepo: Repository<SystemRole>,
    @InjectRepository(SystemUserVenue)
    private readonly userVenueRepo: Repository<SystemUserVenue>,
    @InjectRepository(ActivityLog)
    private readonly activityLogRepo: Repository<ActivityLog>,
    @InjectRepository(LoginHistory)
    private readonly loginHistoryRepo: Repository<LoginHistory>,
    @InjectRepository(Venue) private readonly venueRepo: Repository<Venue>,
    private readonly dataSource: DataSource,

     private readonly jwtService: JwtService,
     private readonly mailService: MailService,
  ) {}

  async findMembers(query: QueryMembersDto, userId: number) {
    const page = Math.max(Number(query.page ?? 1), 1);
    const pageSize = Math.max(Number(query.pageSize ?? 20), 1);
    const offset = (page - 1) * pageSize;

    const rows = await this.dataSource.query(
      `
      SELECT
        u.id, u.name, u.email, u.mobile AS phone, u.status, u.is_online,
        u.last_login, u.last_seen, u.invite_status, u.created_at,
        tm.id AS team_member_id, tm.team_id, tm.user_id, tm.role_id,
        tm.status AS team_member_status, tm.login_access, tm.venue_access,
        tm.contact_method, tm.invite_token_expires_at, tm.invited_by,
        tm.created_at AS joined_at,
        ut.id AS user_team_id, ut.name AS team_name, ut.owner_id AS team_owner_id, ut.type AS team_type,
        sr.id AS system_role_id, sr.rid AS role, sr.name AS role_name,
        sr.description AS role_description, sr.level AS role_level
      FROM team_members tm
      INNER JOIN teams u ON u.id = tm.user_id
      INNER JOIN user_teams ut ON ut.id = tm.team_id
      LEFT JOIN system_roles sr ON sr.id = tm.role_id
      WHERE ut.owner_id = ?
      ORDER BY tm.created_at DESC
      LIMIT ?, ?
      `,
      [userId, offset, pageSize],
    );

    const [countRow] = await this.dataSource.query(
      `
      SELECT COUNT(*) AS total
      FROM team_members tm
      INNER JOIN teams u ON u.id = tm.user_id
      INNER JOIN user_teams ut ON ut.id = tm.team_id
      WHERE ut.owner_id = ?
      `,
      [userId],
    );

    const userTeams = await this.dataSource.query(
      `SELECT * FROM user_teams WHERE owner_id = ? ORDER BY id DESC`,
      [userId],
    );

    const memberIds = rows.map((u: any) => String(u.id));
    const maskMap = new Map<string, string[]>();
    if (memberIds.length) {
      const placeholders = memberIds.map(() => '?').join(', ');
      const maskRows: Array<{ target: string; field_key: string | null }> =
        await this.dataSource.query(
          `SELECT target, field_key FROM masking_rules WHERE scope = 'user' AND target IN (${placeholders})`,
          memberIds,
        );
      for (const row of maskRows) {
        const target = String(row.target);
        const list = maskMap.get(target) ?? [];
        if (row.field_key) list.push(row.field_key);
        maskMap.set(target, list);
      }
    }

    const members = rows.map((u: any) => {
      const id = String(u.id);
      const isMasked = maskMap.has(id);
      const explicitFields = maskMap.get(id) ?? [];

      return {
        id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role || null,
        roleName: u.role_name || null,
        status: u.status == 0 ? 'Suspended':(u.status == 1 ? 'Active':'Pending'),
        isOnline: Boolean(u.is_online),
        masked: isMasked,
        teamId: u.team_id ?? u.user_team_id ?? null,
        teamName: u.team_name || null,
        venues: [],
        lastActive: u.last_seen || 'Never',
        loginDevice: '—',
        loginLocation: '—',
        joinedAt: u.created_at
          ? new Date(u.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
          : '—',
        loginAccess: Boolean(u.login_access),
        venueAccessMode: u.venue_access,
        contactMethod: u.contact_method,
        maskedFields: isMasked
          ? explicitFields.length
            ? explicitFields
            : MASKABLE_FIELDS.map((f) => f.key)
          : [],
        recentActions: [],
        loginHistory: [],
        inviteStatus: u.invite_status || 'accepted',
      };
    });

    return {
      data: members,
      page,
      pageSize,
      user_teams: userTeams,
      total: Number(countRow?.total ?? 0),
    };
  }

  async getStats(ownerId: number) {
    const rows = await this.dataSource.query(
      `
      SELECT t.id, t.status, t.is_online, t.last_seen, ur.mask_data, sr.rid
      FROM teams t
      INNER JOIN team_members tm ON tm.user_id = t.id
      INNER JOIN user_teams ut ON ut.id = tm.team_id
      LEFT JOIN user_roles ur ON ur.user_id = t.id
      LEFT JOIN system_roles sr ON sr.id = ur.role_id
      WHERE ut.owner_id = ?
      `,
      [ownerId],
    );

    const isRecentlyOnline = (r: any) =>
      Boolean(r.is_online) ||
      (r.last_seen && Date.now() - new Date(r.last_seen).getTime() < 15 * 60 * 1000);

    return {
      total: rows.length,
      admins: rows.filter((r: any) => ['owner', 'admin'].includes(r.rid ?? '')).length,
      managers: rows.filter((r: any) => ['manager', 'operations', 'sales', 'finance'].includes(r.rid ?? '')).length,
      staff: rows.filter((r: any) => ['staff', 'viewer'].includes(r.rid ?? '')).length,
      activeToday: rows.filter(isRecentlyOnline).length,
      restricted: rows.filter((r: any) => !!r.mask_data).length,
      pending: rows.filter((r: any) => r.status === 'pending').length,
    };
  }

  async findMemberById(id: string, ownerId: number): Promise<TeamMemberDto> {
    const rows = await this.dataSource.query(
      `
      SELECT
        t.id, t.name, t.email, t.mobile AS phone, t.status,
        t.is_online, t.last_login, t.last_seen, t.invite_status, t.created_at
      FROM teams t
      INNER JOIN team_members tm ON tm.user_id = t.id
      INNER JOIN user_teams ut ON ut.id = tm.team_id
      WHERE t.id = ? AND ut.owner_id = ?
      LIMIT 1
      `,
      [id, ownerId],
    );

    if (!rows.length) throw new NotFoundException(`Member ${id} not found`);
    return this.buildMemberDto(this.mapTeamRow(rows[0]));
  }

  private async buildMemberDto(member: RawTeamMember): Promise<TeamMemberDto> {
    const [userRole, venues, recentActions, loginHistory] = await Promise.all([
      this.userRoleRepo.findOne({ where: { userId: member.id }, relations: ['role'] }),
      this.userVenueRepo.find({ where: { userId: member.id }, relations: ['venue'] }),
      this.activityLogRepo.find({ where: { userId: member.id }, order: { createdAt: 'DESC' }, take: 10 }),
      this.loginHistoryRepo.find({ where: { userId: member.id }, order: { loginTime: 'DESC' }, take: 10 }),
    ]);

    const maskedFields = userRole?.maskData ? await this.resolveMaskedFields(member.id) : [];

    return toTeamMemberDto({
      user: member as unknown as User,
      userRole: userRole
        ? { ...userRole, role: userRole.role ? { rid: userRole.role.rid ?? '' } : undefined }
        : undefined,
      venues: venues.map((v) => ({ ...v, venue: v.venue ? { name: v.venue.name ?? '' } : undefined })),
      recentActions,
      loginHistory,
      maskedFields,
    });
  }

  private mapTeamRow(row: any): RawTeamMember {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone ?? '',
      status: row.status ?? 'active',
      isOnline: Boolean(row.is_online),
      lastLogin: row.last_login ? new Date(row.last_login) : null,
      lastSeen: row.last_seen ?? null,
      createdAt: row.created_at,
      inviteStatus: row.invite_status ?? 'accepted',
    };
  }

  private async findTeamRow(id: number): Promise<any | null> {
    const rows = await this.dataSource.query(
      `
      SELECT id, name, email, mobile AS phone, status,
             is_online, last_login, last_seen, invite_status, created_at
      FROM teams
      WHERE id = ?
      LIMIT 1
      `,
      [id],
    );
    return rows[0] ?? null;
  }

  private async resolveMaskedFields(userId: number): Promise<string[]> {
    const rows: Array<{ field_key: string | null }> = await this.dataSource.query(
      `SELECT field_key FROM masking_rules WHERE scope = 'user' AND target = ?`,
      [String(userId)],
    );
    if (!rows.length) return [];
    const explicit = rows.map((r) => r.field_key).filter((k): k is string => k !== null);
    return explicit.length > 0 ? explicit : MASKABLE_FIELDS.map((f) => f.key);
  }

  async createMember(dto: any, ownerId: number) {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();

    try {
      const roles = await runner.query(
        `
        SELECT id, slug as rid, name
        FROM team_roles
        WHERE id = ?
        LIMIT 1
      `,
        [dto.role],
      );

      if (!roles.length) {
        throw new BadRequestException(`Unknown role "${dto.role}"`);
      }

      const systemRole = roles[0];
      console.log('System Role:', systemRole);

      if (dto.email) {
        const exists = await runner.query(
          `SELECT id FROM teams WHERE email = ? LIMIT 1`,
          [dto.email],
        );
        if (exists.length) {
          throw new BadRequestException('A member with this email already exists');
        }
      }

      const existingTeams = await runner.query(
        `
        SELECT id, owner_id, name, type
        FROM user_teams
        WHERE owner_id = ? AND type = 'vendor'
        LIMIT 1
        FOR UPDATE
      `,
        [ownerId],
      );

      if (!existingTeams.length) {
        throw new BadRequestException(`Vendor team not found for owner ${ownerId}`);
      }

      const team = existingTeams[0];
      const teamId = Number(team.id);
      console.log('Vendor Team:', team);

      const teamRoles = await runner.query(
        `
        SELECT tr.id, tr.team_id, tr.slug, tr.slug as rid, tr.name
        FROM team_roles tr
        WHERE tr.id = ?
        LIMIT 1
      `,
        [dto.role],
      );

      console.log('Team Role:', teamRoles);

      if (!teamRoles.length) {
        throw new BadRequestException(
          `Role ${systemRole.rid} does not belong to team fggfgfg ${teamId}`,
        );
      }

      const teamRole = teamRoles[0];
      console.log('Team Role:', teamRole);

      const teamMemberResult = await runner.query(
        `
        INSERT INTO teams
        (team_uuid, parent_venue_id, vendor_user_id, name, email, mobile, password, role_id, status, created_at, updated_at)
        VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
        [0, ownerId, dto.name, dto.email || null, dto.phone || null, '', systemRole.id, 0 ],
      );

      const userId = teamMemberResult.insertId;
      if (!userId) {
        throw new BadRequestException('Failed to create team member');
      }
      console.log('Created User ID:', userId);

      await runner.query(
        `
        INSERT INTO user_roles (user_id, role_id, auto_role, mask_data, created_at, updated_at)
        VALUES (?, ?, 0, 0, NOW(), NOW())
      `,
        [userId, systemRole.id],
      );

      const memberOptions = dto as CreateMemberDto & { loginAccess?: boolean; contactMethod?: string };

      await runner.query(
        `
        INSERT INTO team_members
        (team_id, user_id, role_id, status, login_access, venue_access, contact_method, invited_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `,
        [
          teamId,
          userId,
          teamRole.id,
          'pending',
          memberOptions.loginAccess ?? true,
          dto.venueAccess ?? 'selected',
          memberOptions.contactMethod ?? 'email',
          ownerId,
        ],
      );

      if (dto.venueAccess === 'selected' && Array.isArray(dto.venueIds) && dto.venueIds.length) {
        for (const venueId of dto.venueIds) {
          const numericVenueId = Number(venueId);
          if (!numericVenueId) continue;
          await runner.query(
            `INSERT INTO system_user_venues (user_id, venue_id) VALUES (?, ?)`,
            [userId, numericVenueId],
          );
        }
      }

      if (dto.venueAccess === 'all') {
        const venues = await runner.query(
          `SELECT child_venue_id FROM venue_child WHERE child_venue_id IS NOT NULL`,
        );
        for (const venue of venues) {
          await runner.query(
            `INSERT INTO system_user_venues (user_id, venue_id) VALUES (?, ?)`,
            [userId, venue.child_venue_id],
          );
        }
      }

      await runner.commitTransaction();

      const token = randomBytes(32).toString('hex');
      

await this.dataSource.query(
  `
  INSERT INTO team_email_verifications
  (user_id, token, expires_at)
  VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))
`,
  [userId, token],
);


//email 

const verifyUrl = `${process.env.APP_URL}/en/in/vendor/teams/verify-email?token=${token}`;

const html = emailVerifyTemplate(
  dto.name,
  verifyUrl,
);

await this.mailService.sendMail(
  dto.email,
  'Verify Your Email Address',
  html,
);

      const rows = await this.dataSource.query(
        `
        SELECT
          u.id, u.name, u.email, u.mobile AS phone, u.status, u.is_online,
          u.last_login, u.last_seen, u.invite_status, u.created_at, ur.mask_data, sr.rid
        FROM teams u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN system_roles sr ON sr.id = ur.role_id
        WHERE u.id = ?
        LIMIT 1
      `,
        [userId],
      );

      if (!rows.length) {
        throw new BadRequestException('Team member created but could not be fetched');
      }

      return this.buildMemberDtoFromRaw(rows[0]);


    } catch (error) {
      await runner.rollbackTransaction();
      this.logger.error(
        `Failed to create team member ${dto?.name ?? 'unknown'} for ownerId=${ownerId}`,
        error as Error,
      );
      throw error;
    } finally {
      await runner.release();
    }
  }

  async updateMember(id: string, dto: any): Promise<TeamMemberDto> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();

    try {
      const existing = await runner.query(`SELECT id FROM teams WHERE id = ? LIMIT 1`, [id]);
      if (!existing.length) throw new NotFoundException(`Member ${id} not found`);

      await runner.query(
        `
        UPDATE teams
        SET name = ?, email = ?, mobile = ?, status = ?, updated_at = NOW()
        WHERE id = ?
        `,
        [
          dto.name ?? null,
          dto.email ?? null,
          dto.phone ?? null,
          dto.status == 'suspended' ? 2 : dto.status == 'pending' ? 1 : 0,
          id,
        ],
      );

      if (dto.role) {
        const roles = await runner.query(
          `SELECT id FROM system_roles WHERE rid = ? OR name = ? LIMIT 1`,
          [dto.role, dto.role],
        );
        if (!roles.length) throw new BadRequestException(`Unknown role "${dto.role}"`);

        await runner.query(
          `UPDATE user_roles SET role_id = ?, updated_at = NOW() WHERE user_id = ?`,
          [roles[0].id, id],
        );
        await runner.query(`UPDATE team_members SET role_id = ? WHERE user_id = ?`, [roles[0].id, id]);
        await runner.query(`UPDATE teams SET role_id = ? WHERE id = ?`, [roles[0].id, id]);
      }

      if (dto.masked !== undefined) {
        await runner.query(
          `UPDATE user_roles SET mask_data = ?, updated_at = NOW() WHERE user_id = ?`,
          [dto.masked ? 1 : 0, id],
        );
      }

      const memberOptions = dto as UpdateMemberDto & {
        venueAccess?: 'all' | 'selected';
        loginAccess?: boolean;
        contactMethod?: string;
      };
      const venueAccess = memberOptions.venueAccess;

      if (
        venueAccess !== undefined ||
        memberOptions.loginAccess !== undefined ||
        memberOptions.contactMethod !== undefined
      ) {
        await runner.query(
          `
          UPDATE team_members
          SET venue_access = COALESCE(?, venue_access), login_access = COALESCE(?, login_access), contact_method = COALESCE(?, contact_method)
          WHERE user_id = ?
          `,
          [venueAccess ?? null, memberOptions.loginAccess ?? null, memberOptions.contactMethod ?? null, id],
        );
      }

      if (dto.venueIds) {
        await runner.query(`DELETE FROM system_user_venues WHERE user_id = ?`, [id]);

        if (venueAccess === 'selected') {
          for (const venueId of dto.venueIds) {
            await runner.query(
              `INSERT INTO system_user_venues (user_id, venue_id) VALUES (?, ?)`,
              [id, Number(venueId)],
            );
          }
        }

        if (venueAccess === 'all') {
          const venues = await runner.query(`SELECT child_venue_id FROM venue_child`);
          for (const venue of venues) {
            await runner.query(
              `INSERT INTO system_user_venues (user_id, venue_id) VALUES (?, ?)`,
              [id, venue.child_venue_id],
            );
          }
        }
      }

      await runner.commitTransaction();

      const rows = await this.dataSource.query(
        `
        SELECT
          u.id, u.name, u.email, u.mobile AS phone, u.status, u.is_online,
          u.last_login, u.last_seen, u.invite_status, u.created_at, ur.mask_data, sr.rid
        FROM teams u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN system_roles sr ON sr.id = ur.role_id
        WHERE u.id = ?
        `,
        [id],
      );

      return this.buildMemberDtoFromRaw(rows[0]);
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async toggleSuspend(id: string): Promise<TeamMemberDto> {
    const row = await this.findTeamRow(Number(id));
    if (!row) throw new NotFoundException(`Member ${id} not found`);

    const newStatus = row.status === 'suspended' ? 'active' : 'suspended';
    await this.dataSource.query(`UPDATE teams SET status = ?, updated_at = NOW() WHERE id = ?`, [newStatus, id]);

    return this.buildMemberDto(this.mapTeamRow({ ...row, status: newStatus }));
  }

  // ─────────────────────────────────────────────────────────────
  // PERMISSIONS  (per-member overrides — PermissionsOverlay)
  // ─────────────────────────────────────────────────────────────
  async updateMemberPermissions(id: string, dto: UpdateMemberPermissionsDto) {
    const teamId = Number(id);
    if (!Number.isInteger(teamId) || teamId <= 0) {
      throw new BadRequestException('Invalid member ID');
    }

    const [member] = await this.dataSource.query(
      `SELECT id, vendor_user_id FROM teams WHERE id = ? LIMIT 1`,
      [teamId],
    );
    if (!member) {
      throw new BadRequestException('Member not found');
    }

    const userId = Number(teamId);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new BadRequestException('Invalid user associated with this member');
    }

    const permissions = dto.permissions ?? {};
    if (typeof permissions !== 'object' || Array.isArray(permissions) || permissions === null) {
      throw new BadRequestException('Permissions must be an object');
    }

    const permissionEntries: Array<{ moduleKey: string; actionKey: string }> = [];
    for (const [moduleKey, actions] of Object.entries(permissions)) {
      if (!Array.isArray(actions)) {
        throw new BadRequestException(`Actions for module "${moduleKey}" must be an array`);
      }
      for (const action of actions) {
        if (typeof action !== 'string' || !action.trim()) {
          throw new BadRequestException(`Invalid action for module "${moduleKey}"`);
        }
        permissionEntries.push({ moduleKey: moduleKey.trim(), actionKey: action.trim() });
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(`DELETE FROM user_permissions WHERE user_id = ?`, [userId]);

      if (permissionEntries.length > 0) {
        for (const permission of permissionEntries) {
          await queryRunner.query(
            `
            INSERT INTO user_permissions (user_id, module_key, action_key, status, created_at, updated_at)
            VALUES (?, ?, ?, 'active', NOW(), NOW())
          `,
            [userId, permission.moduleKey, permission.actionKey],
          );
        }
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Member permissions updated successfully',
        data: { teamId, userId, permissions },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ROLE PRESETS  (RolePresetOverlay — reads/writes system_roles + system_role_permissions)
  // ─────────────────────────────────────────────────────────────
  /**
   * BUG FIX: this used to read from the global `system_roles` table,
   * which never contains a custom role — createRolePreset only ever
   * inserts into `team_roles` — and has no per-vendor scoping at all
   * (every vendor would see the same 8 built-in rows and nothing else).
   * Your Role Presets panel actually shows "12 presets · 6 custom" with
   * numeric ids matching `team_roles.id` (OneStaff/rttrt/rttrt/Test
   * administrative/Test Manager/wwew are the 6 custom rows), which this
   * old query could never produce. Every preset a vendor sees — built-in
   * AND custom — is a row in `team_roles` for their own team; that's
   * what this now lists, using the same resolveOwnerTeamId helper
   * createRolePreset already relies on.
   */
  async listRolePresets(ownerId: number) {
    const teamId = await this.resolveOwnerTeamId(ownerId);
    const roles = await this.dataSource.query(
      `
      SELECT id, slug, name, description, is_builtin
      FROM team_roles
      WHERE team_id = ?
      ORDER BY is_builtin DESC, name ASC
      `,
      [teamId],
    );

    /**
     * BUG FIX ("already set permission" but the Role Presets panel shows
     * every module 0/N unchecked): the frontend's PresetPermissionsView /
     * RolePresetOverlay never calls a separate "get permissions for this
     * preset" endpoint when you open one — openPermissions() reads
     * `preset.permissions` straight off whatever THIS list endpoint
     * returned, and only falls back to a blank/default set when that
     * field is missing:
     *
     *   editor.setPerms(
     *     preset.permissions && Object.keys(preset.permissions).length
     *       ? preset.permissions
     *       : buildDefaultPerms(preset.base)
     *   );
     *
     * This method never included a `permissions` field on each row, so
     * that condition was always false and every preset — including ones
     * you'd genuinely saved permissions for — took the empty fallback
     * branch. (buildDefaultPerms's own fallback is separately broken too,
     * since the frontend's `roles` list is built from these same preset
     * rows and inherits the same missing data — but the real fix is
     * simply to stop omitting the data here.) Fixed by embedding each
     * role's saved permissions using the same getTeamRolePermissions
     * helper getRolePresetPermissions already calls per-role, so the
     * list response now carries exactly what the frontend already
     * expected it to.
     */
    return Promise.all(
      roles.map(async (r: any) => ({
        id: Number(r.id),
        label: r.name,
        desc: r.description,
        base: r.slug,
        builtin: Boolean(r.is_builtin),
        custom: !r.is_builtin,
        permissions: await this.getTeamRolePermissions(
          Number(r.id),
          r.slug,
          Boolean(r.is_builtin),
        ),
      })),
    );
  }

  /**
   * BUG FIX (the "0/4, 0/3, 0/1 — nothing checked" bug in your
   * screenshot): this is what backs the Role Presets panel's checkbox
   * grid. It used to do `systemRoleRepo.findOne({ where: { rid } })` — a
   * lookup by the STRING `system_roles.rid` slug ("operations",
   * "finance", ...). But every other role-preset write below
   * (updateRolePresetInfo, updateRolePresetPermissions, deleteRolePreset)
   * already takes the NUMERIC `team_roles.id` the frontend actually sends
   * — the rolePresets payload you get back is `{ id: 4, label:
   * "Operations", base: "operations", ... }`, id numeric, base the slug.
   * Passing that same numeric id into this method's old string lookup can
   * never match a `rid` column, so it came back empty — exactly the
   * all-unchecked state for Operations. And even where the string lookup
   * WOULD have matched (Admin, by coincidence of also being called with
   * its slug somewhere), it still can't ever find a CUSTOM preset, since
   * those only exist in `team_roles`, never in `system_roles`. Fixed to
   * resolve the role the same way its siblings do — numeric id, scoped to
   * the caller's own team via findTeamRoleById — and reuse the existing
   * getTeamRolePermissions helper, which already knows how to fall back
   * to system_role_permissions for a BUILT-IN team role and read
   * team_role_permissions directly for a CUSTOM one.
   */
  async getRolePresetPermissions(rid: number, ownerId: number): Promise<Record<string, string[]>> {
    const teamId = await this.resolveOwnerTeamId(ownerId);
    const role = await this.findTeamRoleById(teamId, rid);
    if (!role) throw new NotFoundException(`Role "${rid}" not found`);
    return this.getTeamRolePermissions(role.id, role.slug, Boolean(role.is_builtin));
  }

  /**
   * Resolves the caller's own vendor team id from their ownerId — every
   * role-preset method below scopes its team_roles lookup through this,
   * both to find the right role and to stop one vendor from reading,
   * editing or deleting another vendor's role preset just by
   * guessing/incrementing a numeric id (the same class of IDOR already
   * fixed on getMemberPermissions). createRolePreset already ran this
   * exact query inline; refactored here so every role-preset method
   * shares one implementation.
   */
  private async resolveOwnerTeamId(ownerId: number): Promise<number> {
    const rows = await this.dataSource.query(
      `SELECT id FROM user_teams WHERE owner_id = ? LIMIT 1`,
      [ownerId],
    );
    const teamId = rows[0]?.id;
    if (!teamId) {
      throw new BadRequestException(`Vendor team not found for owner ${ownerId}`);
    }
    return Number(teamId);
  }

  /**
   * Ownership-scoped team_roles lookup by numeric id — shared by every
   * role-preset method below so a preset from someone else's team can
   * never be read, edited or deleted just by guessing/incrementing its
   * id in the URL.
   */
  private async findTeamRoleById(teamId: number, rid: number) {
    const rows = await this.dataSource.query(
      `
      SELECT id, team_id, slug, name, description, status, is_builtin
      FROM team_roles
      WHERE id = ? AND team_id = ?
      LIMIT 1
      `,
      [Number(rid), teamId],
    );
    return rows[0] ?? null;
  }

  // ORPHANED after the fix above: getRolePresetPermissions no longer calls
  // this (it uses getTeamRolePermissions instead). Left in place rather
  // than deleted in case something else still depends on it — grep your
  // codebase for `.getRolePermissions(` before removing it.
  private async getRolePermissions(roleDbId: number, rid: RoleId): Promise<Record<ModuleKey, ActionKey[]>> {
    const rows: Array<{ slug: string }> = await this.dataSource.query(
      `
      SELECT p.slug
      FROM system_role_permissions srp
      INNER JOIN permissions p ON p.id = srp.permission_id
      WHERE srp.role_id = ? AND srp.is_allowed = 1
      `,
      [roleDbId],
    );

    if (rows.length > 0) {
      const result: Record<string, ActionKey[]> = {};
      for (const mod of PERMISSION_MODULES) result[mod.key] = [];
      for (const { slug } of rows) {
        const [moduleKey, action] = slug.split('.');
        if (
          result[moduleKey] &&
          (PERMISSION_MODULES.find((m) => m.key === moduleKey)?.actions as readonly string[])?.includes(action)
        ) {
          result[moduleKey].push(action as ActionKey);
        }
      }
      return result as Record<ModuleKey, ActionKey[]>;
    }

    const defaults = ROLE_DEFAULT_PERMISSIONS[rid] ?? {};
    const result: Record<string, ActionKey[]> = {};
    for (const mod of PERMISSION_MODULES) {
      result[mod.key] = (defaults['*'] ?? defaults[mod.key] ?? []).filter((a) =>
        (mod.actions as readonly string[]).includes(a),
      );
    }
    return result as Record<ModuleKey, ActionKey[]>;
  }

  async createRolePreset(dto: any, UserId: number) {
    const teamId = await this.resolveOwnerTeamId(UserId);

    if (!dto?.baseRoleId) {
      throw new BadRequestException('A base role must be specified to create a preset from');
    }
    if (!dto?.label || !String(dto.label).trim()) {
      throw new BadRequestException('Role label is required');
    }

    const label = String(dto.label).trim();
    const baseRoleValue = String(dto.baseRoleId).trim();
    const numericBaseRoleId = Number(baseRoleValue);
    const hasNumericBaseRoleId = Number.isInteger(numericBaseRoleId) && numericBaseRoleId > 0;

    const baseRoleRows = await this.dataSource.query(
      `
        SELECT tr.id, tr.team_id, tr.slug, tr.name, tr.description, tr.status, tr.is_builtin,
               sr.id AS system_role_id, sr.rid AS system_role_rid
        FROM team_roles tr
        LEFT JOIN system_roles sr ON sr.rid = tr.slug
        WHERE tr.team_id = ? AND (tr.slug = ? OR tr.id = ?)
        LIMIT 1
      `,
      [Number(teamId), baseRoleValue, hasNumericBaseRoleId ? numericBaseRoleId : 0],
    );

    if (!baseRoleRows || baseRoleRows.length === 0) {
      throw new NotFoundException(`Base team role "${baseRoleValue}" not found`);
    }

    const baseRole = baseRoleRows[0];

    const slugBase =
      label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'custom_role';

    let slug = `${slugBase}_${Date.now()}`;

    let slugExists = await this.dataSource.query(
      `SELECT id FROM team_roles WHERE team_id = ? AND slug = ? LIMIT 1`,
      [Number(teamId), slug],
    );

    // BUG FIX: this loop used to reassign `slug = \`${slugBase}\`` on every
    // iteration — dropping the timestamp/counter that made it unique in
    // the first place — so it re-checked the EXACT SAME slug forever
    // whenever slugBase already existed for this team, an infinite loop.
    // `counter` now actually feeds into the candidate slug so each retry
    // is a genuinely new value.
    let counter = 1;
    while (slugExists && slugExists.length > 0) {
      slug = `${slugBase}_${Date.now()}_${counter}`;
      slugExists = await this.dataSource.query(
        `SELECT id FROM team_roles WHERE team_id = ? AND slug = ? LIMIT 1`,
        [Number(teamId), slug],
      );
      counter++;
    }

    const result = await this.dataSource.query(
      `
        INSERT INTO team_roles
        (team_id, slug, name, description, status, is_builtin, created_at, updated_at, created_by)
        VALUES (?, ?, ?, ?, 'active', 0, NOW(), NOW(), ?)
      `,
      [Number(teamId), label, label, dto.desc ?? null, UserId],
    );

    const newTeamRoleId = Number(result?.insertId);
    if (!newTeamRoleId) {
      throw new BadRequestException('Failed to create team role');
    }

    return {
      id: newTeamRoleId,
      label,
      desc: dto.desc ?? null,
      base: { id: Number(baseRole.id), slug: baseRole.slug, name: baseRole.name },
      custom: true,
      builtin: false,
    };
  }

  private async saveTeamRolePermissions(teamRoleId: number, permissions: Record<string, string[]>): Promise<void> {
    const allPermissions = await this.dataSource.query(`SELECT id, slug FROM permissions ORDER BY id`);

    await this.dataSource.query(`DELETE FROM system_role_permissions WHERE role_id = ?`, [Number(teamRoleId)]);

    if (!allPermissions || allPermissions.length === 0) {
      return;
    }

    const values: any[] = [];
    for (const permission of allPermissions) {
      const parts = String(permission.slug).split('.');
      if (parts.length < 2) continue;
      const moduleKey = parts[0];
      const actionKey = parts.slice(1).join('.');
      const allowed =
        Array.isArray(permissions?.[moduleKey]) && permissions[moduleKey].includes(actionKey) ? 1 : 0;
      values.push([Number(teamRoleId), Number(permission.id), allowed]);
    }

    for (const value of values) {
      await this.dataSource.query(
        `
          INSERT INTO system_role_permissions (role_id, permission_id, is_allowed, created_at)
          VALUES (?, ?, ?, NOW())
        `,
        value,
      );
    }
  }

  private async getTeamRolePermissions(
    teamRoleId: number,
    teamRoleSlug: string,
    isBuiltin: boolean,
  ): Promise<Record<string, string[]>> {
    const teamPermissionRows = await this.dataSource.query(
      `
        SELECT p.slug, trp.is_allowed
        FROM system_role_permissions trp
        INNER JOIN permissions p ON p.id = trp.permission_id
        WHERE trp.role_id = ? AND trp.is_allowed = 1
        ORDER BY p.slug
      `,
      [Number(teamRoleId)],
    );

    if (teamPermissionRows && teamPermissionRows.length > 0) {
      return this.permissionsToObject(teamPermissionRows);
    }

    if (isBuiltin) {
      const systemRoleRows = await this.dataSource.query(
        `SELECT id FROM system_roles WHERE rid = ? LIMIT 1`,
        [teamRoleSlug],
      );

      if (!systemRoleRows || systemRoleRows.length === 0) {
        return {};
      }

      const systemRoleId = Number(systemRoleRows[0].id);

      const permissionRows = await this.dataSource.query(
        `
          SELECT p.slug, srp.is_allowed
          FROM system_role_permissions srp
          INNER JOIN permissions p ON p.id = srp.permission_id
          WHERE srp.role_id = ? AND srp.is_allowed = 1
          ORDER BY p.slug
        `,
        [systemRoleId],
      );

      return this.permissionsToObject(permissionRows);
    }

    return {};
  }

  private permissionsToObject(rows: any[]): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const row of rows || []) {
      if (!row?.slug) continue;
      const parts = String(row.slug).split('.');
      if (parts.length < 2) continue;
      const moduleKey = parts[0];
      const actionKey = parts.slice(1).join('.');
      if (!result[moduleKey]) result[moduleKey] = [];
      if (!result[moduleKey].includes(actionKey)) result[moduleKey].push(actionKey);
    }
    return result;
  }

  /**
   * BUG FIX: looked up `system_roles` by numeric `id` — but a role
   * preset's numeric id is a `team_roles.id`, not a `system_roles.id`.
   * For a custom preset there's no `system_roles` row at all (this threw
   * NotFound for every one of your 6 custom presets); for a built-in
   * preset, `system_roles.id` and `team_roles.id` are separate
   * auto-increment sequences that can coincidentally collide, silently
   * renaming a totally unrelated built-in role. Now edits the team_roles
   * row directly, with the same ownership scoping as the other
   * role-preset methods.
   */
  async updateRolePresetInfo(rid: number, dto: UpdateRolePresetInfoDto, ownerId: number) {
    const teamId = await this.resolveOwnerTeamId(ownerId);
    const role = await this.findTeamRoleById(teamId, rid);
    if (!role) throw new NotFoundException(`Role "${rid}" not found`);

    await this.dataSource.query(
      `
      UPDATE team_roles
      SET name = COALESCE(?, name), description = COALESCE(?, description), updated_at = NOW()
      WHERE id = ?
      `,
      [dto.label ?? null, dto.description ?? null, role.id],
    );

    return {
      id: role.id,
      label: dto.label ?? role.name,
      desc: dto.description ?? role.description,
    };
  }

  /**
   * BUG FIX: same system_roles/team_roles id mismatch as above — this is
   * the "Save Changes" button in the Role Presets panel. Now resolves the
   * role via findTeamRoleById and saves through the existing
   * saveTeamRolePermissions helper (already used by createRolePreset),
   * so a save actually lands in team_role_permissions against the right
   * row instead of silently no-oping against a nonexistent/unrelated
   * system_roles id.
   */
  async updateRolePresetPermissions(rid: number, dto: UpdateRolePresetPermissionsDto, ownerId: number) {
    const teamId = await this.resolveOwnerTeamId(ownerId);
    const role = await this.findTeamRoleById(teamId, rid);
    if (!role) throw new NotFoundException(`Role "${rid}" not found`);
    if (!dto.permissions) throw new BadRequestException('permissions is required');

    await this.saveTeamRolePermissions(role.id, dto.permissions as Record<string, string[]>);
    return { success: true };
  }

  /** BUG FIX: same id-space mismatch — rewritten against team_roles, reusing
   * getTeamRolePermissions/saveTeamRolePermissions instead of the legacy
   * system_roles-only getRolePresetPermissions/savePresetPermissions pair. */
  async duplicateRolePreset(rid: number, ownerId: number) {
    const teamId = await this.resolveOwnerTeamId(ownerId);
    const role = await this.findTeamRoleById(teamId, rid);
    if (!role) throw new NotFoundException(`Role "${rid}" not found`);

    const perms = await this.getTeamRolePermissions(role.id, role.slug, Boolean(role.is_builtin));

    const dupLabel = `${role.name} (Copy)`;
    const slugBase =
      dupLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'custom_role';
    const dupSlug = `${slugBase}_${Date.now()}`;

    const result = await this.dataSource.query(
      `
      INSERT INTO team_roles (team_id, slug, name, description, status, is_builtin, created_at, updated_at, created_by)
      VALUES (?, ?, ?, ?, 'active', 0, NOW(), NOW(), ?)
      `,
      [teamId, dupSlug, dupLabel, role.description ?? null, ownerId],
    );

    const newId = Number(result?.insertId);
    if (!newId) throw new BadRequestException('Failed to duplicate role preset');

    await this.saveTeamRolePermissions(newId, perms);
    return { id: newId, label: dupLabel, desc: role.description ?? null };
  }

  /**
   * BUG FIX: two separate problems here, both from the same
   * system_roles/team_roles mismatch. (1) The "built-in roles cannot be
   * deleted" guard checked `rid.startsWith('custom_')` — but `rid` here
   * is a NUMBER (team_roles.id), never a string, so that check always
   * evaluated to false and let every delete through, built-in or not.
   * It now reads the real `is_builtin` column on the resolved team_roles
   * row. (2) The "member(s) still assigned" guard counted
   * `user_roles.role_id`, which — per createMember's own comment
   * elsewhere in this file — stores a `system_roles.id`, not a
   * `team_roles.id`; it now counts `team_members.role_id`, the column
   * that's actually a team_roles.id.
   */
  async deleteRolePreset(rid: number, ownerId: number) {
    const teamId = await this.resolveOwnerTeamId(ownerId);
    const role = await this.findTeamRoleById(teamId, rid);
    if (!role) throw new NotFoundException(`Role "${rid}" not found`);
    if (role.is_builtin) {
      throw new BadRequestException('Built-in roles cannot be deleted');
    }

    const [{ cnt }] = await this.dataSource.query(
      `SELECT COUNT(*) AS cnt FROM team_members WHERE role_id = ?`,
      [role.id],
    );
    if (Number(cnt) > 0) {
      throw new BadRequestException(`${cnt} member(s) still have this role assigned`);
    }

    await this.dataSource.query(`DELETE FROM system_role_permissions WHERE role_id = ?`, [role.id]);
    await this.dataSource.query(`DELETE FROM team_roles WHERE id = ?`, [role.id]);
    return { success: true };
  }

  // ORPHANED after the fix above: updateRolePresetPermissions/
  // duplicateRolePreset no longer call this (they use
  // saveTeamRolePermissions instead). Same note as getRolePermissions above.
  private async savePresetPermissions(roleDbId: number, perms: Record<ModuleKey, ActionKey[]>) {
    await this.dataSource.query(`DELETE FROM system_role_permissions WHERE role_id = ?`, [roleDbId]);

    const slugs: string[] = [];
    for (const [moduleKey, actions] of Object.entries(perms)) {
      for (const action of actions) slugs.push(`${moduleKey}.${action}`);
    }
    if (!slugs.length) return;

    const placeholders = slugs.map(() => '?').join(', ');
    await this.dataSource.query(
      `
      INSERT INTO system_role_permissions (role_id, permission_id, is_allowed, created_at)
      SELECT ?, p.id, 1, NOW() FROM permissions p
      WHERE p.slug IN (${placeholders})
      ON DUPLICATE KEY UPDATE is_allowed = VALUES(is_allowed)
      `,
      [roleDbId, ...slugs],
    );
  }

  async getMaskingRules(ownerId: number) {
    const permissionModules = await this.getPermissionModules();

    const roleRules: Record<string, { enabled: boolean; fields: string[] }> = {};
    for (const role of DEFAULT_TEAM_ROLES) {
      const rows: Array<{ field_key: string | null }> = await this.dataSource.query(
        `SELECT field_key FROM masking_rules WHERE scope = 'role' AND target = ?`,
        [role.slug],
      );
      roleRules[role.slug] = {
        enabled: rows.length > 0,
        fields: rows.map((r) => r.field_key).filter((k): k is string => k !== null),
      };
    }

    const members: Array<{ id: number }> = await this.dataSource.query(
      `
      SELECT tm.user_id AS id
      FROM teams t
      INNER JOIN team_members tm ON tm.team_id = t.id
      INNER JOIN user_teams ut ON ut.id = tm.team_id
      WHERE ut.owner_id = ?
      `,
      [ownerId],
    );

    const userRules: Record<string, { enabled: boolean; fields: string[] }> = {};
    for (const member of members) {
      const rows: Array<{ field_key: string | null }> = await this.dataSource.query(
        `SELECT field_key FROM masking_rules WHERE scope = 'user' AND target = ?`,
        [String(member.id)],
      );
      userRules[String(member.id)] = {
        enabled: rows.length > 0,
        fields: rows.map((r) => r.field_key).filter((k): k is string => k !== null),
      };
    }

    return { permissionModules, roleRules, userRules };
  }

  async getMemberPermissions(id: string) {
    const memberId = Number(id);
    if (!memberId) {
      throw new BadRequestException('Invalid member id');
    }

    const rows: Array<{ user_id: number; role_id: number; rid: string; role_name: string }> =
      await this.dataSource.query(
        `
        SELECT ur.user_id, ur.role_id, sr.rid, sr.name AS role_name
        FROM user_roles ur
        INNER JOIN system_roles sr ON sr.id = ur.role_id
        WHERE ur.user_id = ?
        LIMIT 1
        `,
        [memberId],
      );

    if (!rows.length) {
      throw new NotFoundException(`Member ${id} has no assigned role`);
    }

    const role = rows[0];

    const permissionRows: Array<{
      permission_id: number;
      slug: string;
      module_key: string | null;
      action_key: string | null;
      is_allowed: number;
    }> = await this.dataSource.query(
      `
      SELECT p.id AS permission_id, p.slug, p.module, srp.is_allowed
      FROM system_role_permissions srp
      INNER JOIN permissions p ON p.id = srp.permission_id
      WHERE srp.role_id = ? AND srp.is_allowed = 1
      `,
      [role.role_id],
    );

    const permissions: Record<string, string[]> = {};
    for (const row of permissionRows) {
      let moduleKey = row.slug;
      let actionKey = row.slug;

      if ((!moduleKey || !actionKey) && row.slug) {
        const parts = row.slug.split('.');
        moduleKey = parts[0] ?? null;
        actionKey = parts[1] ?? null;
      }
      if (!moduleKey || !actionKey) continue;
      if (!permissions[moduleKey]) permissions[moduleKey] = [];
      if (!permissions[moduleKey].includes(actionKey)) permissions[moduleKey].push(actionKey);
    }

    const permissionModules = await this.getPermissionModules();

    return {
      memberId,
      role: { id: role.rid, name: role.role_name, databaseId: role.role_id },
      permissionModules,
      permissions,
    };
  }

  async getPermissionModules() {
    const rows: Array<{ slug: string; module_key: string | null; action_key: string | null }> =
      await this.dataSource.query(`SELECT slug, module FROM permissions`);

    const modules: Record<string, string[]> = {};
    for (const row of rows) {
      let moduleKey = row.slug;
      let actionKey = row.slug;

      if ((!moduleKey || !actionKey) && row.slug) {
        const parts = row.slug.split('.');
        moduleKey = parts[0] ?? null;
        actionKey = parts[1] ?? null;
      }
      if (!moduleKey || !actionKey) continue;
      if (!modules[moduleKey]) modules[moduleKey] = [];
      if (!modules[moduleKey].includes(actionKey)) modules[moduleKey].push(actionKey);
    }

    return Object.entries(modules).map(([key, actions]) => ({ key, actions }));
  }

  async updateMaskingRules(dto: UpdateMaskingRulesDto) {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();

    try {
      const applyRules = async (
        scope: 'role' | 'user',
        rules: Record<string, { enabled?: boolean; fields?: string[] }>,
      ) => {
        for (const [target, rule] of Object.entries(rules)) {
          await runner.query(`DELETE FROM masking_rules WHERE scope = ? AND target = ?`, [scope, target]);
          if (!rule.enabled) continue;

          const fields = rule.fields ?? [];
          if (fields.length) {
            for (const field of fields) {
              await runner.query(
                `INSERT INTO masking_rules (scope, target, field_key) VALUES (?, ?, ?)`,
                [scope, target, field],
              );
            }
          } else {
            await runner.query(
              `INSERT INTO masking_rules (scope, target, field_key) VALUES (?, ?, NULL)`,
              [scope, target],
            );
          }
        }
      };

      if (dto.roleRules) await applyRules('role', dto.roleRules);

      if (dto.userRules) {
        await applyRules('user', dto.userRules);
        for (const [userId, rule] of Object.entries(dto.userRules)) {
          await runner.query(`UPDATE user_roles SET mask_data = ? WHERE user_id = ?`, [rule.enabled ? 1 : 0, userId]);
        }
      }

      await runner.commitTransaction();
      return { success: true };
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

 async listVenues(id: any) {
  return this.venueRepo.find({
    where: {
      createdBy: id,
    },
    order: {
      id: 'DESC',
    },
  });
}


  private buildMemberDtoFromRaw(row: any): TeamMemberDto {
    return {
      id: String(row.id),
      name: row.name,
      email: row.email,
      phone: row.phone ?? '',
      role: row.rid ?? 'viewer',
      status: row.status,
      isOnline: Boolean(row.is_online),
      masked: Boolean(row.mask_data),
      venues: [],
      lastActive: row.last_seen ?? row.last_login,
      loginDevice: '—',
      loginLocation: '—',
      joinedAt: String(new Date(row.created_at)),
      loginAccess: row.status !== 'suspended' && row.invite_status === 'accepted',
      maskedFields: [],
      recentActions: [],
      loginHistory: [],
      inviteStatus: row.invite_status ?? 'accepted',
    };
  }

  async roles() {
    const roleUI: Record<string, { color: string; icon: string }> = {
      owner: { color: 'amber', icon: 'Crown' },
      admin: { color: 'purple', icon: 'ShieldCheck' },
      manager: { color: 'blue', icon: 'Briefcase' },
      operations: { color: 'cyan', icon: 'Zap' },
      sales: { color: 'green', icon: 'BarChart2' },
      finance: { color: 'emerald', icon: 'DollarSign' },
      staff: { color: 'gray', icon: 'Users' },
      viewer: { color: 'slate', icon: 'Eye' },
    };

    const rows = await this.dataSource.query(`
      SELECT id, rid, name, description, level, status
      FROM system_roles
      WHERE status = 1
      ORDER BY level DESC
    `);

    return rows.map((role: any) => ({
      id: role.rid,
      label: role.name,
      color: roleUI[role.rid]?.color ?? 'gray',
      icon: roleUI[role.rid]?.icon ?? 'Users',
      level: Number(role.level),
      desc: role.description,
    }));
  }

  async permissionmodules() {
    return PERMISSION_MODULES;
  }

  async maskableFields() {
    return MASKABLE_FIELDS;
  }

  async createVendorTeam(ownerId: number, teamName = 'Vendor Team'): Promise<CreateTeamResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existing = await queryRunner.manager.query(
        `
        SELECT id, owner_id
        FROM user_teams
        WHERE owner_id = ? AND type = 'vendor'
        LIMIT 1
        FOR UPDATE
      `,
        [ownerId],
      );

      if (existing.length > 0) {
        const team = existing[0];
        await queryRunner.commitTransaction();
        return { teamId: team.id, ownerId: team.owner_id, rolesCreated: 0, permissionsAssigned: false };
      }

      const result = await this.createTeamWithRolesAndPermissions(queryRunner, ownerId, teamName, 'vendor');
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create vendor team for ownerId=${ownerId}`, error as Error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async createTeamForExistingVendor(ownerId: number, teamName: string): Promise<CreateTeamResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await this.createTeamWithRolesAndPermissions(queryRunner, ownerId, teamName, 'vendor');
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create team for ownerId=${ownerId}`, error as Error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async createTeamWithRolesAndPermissions(
    queryRunner: QueryRunner,
    ownerId: number,
    teamName: string,
    type: string,
  ): Promise<CreateTeamResult> {
    const teamResult = await queryRunner.manager.query(
      `INSERT INTO user_teams (name, owner_id, type, created_at) VALUES (?, ?, ?, NOW())`,
      [teamName, ownerId, type],
    );
    const teamId: number = teamResult.insertId;

    for (const role of DEFAULT_TEAM_ROLES) {
      await queryRunner.manager.query(
        `
        INSERT INTO team_roles (team_id, name, slug, description, created_by, status, is_builtin)
        VALUES (?, ?, ?, ?, ?, 'active', 1)
        `,
        [teamId, role.name, role.slug, role.description, ownerId],
      );
    }

    const teamRoles: Array<{ id: number; slug: string }> = await queryRunner.manager.query(
      `SELECT id, slug FROM team_roles WHERE team_id = ?`,
      [teamId],
    );

    for (const teamRole of teamRoles) {
      const mapping = ROLE_PERMISSION_MATRIX[teamRole.slug];
      if (!mapping) {
        this.logger.warn(`No permission mapping for role slug "${teamRole.slug}", skipping`);
        continue;
      }

      const [systemRole] = await queryRunner.manager.query(
        `SELECT id FROM system_roles WHERE rid = ? LIMIT 1`,
        [teamRole.slug],
      );
      if (!systemRole) {
        this.logger.warn(`No system_roles row for rid "${teamRole.slug}" — skipping permission seed`);
        continue;
      }

      if (mapping === 'ALL') {
        await queryRunner.manager.query(
          `
          INSERT INTO system_role_permissions (role_id, permission_id, is_allowed, created_at)
          SELECT ?, p.id, 1, NOW() FROM permissions p
          ON DUPLICATE KEY UPDATE is_allowed = VALUES(is_allowed)
          `,
          [systemRole.id],
        );
      } else {
        const placeholders = mapping.map(() => '?').join(', ');
        await queryRunner.manager.query(
          `
          INSERT INTO system_role_permissions (role_id, permission_id, is_allowed, created_at)
          SELECT ?, p.id, 1, NOW() FROM permissions p
          WHERE p.slug IN (${placeholders})
          ON DUPLICATE KEY UPDATE is_allowed = VALUES(is_allowed)
          `,
          [systemRole.id, ...mapping],
        );
      }
    }

    return { teamId, ownerId, rolesCreated: teamRoles.length, permissionsAssigned: true };
  }



async teamLogin(
  username: string,
  password: string,
) {
  if (!username || !password) {
    throw new BadRequestException(
      'Username and password are required',
    );
  }

  const identifier = username.trim();

  const rows = await this.dataSource.query(
    `
      SELECT
        t.id,
        t.team_uuid,
        t.name,
        t.email,
        t.mobile,
        t.password,
        t.status,
        t.is_online,
        t.last_login,
        t.last_seen,
        t.invite_status,

        tm.team_id,
        tm.role_id AS team_role_id,
        tm.login_access,
        tm.venue_access,
        tm.contact_method,

        tr.slug AS role_slug,
        tr.name AS role_name

      FROM teams t

      INNER JOIN team_members tm
        ON tm.user_id = t.id

      LEFT JOIN team_roles tr
        ON tr.id = tm.role_id

      WHERE
        LOWER(t.email) = LOWER(?)
        OR t.mobile = ?

      LIMIT 1
    `,
    [identifier, identifier],
  );

  if (!rows || rows.length === 0) {
    throw new UnauthorizedException(
      'Invalid username or password',
    );
  }

  const user = rows[0];

  // Suspended user
  if (
    user.status === 'suspended' ||
    user.status === 0
  ) {
    throw new UnauthorizedException(
      'Your account has been suspended',
    );
  }

  // Login access disabled
  if (
    user.login_access === 0 ||
    user.login_access === false
  ) {
    throw new UnauthorizedException(
      'Login access is disabled',
    );
  }

  // Password not configured
  if (!user.password) {
    throw new UnauthorizedException(
      'Password is not configured for this account',
    );
  }

  const passwordValid = await bcrypt.compare(
    password,
    user.password,
  );

  if (!passwordValid) {
    throw new UnauthorizedException(
      'Invalid username or password',
    );
  }

  // Update login information
  await this.dataSource.query(
    `
      UPDATE teams
      SET
        is_online = 1,
        last_login = NOW(),
        last_seen = NOW(),
        updated_at = NOW()
      WHERE id = ?
    `,
    [user.id],
  );

  // Login history
  // await this.dataSource.query(
  //   `
  //     INSERT INTO login_history
  //     (
  //       user_id,
  //       login_time
  //     )
  //     VALUES (?, NOW())
  //   `,
  //   [user.id],
  // );

  // ACCESS TOKEN
// const token = this.jwtService.sign({
//   id: user.id,
// });

const token = this.jwtService.sign(
  {
    sub: user.id,
    id: user.id,
    is_team: true,
    owner_id: user.vendor_user_id,
  type: 'team',
  },
  { secret: process.env.JWT_SECRET as string, expiresIn: '7d' },
);


  return {
    success: true,
    message: 'Login successful',
accessToken:token,
    user: {
      id: user.id,
      teamUuid: user.team_uuid,
      name: user.name,
      email: user.email,
      mobile: user.mobile,

      role: user.role_slug,
      roleName: user.role_name,

      status: user.status,
      inviteStatus: user.invite_status,

      loginAccess: Boolean(user.login_access),
      venueAccess: user.venue_access,
    },
  };
}

async verifyEmail(token:any)
{
  const rows = await this.dataSource.query(
    `
    SELECT *
    FROM team_email_verifications
    WHERE token = ?
      AND verified_at IS NULL
      AND expires_at > NOW()
    LIMIT 1
    `,
    [token],
  );

  if (!rows.length) {
    return {
      success: false,
      message: 'Verification link is invalid or expired',
    };
  }

  await this.dataSource.query(
    `
    UPDATE teams
    SET email_verified = 1,
        email_verified_at = NOW()
    WHERE id = ?
    `,
    [rows[0].user_id],
  );

  await this.dataSource.query(
    `
    UPDATE team_email_verifications
    SET verified_at = NOW()
    WHERE id = ?
    `,
    [rows[0].id],
  );

  return {
    success: true,
    message: 'Email verified successfully',
  };
}

async findById(id: string) {
  const [member] = await this.dataSource.query(
    `
    SELECT
      t.id,
      t.name,
      t.email,
      t.mobile as phone,
      t.status,
      t.created_at,

      t.vendor_user_id  AS owner_id,
      v.vendor_id,
      v.name       AS vendor_name,
      v.logo       AS avatar,

      r.id         AS role_id,
      r.name       AS role_name

    FROM teams t
    INNER JOIN users v    ON v.id = t.vendor_user_id
    LEFT JOIN team_roles r ON r.id = t.role_id

    WHERE t.id = ?
    LIMIT 1
    `,
    [id],
  );

  if (!member) return null;

  // ==========================================================
  // ROLE PERMISSIONS + USER (MEMBER) PERMISSIONS
  // ==========================================================
  const [rolePermissionRows, userPermissionRows] = await Promise.all([
    member.role_id
      ? this.dataSource.query(
          `
          SELECT p.name
          FROM system_role_permissions rp
          INNER JOIN permissions p ON p.id = rp.permission_id
          WHERE rp.role_id = ?
          `,
          [member.role_id],
        )
      : Promise.resolve([]),

    this.dataSource.query(
      `
      SELECT p.name
      FROM user_permissions tp
      INNER JOIN permissions p ON p.module = tp.module_key
      WHERE tp.user_id = ?
      `,
      [id],
    ),
  ]);

  const rolePermissions: string[] = rolePermissionRows.map((r) => r.name);
  const userPermissions: string[] = userPermissionRows.map((r) => r.name);

  const { role_id, role_name, ...profile } = member;

  return {
    ...profile,
    account_type: 'team',
    is_team: true,
    is_vendor: 1,

    role: role_id ? { id: role_id, name: role_name } : null,
    role_permissions: rolePermissions,
    user_permissions: userPermissions,

    // Effective permissions = role + member-specific, de-duplicated
    permissions: [...new Set([...rolePermissions, ...userPermissions])],
  };
}
}