import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import Razorpay from 'razorpay';
import {
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
} from './utils/razorpay-signature.util';

// ---------------------------------------------------------------------------
// IntegrationService — ADJUST THIS IMPORT PATH.
//
// This module assumes your app already has a service that reads
// integration credentials (Razorpay key_id/key_secret/webhook_secret,
// stored as a JSON blob or equivalent columns) out of the database, with a
// shape along these lines:
//
//   @Injectable()
//   export class IntegrationService {
//     async getIntegrationConfig(provider: string): Promise<Record<string, any> | string> { ... }
//   }
//
// The import path below (`../../integrations/integration.service`) is a
// placeholder — point it at wherever your real IntegrationService actually
// lives, and adjust the constructor injection below if its method name or
// return shape differs. Nothing else in this file depends on any other
// detail of that service.
// ---------------------------------------------------------------------------
import { IntegrationService } from '../integSettings/integSettings.service';

interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

/**
 * Wraps both the official `razorpay` Node SDK (used for the well-covered
 * endpoints: orders, customers, payments) and a small raw axios client for
 * the handful of REST endpoints the SDK doesn't expose consistently across
 * versions (customer token fetch/cancel, the "Charge at Will" recurring
 * payment endpoint, refunds).
 *
 * Centralizing this here means every other file just calls
 * `await this.razorpayApi.createOrder(...)` etc. and never touches
 * auth/base-URL details, where the credentials come from, or Razorpay's raw
 * error shape directly.
 *
 * -- Credentials are DB-backed, not env-backed -----------------------------
 * `key_id`, `key_secret`, and `webhook_secret` are loaded from
 * `IntegrationService.getIntegrationConfig('razorpay')` — NEVER from
 * `process.env` / `ConfigService`. Every public method below calls
 * `ensureCredentials()` first, which lazily fetches the config on first use
 * and caches it in memory for `CREDENTIALS_CACHE_TTL_MS` (5 minutes) so a
 * credential rotation in the DB is picked up within that window without
 * requiring an app restart, while everyday calls don't pay for a DB round
 * trip each time. If you need a rotation to take effect immediately, either
 * restart the process or add an admin endpoint that calls
 * `invalidateCredentialsCache()` below.
 *
 * `RAZORPAY_API_BASE_URL` is the one exception kept on `ConfigService` — it
 * is not a credential (it's a deployment-time proxy/sandbox override, almost
 * never set in practice) and defaults to Razorpay's real API host either
 * way, so there's no secret-in-.env concern with leaving it there.
 *
 * -- CHANGED in this pass --------------------------------------------------
 * Added `verifyWebhookSignature()` (problem #2 in the review). Inbound
 * webhook signature checking used to be done ad hoc inside
 * RazorpayWebhookController (re-fetching + re-parsing the DB config on
 * every single webhook call, bypassing the cache above entirely). It now
 * lives here, next to `verifyCheckoutSignature`, benefits from the same
 * 5-minute credential cache, and is the one place both the controller and
 * RazorpayService.handleWebhook can call.
 *
 * Also changed `createRecurringPayment()`'s `recurring` field from the
 * string `'1'` to the boolean `true`, matching Razorpay's documented
 * request example for `POST /payments/create/recurring` exactly
 * (https://razorpay.com/docs/api/payments/recurring-payments/cards/create-subsequent-payments/).
 * Extended `createOrder()`'s `token` type to optionally accept
 * `recurring_value` / `recurring_type`, which Razorpay's UPI recurring-payments
 * docs show as additional token fields for fixed-day autopay debits
 * (https://razorpay.com/docs/api/payments/recurring-payments/upi/create-authorization-transaction/).
 * Nothing in this file *requires* them — RazorpayService doesn't pass them —
 * this only makes room for RazorpayService to add them later without
 * touching this file again. See the review notes for why they were not
 * made mandatory.
 */
@Injectable()
export class RazorpayApiClient {
  private readonly logger = new Logger(RazorpayApiClient.name);

  private static readonly CREDENTIALS_CACHE_TTL_MS = 5 * 60 * 1000;

