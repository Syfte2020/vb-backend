import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { RazorpayService } from './razorpay.service';

@Controller('razorpay')
export class RazorpayController {
  constructor(
    private readonly razorpayService: RazorpayService,
  ) {}

  /**
   * Create Order (One Time Payment)
   */
  // @UseGuards(JwtAuthGuard)
  // @Post('create-order')
  // async createOrder(
  //   @Body() body: any,
  //   @CurrentUser() user: any,
  //   @Headers('x-country') country: number,
  // ) {
  //   return this.razorpayService.createOrder(
  //     body,
  //     user.id,
  //     country,
  //   );
  // }

  /**
   * Verify Payment Signature
   */
  @UseGuards(JwtAuthGuard)
  @Post('verify-payment')
  async verifyPayment(
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    return this.razorpayService.verifyPayment(
      body,
      user.id,
    );
  }

  /**
   * Create Subscription
   */
  // @UseGuards(JwtAuthGuard)
  // @Post('subscription')
  // async createSubscription(
  //   @Body() body: any,
  //   @CurrentUser() user: any,
  //   @Headers('x-country') country: number,
  // ) {
  //   return this.razorpayService.createSubscription(
  //     body,
  //     user.id,
  //     country,
  //   );
  // }

  /**
   * Verify Subscription
   */
   @UseGuards(JwtAuthGuard)
  @Post('razorpay_subscription')
  async subscription(
    @Body()
    body: any,
     @CurrentUser() user: any,
     @Headers('x-country') country: number,
  ) {
    return this.razorpayService.subscription(
       body,
      user.id,
      country,
    );
  }

  @Post('subscription/verify')
async verifySubscription(@Body() body: any) {
return this.razorpayService.verifySubscription(
       body
    );
}
  @Get('verify_subscription/:id')
async verifys(@Param('id') id: any) {
return this.razorpayService.verifys(
       id
    );
}

  /**
   * Cancel Subscription
   */
  // @UseGuards(JwtAuthGuard)
  // @Post('subscription/cancel')
  // async cancelSubscription(
  //   @Body() body: any,
  // ) {
  //   return this.razorpayService.cancelSubscription(
  //     body.subscription_id,
  //   );
  // }

  /**
   * Payment Details
   */
  // @Get('payment/:payment_id')
  // async paymentDetails(
  //   @Param('payment_id')
  //   paymentId: string,
  // ) {
  //   return this.razorpayService.paymentDetails(
  //     paymentId,
  //   );
  // }

  /**
   * Razorpay Webhook
   */
  // @Post('webhook')
  // async webhook(
  //   @Req() req,
  //   @Headers('x-razorpay-signature')
  //   signature: string,
  // ) {
  //   return this.razorpayService.webhook(
  //     req.body,
  //     signature,
  //   );
  // }
@Post("create-order")
createOrder(@Body() body: any) {
  return this.razorpayService.createOrder(body);
}

@Post("verify")
verify(@Body() body: any) {
  return this.razorpayService.verify(body);
}

  
  @UseGuards(JwtAuthGuard)
  @Post('createOnlineBooking')
  async createOnlineBooking(@Body() body: any, @CurrentUser() user: any,@Headers('x-country') country: any) {
    return await this.razorpayService.createOnlineBooking(body, user?.id,country);
  } 


}