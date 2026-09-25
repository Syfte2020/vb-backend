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
import { CardType } from '../enums/payment-method.enum';

export class CreateCardMandateDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsIn([MandateFrequency.MONTHLY, MandateFrequency.YEARLY])
  billingCycle: MandateFrequency.MONTHLY | MandateFrequency.YEARLY;

  /**
   * Client's hint about credit vs debit — cosmetic only. The authoritative
   * value comes from Razorpay's card/token entity on the webhook once the
   * OTP/3DS authentication completes, and overwrites this in
   * `metadata.cardType`.
   */
  @IsOptional()
  @IsIn([CardType.CREDIT, CardType.DEBIT])
  cardTypeHint?: CardType;

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
