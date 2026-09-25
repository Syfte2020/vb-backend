import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  UseGuards,
  Param,
  Get,
} from '@nestjs/common';
import { VenueService } from './venue.service';
import { VenueFilterDto } from './dto/VenueFilterDto.dto';
import { JwtAuthGuard } from '../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';

@Controller('listing')
export class VenueController {
  constructor(private readonly venueService: VenueService) {}

  @Post()
  getVenues(
    @Body() filters: VenueFilterDto,
    @Headers('x-country') country: number,
  ) {
    return this.venueService.getVenuesPageData(filters, country);
  }
  @UseGuards(JwtAuthGuard)
  @Post('save_wishlist_category')
  async save_wishlist_category(
    @Body() body: any,
    @CurrentUser() user: any,
    @Headers('x-country') country: number,
    @Headers('x-category') category: number,
  ) {
    const userId = user?.id;

    console.log('Logged in user:', userId);
    return this.venueService.saveWishlistCategory(
      body,
      userId,
      country,
      category,
    );
  }
  @UseGuards(JwtAuthGuard)
  @Get('UserWishlistCategory')
  async UserWishlistCategory(
    @CurrentUser() user: any,
    @Headers('x-country') country: number,
    @Headers('x-category') category: number,
  ) {
    const userId = user?.id;

    return this.venueService.UserWishlistCategory(userId, country, category);
  }

  @UseGuards(JwtAuthGuard)
  @Get('UserWishlist')
  async UserUserWishlist(
    @CurrentUser() user: any,
    @Headers('x-country') country: number,
    @Headers('x-category') category: number,
  ) {
    const userId = user?.id;

    return this.venueService.UserUserWishlist(userId, country, category);
  }

  @UseGuards(JwtAuthGuard)
  @Post('remove_wishlist')
  async remove_wishlist(@Body() body: any, @CurrentUser() user: any) {
    const userId = user?.id;

    return this.venueService.remove_wishlist(body, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('UserCompare')
  async UserCompare(
    @Body() body: any,
    @CurrentUser() user: any,
    @Headers('x-country') country: number,
    @Headers('x-category') category: string,
  ) {
    const userId = user?.id;

    return this.venueService.UserCompare(userId, country, category);
  }

  @UseGuards(JwtAuthGuard)
  @Post('addCompare')
  async addCompareAPI(
    @Body() body: any,
    @CurrentUser() user: any,
    @Headers('x-country') country: number,
    @Headers('x-category') category: number,
  ) {
    const userId = user?.id;

    return this.venueService.addCompareAPI(body, userId, country, category);
  }

  @UseGuards(JwtAuthGuard)
  @Post('removeCompare')
  async removeCompareAPI(@Body() body: any, @CurrentUser() user: any) {
    const userId = user?.id;

    return this.venueService.removeCompareAPI(body, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('userRecentViews')
  async userRecentViewsAPI(@Body() body: any, @CurrentUser() user: any) {
    const userId = user?.id;

    return this.venueService.userRecentViewsAPI(body, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('likedProperty')
  async likedProperty(
    @CurrentUser() user: any,
    @Headers('x-country') country: number,
    @Headers('x-category') category: number,
  ) {
    const userId = user?.id;

    return this.venueService.likedProperty(userId, country, category);
  }

  @UseGuards(JwtAuthGuard)
  @Post('addLikedProperty')
  async addLikedProperty(
    @Body() body: any,
    @CurrentUser() user: any,
    @Headers('x-country') country: number,
    @Headers('x-category') categorys: number,
  ) {
    const userId = user?.id;

    return this.venueService.addLikedProperty(body, userId, country, categorys);
  }

  @Get('UserlikedProperty')
  async UserlikedProperty(
    @Body() body: any,
    @CurrentUser() user: any,
    @Headers('x-country') country: number,
    @Headers('x-category') categorys: number,
  ) {
    const userId = 0;

    return this.venueService.UserlikedProperty(
      body,
      userId,
      country,
      categorys,
    );
  }

  @Get('totalLikedProperty')
  async totalLikedProperty() {
    return this.venueService.totalLikedProperty();
  }
  @Get('getParent/:id/:id1')
  async getParent(@Param('id') id: any, @Param('id1') id1: any) {
    return this.venueService.getParent(id, id1);
  }

  @Post('checkoutdatapass')
  checkoutdatapass(@Body() body: any) {
    const token = this.venueService.createCheckoutToken(body);
    return { token };
  }
  @Post('verify_checkout_token')
  verifyToken(@Body('token') token: string) {
    return this.venueService.verifyCheckoutToken(token);
  }

  @Get('test-broadcast')
testBroadcast() {
return this.venueService.testBroadcast();
}
}
