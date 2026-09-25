import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { TeamMemberService } from './team-member.service';
import { AddTeamMemberDto } from './dto/add-team-member.dto';


@Controller('teams/members')
export class TeamMemberController {
  constructor(private readonly teamMemberService: TeamMemberService) {}

  @Post('')
  async addMember(
    
    @Body() dto: any, // replace with a proper AddMemberDto class + class-validator if you use one elsewhere
    // @CurrentUser() currentUser — plug in whatever gives you the authenticated vendor's id/country,
    // same open question as the useCurrentUser hook earlier
  ) {
    const invitedByUserId = 1;   // TODO(dev-stub): replace with the authenticated vendor's user id
      // TODO(dev-stub): replace with the authenticated vendor's country id
    const countryId = 1;          // TODO(dev-stub): replace with the authenticated vendor's country id
    return this.teamMemberService.addTeamMember(dto, invitedByUserId, countryId);
  }
}