import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
  Res,
  Patch,
  Query
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { RazorpayService } from './razorpay.service';

import type { FastifyReply } from 'fastify';

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
  
async verifys(@Param('id') id: string ,   
@Query('signature') signature: string,
  @Query('paymentId') paymentId: string,) {
return this.razorpayService.verifys(
       id,signature,paymentId
    );
}
 @UseGuards(JwtAuthGuard)
@Patch('subscription/quantity')
async updateSubscriptionQuantity(
  @Body() body: any,
  @Req() req: any,
   @CurrentUser() user: any,
) {
  return this.razorpayService.updateSubscriptionQuantity(
    body,
    user.id,
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

@Post("validate_coupon")
validate_coupon(@Body() body: any) {
  return this.razorpayService.validate_coupon(body);
}

  
  @UseGuards(JwtAuthGuard)
  @Post('createOnlineBooking')
  async createOnlineBooking(@Body() body: any, @CurrentUser() user: any,@Headers('x-country') country: any) {
    return await this.razorpayService.createOnlineBooking(body, user?.id,country);
  } 

  @Post("webhook")
async webhook(@Req() req: Request, @Res() res: Response) {
  return this.razorpayService.webhook(req,res);
}
 @UseGuards(JwtAuthGuard)
 @Post("onlinepayment")
async onlinepayment(@Body() body: any,@CurrentUser() user: any) {
  return this.razorpayService.onlinepayment(body,user?.id);
} 

@UseGuards(JwtAuthGuard)
 @Post("cancelBooking")
async cancelBooking(@Body() body: any,@CurrentUser() user: any) {
  return this.razorpayService.cancelBooking(body,user?.id);
}

// @Get('callback')
// async callback(
//   @Query() query: any,
//   @Res() reply: FastifyReply,
// ) {
//   try {
//     console.log('====================================');
//     console.log('RAZORPAY CALLBACK');
//     console.log('Query:', query);
//     console.log('====================================');

//     const {
//       razorpay_payment_id,
//       razorpay_payment_link_id,
//       razorpay_payment_link_reference_id,
//       razorpay_payment_link_status,
//     } = query;

//     const result =
//       await this.razorpayService.handleCallback({
//         razorpay_payment_id,
//         razorpay_payment_link_id,
//         razorpay_payment_link_reference_id,
//         razorpay_payment_link_status,
//       });

//     const subscriptionId =
//       result?.subscription_id
//         ? String(result.subscription_id)
//         : '';

//     const status =
//       result?.status ||
//       razorpay_payment_link_status ||
//       'pending';

//     const frontendUrl =
//       process.env.APP_URL_FRONTEND ||
//       'https://venuebook.in';

//     console.log('Subscription ID:', subscriptionId);
//     console.log('Payment status:', status);

//     /*
//      * Send result to parent VenueBook window
//      */
//     const html = `
// <!DOCTYPE html>
// <html>
// <head>
//   <meta charset="UTF-8" />
//   <meta
//     name="viewport"
//     content="width=device-width, initial-scale=1.0"
//   />
//   <title>Payment Processing</title>

//   <style>
//     body {
//       margin: 0;
//       min-height: 100vh;
//       display: flex;
//       align-items: center;
//       justify-content: center;
//       font-family: Arial, sans-serif;
//       background: #f8fafc;
//     }

//     .box {
//       text-align: center;
//       background: white;
//       padding: 40px;
//       border-radius: 16px;
//       box-shadow: 0 10px 30px rgba(0,0,0,0.08);
//       max-width: 400px;
//       width: calc(100% - 40px);
//     }

//     .success {
//       color: #16a34a;
//     }

//     .pending {
//       color: #ca8a04;
//     }

//     .failed {
//       color: #dc2626;
//     }

//     h2 {
//       margin-bottom: 10px;
//     }

//     p {
//       color: #64748b;
//     }
//   </style>
// </head>

// <body>

//   <div class="box">

//     <div id="content">
//       <h2 class="${status === 'paid' ? 'success' : 'pending'}">
//         ${
//           status === 'paid'
//             ? 'Payment Successful'
//             : 'Payment Processing'
//         }
//       </h2>

//       <p>
//         ${
//           status === 'paid'
//             ? 'You can close this window.'
//             : 'Please wait while we confirm your payment.'
//         }
//       </p>
//     </div>

//   </div>

// <script>

//   const paymentData = {
//     type: "RAZORPAY_PAYMENT_RESULT",
//     success: ${
//       status === 'paid' ||
//       status === 'captured'
//         ? 'true'
//         : 'false'
//     },
//     status: ${JSON.stringify(status)},
//     subscription_id: ${JSON.stringify(subscriptionId)},
//     payment_id: ${JSON.stringify(
//       razorpay_payment_id || ''
//     )}
//   };

//   console.log(
//     "Sending payment result:",
//     paymentData
//   );

//   /*
//    * Send message to the VenueBook parent window
//    */
//   if (window.opener) {

//     window.opener.postMessage(
//       paymentData,
//       ${JSON.stringify(frontendUrl)}
//     );

//   }

//   /*
//    * Close Razorpay popup automatically
//    */
//   setTimeout(() => {

//     window.close();

//   }, 1000);

// </script>

// </body>
// </html>
// `;

//     return reply
//       .type('text/html')
//       .send(html);

//   } catch (error) {

//     console.error(
//       'Razorpay callback error:',
//       error,
//     );

//     const frontendUrl =
//       process.env.APP_URL_FRONTEND ||
//       'https://venuebook.in';

//     const html = `
// <!DOCTYPE html>
// <html>
// <head>
//   <meta charset="UTF-8" />
//   <title>Payment Failed</title>
// </head>

// <body>

// <script>

//   if (window.opener) {

//     window.opener.postMessage(
//       {
//         type: "RAZORPAY_PAYMENT_RESULT",
//         success: false,
//         status: "failed"
//       },
//       ${JSON.stringify(frontendUrl)}
//     );

//   }

//   setTimeout(() => {
//     window.close();
//   }, 1000);

// </script>

// <h2 style="
//   text-align:center;
//   margin-top:100px;
//   font-family:Arial;
// ">
//   Payment verification failed
// </h2>

// </body>
// </html>
// `;

//     return reply
//       .type('text/html')
//       .send(html);
//   }
// }
  @Get('callback')
async callback(
  @Query() query: any,
  @Res() reply: FastifyReply,
) {
  try {
    console.log('====================================');
    console.log('RAZORPAY CALLBACK');
    console.log('Query:', query);
    console.log('====================================');

    const {
      razorpay_payment_id,
      razorpay_payment_link_id,
      razorpay_payment_link_reference_id,
      razorpay_payment_link_status,
      razorpay_signature,
    } = query;

    /*
     * Validate Payment Link
     */
    if (!razorpay_payment_link_id) {
      return this.sendPaymentResult(reply, {
        success: false,
        status: 'failed',
        subscription_id: '',
        payment_id: razorpay_payment_id || '',
        signature_id: razorpay_signature || '',
      });
    }

    /*
     * Handle callback
     */
    const result =
      await this.razorpayService.handleCallback({
        razorpay_payment_id,
        razorpay_payment_link_id,
        razorpay_payment_link_reference_id,
        razorpay_payment_link_status,
        razorpay_signature,
      });

    console.log(
      'Callback service result:',
      result,
    );

    /*
     * Database subscription ID
     *
     * Example: 198
     */
    const subscriptionId =
      result?.subscription_id
        ? String(result.subscription_id)
        : '';

    /*
     * Payment status
     */
    const status =
      result?.status ||
      razorpay_payment_link_status ||
      'pending';

    /*
     * Payment ID
     */
    const paymentId =
      razorpay_payment_id || '';

    /*
     * Razorpay signature
     */
    const signature =
      razorpay_signature || '';

    console.log(
      'Subscription ID:',
      subscriptionId,
    );

    console.log(
      'Status:',
      status,
    );

    console.log(
      'Payment ID:',
      paymentId,
    );

    console.log(
      'Razorpay Signature:',
      signature,
    );

    /*
     * Send result to parent/frontend
     */
    return this.sendPaymentResult(reply, {
      success:
        status === 'paid' ||
        status === 'captured',

      status,

      subscription_id:
        subscriptionId,

      payment_id:
        paymentId,

      signature_id:
        signature,
    });

  } catch (error) {
    console.error(
      'Razorpay callback error:',
      error,
    );

    return this.sendPaymentResult(reply, {
      success: false,
      status: 'failed',
      subscription_id: '',
      payment_id: '',
      signature_id: '',
    });
  }
}
  /**
   * Return HTML to Razorpay popup
   * and communicate with parent window.
   */
  private sendPaymentResult(
    reply: FastifyReply,
    data: {
      success: boolean;
      status: string;
      subscription_id: string;
      payment_id: string;
      signature_id: string;
    },
  ) {
    const frontendUrl =
      process.env.APP_URL_FRONTEND ||
      'https://venuebook.in';

    const html = `
<!DOCTYPE html>
<html lang="en">

<head>

  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />

  <title>
    ${
      data.success
        ? 'Payment Successful'
        : 'Payment Processing'
    }
  </title>

  <style>

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;

      display: flex;
      align-items: center;
      justify-content: center;

      font-family:
        Arial,
        Helvetica,
        sans-serif;

      background: #f8fafc;
    }

    .container {
      width: 90%;
      max-width: 420px;

      padding: 40px 30px;

      text-align: center;

      background: #ffffff;

      border-radius: 20px;

      box-shadow:
        0 10px 40px
        rgba(0, 0, 0, 0.08);
    }

    .icon {
      width: 70px;
      height: 70px;

      margin: 0 auto 20px;

      display: flex;
      align-items: center;
      justify-content: center;

      border-radius: 50%;

      font-size: 36px;

      ${
        data.success
          ? `
            background: #dcfce7;
            color: #16a34a;
          `
          : `
            background: #fef3c7;
            color: #d97706;
          `
      }
    }

    h1 {
      margin: 0;

      font-size: 24px;

      color: #111827;
    }

    p {
      margin-top: 10px;

      font-size: 14px;

      line-height: 1.6;

      color: #6b7280;
    }

    .close {
      margin-top: 25px;

      font-size: 13px;

      color: #9ca3af;
    }

  </style>

</head>

<body>

  <div class="container">

    <div class="icon">

      ${
        data.success
          ? '✓'
          : '⌛'
      }

    </div>

    <h1>

      ${
        data.success
          ? 'Payment Successful'
          : 'Payment Processing'
      }

    </h1>

    <p>

      ${
        data.success
          ? 'Your payment was successfully completed. This window will close automatically.'
          : 'We are processing your payment. Please wait.'
      }

    </p>

    ${
      data.success
        ? `
          <div class="close">
            Closing payment window...
          </div>
        `
        : ''
    }

  </div>

  <script>

    const paymentData = ${JSON.stringify({
      type: 'RAZORPAY_PAYMENT_RESULT',
      success: data.success,
      status: data.status,
      subscription_id:
        data.subscription_id,
      payment_id:
        data.payment_id, 
      signature_id:
        data.signature_id,
    })};

    console.log(
      'Sending Razorpay result:',
      paymentData
    );

    /*
     * Send result to VenueBook
     */
    if (window.opener) {

      window.opener.postMessage(
        paymentData,
        ${JSON.stringify(frontendUrl)}
      );

    }

    /*
     * Close popup automatically
     */
    setTimeout(() => {

      window.close();

    }, 1500);

  </script>

</body>

</html>
`;

    return reply
      .type('text/html')
      .send(html);
  }
@UseGuards(JwtAuthGuard)
    @Post('accept_terms_condition')
async accept_terms_condition(
  @Body() body: any,
   @CurrentUser() user: any,
) {
 return this.razorpayService.accept_terms_condition(
       body,
      user.id
    );
}

  

}
