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
import { VenueDetailService } from './venueDeatil.service';
import { JwtAuthGuard } from '../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';

@Controller('venues')
export class VenueDeatilController {
  constructor(private readonly venueDetailService: VenueDetailService) {}

  @Get('venue_deatils/:id')
  getVenuesDetailData(
    @Headers('x-country') country: number,
    @Headers('x-category') category: number,
    @Param('id') id: any,
  ) {
    return this.venueDetailService.getVenuesDetailData(country,id,category);
  } 
  
  @Post('loadAddons')
  loadAddons(
    @Headers('x-country') country: number,
    @Body() id: number,
  ) {
    return this.venueDetailService.loadAddons(country,id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sendEnquiry')
  sendEnquiry(
    @Headers('x-category') category: number,
    @Headers('x-country') country: number,
    @Body() body: any,
     @CurrentUser() user: any,
  ) {
    return this.venueDetailService.sendEnquiry(category,country,body,user?.id);
  }
 //category: any, country: any,dto: any
}
 