import { Controller, Get, Post, Body, Patch, Param, Delete,UseGuards,Headers } from '@nestjs/common';
import { VendorNotificationService } from './vendor_notification.service';

import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';

@Controller('vendor-notification')
export class VendorNotificationController {
  constructor(private readonly vendorNotificationService: VendorNotificationService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@CurrentUser() user: any,
      @Headers('x-country') country: number,
      @Headers('x-category') category: number,) {
    return this.vendorNotificationService.findAll(user?.id);
  }

}
