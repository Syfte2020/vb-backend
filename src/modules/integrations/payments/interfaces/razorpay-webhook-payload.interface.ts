/**
 * Minimal shape of the Razorpay webhook envelope this module relies on.
 * Razorpay's actual payloads carry many more fields per entity — only what
 * is read here is typed; everything else still round-trips through
 * `payload: Record<string, any>` on `RazorpayWebhookEvent` untouched.
 */
export interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: { entity: RazorpayPaymentEntity };
    order?: { entity: RazorpayOrderEntity };
    subscription?: { entity: Record<string, any> };
    token?: { entity: RazorpayTokenEntity };
    refund?: { entity: Record<string, any> };
  };
  created_at?: number;
}

export interface RazorpayPaymentEntity {
  id: string;
  order_id?: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  token_id?: string;
  customer_id?: string;
  error_description?: string | null;
  error_reason?: string | null;
  card?: { network?: string; type?: string; last4?: string };
  upi?: { mandate_id?: string; vpa?: string };
  notes?: Record<string, string>;
}

export interface RazorpayOrderEntity {
  id: string;
  amount: number;
  currency: string;
  status: string;
  notes?: Record<string, string>;
}

export interface RazorpayTokenEntity {
  id: string;
  customer_id?: string;
  method?: string;
  card?: { network?: string; type?: string; last4?: string };
  bank?: string;
  expired_at?: number;
  max_amount?: number;
  notes?: Record<string, string>;
}
