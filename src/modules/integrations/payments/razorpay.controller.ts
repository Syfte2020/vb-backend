import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';

import { RazorpayService } from './razorpay.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateUpiMandateDto } from './dto/create-upi-mandate.dto';
import { CreateCardMandateDto } from './dto/create-card-mandate.dto';
import { CreateMandateOrderDto } from './dto/create-mandate-order.dto';
import { VerifyMandateOrderDto } from './dto/verify-mandate-order.dto';
import { ChargeTokenDto } from './dto/charge-token.dto';
import { CancelMandateDto } from './dto/cancel-mandate.dto';

/**
 * User-scoped payment routes, now wired to the app's real JwtAuthGuard /
 * CurrentUser decorator instead of the placeholder header-based stub this
 * module shipped with.
 *
 * `charge-token`, `mandate/:id`, and `cancel-mandate` are deliberately left
 * WITHOUT @UseGuards(JwtAuthGuard) here, same as before:
 *  - `charge-token` is meant to be called by an internal billing
 *    scheduler/job, not an end user's browser — put a separate
 *    internal-only guard (e.g. a service token / IP allowlist) in front of
 *    it rather than the end-user guard.
 *  - `mandate/:id` (GET) and `cancel-mandate` accept a mandate id / dto
 *    with no implicit ownership check yet — before exposing these to end
 *    users, add @UseGuards(JwtAuthGuard) to them too AND have
 *    RazorpayService verify the mandate's userId matches the authenticated
 *    user (getMandate/cancelMandate currently trust the caller-supplied id
 *    outright). Flagging rather than silently changing this myself since
 *    it's a behavior change beyond "link to this controller".
 */
@Controller('payments')
export class RazorpayController {
  constructor(private readonly razorpayService: RazorpayService) {}

  @UseGuards(JwtAuthGuard)
  @Post('create-customer')
  async createCustomer(
    @Body() dto: CreateCustomerDto,
    @CurrentUser() user: any,
  ) {
    return this.razorpayService.createCustomer(dto, user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('create-upi-mandate')
  async createUpiMandate(
    @Body() dto: CreateUpiMandateDto,
    @CurrentUser() user: any,
  ) {
    return this.razorpayService.createUpiMandate(dto, user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('create-card-mandate')
  async createCardMandate(
    @Body() dto: CreateCardMandateDto,
    @CurrentUser() user: any,
  ) {
    return this.razorpayService.createCardMandate(dto, user?.id);
  }

  // Unified, method-agnostic mandate order — ₹1 authorization regardless of
  // whether the customer ends up paying via UPI or Card inside the same
  // combined Checkout modal. Use this one for a single-popup checkout like
  // PaymentPage.jsx's; use create-upi-mandate/create-card-mandate above
  // only if you add a method-picker step before opening Checkout.
  @UseGuards(JwtAuthGuard)
  @Post('create-mandate-order')
  async createMandateOrder(
    @Body() dto: CreateMandateOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.razorpayService.createMandateOrder(dto, user?.id);
  }

  // Called from the Checkout `handler` callback right after the popup
  // reports success — gives the frontend an immediate, signature-verified
  // answer instead of waiting on payment.captured webhook delivery lag.
  @UseGuards(JwtAuthGuard)
  @Post('verify-mandate-order')
  async verifyMandateOrder(
    @Body() dto: VerifyMandateOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.razorpayService.verifyMandateOrder(dto, user?.id);
  }

  @Post('charge-token')
  async chargeToken(@Body() dto: ChargeTokenDto) {
    // Internal billing scheduler only — see class-level note above.
    return this.razorpayService.chargeToken(dto);
  }
 @UseGuards(JwtAuthGuard)
  @Get('mandate/:id')
  async getMandate(@Param('id', ParseIntPipe) id: number,@CurrentUser() user: any,) {
    return this.razorpayService.getMandate(id,user?.id);
  }
 @UseGuards(JwtAuthGuard)
  @Post('cancel-mandate')
  async cancelMandate(@Body() dto: CancelMandateDto,@CurrentUser() user: any) {
    return this.razorpayService.cancelMandate(dto,user?.id);
  }
}
