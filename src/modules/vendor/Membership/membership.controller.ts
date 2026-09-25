import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { MembershipService } from './membership.service';
// import { AuthGuard } from '../auth/auth.guard';   // ← your existing guard

import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';

/**
 * venuebook.in — Membership endpoints.
 * Paths match the frontend contract in services/membership.service.js.
 * Assumes your AuthGuard puts the logged-in user on req.user ({ id, vendor_id, name, email, phone }).
 */

const vendorId = (req: any): number => Number(req.user?.vendor_id ?? req.user?.id);
const customer = (req: any) => ({
  id: Number(req.user?.id),
  name: req.user?.name,
  email: req.user?.email,
  phone: req.user?.phone,
});

/* ───────── vendor dashboard ───────── */

// @UseGuards(AuthGuard)
@Controller('membership') // vendor guard must also require the `membership.manage` permission → 403
export class VendorMembershipController {
  constructor(private readonly membership: MembershipService) {}

  // program
  @UseGuards(JwtAuthGuard)
  @Get('program')
  getProgram(@CurrentUser() user: any) {
    return this.membership.getMembershipProgram(user?.id);
  }
 @UseGuards(JwtAuthGuard)
  @Put('program')
  saveProgram(@CurrentUser() user: any, @Body() body: any) {
    return this.membership.saveMembershipProgram(user?.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('overview')
  overview(@CurrentUser() user: any) {
    return this.membership.getMembershipOverview(user?.id);
  }

  // tiers
  @UseGuards(JwtAuthGuard)
  @Get('tiers')
  listTiers(@CurrentUser() user: any, @Query('include_archived') includeArchived?: string) {
    return this.membership.listMembershipTiers(user?.id, includeArchived === 'true' || includeArchived === '1');
  }

  @UseGuards(JwtAuthGuard)
  @Post('tiers')
  createTier(@CurrentUser() user: any, @Body() body: any) {
    return this.membership.createMembershipTier(user?.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Put('tiers/reorder')
  reorderTiers(@CurrentUser() user: any, @Body() body: { ids: (number | string)[] }) {
    return this.membership.reorderMembershipTiers(user?.id, body?.ids ?? []);
  }

  @UseGuards(JwtAuthGuard)
  @Put('tiers/:id')
  updateTier(@CurrentUser() user: any, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.membership.updateMembershipTier(user?.id, id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('tiers/:id/archive')
  archiveTier(@CurrentUser() user: any, @Param('id', ParseIntPipe) id: number) {
    return this.membership.setTierArchived(user?.id, id, true);
  }

  @UseGuards(JwtAuthGuard)
  @Post('tiers/:id/restore')
  restoreTier(@CurrentUser() user: any, @Param('id', ParseIntPipe) id: number) {
    return this.membership.setTierArchived(user?.id, id, false);
  }

  // venue access
  @UseGuards(JwtAuthGuard)
  @Get('venues')
  listVenues(@CurrentUser() user: any) {
    return this.membership.listMembershipVenues(user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('venues/:venueId/access')
  saveVenueAccess(@CurrentUser() user: any, @Param('venueId') venueId: string, @Body() body: any) {
    return this.membership.saveMembershipVenueAccess(user?.id, venueId, body);
  }

  // members
  @UseGuards(JwtAuthGuard)
  @Get('members')
  listMembers(@CurrentUser() user: any, @Query() query: any) {
    return this.membership.listMembershipMembers(user?.id, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('members/:id')
  getMember(@CurrentUser() user: any, @Param('id', ParseIntPipe) id: number) {
    return this.membership.getMembershipMember(user?.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('members')
  createMember(@CurrentUser() user: any, @Body() body: any) {
    return this.membership.createMembershipMember(user?.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('members/:id')
  updateMember(@CurrentUser() user: any, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.membership.updateMembershipMember(user?.id, id, body);
  }


  // booking form: lookup + OTP (declared before members/:id)
   @UseGuards(JwtAuthGuard)
  @Get('members/lookup')
  lookupMember(@CurrentUser() user: any, @Query('number') number: string, @Query('venue_ids') venueIds?: string) {
    const ids = String(venueIds ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    return this.membership.lookupMemberForBooking(user?.id, number, ids);
  }
  @UseGuards(JwtAuthGuard)
  @Post('members/:id/otp/send')
  sendOtp(@CurrentUser() user: any, @Param('id', ParseIntPipe) id: number) {
    return this.membership.sendMemberOtp(user?.id, id);
  }
  @UseGuards(JwtAuthGuard)
  @Post('members/:id/otp/verify')
  verifyOtp(@CurrentUser() user: any, @Param('id', ParseIntPipe) id: number, @Body() body: { otp: string }) {
    return this.membership.verifyMemberOtp(user?.id, id, body?.otp);
  }
 
 
}

/* ───────── customer ───────── */

@Controller('membership')
export class CustomerMembershipController {
  constructor(private readonly membership: MembershipService) {}

  // public — no login needed
  @Get('public/tiers')
  publicTiers(@Query('vendor_id') vendor?: string, @Query('venue_id') venue?: string) {
    return this.membership.listPublicMembershipTiers({
      vendor_id: vendor ? Number(vendor) : undefined,
      venue_id: venue ? Number(venue) : undefined,
    });
  }

  // @UseGuards(AuthGuard)
  @Get('me')
  mine(@Req() req) {
    return this.membership.getMyMemberships(customer(req).id);
  }

  // @UseGuards(AuthGuard)
  @Get('eligibility/:venueId')
  eligibility(@Req() req, @Param('venueId', ParseIntPipe) venueId: number) {
    return this.membership.getVenueEligibility(customer(req).id, venueId);
  }

  // @UseGuards(AuthGuard)
  @Post('purchase')
  startPurchase(@Req() req, @Body() body: any) {
    return this.membership.startMembershipPurchase(customer(req), body);
  }

  // @UseGuards(AuthGuard)
  @Post('purchase/verify')
  verifyPurchase(@Req() req, @Body() body: any) {
    return this.membership.verifyMembershipPurchase(customer(req), body);
  }
}