export enum PaymentMethod {
  UPI = 'upi',
  CARD = 'card',
  /**
   * Method not yet known — used only by the unified, method-agnostic
   * create-mandate-order flow (RazorpayService.createMandateOrder), where a
   * single order is created without a fixed method and the customer picks
   * UPI or Card inside the Checkout popup. Resolved to UPI or CARD in
   * onPaymentCaptured once the authorization payment tells us which method
   * was actually used.
   */
  PENDING = 'pending',
}

/**
 * Card sub-type as reported by Razorpay's token/card entity after
 * authentication. Not persisted as its own DB column (kept inside
 * `metadata`) because Razorpay is the source of truth for it and it can
 * only be known *after* the authorization payment completes.
 */
export enum CardType {
  CREDIT = 'credit',
  DEBIT = 'debit',
  PREPAID = 'prepaid',
  UNKNOWN = 'unknown',
}
