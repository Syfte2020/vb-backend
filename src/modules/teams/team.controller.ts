import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseIntPipe,
  BadRequestException
} from '@nestjs/common';
import { TeamService } from './team.service';
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

import { CurrentUser } from '../../common/decorators/user.decorator';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';
import { getOwnerId } from '../../common/access/permissions';

@Controller('team')

export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  // ── Members list (grid/table + tabs + search + filters) ──
  @UseGuards(JwtAuthGuard)
  @Get('members')
  findMembers(@Query() query: QueryMembersDto, @CurrentUser() user: any) {
    return this.teamService.findMembers(query, getOwnerId(user));
  }

  // ── Stat cards + tab counts, computed server-side in one pass ──
  @UseGuards(JwtAuthGuard)
  @Get('members/stats')
  getStats( @CurrentUser() user: any) {
    return this.teamService.getStats(getOwnerId(user));
  }

  // ── Single member (MemberDrawer: overview/permissions/activity/venues/masked tabs) ──
  @UseGuards(JwtAuthGuard)
  @Get('members/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.teamService.findMemberById(id, getOwnerId(user));
  }

  // ── Add Member wizard (5-step) ──
  // @Post('members')
  // create(@Body() dto: CreateMemberDto) {
  //   return this.teamService.createMember(dto);
  // }
@UseGuards(JwtAuthGuard)
  @Post('members')
async createMember(
  @Body() dto: any,
  @CurrentUser() user: any
) {
  const ownerId = getOwnerId(user);

  return this.teamService.createMember(
    dto,
    ownerId,
  );
}

  @Get('roles')
  roles() {
    return this.teamService.roles();
  }

  @Get('permission-modules')
  permissionmodules() {
    return this.teamService.permissionmodules();
  }

  @Get('maskable-fields')
  maskableFields() {
    return this.teamService.maskableFields();
  }

  // ── Edit Member overlay (details / role / venues / access sections) ──
  @Patch('members/:id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.teamService.updateMember(id, dto);
  }

  // ── Suspend / Reactivate (row menu, drawer button) ──
  @Patch('members/:id/suspend')
  toggleSuspend(@Param('id') id: string) {
    return this.teamService.toggleSuspend(id);
  }

  // ── Per-member permission overrides (PermissionsOverlay) ──
  @Get('members/:id/permissions')
  getMemberPermissions(@Param('id') id: string) {
    return this.teamService.getMemberPermissions(id);
  }

  @Patch('members/:id/permissions')
  updateMemberPermissions(@Param('id') id: string, @Body() dto: UpdateMemberPermissionsDto) {
    return this.teamService.updateMemberPermissions(id, dto);
  }

  // ── Venues for the venue-access pickers (Add/Edit member, per-member venues tab) ──
  @UseGuards(JwtAuthGuard)
  @Get('venues')
  listVenues(@CurrentUser() user: any) {
    return this.teamService.listVenues(getOwnerId(user));
  }
@UseGuards(JwtAuthGuard)
  @Get('masking-rules')
async getMaskingRules( @CurrentUser() user: any) {
  return this.teamService.getMaskingRules(getOwnerId(user));
}

  // ── Role presets (RolePresetOverlay) ──
  @UseGuards(JwtAuthGuard)
  @Get('role-presets')
  listRolePresets(@CurrentUser() user: any) {
    return this.teamService.listRolePresets(getOwnerId(user));
  }
@UseGuards(JwtAuthGuard)
  @Get('role-presets/:rid/permissions')
  getRolePresetPermissions(@Param('rid') rid: number, @CurrentUser() user: any) {
    return this.teamService.getRolePresetPermissions(rid,getOwnerId(user));
  }
@UseGuards(JwtAuthGuard)
  @Post('role-presets')
  createRolePreset(@Body() dto: any, @CurrentUser() user: any,
) {
  return this.teamService.createRolePreset(
    dto,
    getOwnerId(user),
  );
}
@UseGuards(JwtAuthGuard)
  @Patch('role-presets/:rid')
  updateRolePresetInfo(@Param('rid') rid: number, @Body() dto: UpdateRolePresetInfoDto, @CurrentUser() user: any) {
    return this.teamService.updateRolePresetInfo(rid, dto,getOwnerId(user));
  }
@UseGuards(JwtAuthGuard)
  @Patch('role-presets/:rid/permissions')
  updateRolePresetPermissions(
    @Param('rid') rid: number,
    @Body() dto: UpdateRolePresetPermissionsDto,
    @CurrentUser() user: any
  ) {
    return this.teamService.updateRolePresetPermissions(rid, dto,getOwnerId(user));
  }
@UseGuards(JwtAuthGuard)
  @Post('role-presets/:rid/duplicate')
  duplicateRolePreset(@Param('rid') rid: number,@CurrentUser() user: any) {
    return this.teamService.duplicateRolePreset(rid,getOwnerId(user));
  }
@UseGuards(JwtAuthGuard)
  @Delete('role-presets/:rid')
  @HttpCode(HttpStatus.OK)
  deleteRolePreset(@Param('rid') rid: number,@CurrentUser() user: any) {
    return this.teamService.deleteRolePreset(rid,getOwnerId(user));
  }

  // ── Masking control panel (MaskedDataOverlay) ──
  // @Get('masking')
  // getMaskingRules(@CurrentUser() user: any) {
  //   return this.teamService.getMaskingRules(getOwnerId(user));
  // }

  @Patch('masking')
  updateMaskingRules(@Body() dto: UpdateMaskingRulesDto) {
    return this.teamService.updateMaskingRules(dto);
  }

  @Post('vendors/:ownerId/teams')
  createVendorTeam(
    @Param('ownerId', ParseIntPipe) ownerId: number,
    @Body('teamName') teamName?: string,
  ) {
    return this.teamService.createVendorTeam(ownerId, teamName);
  }

  @Post('vendors/:ownerId/teams/additional')
  createTeamForExistingVendor(
    @Param('ownerId', ParseIntPipe) ownerId: number,
    @Body('teamName') teamName: string,
  ) {
    return this.teamService.createTeamForExistingVendor(ownerId, teamName);
  }


@Post('login')
async teamLogin(@Body() dto: any) {
  const username = dto?.data?.username?.trim();
  const password = dto?.data?.password;

  if (!username) {
    throw new BadRequestException('Username is required');
  }

  if (!password) {
    throw new BadRequestException('Password is required');
  }

  return this.teamService.teamLogin(username, password);
}

@Get('verify-email')
async verifyEmail(@Query('token') token: string) {
 return this.teamService.verifyEmail(token);
}

@UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: any) {
  
    return this.teamService.findById(user.id); // me = logged-in member itself
 
  }


}