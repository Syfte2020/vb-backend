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

export class CreateUpiMandateDto {
  /**
   * Razorpay customer id from `/payments/create-customer`. Optional — if
   * omitted the service creates/reuses one automatically using the
   * authenticated user's profile (name/email/phone).
   */
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsIn([MandateFrequency.MONTHLY, MandateFrequency.YEARLY])
  billingCycle: MandateFrequency.MONTHLY | MandateFrequency.YEARLY;

  /**
   * Override for the per-venue price (rupees/month). Omit to use the
   * configured default — present mainly for promo/negotiated pricing.
   */
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
