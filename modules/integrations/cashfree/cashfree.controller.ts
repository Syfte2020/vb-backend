import {
  Controller,
  Get,
  UseGuards,
  Param,
  Put,
  Req,
  Patch,
  Post,
  Body,
  Query,
  Delete,
  Headers,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { CashfreeService } from './cashfree.service';

import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';

@Controller('cashfree')
export class CashfreeController {
  constructor(private readonly cashfreeService: CashfreeService) {}

  @UseGuards(JwtAuthGuard)
  @Post('subscription')
  subscription(@Body() body: any, @CurrentUser() user: any,@Headers('x-country') Country : any) {
    return this.cashfreeService.subscription(body, user?.id,Country);
  }

  @Get('verify_subscription/:subscription_id')
  async verifySubscription(@Param('subscription_id') subscriptionId: string) {
    return this.cashfreeService.verifySubscription(subscriptionId);
  }
  @Get('cashfree_plans/:category')
  async cashfree_plans(
    @Param('category') category_id: string,
    @Query('category') category: string,
  ) {
    return this.cashfreeService.cashfree_plans(category_id, category);
  }

  @UseGuards(JwtAuthGuard)
  @Post('create-order')
  cashfree_order(  @Body()
     @Body() body: any,

    @Param('id') id: string,

    @Param('country') country: string, @CurrentUser() user: any,@Headers('x-country') Country : any) {
    return this.cashfreeService.cashfree_order(body, user?.id,Country);
  }

  
}
