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

import { StripeService } from './Stripe.service';

import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @UseGuards(JwtAuthGuard)
  @Post('subscription')
  subscription(@Body() body: any, @CurrentUser() user: any,@Headers('x-country') Country : any) {
    return this.stripeService.subscription(body, user?.id,Country);
  }


  @Get('verify_subscription/:subscription_id')
  async verifySubscription(@Param('subscription_id') subscriptionId: string) {
    return this.stripeService.verifyStripeSubscription(subscriptionId);
  }
}
