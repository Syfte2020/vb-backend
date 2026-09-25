// import {
//   Controller,
//   Get,
//   UseGuards,
//   Param,
//   Put,
//   Req,
//   Patch,
//   Post,
//   Body,
//   Query,
//   Delete,
//   Headers,
//   ParseIntPipe,
//   BadRequestException
// } from '@nestjs/common';

// import { VendorDashboardService } from './vendor_dashboard.service';

// import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
// import { CurrentUser } from '../../../common/decorators/user.decorator';

//   import { ListShiftBlocksQueryDto } from './dto/shift blocks.query.dto';
// import { ToggleShiftBlockDto } from './dto/toggle-shift-block.dto';

// @Controller('vendor-dashboard')
// export class VendorDashboardController {
//   constructor(
//     private readonly vendorDashboardService: VendorDashboardService,
//   ) {}

//   @UseGuards(JwtAuthGuard)
//   @Post('dashboard')
//   revenue_amount(@CurrentUser() user: any, @Body() body: any) {
//     return this.vendorDashboardService.getDashboard(user?.id, body);
//   }
//   @UseGuards(JwtAuthGuard)
//   @Get('calendar/occupancy')
//   occupancy(@CurrentUser() user: any, @Query() query: any) {
//     return this.vendorDashboardService.occupancy(user?.id, query);
//   }

//   @UseGuards(JwtAuthGuard)
//   @Get('venueList')
//   venueList(@CurrentUser() user: any, @Headers('x-category') category: number,) {
//     return this.vendorDashboardService.venueList(user?.id,category);
//   }
//   @UseGuards(JwtAuthGuard)
//   @Post('calendar')
//   async calendar(@CurrentUser() user: any, @Body() query: any) {
//     const userId = user?.id;

//     return {
//       success: true,
//       data: await this.vendorDashboardService.calendar(userId, query),
//     };
//   }
//   @UseGuards(JwtAuthGuard)
//   @Get('subscriptionDetails')
//   subscriptionDetails(@CurrentUser() user: any) {
//     return this.vendorDashboardService.subscriptionDetails(user?.id);
//   }

//   @UseGuards(JwtAuthGuard)
//   @Post('revenue')
//   async getRevenue(
//     @CurrentUser() user: any,

//     @Body('parentVenueId') parentVenueId?: string,
//     @Body('venueId') childVenueId?: string,
//     @Body('bookingType') bookingType?: string,
//     @Body('category') category?: string,
//     @Body('countryId') countryId?: string,
//     @Body('bookingEventTypeId') bookingEventTypeId?: string,
//     @Body('bookingStatus') bookingStatus?: string,
//     @Body('filters') filters?: any,
//   ) {
//     return this.vendorDashboardService.getdashboardRevenue(user?.id, {
//       parentVenueId: parentVenueId ? Number(parentVenueId) : undefined,
//       childVenueId: childVenueId ? childVenueId : undefined,
//       bookingType: bookingType || undefined,
//       category: category || undefined,
//       countryId: countryId ? Number(countryId) : undefined,
//       bookingEventTypeId: bookingEventTypeId
//         ? Number(bookingEventTypeId)
//         : undefined,
//       bookingStatus: bookingStatus || undefined,
//     });
//   }
//   @UseGuards(JwtAuthGuard)
//   @Post('eventsDetails')
//   getEventRevenue(@CurrentUser() user: any , @Body() body:any) {
//     return this.vendorDashboardService.getEventRevenue(user?.id,body);
//   } 
  
//   @UseGuards(JwtAuthGuard)
//   @Post('lead_sources')
//   getLeadSourcesAndVenueBook(@CurrentUser() user: any , @Body() body:any) {
//     return this.vendorDashboardService.getLeadSourcesAndVenueBook(user?.id,body);
//   }
//   @UseGuards(JwtAuthGuard) 
//   @Post('action_required')
//   action_required(@CurrentUser() user: any,@Body() body: any,) {
//     return this.vendorDashboardService.action_required(user?.id,body);
//   }

//     @UseGuards(JwtAuthGuard)
//   @Get('leads_piplines')
//   leads_piplines(@CurrentUser() user: any) {
//     return this.vendorDashboardService.leads_piplines(user?.id);
//   }

//   @Post('calendar_setting')
//   async calendarSetting(
//     @Body()
//     body: {
//       venueId: string;
//       date: string;
//       mode?: string;
//     },
//   ) {
//     return this.vendorDashboardService.calendarSetting(body);
//   }

//  @UseGuards(JwtAuthGuard) 
//     @Get()
//   list(
//     @Param('venueId', ParseIntPipe) venueId: number,
//     @Query() query: ListShiftBlocksQueryDto,
//     @CurrentUser() user: any
//   ) {

//     if (!query.from || !query.to) {
//   throw new BadRequestException('from and to are required');
// }

// return this.vendorDashboardService.listBlocks(
//   venueId,
// user?.id,
//   query.from,
//   query.to,
// );
//     //return this.vendorDashboardService.listBlocks(venueId, user?.id, query.from, query.to);
//   }
 
//   /**vendor-dashboard/venues/a0da0bdf-51b9-40b5-9a79-4ee4f62629a5/calendar/blocks/toggle
//    * POST /vendor/venues/:venueId/calendar/blocks/toggle
//    * Body: { date, shiftKey, blocked, reason? }
//    * Called from onToggleShiftDisabled — see calendarBlock.service.js on the
//    * frontend for the matching client call.
//    */
//   @UseGuards(JwtAuthGuard) 
//   @Post('venues/:venueId/calendar/blocks/toggle')
//   toggle(
//     @Param('venueId') venueId: any,
//     @Body() dto: any,
//      @CurrentUser() user: any
//   ) {
//     return this.vendorDashboardService.toggleBlock(venueId, user?.id, dto);
//   }





