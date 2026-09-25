import * as crypto from 'crypto';

/**
 * Verifies a Razorpay webhook signature (`x-razorpay-signature` header)
 * against the raw request body, using a timing-safe comparison so this
 * can't be sped up into a byte-by-byte oracle attack. `rawBody` MUST be the
 * exact bytes Razorpay signed — a re-serialized `JSON.stringify(req.body)`
 * will not match if key order or whitespace differs. See README for how to
 * wire up `rawBody` in main.ts.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: Buffer | string,
  signature: string | undefined,
  webhookSecret: string,
): boolean {
  if (!signature || !webhookSecret) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const signatureBuffer = Buffer.from(signature, 'utf8');

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

/** Verifies the Checkout (client-side) signature: order_id|payment_id. */
export function verifyRazorpayCheckoutSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string,
): boolean {
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const signatureBuffer = Buffer.from(signature ?? '', 'utf8');

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}
