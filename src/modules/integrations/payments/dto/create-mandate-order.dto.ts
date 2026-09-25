import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { MandateFrequency } from '../enums/frequency.enum';

/**
 * Unified, method-agnostic mandate authorization order.
 *
 * Unlike CreateUpiMandateDto / CreateCardMandateDto (which each fix a
 * method and its own authorization amount up front — ₹1 for UPI, ₹5 for
 * Card, per the original spec), this DTO backs a single order with ONE
 * authorization amount (`MANDATE_AUTH_AMOUNT_PAISE`, ₹1 by default) and NO
 * `method` set on the order, so the existing combined Razorpay Checkout
 * modal can keep letting the customer pick UPI or Card inside the same
 * popup — no method-picker step added to the UI. See
 * RazorpayService.createMandateOrder.
 */
export class CreateMandateOrderDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsIn([MandateFrequency.MONTHLY, MandateFrequency.YEARLY])
  billingCycle: MandateFrequency.MONTHLY | MandateFrequency.YEARLY;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  pricePerVenue?: number;

  @IsOptional()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
