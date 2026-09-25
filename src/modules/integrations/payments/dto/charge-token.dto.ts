import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class ChargeTokenDto {
  /** Our `recurring_mandates.id` — not the Razorpay token string. */
  @IsInt()
  @IsPositive()
  mandateId: number;

  /**
   * Amount in rupees. Omit to auto-recompute from the mandate's stored
   * quantity/billing cycle (the usual path for scheduled recurring runs);
   * pass it explicitly only for a one-off/ad-hoc charge — it is still
   * capped at the mandate's `max_amount` either way.
   */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  /**
   * Caller-supplied idempotency key (e.g. `sub_42_2026-10`). Strongly
   * recommended for anything triggered by a retryable job — a repeat call
   * with the same key + mandateId returns the original result instead of
   * charging twice.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  idempotencyKey?: string;
}
