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
    @Param('id') id: number,
  ) {
    return this.venueDetailService.getVenuesDetailData(country,id);
  } 
  
  @Post('loadAddons')
  loadAddons(
    @Headers('x-country') country: number,
    @Body() id: number,
  ) {
    return this.venueDetailService.loadAddons(country,id);
  }
 
}