// }
import {
  Controller,
  Get,
  UseGuards,
  Param,
  Post,
  Body,
  Query,
  Headers,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

import { VendorDashboardService } from './vendor_dashboard.service';

import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';

import { PermissionsGuard } from '../../../common/access/permissions.guard';
import { Permissions } from '../../../common/access/permissions.decorator';
import { PERMISSIONS, getOwnerId } from '../../../common/access/permissions';

import { ListShiftBlocksQueryDto } from './dto/shift blocks.query.dto';

@Controller('vendor-dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VendorDashboardController {
  constructor(private readonly vendorDashboardService: VendorDashboardService) {}

  // ================= DASHBOARD =================

  @Post('dashboard')
  @Permissions(PERMISSIONS.DASHBOARD_VIEW)
  revenue_amount(@CurrentUser() user: any, @Body() body: any) {
    return this.vendorDashboardService.getDashboard(getOwnerId(user), body);
  }

  @Post('revenue')
  @Permissions(PERMISSIONS.DASHBOARD_VIEW)
  async getRevenue(
    @CurrentUser() user: any,
    @Body('parentVenueId') parentVenueId?: string,
    @Body('venueId') childVenueId?: string,
    @Body('bookingType') bookingType?: string,
    @Body('category') category?: string,
    @Body('countryId') countryId?: string,
    @Body('bookingEventTypeId') bookingEventTypeId?: string,
    @Body('bookingStatus') bookingStatus?: string,
  ) {
    return this.vendorDashboardService.getdashboardRevenue(getOwnerId(user), {
      parentVenueId: parentVenueId ? Number(parentVenueId) : undefined,
      childVenueId: childVenueId ? childVenueId : undefined,
      bookingType: bookingType || undefined,
      category: category || undefined,
      countryId: countryId ? Number(countryId) : undefined,
      bookingEventTypeId: bookingEventTypeId ? Number(bookingEventTypeId) : undefined,
      bookingStatus: bookingStatus || undefined,
    });
  }

  @Post('eventsDetails')
  @Permissions(PERMISSIONS.DASHBOARD_VIEW)
  getEventRevenue(@CurrentUser() user: any, @Body() body: any) {
    return this.vendorDashboardService.getEventRevenue(getOwnerId(user), body);
  }

  @Post('lead_sources')
  @Permissions(PERMISSIONS.DASHBOARD_VIEW)
  getLeadSourcesAndVenueBook(@CurrentUser() user: any, @Body() body: any) {
    return this.vendorDashboardService.getLeadSourcesAndVenueBook(getOwnerId(user), body);
  }

  @Post('action_required')
  @Permissions(PERMISSIONS.DASHBOARD_VIEW)
  action_required(@CurrentUser() user: any, @Body() body: any) {
    return this.vendorDashboardService.action_required(getOwnerId(user), body);
  }

  @Get('leads_piplines')
  @Permissions(PERMISSIONS.DASHBOARD_VIEW)
  leads_piplines(@CurrentUser() user: any) {
    return this.vendorDashboardService.leads_piplines(getOwnerId(user));
  }

  // ================= CALENDAR =================

  @Post('calendar')
  @Permissions(PERMISSIONS.CALENDAR_VIEW)
  async calendar(@CurrentUser() user: any, @Body() query: any) {
    return {
      success: true,
      data: await this.vendorDashboardService.calendar(getOwnerId(user), query),
    };
  }

  @Get('calendar/occupancy')
  @Permissions(PERMISSIONS.CALENDAR_VIEW)
  occupancy(@CurrentUser() user: any, @Query() query: any) {
    return this.vendorDashboardService.occupancy(getOwnerId(user), query);
  }

  @Get('venueList')
  venueList(@CurrentUser() user: any, @Headers('x-category') category: string) {
    return this.vendorDashboardService.venueList(getOwnerId(user), category);
  }

  @Post('calendar_setting')
  @Permissions(PERMISSIONS.CALENDAR_VIEW)
  async calendarSetting(@Body() body: { venueId: string; date: string; mode?: string }) {
    return this.vendorDashboardService.calendarSetting(body);
  }

  @Get('venues/:venueId/calendar/blocks')
  @Permissions(PERMISSIONS.CALENDAR_VIEW)
  list(
    @CurrentUser() user: any,
    @Param('venueId') venueId: any,
    @Query() query: ListShiftBlocksQueryDto,
  ) {
    if (!query.from || !query.to) {
      throw new BadRequestException('from and to are required');
    }
    return this.vendorDashboardService.listBlocks(venueId, getOwnerId(user), query.from, query.to);
  }

  @Post('venues/:venueId/calendar/blocks/toggle')
  @Permissions(PERMISSIONS.CALENDAR_EDIT)
  toggle(@CurrentUser() user: any, @Param('venueId') venueId: any, @Body() dto: any) {
    return this.vendorDashboardService.toggleBlock(venueId, getOwnerId(user), dto);
  }

  // ================= VENDOR ONLY =================

  @Get('subscriptionDetails')
  subscriptionDetails(@CurrentUser() user: any) {
    if (user?.is_team) {
      throw new ForbiddenException('Only vendor can access subscription details');
    }
    return this.vendorDashboardService.subscriptionDetails(user?.id);
  }
}