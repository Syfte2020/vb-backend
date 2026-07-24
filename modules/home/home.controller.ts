import { Controller, Get, UseGuards, Headers, Query } from '@nestjs/common';
import { HomeService } from './home.service';

import { JwtAuthGuard } from '../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';

@Controller('home')
export class HomeController {
  constructor(private homeService: HomeService) {}

  @Get()
  getHome() {
    return this.homeService.getHomePageData();
  }
  @UseGuards(JwtAuthGuard)
  @Get('recent_views')
  getUserRecentViews(
    @CurrentUser() user: any,
    @Headers('x-category') category: any,
  ) {
    const userId = user?.id;
    return this.homeService.getUserRecentViews(userId, category);
  }

  @UseGuards(JwtAuthGuard)
  @Get('vendor_category')
  vendor_category(
    @CurrentUser() user: any,
    @Headers('x-country') country: any,
  ) {
    const userId = user?.id;
    return this.homeService.vendor_category(userId, country);
  }

  @Get('recommeded')
  recommeded_property(
    @Headers('x-country') country: any,
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('state') state: string,
    @Headers('x-category') category: any,
  ) {
    // const userId = user?.id;

    console.log(state);
    return this.homeService.recommeded_property(state, category);
  }

  @Get('topDestination')
  async getNearbyCities(@Query('state') state: string) {
    return this.homeService.getNearbyCities(state);
  }
}
