import { IsString } from 'class-validator';

/**
 * Body sent from the Razorpay Checkout `handler` callback once the popup
 * reports success — the synchronous counterpart to the payment.captured
 * webhook, so the frontend gets an immediate answer instead of waiting on
 * webhook delivery. Used with orders created by createMandateOrder,
 * createUpiMandate, or createCardMandate alike (all three key off the same
 * razorpay_order_id).
 */
export class VerifyMandateOrderDto {
  @IsString()
  orderId: string;

  @IsString()
  paymentId: string;

  @IsString()
  signature: string;
}
