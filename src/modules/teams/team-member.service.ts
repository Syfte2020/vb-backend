import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { MailService } from '../../mail/mail.service';
import { AddTeamMemberDto } from './dto/add-team-member.dto';

const TEAM_MEMBER_GLOBAL_ROLE_ID = 2; // "vendor/team member" in the global `roles` table
const INVITE_TOKEN_TTL_HOURS = 168;   // 7 days



export interface AddTeamMemberResult {
  success: true;
  userId: number;
  teamMemberId: number;
  inviteToken: string; // raw token — only used to send the email below; never stored raw
  emailSent: boolean;
}

@Injectable()
export class TeamMemberService {
  private readonly logger = new Logger(TeamMemberService.name);

  constructor(private readonly dataSource: DataSource ,
    private readonly mailService: MailService,
  ) {}

  async addTeamMember(
    dto: any,
    invitedByUserId: number,
    countryId: number, // team members inherit the vendor's own country
  ): Promise<AddTeamMemberResult> {

    console.log('-------------Start-------------')
    if (!dto.body?.name || !dto.body?.email || !dto.body?.role) {
      throw new BadRequestException('name, email and role are required');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const teamId = dto.body.teamId;

    try {
      // 1. The role id must belong to THIS team — never trust it blindly
      // (this is the same team-isolation rule from the RBAC design earlier).
      const roleRows: Array<{ id: number }> = await queryRunner.manager.query(
        `SELECT id FROM team_roles WHERE id = ? AND team_id = ?`,
        [dto.body.role, teamId],
      );
      if (!roleRows.length) {
        throw new BadRequestException(`Role ${dto.body.role} does not belong to team ${teamId}`);
      }

        const teamRows: Array<{ name: string }> = await queryRunner.manager.query(
        `SELECT name FROM user_teams WHERE id = ?`,
        [teamId],
      );
      const teamName = teamRows[0]?.name || 'your team';

      // 2. Find or create the user. An existing user (e.g. already on another
      // vendor's team) is reused rather than duplicated.
      let userId: number;
      const existingUser: Array<{ id: number }> = await queryRunner.manager.query(
        `SELECT id FROM users WHERE email = ?`,
        [dto.email],
      );

      if (existingUser.length) {
        userId = existingUser[0].id;
      } else {
        // No password yet — a random, unusable placeholder is stored so a
        // login attempt can never succeed before the invite is accepted.
        const placeholderPassword = await bcrypt.hash(crypto.randomUUID(), 10);

        const userResult = await queryRunner.manager.query(
          `INSERT INTO users (name, email, password, phone, country)
           VALUES (?, ?, ?, ?, ?)`,
          [dto.body.name, dto.body.email, placeholderPassword, dto.body.phone || null, countryId],
        );
        userId = userResult.insertId;
      }

      // 3. Global role: vendor-side team member, not a customer.
      await queryRunner.manager.query(
        `INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)`,
        [userId, TEAM_MEMBER_GLOBAL_ROLE_ID],
      );

      // 4. Team membership + team-scoped role + invite token.
      const rawInviteToken = crypto.randomBytes(32).toString('hex');
      const inviteTokenHash = crypto.createHash('sha256').update(rawInviteToken).digest('hex');
      const inviteExpiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_HOURS * 60 * 60 * 1000);

      await queryRunner.manager.query(
        `INSERT INTO team_members
           (team_id, user_id, role_id, status, login_access, venue_access,
            contact_method, invite_token_hash, invite_token_expires_at, invited_by)
         VALUES (?, ?, ?, 'invited', ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           role_id = VALUES(role_id),
           login_access = VALUES(login_access),
           venue_access = VALUES(venue_access),
           contact_method = VALUES(contact_method)`,
        [
          teamId, userId, dto.body.role, dto.body.loginAccess ?? true, dto.body.venueAccess,
          dto.body.contactMethod || null, inviteTokenHash, inviteExpiresAt, invitedByUserId,
        ],
      );

      // ON DUPLICATE KEY UPDATE doesn't give us insertId reliably on the
      // "already a member" path, so look the row up explicitly.
      const memberRow: Array<{ id: number }> = await queryRunner.manager.query(
        `SELECT id FROM team_members WHERE team_id = ? AND user_id = ?`,
        [teamId, userId],
      );
      const teamMemberId = memberRow[0].id;

      // 5. Per-member permission overrides, layered on top of the role's
      // own defaults in system_role_permissions.
      if (dto.body.permissions && Object.keys(dto.body.permissions).length) {
        const permissions = dto.body.permissions as Record<string, string[]>;

const slugs = Object.entries(permissions).flatMap(
  ([module, actions]) =>
    actions.map((action) => `${module}.${action}`),
);

        if (slugs.length) {
          const placeholders = slugs.map(() => '?').join(', ');
          const permRows: Array<{ id: number }> = await queryRunner.manager.query(
            `SELECT id FROM permissions WHERE slug IN (${placeholders})`,
            slugs,
          );

          for (const perm of permRows) {
            await queryRunner.manager.query(
              `INSERT INTO team_member_permissions (team_member_id, permission_id, is_allowed)
               VALUES (?, ?, 1)
               ON DUPLICATE KEY UPDATE is_allowed = VALUES(is_allowed)`,
              [teamMemberId, perm.id],
            );
          }
        }
      }

      // 6. Venue access — rows only when restricted; "all" means no rows,
      // i.e. unrestricted.
      if (dto.venueAccess === 'selected' && dto.venues?.length) {
        const placeholders = dto.venues.map(() => '?').join(', ');
        const venueRows: Array<{ id: number; name: string }> = await queryRunner.manager.query(
          `SELECT id, name FROM venues WHERE team_id = ? AND name IN (${placeholders})`,
          [teamId, ...dto.venues],
        );

        const matchedNames = new Set(venueRows.map((v) => v.name));
        const unmatched = dto.venues.filter((n) => !matchedNames.has(n));
        if (unmatched.length) {
          this.logger.warn(`Could not resolve venue names for team ${teamId}: ${unmatched.join(', ')}`);
        }

        for (const venue of venueRows) {
          await queryRunner.manager.query(
            `INSERT IGNORE INTO team_venue_access (team_member_id, venue_id) VALUES (?, ?)`,
            [teamMemberId, venue.id],
          );
        }
      }

      await queryRunner.commitTransaction();

      // TODO: send the invite email, e.g. mailService.sendTeamInvite(dto.email, rawInviteToken)
       let emailSent = true;
      try {
        await this.mailService.sendTeamInviteEmail({
          to: dto.body.email,
          name: dto.body.name,
          teamName,
          token: rawInviteToken,
        });
      } catch (mailError) {
        // The member is already created — a failed email shouldn't fail the
        // request. Log it so it's visible, and let the caller know so the
        // UI can offer a "resend invite" action later.
        emailSent = false;
        this.logger.error(
          `Team member ${teamMemberId} created but invite email to ${dto.body.email} failed to send`,
          mailError as Error,
        );
      }

      return { success: true, userId, teamMemberId, inviteToken: rawInviteToken, emailSent };
  
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to add team member ${dto?.email} to team ${teamId}`, error as Error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}