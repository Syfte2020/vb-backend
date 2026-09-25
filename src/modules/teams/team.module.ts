import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TeamController } from './team.controller';
import { TeamService } from './team.service';

import { RoleCatalogController } from './role-catalog.controller';
import { RoleCatalogService } from './role-catalog.service';

import { TeamMemberController } from './team-member.controller';
import { TeamMemberService } from './team-member.service';

import { JwtModule } from '@nestjs/jwt';
import { MailService } from '../../mail/mail.service';


import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.entity';
import { SystemRole } from './entities/system-role.entity';
import { SystemRolePermission } from './entities/system-role-permission.entity';
import { SystemUserVenue } from './entities/system-user-venue.entity';
import { ActivityLog } from './entities/activity-log.entity';
import { LoginHistory } from './entities/login-history.entity';
import { Venue } from './entities/venue.entity';
import { Permission } from './entities/permission.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      
      User,
      UserRole,
      SystemRole,
      SystemRolePermission,
      SystemUserVenue,
      ActivityLog,
      LoginHistory,
      Venue,
      Permission,

    ]),
     JwtModule.register({
      secret: process.env.JWT_SECRET || 'secretKey',
      signOptions: { expiresIn: '3650d' },
    }),
  ],
  controllers: [TeamController,RoleCatalogController,TeamMemberController],
  providers: [TeamService,RoleCatalogService,TeamMemberService,MailService],
  exports: [TeamService,RoleCatalogService,TeamMemberService,MailService],
})
export class TeamModule {}