  private sdk: Razorpay | null = null;
  private http: AxiosInstance | null = null;
  private credentials: RazorpayCredentials | null = null;
  private credentialsLoadedAt = 0;
  private credentialsLoadPromise: Promise<RazorpayCredentials> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly integrationService: IntegrationService,
  ) {}

  // ---------------------------------------------------------------------
  // Credential loading (DB-backed via IntegrationService)
  // ---------------------------------------------------------------------

  /**
   * Forces the next call to re-fetch credentials from IntegrationService
   * instead of using the cached copy. Call this from an admin action right
   * after rotating Razorpay credentials in the DB, if you don't want to
   * wait out the cache TTL or restart the process.
   */
  invalidateCredentialsCache(): void {
    this.credentials = null;
    this.credentialsLoadedAt = 0;
    this.credentialsLoadPromise = null;
  }

  private isCacheFresh(): boolean {
    return (
      !!this.credentials &&
      Date.now() - this.credentialsLoadedAt <
        RazorpayApiClient.CREDENTIALS_CACHE_TTL_MS
    );
  }

  private async loadCredentials(): Promise<RazorpayCredentials> {
    const raw = await this.integrationService.getIntegrationConfig(
      'razorpay',
    );
    // Tolerate the config coming back as a JSON string (e.g. a raw TEXT/JSON
    // column read without the ORM parsing it) as well as an already-parsed
    // object.
    const configData =
      typeof raw === 'string' ? JSON.parse(raw) : raw || {};

    const keyId = String(configData?.key_id || '').trim();
    const keySecret = String(configData?.key_secret || '').trim();
    const webhookSecret = String(configData?.webhook_secret || '').trim();

    if (!keyId) {
      throw new Error(
        "Razorpay integration config is missing 'key_id' — check the row IntegrationService('razorpay') reads from.",
      );
    }
    if (!keySecret) {
      throw new Error(
        "Razorpay integration config is missing 'key_secret' — check the row IntegrationService('razorpay') reads from.",
      );
    }
    // webhook_secret is validated lazily in getWebhookSecret() rather than
    // here, so a deployment that doesn't yet process webhooks (e.g. a fresh
    // local/staging setup) can still create orders and charge tokens.

    return { keyId, keySecret, webhookSecret };
  }

  /**
   * Ensures `this.sdk` / `this.http` are built from fresh-enough DB
   * credentials before any Razorpay call. Concurrent callers share a single
   * in-flight DB fetch (via `credentialsLoadPromise`) rather than each
   * firing their own `getIntegrationConfig` call.
   */
  private async ensureCredentials(): Promise<RazorpayCredentials> {
    if (this.isCacheFresh()) {
      return this.credentials as RazorpayCredentials;
    }

    if (!this.credentialsLoadPromise) {
      this.credentialsLoadPromise = this.loadCredentials()
        .then((creds) => {
          const changed =
            !this.credentials ||
            this.credentials.keyId !== creds.keyId ||
            this.credentials.keySecret !== creds.keySecret;

          this.credentials = creds;
          this.credentialsLoadedAt = Date.now();

          // Only rebuild the SDK/http client when the actual key material
          // changed (or this is the first load) — avoids throwing away a
          // perfectly good client just because the cache TTL elapsed with
          // unchanged credentials.
          if (changed || !this.sdk || !this.http) {
            this.sdk = new Razorpay({
              key_id: creds.keyId,
              key_secret: creds.keySecret,
            });
            this.http = axios.create({
              baseURL:
                this.configService.get<string>('RAZORPAY_API_BASE_URL') ||
                'https://api.razorpay.com/v1',
              auth: { username: creds.keyId, password: creds.keySecret },
              headers: { 'Content-Type': 'application/json' },
              timeout: 15000,
            });
            this.logger.log(
              changed
                ? 'Razorpay credentials (re)loaded from IntegrationService — key material changed, SDK/http client rebuilt.'
                : 'Razorpay credentials loaded from IntegrationService.',
            );
          }

          return creds;
        })
        .finally(() => {
          this.credentialsLoadPromise = null;
        });
    }

    return this.credentialsLoadPromise;
  }

  /** Public key id (`key_id`) — safe to hand to the frontend for Checkout. */
  async getPublicKeyId(): Promise<string> {
    const creds = await this.ensureCredentials();
    return creds.keyId;
  }

  /** Webhook secret, for signature verification. Never logged, never returned to a client. */
  async getWebhookSecret(): Promise<string> {
    const creds = await this.ensureCredentials();
    if (!creds.webhookSecret) {
      throw new Error(
        "Razorpay integration config is missing 'webhook_secret' — cannot verify webhook signatures until it's set in the DB config.",
      );
    }
    return creds.webhookSecret;
  }

  /**
   * Verifies a Razorpay Checkout `handler` response's signature
   * (order_id|payment_id, HMAC-SHA256 with the key *secret*) without
   * handing the secret itself out to callers. Async because the secret now
   * comes from the DB, not a value already held in memory at construction.
   */
  async verifyCheckoutSignature(
    orderId: string,
    paymentId: string,
    signature: string,
  ): Promise<boolean> {
    const creds = await this.ensureCredentials();
    return verifyRazorpayCheckoutSignature(
      orderId,
      paymentId,
      signature,
      creds.keySecret,
    );
  }

  /**
   * NEW — verifies an inbound Razorpay *webhook* signature
   * (`x-razorpay-signature`), HMAC-SHA256 over the raw, unparsed request
   * body, keyed with the webhook secret (NOT the key secret — a different
   * value, configured separately on the Razorpay dashboard webhook and
   * mirrored into the `webhook_secret` field of the same DB config row).
   *
   * `rawBody` MUST be the exact bytes Razorpay sent — never a
   * re-serialized `JSON.stringify(parsedBody)` — per Razorpay's webhook
   * validation docs (https://razorpay.com/docs/webhooks/validate-test/):
   * "Do not parse or cast the webhook request body."
   */
  async verifyWebhookSignature(
    rawBody: Buffer | string,
    signature: string | undefined,
  ): Promise<boolean> {
    const webhookSecret = await this.getWebhookSecret();
    return verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret);
  }

  private handleError(context: string, error: any): never {
    const description =
      error?.error?.description ||
      error?.response?.data?.error?.description ||
      error?.message ||
      'Razorpay request failed';
    this.logger.error(`${context}: ${description}`, error?.stack);
    throw new BadRequestException(description);
  }

  // ---------------------------------------------------------------------
  // Customers
  // ---------------------------------------------------------------------

  async createOrFetchCustomer(payload: {
    name: string;
    email: string;
    contact: string;
    notes?: Record<string, string>;
  }) {
    await this.ensureCredentials();
    try {
      // "0" (string) is intentional — Razorpay returns the existing customer
      // instead of erroring when one already matches this email/contact.
      return await (this.sdk!.customers.create as any)({
        ...payload,
        fail_existing: '0',
      });
    } catch (error) {
      this.handleError('createOrFetchCustomer', error);
    }
  }

  async fetchCustomer(customerId: string) {
    await this.ensureCredentials();
    try {
      return await this.sdk!.customers.fetch(customerId);
    } catch (error) {
      this.handleError('fetchCustomer', error);
    }
  }

  async findCustomerByContact(params: { email: string; contact: string }) {
    await this.ensureCredentials();
    const normalizedEmail = params.email.trim().toLowerCase();
    const normalizedContact = params.contact.replace(/\D/g, '');

    let skip = 0;
    const count = 100;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = await this.sdk!.customers.all({ count, skip });
      const items = page?.items || [];
      const match = items.find((customer: any) => {
        const email = String(customer?.email || '').trim().toLowerCase();
        const contact = String(customer?.contact || '').replace(/\D/g, '');
        return email === normalizedEmail || contact === normalizedContact;
      });
      if (match) return match;
      if (items.length < count) return null;
      skip += count;
    }
  }

  // ---------------------------------------------------------------------
  // Orders
  // ---------------------------------------------------------------------

  async createOrder(payload: {
    amount: number;
    currency: string;
    receipt: string;
    customer_id?: string;
    token?: {
      max_amount: number;
      expire_at: number;
      frequency: string;
      /**
       * UPI Autopay only — day/date the debit should occur, per Razorpay's
       * UPI recurring-payments docs. Optional: not required for every
       * frequency value there, and RazorpayService does not currently set
       * it. Left here so it can be wired up later without touching this
       * file again — see the review notes on problem #1 before relying on
       * it being mandatory for `frequency: 'monthly' | 'yearly'`.
       */
      recurring_value?: number;
      recurring_type?: 'on' | 'before' | 'after';
    };
    method?: string;
    notes?: Record<string, string>;
  }) {
    await this.ensureCredentials();
    try {
      return await (this.sdk!.orders.create as any)({
        payment_capture: true,
        ...payload,
      });
    } catch (error) {
      this.handleError('createOrder', error);
    }
  }

  async fetchOrder(orderId: string) {
    await this.ensureCredentials();
    try {
      return await this.sdk!.orders.fetch(orderId);
    } catch (error) {
      this.handleError('fetchOrder', error);
    }
  }

  // ---------------------------------------------------------------------
  // Payments
  // ---------------------------------------------------------------------

  async fetchPayment(paymentId: string) {
    await this.ensureCredentials();
    try {
      return await this.sdk!.payments.fetch(paymentId);
    } catch (error) {
      this.handleError('fetchPayment', error);
    }
  }

  /**
   * "Charge at Will" — debits a saved token without customer interaction.
   * Maps to `POST /v1/payments/create/recurring`. Called directly via axios
   * rather than the SDK helper since its availability/name varies across
   * `razorpay` npm versions.
   *
   * `payload.token` MUST be the Razorpay token id (`mandate.tokenId` /
   * `recurring_mandates.token_id`, e.g. `token_Gzn7hz9AhjPnMz`) — NEVER the
   * local `recurring_mandates.id` primary key. This method refuses to call
   * Razorpay at all if `token` is missing, so a caller bug (passing the
   * wrong id, or forgetting to check `chargeToken`'s own guard) fails fast
   * and loud here instead of reaching Razorpay as a confusing
   * "Token absent for recurring payment" error.
   *
   * NOTE on idempotency (problem #10): Razorpay's documented request body
   * for this endpoint (email, contact, amount, currency, order_id,
   * customer_id, token, recurring, description, notes) does not include or
   * mention any idempotency-key header/field. The `X-Idempotency-Key`
   * header below is sent defensively (harmless if Razorpay ignores it) but
   * MUST NOT be relied on as the source of duplicate-charge protection —
   * that has to be — and already is, via `idempotencyKey` on
   * RecurringMandateTransaction — enforced on our own side before this
   * method is ever called. See RazorpayService.chargeToken.
   */
  async createRecurringPayment(
    payload: {
      email: string;
      contact: string;
      customer_id: string;
      token: string;
      amount: number;
      currency: string;
      order_id: string;
      description?: string;
      notes?: Record<string, string>;
    },
    idempotencyKey?: string,
  ) {
    const token = String(payload.token || '').trim();
    if (!token) {
      // Defense in depth: RazorpayService.chargeToken() already refuses to
      // reach this method without a confirmed mandate.tokenId, but this
      // guard means NO caller — present or future — can accidentally send
      // Razorpay an empty/undefined token and get back a misleading
      // "Token absent for recurring payment" from Razorpay itself instead
      // of a clear local error.
      throw new BadRequestException(
        'createRecurringPayment called without a Razorpay token — refusing to call /payments/create/recurring. ' +
          'This must be the Razorpay token id (mandate.tokenId), never the local mandate.id.',
      );
    }

    await this.ensureCredentials();
    try {
      const config = idempotencyKey
        ? { headers: { 'X-Idempotency-Key': idempotencyKey } }
        : undefined;
      this.logger.log(
        `createRecurringPayment: order_id=${payload.order_id}, customer_id=${payload.customer_id}, amount=${payload.amount}, token=present`,
      );
      const { data } = await this.http!.post(
        '/payments/create/recurring',
        // CHANGED: `recurring: true` (boolean) — matches Razorpay's
        // documented request example exactly. Previously sent as the
        // string '1'.
        { ...payload, token, recurring: true },
        config,
      );
      return data;
    } catch (error) {
      this.handleError('createRecurringPayment', error);
    }
  }

  async refundPayment(
    paymentId: string,
    amount: number,
    notes?: Record<string, string>,
  ) {
    await this.ensureCredentials();
    try {
      const { data } = await this.http!.post(`/payments/${paymentId}/refund`, {
        amount,
        notes,
      });
      return data;
    } catch (error) {
      this.handleError('refundPayment', error);
    }
  }

  // ---------------------------------------------------------------------
  // Tokens (mandate lifecycle)
  // ---------------------------------------------------------------------

  async fetchToken(customerId: string, tokenId: string) {
    await this.ensureCredentials();
    try {
      const { data } = await this.http!.get(
        `/customers/${customerId}/tokens/${tokenId}`,
      );
      return data;
    } catch (error) {
      this.handleError('fetchToken', error);
    }
  }

  /** Revokes a saved token so no further recurring debit can be attempted. */
  async deleteToken(customerId: string, tokenId: string) {
    await this.ensureCredentials();
    try {
      const { data } = await this.http!.delete(
        `/customers/${customerId}/tokens/${tokenId}`,
      );
      return data;
    } catch (error) {
      this.handleError('deleteToken', error);
    }
  }
}
