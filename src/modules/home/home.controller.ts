// import { Controller, Get, UseGuards, Headers, Query,Post,Body } from '@nestjs/common';
// import { HomeService } from './home.service';

// import { JwtAuthGuard } from '../../modules/auth/strategies/jwt-auth.guard';
// import { CurrentUser } from '../../common/decorators/user.decorator';

// @Controller('home')
// export class HomeController {
//   constructor(private homeService: HomeService) {}

//   @Get()
//   getHome() {
//     return this.homeService.getHomePageData();
//   }
//   @UseGuards(JwtAuthGuard)
//   @Get('recent_views')
//   getUserRecentViews(
//     @CurrentUser() user: any,
//     @Headers('x-category') category: any,
//   ) {
//     const userId = user?.id;
//     return this.homeService.getUserRecentViews(userId, category);
//   }

//   @UseGuards(JwtAuthGuard)
//   @Get('vendor_category')
//   vendor_category(
//     @CurrentUser() user: any,
//     @Headers('x-country') country: any,
//   ) {
//     const userId = user?.id;
//     return this.homeService.vendor_category(userId, country);
//   }

//   @Get('recommeded')
//   recommeded_property(
//     @Headers('x-country') country: any,
//     @Query('lat') lat: number,
//     @Query('lng') lng: number,
//     @Query('state') state: string,
//     @Headers('x-category') category: any,
//   ) {
//     // const userId = user?.id;

//     console.log(state);
//     return this.homeService.recommeded_property(state, category);
//   }

//   @Get('topDestination')
//   async getNearbyCities(@Query('state') state: string) {
//     return this.homeService.getNearbyCities(state);
//   }
//    @UseGuards(JwtAuthGuard)
//   @Get('find_your_tier')
//   async find_your_tier( @CurrentUser() user: any,) {
//     return this.homeService.find_your_tier(user?.id);
//   }

//   @Post("search")
// async searchVenues(@Body() body: any) {
//   return this.homeService.searchVenues(body);
// }
// }


import {
  Controller,
  Get,
  UseGuards,
  Headers,
  Query,
  Post,
  Body,
  ForbiddenException,
} from '@nestjs/common';
import { HomeService } from './home.service';

import { JwtAuthGuard } from '../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';

import { PermissionsGuard } from '../../common/access/permissions.guard';
import { getOwnerId } from '../../common/access/permissions';

@Controller('home')
export class HomeController {
  constructor(private homeService: HomeService) {}

  /* ─────────────────────────────
     PUBLIC (no login needed)
  ───────────────────────────── */

  @Get()
  getHome() {
    return this.homeService.getHomePageData();
  }

  @Get('recommeded')
  recommeded_property(
    @Query('state') state: string,
    @Headers('x-category') category: any,
  ) {
    return this.homeService.recommeded_property(state, category);
  }

  @Get('topDestination')
  async getNearbyCities(@Query('state') state: string) {
    return this.homeService.getNearbyCities(state);
  }

  @Post('search')
  async searchVenues(@Body() body: any) {
    return this.homeService.searchVenues(body);
  }

  /* ─────────────────────────────
     VENDOR + TEAM
     Used by the vendor layout on every page, so every team member
     can call it (no @Permissions). Team → loads the vendor's categories.
  ───────────────────────────── */

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('vendor_category')
  vendor_category(
    @CurrentUser() user: any,
    @Headers('x-country') country: any,
  ) {
    return this.homeService.vendor_category(getOwnerId(user), country);
  }

  /* ─────────────────────────────
     CUSTOMER ONLY (team members blocked)
  ───────────────────────────── */

  @UseGuards(JwtAuthGuard)
  @Get('recent_views')
  getUserRecentViews(
    @CurrentUser() user: any,
    @Headers('x-category') category: any,
  ) {
    if (user?.is_team) {
      throw new ForbiddenException('Team members cannot access this');
    }
    return this.homeService.getUserRecentViews(user?.id, category);
  }

  @UseGuards(JwtAuthGuard)
  @Get('find_your_tier')
  async find_your_tier(@CurrentUser() user: any) {
    if (user?.is_team) {
      throw new ForbiddenException('Team members cannot access this');
    }
    return this.homeService.find_your_tier(user?.id);
  }
}