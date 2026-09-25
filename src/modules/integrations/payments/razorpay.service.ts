import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import dayjs from 'dayjs';

import { RazorpayApiClient } from './razorpay-api.client';
import { RecurringMandate } from './entities/recurring-mandate.entity';
import { RecurringMandateTransaction } from './entities/recurring-mandate-transaction.entity';
import { RazorpayWebhookEvent } from './entities/razorpay-webhook-event.entity';

import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateUpiMandateDto } from './dto/create-upi-mandate.dto';
import { CreateCardMandateDto } from './dto/create-card-mandate.dto';
import { CreateMandateOrderDto } from './dto/create-mandate-order.dto';
import { VerifyMandateOrderDto } from './dto/verify-mandate-order.dto';
import { ChargeTokenDto } from './dto/charge-token.dto';
import { CancelMandateDto } from './dto/cancel-mandate.dto';

import { PaymentMethod, CardType } from './enums/payment-method.enum';
import { MandateStatus } from './enums/mandate-status.enum';
import {
  TransactionStatus,
  TransactionType,
} from './enums/transaction-status.enum';

import { ZohoService } from '../../integrations/zoho/zoho.service';

import {
  calculateRecurringAmount,
  rupeesToPaise,
  paiseToRupees,
} from './utils/pricing.util';
import { RazorpayWebhookPayload } from './interfaces/razorpay-webhook-payload.interface';

const GST_RATE = 0.18;



// ============================================================================
// Small pure helpers — no DB/HTTP calls, easy to read and test on their own.
// ============================================================================

// Works out the rupee discount a `coupons` row gives on `baseAmount`.
// Returns 0 if the coupon doesn't apply for any reason (inactive, expired,
// below minimum order, usage limit reached, etc).
function computeCouponDiscount(coupon: any, baseAmount: number): number {
  if (!coupon) return 0;

  const now = new Date();
  if (Number(coupon.status) !== 1) return 0;
  if (coupon.start_date && new Date(coupon.start_date) > now) return 0;
  if (coupon.expiry_date && new Date(coupon.expiry_date) < now) return 0;

  const minOrder = Number(coupon.min_order_amount || 0);
  if (minOrder > 0 && baseAmount < minOrder) return 0;

  const usageLimit = Number(coupon.usage_limit || 0);
  if (usageLimit > 0 && Number(coupon.used_count || 0) >= usageLimit) return 0;

  let discount: number;
  const value = Number(coupon.discount_value || 0);
  if (String(coupon.discount_type).toLowerCase() === 'percentage') {
    discount = Math.round((baseAmount * value) / 100);
    const cap = Number(coupon.max_discount_amount || 0);
    if (cap > 0) {
      discount = Math.min(discount, cap);
    }
  } else {
    discount = value; // flat amount
  }
  return Math.max(0, Math.min(discount, baseAmount));
}

function applyGst(amountRupees: number): number {
  return Math.round(amountRupees * (1 + GST_RATE));
}

function nextBillingDate(fromDate: Date | string, frequency: string): Date {
  const unit = frequency === 'yearly' ? 'year' : 'month';
  return dayjs(fromDate).add(1, unit).toDate();
}

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);

  // Env-configured amounts/durations. Read once in the constructor instead
  // of calling configService.get() everywhere else in the file.
  private readonly upiAuthAmountPaise: number;
  private readonly cardAuthAmountPaise: number;
  private readonly pricePerVenueMonthly: number;
  private readonly yearlyMultiplier: number;
  private readonly upiMandateValidityYears: number;
  private readonly cardMandateValidityYears: number;
  private readonly refundCardAuthorization: boolean;
  // NEW — fallback only. Used when a mandate's metadata doesn't carry a
  // resolvable category/country (problem #12). Real resolution always goes
  // through resolveCategoryId()/resolveCountryId() first; these just stop
  // an insert from failing (or silently writing NULL into a NOT NULL
  // column) while the frontend is updated to send metadata.category /
  // metadata.country on every create-*-mandate call.
  private readonly defaultCategoryId: number | null;
  private readonly defaultCountryId: number | null;

  private readonly SUBSCRIPTION_PAYMENT_COLUMNS = `
  id, subscription_id, razorpay_subscription_id, user_id, order_id, razorpay_order_id,
  transaction_id, payment_id, razorpay_payment_id, razorpay_invoice_id,
  amount, tax_amount, total_amount, currency, quantity, price_per_unit,
  payment_method, payment_status, webhook_event, webhook_status,
  webhook_received_at, paid_at, failure_reason, created_at, updated_at
`;

  constructor(
    private readonly configService: ConfigService,
    private readonly razorpayApi: RazorpayApiClient,
    private readonly dataSource: DataSource,
    private readonly zohoService: ZohoService,
    @InjectRepository(RecurringMandate)
    private readonly mandateRepo: Repository<RecurringMandate>,
    @InjectRepository(RecurringMandateTransaction)
    private readonly transactionRepo: Repository<RecurringMandateTransaction>,
    @InjectRepository(RazorpayWebhookEvent)
    private readonly webhookEventRepo: Repository<RazorpayWebhookEvent>,
  ) {
    this.upiAuthAmountPaise = Number(this.configService.get('UPI_AUTH_AMOUNT_PAISE') ?? 100);
    // FIX (problem #7): was defaulting to 100 (₹1) — the spec's card
    // authorization amount is ₹5 (500 paise). The .env value, if set,
    // still wins; only the fallback default changes.
    this.cardAuthAmountPaise = Number(this.configService.get('CARD_AUTH_AMOUNT_PAISE') ?? 500);
    this.pricePerVenueMonthly = Number(this.configService.get('PRICE_PER_VENUE_MONTHLY') ?? 100);
    this.yearlyMultiplier = Number(this.configService.get('RAZORPAY_YEARLY_MULTIPLIER') ?? 1);
    this.upiMandateValidityYears = Number(this.configService.get('UPI_MANDATE_VALIDITY_YEARS') ?? 3);
    this.cardMandateValidityYears = Number(this.configService.get('CARD_MANDATE_VALIDITY_YEARS') ?? 5);
    this.refundCardAuthorization =
      (this.configService.get('REFUND_CARD_AUTH_AMOUNT') ?? 'true') !== 'false';
    this.defaultCategoryId = this.configService.get('DEFAULT_CATEGORY_ID')
      ? Number(this.configService.get('DEFAULT_CATEGORY_ID'))
      : null;
    this.defaultCountryId = this.configService.get('DEFAULT_COUNTRY_ID')
      ? Number(this.configService.get('DEFAULT_COUNTRY_ID'))
      : null;
  }

  // ==========================================================================
  // 1. CUSTOMER
  // ==========================================================================

  private async getUserProfile(userId: number) {
    const [user] = await this.dataSource.query(
      `SELECT id, name, email, phone FROM users WHERE id = ? LIMIT 1`,
      [userId],
    );
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    const email = String(user.email || '').trim();
    const contact = String(user.phone || '').replace(/\D/g, '');
    if (!email) {
      throw new BadRequestException('User email is required to register a Razorpay customer');
    }
    if (!contact) {
      throw new BadRequestException('User phone is required to register a Razorpay customer');
    }
    return { name: user.name || 'VenueBook User', email, contact };
  }

  async createCustomer(dto: CreateCustomerDto, userId: number) {
    // Reuse the customer from this user's most recent mandate, if we have
    // one and Razorpay still recognises it.
    const existingMandate = await this.mandateRepo.findOne({
      where: { userId },
      order: { id: 'DESC' },
    });
    if (existingMandate?.razorpayCustomerId) {
      try {
        const customer = await this.razorpayApi.fetchCustomer(existingMandate.razorpayCustomerId);
        if (customer?.id) {
          return {
            customerId: customer.id,
            name: customer.name,
            email: customer.email,
            contact: customer.contact,
            reused: true,
          };
        }
      } catch (error: any) {
        this.logger.warn(
          `createCustomer: stored customer ${existingMandate.razorpayCustomerId} for user ${userId} ` +
          `could not be fetched (${error?.message ?? error}) — creating a new customer instead`,
        );
      }
    }

    let customer: any;
    try {
      customer = await this.razorpayApi.createOrFetchCustomer({
        name: dto.name,
        email: dto.email,
        contact: dto.contact,
        notes: { user_id: String(userId) },
      });
    } catch (error: any) {
      // Razorpay can reject a duplicate customer even with fail_existing:0
      // in some edge cases — fall back to a direct lookup before giving up.
      const found = await this.razorpayApi.findCustomerByContact({
        email: dto.email,
        contact: dto.contact,
      });
      if (!found) throw error;
      customer = found;
    }

    if (!customer?.id) {
      throw new BadRequestException('Razorpay customer could not be created or found');
    }

    this.logger.log(`Razorpay customer ready: ${customer.id} (user ${userId})`);
    return {
      customerId: customer.id,
      name: customer.name,
      email: customer.email,
      contact: customer.contact,
      reused: false,
    };
  }

  /**
   * FIX (problem #11): previously `if (dto.customerId) return dto.customerId;`
   * — blindly trusted whatever customer id the frontend sent, with no check
   * that it actually belongs to the authenticated user. A malicious or
   * buggy client could pass ANY existing Razorpay customer id and every
   * later charge would run against a stranger's saved payment method.
   *
   * Now: a supplied customerId is only used if Razorpay's own customer
   * record for it carries `notes.user_id === String(userId)` — the same
   * notes field `createCustomer()`/`createOrFetchCustomer()` above always
   * sets at creation time. This covers the legitimate case (frontend calls
   * POST /payments/create-customer first, then passes that id into
   * create-upi-mandate/create-card-mandate) while rejecting anything that
   * isn't actually this user's customer, without relying on a
   * recurring_mandates row existing yet (there may not be one — customer
   * creation doesn't create a mandate).
   */
  private async getOrCreateCustomerId(dto: { customerId?: string }, userId: number): Promise<string> {
    if (dto.customerId) {
      try {
        const customer: any = await this.razorpayApi.fetchCustomer(dto.customerId);
        if (String(customer?.notes?.user_id ?? '') === String(userId)) {
          return dto.customerId;
        }
        this.logger.warn(
          `getOrCreateCustomerId: user ${userId} supplied customerId ${dto.customerId} whose Razorpay ` +
          `notes.user_id ("${customer?.notes?.user_id ?? ''}") does not match — refusing to use it.`,
        );
      } catch (error: any) {
        this.logger.warn(
          `getOrCreateCustomerId: could not verify supplied customerId ${dto.customerId} for user ${userId} ` +
          `(${error?.message ?? error}) — resolving the real customer instead.`,
        );
      }
    }
    const profile = await this.getUserProfile(userId);
    const customer = await this.createCustomer(profile as CreateCustomerDto, userId);
    return customer.customerId;
  }

  // ==========================================================================
  // 2/3. CREATE A MANDATE AUTHORIZATION ORDER (UPI / Card / method-unset)
  //
  // The three public methods below (createUpiMandate, createCardMandate,
  // createMandateOrder) used to be three separate, almost-identical copies
  // of this logic. They now all call this one shared method — same
  // behaviour, far less code to keep in sync.
  //
  // NOT changed here: the createOrder() call with a `token: { max_amount,
  // expire_at, frequency }` block IS the correct, currently-documented
  // Razorpay API for registering a card/UPI recurring authorization
  // (POST /v1/orders) — verified against Razorpay's official docs. See the
  // review notes for problem #1; no endpoint change was made.
  // ==========================================================================

  private async createMandateAuthorization(
    method: PaymentMethod.UPI | PaymentMethod.CARD | PaymentMethod.PENDING,
    dto: CreateUpiMandateDto | CreateCardMandateDto | CreateMandateOrderDto,
    userId: number,
  ) {
    const customerId = await this.getOrCreateCustomerId(dto, userId);

    const baseAmount = calculateRecurringAmount({
      quantity: dto.quantity,
      billingCycle: dto.billingCycle,
      pricePerVenueMonthly: dto.pricePerVenue ?? this.pricePerVenueMonthly,
      yearlyMultiplier: this.yearlyMultiplier,
    });
    const maxAmountRupees = applyGst(baseAmount);
    this.warnIfMaxAmountDrifts(maxAmountRupees, (dto as any).maxAmount);

    const startDate = dto.startDate ? dayjs(dto.startDate) : dayjs();
    const validityYears =
      method === PaymentMethod.UPI
        ? this.upiMandateValidityYears
        : method === PaymentMethod.CARD
        ? this.cardMandateValidityYears
        : Number(this.configService.get('MANDATE_VALIDITY_YEARS') ?? 3);
    const expireAt = startDate.add(validityYears, 'year');

    const authAmountPaise =
      method === PaymentMethod.UPI
        ? this.upiAuthAmountPaise
        : method === PaymentMethod.CARD
        ? this.cardAuthAmountPaise
        : Number(this.configService.get('MANDATE_AUTH_AMOUNT_PAISE') ?? 100);

    const receipt = `MANDATE_${method}_${userId}_${Date.now()}`;

    let order: any;
    try {
      order = await this.razorpayApi.createOrder({
        amount: authAmountPaise,
        currency: 'INR',
        receipt,
        customer_id: customerId,
        // For the "unset" (unified) flow, method is left off the order so
        // Razorpay Checkout can offer both UPI and card.
        ...(method !== PaymentMethod.PENDING ? { method } : {}),
        token: {
          max_amount: rupeesToPaise(maxAmountRupees),
          expire_at: expireAt.unix(),
          frequency: dto.billingCycle,
        },
        notes: {
          user_id: String(userId),
          payment_method: method,
          quantity: String(dto.quantity),
          billing_cycle: dto.billingCycle,
          purpose: 'recurring_mandate_authorization',
        },
      });
    } catch (error: any) {
      const reason = error?.error?.description || error?.message || 'unknown error';
      this.logger.error(
        `createMandateAuthorization (${method}): Razorpay order creation failed for user ${userId} — ${reason}. ` +
        'If this only happens in LIVE mode (test works fine), check whether recurring/e-mandate ' +
        'payments are approved for this account in live mode.',
      );
      throw new BadRequestException(`Razorpay order could not be created: ${reason}`);
    }
    if (!order?.id) {
      throw new BadRequestException('Razorpay order could not be created for the mandate');
    }

    const mandate = await this.mandateRepo.save(
      this.mandateRepo.create({
        userId,
        razorpayCustomerId: customerId,
        tokenId: null,
        mandateId: null,
        paymentMethod: method,
        authorizationAmount: paiseToRupees(authAmountPaise).toFixed(2),
        status: MandateStatus.PENDING_AUTHENTICATION,
        maxAmount: maxAmountRupees.toFixed(2),
        frequency: dto.billingCycle,
        startDate: startDate.toDate(),
        endDate: expireAt.toDate(),
        razorpayOrderId: order.id,
        metadata: {
          quantity: dto.quantity,
          pricePerVenue: dto.pricePerVenue ?? this.pricePerVenueMonthly,
          ...('cardTypeHint' in dto ? { cardTypeHint: dto.cardTypeHint ?? CardType.UNKNOWN } : {}),
          ...dto.metadata,
        },
      }),
    );

    await this.transactionRepo.save(
      this.transactionRepo.create({
        mandateId: mandate.id,
        transactionType: TransactionType.AUTHORIZATION,
        razorpayOrderId: order.id,
        amount: paiseToRupees(authAmountPaise).toFixed(2),
        currency: 'INR',
        status: TransactionStatus.INITIATED,
      }),
    );

    this.logger.log(
      `Mandate ${mandate.id} (${method}) created for user ${userId}, order ${order.id}, ` +
      `status=${mandate.status}, awaiting authorization`,
    );

    return {
      success: true,
      key_id: await this.razorpayApi.getPublicKeyId(),
      customer: { id: customerId },
      order: { id: order.id, amount: order.amount, currency: order.currency },
      mandate: {
        id: mandate.id,
        status: mandate.status,
        payment_method: mandate.paymentMethod,
        max_amount: mandate.maxAmount,
        frequency: mandate.frequency,
      },
      ...(method === PaymentMethod.CARD
        ? {
            note:
              'Complete Checkout with 3DS/OTP authentication to activate this mandate. ' +
              'The card authorization amount is refunded automatically once the token is confirmed.',
          }
        : {}),
    };
  }

  async createUpiMandate(dto: CreateUpiMandateDto, userId: number) {
    return this.createMandateAuthorization(PaymentMethod.UPI, dto, userId);
  }

  async createCardMandate(dto: CreateCardMandateDto, userId: number) {
    return this.createMandateAuthorization(PaymentMethod.CARD, dto, userId);
  }

  async createMandateOrder(dto: CreateMandateOrderDto, userId: number) {
    return this.createMandateAuthorization(PaymentMethod.PENDING, dto, userId);
  }

  // ==========================================================================
  // 4. VERIFY THE AUTHORIZATION PAYMENT AND ACTIVATE THE SUBSCRIPTION
  //
  // CHANGED: this method used to build the subscription itself (calling
  // upsertSubscriptionForMandate/recordSubscriptionPayment directly) in
  // addition to whatever activateMandateFromPayment() already did. That
  // meant TWO independent code paths could each try to create the
  // subscription row for the same mandate — this HTTP call, and the
  // payment.captured webhook, which can legitimately race each other
  // (Razorpay fires the webhook as soon as the payment captures, often
  // before/alongside the Checkout `handler` callback reaching our
  // frontend). Now verifyMandateOrder only drives the mandate state
  // transition via activateMandateFromPayment() (the same method the
  // webhook uses) and reads back whatever that produced — there is exactly
  // one place that can create a subscription. See activateMandateWithToken
  // below.
  // ==========================================================================

  async verifyMandateOrder(dto: VerifyMandateOrderDto, userId: number) {
    const signatureIsValid = await this.razorpayApi.verifyCheckoutSignature(
      dto.orderId,
      dto.paymentId,
      dto.signature,
    );
    if (!signatureIsValid) {
      throw new BadRequestException('Invalid Razorpay payment signature');
    }

    const mandate = await this.mandateRepo.findOne({ where: { razorpayOrderId: dto.orderId } });
    if (!mandate) {
      throw new NotFoundException(`No mandate found for order ${dto.orderId}`);
    }
    if (mandate.userId !== userId) {
      throw new BadRequestException('This mandate does not belong to the authenticated user');
    }

    const payment: any = await this.razorpayApi.fetchPayment(dto.paymentId);
    if (!payment || payment.order_id !== dto.orderId) {
      throw new BadRequestException('Payment does not match the given order');
    }
    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      throw new BadRequestException(`Payment is not yet captured (status: ${payment.status})`);
    }

    if (mandate.status !== MandateStatus.ACTIVE) {
      await this.activateMandateFromPayment(mandate, payment);
    }

    const refreshed = await this.mandateRepo.findOneOrFail({ where: { id: mandate.id } });

    // Razorpay captured the ₹ authorization but hasn't handed us a token
    // yet (common for UPI, where the bank confirms the mandate a little
    // later). We don't fail the request — we tell the frontend to keep
    // polling, and `sweepTokenMissingMandates` (run on a schedule) / the
    // token.confirmed webhook will pick the token up once Razorpay has it.
    if (!refreshed.tokenId) {
      this.logger.warn(
        `verifyMandateOrder: mandate ${refreshed.id} payment ${dto.paymentId} captured but ` +
        'token_id is still missing — subscription not activated yet.',
      );
      return {
        success: true,
        payment_captured: true,
        awaiting_token_confirmation: true,
        mandate: {
          id: refreshed.id,
          status: refreshed.status,
          payment_method: refreshed.paymentMethod,
          max_amount: refreshed.maxAmount,
          frequency: refreshed.frequency,
          token_id: null,
        },
        subscription: null,
        message:
          'Payment received — confirming the mandate with your bank. This can take a few ' +
          'minutes before the subscription activates. Please check back shortly.',
        order_id: dto.orderId,
        payment_id: dto.paymentId,
      };
    }

    const [subscription] = await this.dataSource.query(
      `SELECT id, quantity, price_per_unit, current_amount, gst_rate, gst_amount, total_amount, coupan_code
         FROM user_subscriptions WHERE recurring_mandate_id = ? ORDER BY id DESC LIMIT 1`,
      [refreshed.id],
    );
    if (!subscription) {
      // Should never happen — activateMandateFromPayment() always creates
      // a subscription in the same transaction as flipping the mandate to
      // ACTIVE (see activateMandateWithToken). Surfacing this loudly
      // rather than silently returning `subscription: null` for an ACTIVE
      // mandate (that was exactly problem #4).
      this.logger.error(
        `verifyMandateOrder: mandate ${refreshed.id} is ACTIVE with token ${refreshed.tokenId} but has NO ` +
        'linked user_subscriptions row — this should be impossible, please investigate.',
      );
      throw new BadRequestException(
        'Mandate is active but its subscription could not be found — please contact support.',
      );
    }

    return {
      success: true,
      mandate: {
        id: refreshed.id,
        status: refreshed.status,
        payment_method: refreshed.paymentMethod,
        max_amount: refreshed.maxAmount,
        frequency: refreshed.frequency,
        token_id: refreshed.tokenId,
      },
      subscription: {
        id: subscription.id,
        quantity: subscription.quantity,
        price_per_unit: subscription.price_per_unit,
        current_amount: subscription.current_amount,
        gst_rate: subscription.gst_rate,
        gst_amount: subscription.gst_amount,
        total_amount: subscription.total_amount,
        coupon_code: subscription.coupan_code,
      },
      order_id: dto.orderId,
      payment_id: dto.paymentId,
    };
  }

  private resolvePaymentMethod(mandate: RecurringMandate, razorpayMethod: string | undefined): PaymentMethod {
    if (mandate.paymentMethod !== PaymentMethod.PENDING) return mandate.paymentMethod;
    if (razorpayMethod === 'upi') return PaymentMethod.UPI;
    if (razorpayMethod === 'card') return PaymentMethod.CARD;
    return mandate.paymentMethod;
  }

  // --- pricing & coupon -----------------------------------------------------

  private parseMandateMetadata(mandate: RecurringMandate): Record<string, any> {
    const raw = (mandate as any)?.metadata;
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw || {};
    } catch {
      return {};
    }
  }

  private async lookupCoupon(code: string): Promise<any | null> {
    if (!code) return null;
    try {
      const rows = await this.dataSource.query(
        `SELECT id, code, discount_type, discount_value, min_order_amount,
                max_discount_amount, start_date, expiry_date, usage_limit,
                usage_per_user, used_count, applicable_for, category_id,
                plan_id, status
           FROM coupons
          WHERE code = ?
          LIMIT 1`,
        [code],
      );
      return rows?.[0] ?? null;
    } catch (error: any) {
      this.logger.warn(`lookupCoupon: failed to look up coupon "${code}" (${error?.message ?? error})`);
      return null;
    }
  }

  private async computePricing(metadata: Record<string, any>) {
    const quantity = Number(metadata?.quantity) > 0 ? Number(metadata.quantity) : 1;
    const pricePerUnit = Number(metadata?.pricePerVenue) > 0 ? Number(metadata.pricePerVenue) : 0;
    const currentAmount = quantity * pricePerUnit;

    const gstAmount = Math.round(currentAmount * GST_RATE);
    const grossAmount = currentAmount + gstAmount;

    const requestedCode = metadata?.coupon ? String(metadata.coupon).trim().toUpperCase() : null;
    const coupon = requestedCode ? await this.lookupCoupon(requestedCode) : null;
    const discountAmount = computeCouponDiscount(coupon, grossAmount);
    const totalAmount = Math.max(0, grossAmount - discountAmount);

    return {
      quantity,
      pricePerUnit,
      currentAmount,
      gstRate: GST_RATE * 100,
      gstAmount,
      discountAmount,
      totalAmount,
      couponCode: coupon ? requestedCode : null,
    };
  }

  // --- user_subscriptions / user_subscription_payments -----------------------

  private async resolveCategoryId(category: unknown): Promise<number | null> {
    if (category === null || category === undefined || category === '') return null;
    const raw = String(category);
    if (/^\d+$/.test(raw)) return Number(raw);
    try {
      const rows = await this.dataSource.query(`SELECT id FROM categories WHERE name = ? LIMIT 1`, [raw]);
      return rows?.[0]?.id ?? null;
    } catch (error: any) {
      this.logger.warn(
        `resolveCategoryId: could not resolve category "${raw}" (${error?.message ?? error})`,
      );
      return null;
    }
  }

  /**
   * NEW (problem #12) — mirrors resolveCategoryId(). Looks up a numeric
   * country id from either a numeric string (used as-is) or an ISO code /
   * name against a `countries` table.
   *
   * ASSUMPTION TO CONFIRM: this assumes a `countries` table with `id` and
   * a `code` column (e.g. 'IN', 'AE'), matching the region-first (IN, AE)
   * architecture the rest of the platform uses. If your actual schema
   * differs (different table/column names, or country lives inside the
   * region-system config rather than a DB table), point this query at the
   * real source instead — do not leave it querying a table that doesn't
   * exist. See the migration notes for a placeholder `countries` table if
   * you don't already have one.
   */
  private async resolveCountryId(country: unknown): Promise<number | null> {
    if (country === null || country === undefined || country === '') return null;
    const raw = String(country);
    if (/^\d+$/.test(raw)) return Number(raw);
    try {
      const rows = await this.dataSource.query(
        `SELECT id FROM countries WHERE code = ? OR name = ? LIMIT 1`,
        [raw.toUpperCase(), raw],
      );
      return rows?.[0]?.id ?? null;
    } catch (error: any) {
      this.logger.warn(
        `resolveCountryId: could not resolve country "${raw}" (${error?.message ?? error})`,
      );
      return null;
    }
  }

  /**
   * FIX (problems #4, #12, #13): rewritten to (a) accept a transactional
   * EntityManager instead of always going through `this.dataSource` — so
   * this can now run inside the same transaction as the mandate's ACTIVE
   * flip (see activateMandateWithToken) instead of as an unrelated,
   * separately-committed write; (b) resolve category_id/country_id for
   * real instead of the hardcoded `2, 2`; (c) take the mandate itself
   * (plus orderId/paymentId) instead of a VerifyMandateOrderDto, since
   * it's now called from the webhook path too, which has no such dto;
   * (d) lock any existing row for this mandate with `FOR UPDATE` before
   * deciding insert-vs-update, so the webhook path and the frontend
   * verify-mandate-order path can never both see "no existing row" and
   * insert two subscriptions for the same mandate.
   */
  // private async upsertSubscriptionForMandate(
  //   manager: EntityManager,
  //   mandate: RecurringMandate,
  //   metadata: Record<string, any>,
  //   pricing: Awaited<ReturnType<RazorpayService['computePricing']>>,
  //   paymentMethod: PaymentMethod,
  //   orderId: string | null,
  //   paymentId: string | null,
  // ): Promise<number> {
  //   const planId = Number(metadata?.selectedPlan) > 0 ? Number(metadata.selectedPlan) : 1;
  //   const categoryId = (await this.resolveCategoryId(metadata?.category)) ?? this.defaultCategoryId;
  //   const countryId = (await this.resolveCountryId(metadata?.country ?? metadata?.countryCode)) ?? this.defaultCountryId;

  //   if (categoryId === null || countryId === null) {
  //     this.logger.warn(
  //       `upsertSubscriptionForMandate: mandate ${mandate.id} has no resolvable category/country ` +
  //       `(metadata.category="${metadata?.category ?? ''}", metadata.country="${metadata?.country ?? ''}") and no ` +
  //       'DEFAULT_CATEGORY_ID/DEFAULT_COUNTRY_ID fallback configured — writing NULL. Update the frontend to send ' +
  //       'metadata.category / metadata.country on mandate creation, or set the fallback env vars.',
  //     );
  //   }

  //   const subscriptionMetadata = JSON.stringify({
  //     ...metadata,
  //     source: 'razorpay_mandate_activation',
  //     order_id: orderId,
  //     payment_id: paymentId,
  //     mandate_id: mandate.id,
  //   });

  //   const existing = await manager.query(
  //     `SELECT id FROM user_subscriptions WHERE user_id = ? AND recurring_mandate_id = ? ORDER BY id DESC LIMIT 1 FOR UPDATE`,
  //     [mandate.userId, mandate.id],
  //   );

  //   if (existing?.length) {
  //     const subscriptionId = existing[0].id;
  //     await manager.query(
  //       `UPDATE user_subscriptions SET
  //          quantity = ?, price_per_unit = ?, current_amount = ?, gst_rate = ?, gst_amount = ?,
  //          total_amount = ?, coupan_code = ?, plan_id = ?, category_id = ?, country_id = ?, payment_method = ?,
  //          razorpay_customer_id = ?, razorpay_token_id = ?, razorpay_order_id = ?, razorpay_payment_id = ?,
  //          status = 'active', metadata = ?, updated_at = NOW()
  //        WHERE id = ? AND user_id = ?`,
  //       [
  //         pricing.quantity, pricing.pricePerUnit, pricing.currentAmount, pricing.gstRate, pricing.gstAmount,
  //         pricing.totalAmount, pricing.couponCode, planId, 1, 2, paymentMethod,
  //         mandate.razorpayCustomerId || null, mandate.tokenId || null, orderId, paymentId,
  //         subscriptionMetadata, subscriptionId, mandate.userId,
  //       ],
  //     );
  //     this.logger.log(
  //       `user_subscriptions ${subscriptionId} updated for mandate ${mandate.id} ` +
  //       `(qty=${pricing.quantity}, total=₹${pricing.totalAmount})`,
  //     );
  //     return subscriptionId;
  //   }

  //   const subscriptionCode = `VB-${mandate.id}-${Date.now()}`;
  //   const nextBilling = nextBillingDate(mandate.startDate || new Date(), mandate.frequency);

  //   await manager.query(
  //     `INSERT INTO user_subscriptions (
  //        user_id, recurring_mandate_id, subscription_code, plan_id, category_id, country_id,
  //        quantity, price_per_unit, current_amount, gst_rate, gst_amount, total_amount, coupan_code,
  //        start_date, end_date, next_billing_date, auto_renew, status, payment_method,
  //        razorpay_customer_id, razorpay_token_id, razorpay_order_id, razorpay_payment_id,
  //        metadata, created_at, updated_at
  //      ) VALUES (
  //        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, 1, 'active', ?, ?, ?, ?, ?, ?, NOW(), NOW()
  //      )`,
  //     [
  //       mandate.userId, mandate.id, subscriptionCode, planId, 1, 2,
  //       pricing.quantity, pricing.pricePerUnit, pricing.currentAmount, pricing.gstRate, pricing.gstAmount,
  //       pricing.totalAmount, pricing.couponCode, mandate.endDate || null, nextBilling, paymentMethod,
  //       mandate.razorpayCustomerId || null, mandate.tokenId || null, orderId, paymentId,
  //       subscriptionMetadata,
  //     ],
  //   );

  //   const created = await manager.query(
  //     `SELECT id FROM user_subscriptions WHERE user_id = ? AND recurring_mandate_id = ? ORDER BY id DESC LIMIT 1`,
  //     [mandate.userId, mandate.id],
  //   );
  //   if (!created?.length) {
  //     throw new BadRequestException('Subscription was created but could not be retrieved');
  //   }
  //   this.logger.log(
  //     `user_subscriptions ${created[0].id} created for mandate ${mandate.id} ` +
  //     `(qty=${pricing.quantity}, total=₹${pricing.totalAmount}, next_billing_date=${dayjs(nextBilling).format('YYYY-MM-DD')})`,
  //   );
  //   return created[0].id;
  // }

private async upsertSubscriptionForMandate(
  manager: EntityManager,
  mandate: RecurringMandate,
  metadata: Record<string, any>,
  pricing: Awaited<ReturnType<RazorpayService['computePricing']>>,
  paymentMethod: PaymentMethod,
  orderId: string | null,
  paymentId: string | null,
): Promise<number> {
  const planId = Number(metadata?.selectedPlan) > 0 ? Number(metadata.selectedPlan) : 1;
  const categoryId = (await this.resolveCategoryId(metadata?.category)) ?? this.defaultCategoryId;
  const countryId = (await this.resolveCountryId(metadata?.country ?? metadata?.countryCode)) ?? this.defaultCountryId;
 
  if (categoryId === null || countryId === null) {
    this.logger.warn(
      `upsertSubscriptionForMandate: mandate ${mandate.id} has no resolvable category/country ` +
      `(metadata.category="${metadata?.category ?? ''}", metadata.country="${metadata?.country ?? ''}") and no ` +
      'DEFAULT_CATEGORY_ID/DEFAULT_COUNTRY_ID fallback configured — writing NULL. Update the frontend to send ' +
      'metadata.category / metadata.country on mandate creation, or set the fallback env vars.',
    );
  }
 
  const subscriptionMetadata = JSON.stringify({
    ...metadata,
    source: 'razorpay_mandate_activation',
    order_id: orderId,
    payment_id: paymentId,
    mandate_id: mandate.id,
  });
 
  // Match by recurring_mandate_id ONLY — do not require user_id to match
  // too, since mandate.userId can arrive null (that was the bug) and a
  // mandate has at most one subscription anyway.
  const existing = await manager.query(
    `SELECT id, user_id FROM user_subscriptions
      WHERE id = ?
      ORDER BY id DESC
      LIMIT 1
      FOR UPDATE`,
    [mandate.id],
  );
 
  if (!existing?.length) {
    // This path is update-only: a user_subscriptions row is expected to
    // already exist for this mandate before activation runs. Surface the
    // problem loudly instead of inserting a row with a null/guessed user_id.
    this.logger.error(
      `upsertSubscriptionForMandate: no existing user_subscriptions row found for mandate ${mandate.id} — ` +
      'expected one to already exist before activation. Not inserting.',
    );
    throw new BadRequestException(
      `No existing subscription found for mandate ${mandate.id} — cannot activate.`,
    );
  }
 
  const subscriptionId = existing[0].id;
 
  await manager.query(
    `UPDATE user_subscriptions SET
       quantity = ?, price_per_unit = ?, current_amount = ?, gst_rate = ?, gst_amount = ?,
       total_amount = ?, coupan_code = ?, plan_id = ?, category_id = ?, country_id = ?, payment_method = ?,
       razorpay_customer_id = ?, razorpay_token_id = ?, razorpay_order_id = ?, razorpay_payment_id = ?,
       status = 'active', metadata = ?, updated_at = NOW()
     WHERE id = ?`,
    [
      pricing.quantity, pricing.pricePerUnit, pricing.currentAmount, pricing.gstRate, pricing.gstAmount,
      pricing.totalAmount, pricing.couponCode, planId, categoryId, countryId, paymentMethod,
      mandate.razorpayCustomerId || null, mandate.tokenId || null, orderId, paymentId,
      subscriptionMetadata, subscriptionId,
    ],
  );
 
  this.logger.log(
    `user_subscriptions ${subscriptionId} updated for mandate ${mandate.id} ` +
    `(qty=${pricing.quantity}, total=₹${pricing.totalAmount})`,
  );
 
  return subscriptionId;
}

  /**
   * FIX (problem #13): renamed from recordSubscriptionPayment, now takes a
   * transactional EntityManager so this write commits atomically with the
   * mandate/subscription writes above instead of as an unrelated separate
   * statement.
   */
  private async recordAuthorizationPayment(
    manager: EntityManager,
    subscriptionId: number,
    mandate: RecurringMandate,
    payment: any,
    pricing: Awaited<ReturnType<RazorpayService['computePricing']>>,
    paymentMethod: PaymentMethod,
    orderId: string | null,
  ): Promise<void> {
    const existing = await manager.query(
      `SELECT id FROM user_subscription_payments WHERE razorpay_payment_id = ? OR payment_id = ? LIMIT 1`,
      [payment.id, payment.id],
    );
    if (existing?.length) {
      this.logger.log(`Payment ${payment.id} already recorded — skipping duplicate insert`);
      return;
    }

    const amount = paiseToRupees(Number(payment.amount) || 0);
    await manager.query(
      `INSERT INTO user_subscription_payments (
         subscription_id, razorpay_subscription_id, user_id, order_id, razorpay_order_id,
         transaction_id, payment_id, razorpay_payment_id, razorpay_invoice_id,
         amount, tax_amount, total_amount, currency, quantity, price_per_unit,
         payment_method, payment_status, webhook_event, webhook_status,
         webhook_received_at, paid_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW(), NOW())`,
      [
        subscriptionId, null, 0 , orderId, orderId, payment.id, payment.id,
        payment.id, payment.invoice_id || null, amount, 0, amount, payment.currency || 'INR',
        pricing.quantity, pricing.pricePerUnit, paymentMethod,
        payment.status === 'captured' ? 'paid' : 'authorized',
        'mandate_activation', 'processed',
      ],
    );
    this.logger.log(
      `user_subscription_payments recorded (authorization): subscription=${subscriptionId}, ` +
      `payment=${payment.id}, amount=₹${amount}`,
    );
  }

  /**
   * NEW — the single place that turns "we have a confirmed Razorpay token
   * for this mandate" into ACTIVE + a subscription row, atomically.
   *
   * Every caller that ends up holding (mandate, tokenId) goes through
   * here: activateMandateFromPayment() (payment.captured webhook +
   * verify-mandate-order + the reconciliation sweep) and onTokenConfirmed()
   * (token.confirmed webhook). Before this change each of those either
   * duplicated this logic or skipped it entirely (onTokenConfirmed never
   * created a subscription at all — problem #4). Now there is exactly one
   * transactional path, so an ACTIVE mandate without a linked subscription
   * should be structurally impossible.
   */
  private async activateMandateWithToken(
    mandate: RecurringMandate,
    params: {
      tokenId: string;
      npciMandateId?: string | null;
      paymentMethod: PaymentMethod;
      cardMeta?: { network?: string; type?: string; last4?: string };
      bank?: string;
      orderId: string | null;
      /** Razorpay payment entity, when we have one (may be null for a bare token.confirmed with no linked payment on file). */
      payment: any | null;
    },
  ): Promise<{ subscriptionId: number }> {
    return this.dataSource.transaction(async (manager) => {
      if (params.orderId) {
        const transaction = await manager.findOne(RecurringMandateTransaction, {
          where: { mandateId: mandate.id, razorpayOrderId: params.orderId },
          order: { id: 'DESC' },
        });
        if (transaction && params.payment) {
          await manager.update(RecurringMandateTransaction, transaction.id, {
            razorpayPaymentId: params.payment.id,
            status: TransactionStatus.SUCCESS,
            rawResponse: params.payment as any,
          });
        }
      }

      await manager.update(RecurringMandate, mandate.id, {
        tokenId: params.tokenId,
        mandateId: params.npciMandateId ?? mandate.mandateId ?? params.tokenId,
        paymentMethod: params.paymentMethod,
        status: MandateStatus.ACTIVE,
        metadata: {
          ...(mandate.metadata || {}),
          ...(params.cardMeta?.network ? { cardNetwork: params.cardMeta.network } : {}),
          ...(params.cardMeta?.type ? { cardType: params.cardMeta.type } : {}),
          ...(params.cardMeta?.last4 ? { cardLast4: params.cardMeta.last4 } : {}),
          ...(params.bank ? { bank: params.bank } : {}),
        },
      });

      const activeMandate: RecurringMandate = {
        ...mandate,
        tokenId: params.tokenId,
        paymentMethod: params.paymentMethod,
        status: MandateStatus.ACTIVE,
      } as RecurringMandate;

      const metadata = this.parseMandateMetadata(mandate);
      const pricing = await this.computePricing(metadata);
      const paymentId: string | null =
        params.payment?.id ?? (mandate.metadata as any)?.lastCapturedPaymentId ?? null;

      const subscriptionId = await this.upsertSubscriptionForMandate(
        manager,
        activeMandate,
        metadata,
        pricing,
        params.paymentMethod,
        params.orderId,
        paymentId,
      );

      if (params.payment) {
        await this.recordAuthorizationPayment(
          manager,
          subscriptionId,
          activeMandate,
          params.payment,
          pricing,
          params.paymentMethod,
          params.orderId,
        );
      }

      return { subscriptionId };
    });
  }

  // ==========================================================================
  // 5. CHARGE A SAVED TOKEN — POST /payments/charge-token
  // ==========================================================================

  async chargeToken(dto: ChargeTokenDto) {
    const mandate = await this.mandateRepo.findOne({ where: { id: dto.mandateId } });
    if (!mandate) {
      throw new NotFoundException(`Mandate ${dto.mandateId} not found`);
    }

    // Replay guard: if this exact idempotency key already produced a
    // transaction, return that instead of charging again.
    if (dto.idempotencyKey) {
      const existing = await this.transactionRepo.findOne({
        where: { mandateId: mandate.id, idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        this.logger.log(`Idempotent replay for mandate ${mandate.id}, key ${dto.idempotencyKey}`);
        return {
          success: true,
          mandate_id: mandate.id,
          transaction_id: existing.id,
          order_id: existing.razorpayOrderId,
          amount: Number(existing.amount),
          currency: existing.currency,
          status: existing.status,
          idempotent_replay: true,
        };
      }
    }

    if (mandate.status !== MandateStatus.ACTIVE) {
      throw new ConflictException(
        `Mandate ${mandate.id} is inactive (status: ${mandate.status}). Only an ACTIVE mandate ` +
        'with a confirmed token can be charged.',
      );
    }
    if (!mandate.tokenId || !mandate.razorpayCustomerId) {
      throw new ConflictException(`Mandate ${mandate.id} has no confirmed token/customer yet.`);
    }
    if (mandate.endDate && dayjs(mandate.endDate).isBefore(dayjs())) {
      throw new ConflictException(
        `Mandate ${mandate.id} token has expired (end date: ${dayjs(mandate.endDate).format('YYYY-MM-DD')}).`,
      );
    }

    const metadata = this.parseMandateMetadata(mandate);
    const pricing = await this.computePricing(metadata);
    const amount = dto.amount ?? pricing.totalAmount;

    if (amount > Number(mandate.maxAmount)) {
      throw new BadRequestException(
        `Requested amount ₹${amount} exceeds the mandate's max_amount ₹${mandate.maxAmount}`,
      );
    }

    this.logger.log(
      `Recurring charge: mandate=${mandate.id}, amount=₹${amount} ` +
      `(gst=₹${pricing.gstAmount}, discount=₹${pricing.discountAmount}, coupon=${pricing.couponCode ?? 'none'})`,
    );

    const customer = await this.razorpayApi.fetchCustomer(mandate.razorpayCustomerId);
    const order = await this.razorpayApi.createOrder({
      amount: rupeesToPaise(amount),
      currency: 'INR',
      receipt: `CHARGE_${mandate.id}_${Date.now()}`,
      notes: { mandate_id: String(mandate.id) },
    });

    // FIX (problem #10): the app-level "does this idempotencyKey already
    // have a transaction row" check above has a race window — two cron
    // ticks (or a manual retry racing the cron) can both pass that SELECT
    // before either INSERT commits. The unique index on
    // (mandate_id, idempotency_key) — see the migration notes — turns that
    // race into a hard DB constraint instead of a possible double charge;
    // this catch treats the resulting duplicate-key error as the same
    // "idempotent replay" case as the check above.
    let transaction: RecurringMandateTransaction;
    try {
      transaction = await this.transactionRepo.save(
        this.transactionRepo.create({
          mandateId: mandate.id,
          transactionType: TransactionType.RECURRING_CHARGE,
          razorpayOrderId: order.id,
          amount: amount.toFixed(2),
          currency: 'INR',
          status: TransactionStatus.PROCESSING,
          idempotencyKey: dto.idempotencyKey ?? null,
        }),
      );
    } catch (error: any) {
      if (dto.idempotencyKey && this.isDuplicateKeyError(error)) {
        const existing = await this.transactionRepo.findOne({
          where: { mandateId: mandate.id, idempotencyKey: dto.idempotencyKey },
        });
        if (existing) {
          this.logger.warn(
            `chargeToken: DB-level idempotency race caught for mandate ${mandate.id}, key ${dto.idempotencyKey} ` +
            '— returning the existing transaction instead of charging again.',
          );
          return {
            success: true,
            mandate_id: mandate.id,
            transaction_id: existing.id,
            order_id: existing.razorpayOrderId,
            amount: Number(existing.amount),
            currency: existing.currency,
            status: existing.status,
            idempotent_replay: true,
          };
        }
      }
      throw error;
    }

    try {
      const payment = await this.razorpayApi.createRecurringPayment(
        {
          email: String(customer.email),
          contact: String(customer.contact),
          customer_id: mandate.razorpayCustomerId,
          token: mandate.tokenId,
          amount: rupeesToPaise(amount),
          currency: 'INR',
          order_id: order.id,
          description: dto.description ?? `Recurring charge for mandate ${mandate.id}`,
          notes: { mandate_id: String(mandate.id), transaction_id: String(transaction.id) },
        },
        dto.idempotencyKey,
      );

      await this.transactionRepo.update(transaction.id, {
        razorpayPaymentId: payment?.razorpay_payment_id ?? payment?.id ?? null,
        rawResponse: payment,
      });

      this.logger.log(`Recurring charge initiated for mandate ${mandate.id}: order ${order.id}, ₹${amount}`);
      return {
        success: true,
        mandate_id: mandate.id,
        transaction_id: transaction.id,
        order_id: order.id,
        amount,
        currency: 'INR',
        status: 'processing',
      };
    } catch (error: any) {
      const failureReason =
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
          ? error.message
          : `Razorpay API error: ${error?.message ?? 'unknown error'}`;

      await this.transactionRepo.update(transaction.id, {
        status: TransactionStatus.FAILED,
        failureReason,
      });
      this.logger.error(`Recurring charge failed for mandate ${mandate.id}: ${failureReason}`);
      throw error;
    }
  }

  // ==========================================================================
  // SCHEDULED WORK — called by a cron job elsewhere (e.g. once daily).
  // Razorpay never bills automatically on this integration; this is what
  // actually triggers chargeToken() for subscriptions that are due.
  // ==========================================================================

  async runDueRecurringCharges() {
    const due = await this.dataSource.query(
      `SELECT us.id AS subscription_id, us.recurring_mandate_id, us.next_billing_date
         FROM user_subscriptions us
         INNER JOIN recurring_mandates rm ON rm.id = us.recurring_mandate_id
        WHERE us.next_billing_date <= NOW()
          AND us.status = 'active'
          AND us.auto_renew = 1
          AND rm.status = ?`,
      [MandateStatus.ACTIVE],
    );

    this.logger.log(`runDueRecurringCharges: ${due.length} subscription(s) due for billing`);

    const results: Array<{ mandateId: number; success: boolean; error?: string }> = [];
    let succeeded = 0;
    let failed = 0;

    for (const row of due) {
      const mandateId = row.recurring_mandate_id;
      // Stable per mandate per due date, so charging the same mandate
      // twice for the same day (a re-run, a manual trigger) is a no-op —
      // chargeToken()'s idempotency-key replay guard (app-level AND now
      // DB-level, see chargeToken) catches it.
      const idempotencyKey = `SCHEDULED_${mandateId}_${dayjs(row.next_billing_date).format('YYYY-MM-DD')}`;
      try {
        await this.chargeToken({ mandateId, idempotencyKey } as ChargeTokenDto);
        succeeded++;
        results.push({ mandateId, success: true });
      } catch (error: any) {
        failed++;
        const message = error?.message ?? String(error);
        results.push({ mandateId, success: false, error: message });
        this.logger.error(`runDueRecurringCharges: charge failed for mandate ${mandateId} — ${message}`);
      }
    }

    this.logger.log(`runDueRecurringCharges: done — processed=${due.length}, succeeded=${succeeded}, failed=${failed}`);
    return { processed: due.length, succeeded, failed, results };
  }

  // Picks up mandates whose authorization payment was captured but never
  // got a token_id back from Razorpay (rare, but it happens). Run this on
  // a schedule too (e.g. every 15–30 minutes) — it's the safety net for
  // the immediate reconciliation attempt in activateMandateFromPayment.
  async sweepTokenMissingMandates() {
    const stuck = await this.mandateRepo.find({
      where: { status: MandateStatus.TOKEN_MISSING_AFTER_CAPTURE },
    });
    this.logger.log(`sweepTokenMissingMandates: ${stuck.length} mandate(s) stuck`);

    for (const mandate of stuck) {
      const paymentId = (mandate.metadata as any)?.lastCapturedPaymentId;
      if (!paymentId) {
        this.logger.warn(`sweepTokenMissingMandates: mandate ${mandate.id} has no captured payment id, skipping`);
        continue;
      }
      try {
        await this.reconcileMandateToken(mandate.id, paymentId);
      } catch (error: any) {
        this.logger.error(
          `sweepTokenMissingMandates: reconciliation failed for mandate ${mandate.id} — ${error?.message ?? error}`,
        );
      }
    }
    return { processed: stuck.length };
  }

  private async reconcileMandateToken(mandateId: number, paymentId: string) {
    const mandate = await this.mandateRepo.findOne({ where: { id: mandateId } });
    if (!mandate || mandate.status === MandateStatus.ACTIVE) return;

    const payment: any = await this.razorpayApi.fetchPayment(paymentId);
    if (payment?.token_id) {
      this.logger.log(`reconcileMandateToken: mandate ${mandateId} — token ${payment.token_id} found`);
      await this.activateMandateFromPayment(mandate, payment);
      return;
    }

    this.logger.warn(
      `reconcileMandateToken: mandate ${mandateId}, payment ${paymentId} — still no token_id. ` +
      'Money was captured but Razorpay never created a token — needs manual review ' +
      '(refund the auth amount and/or confirm UPI Autopay recurring is enabled on the LIVE account).',
    );
  }

  // ==========================================================================
  // 6. FETCH / CANCEL A MANDATE
  // ==========================================================================

  async getMandate(id: number, userId: number) {
    const mandate = await this.mandateRepo.findOne({ where: { id } });
    if (!mandate) {
      throw new NotFoundException(`Mandate ${id} not found`);
    }
    if (mandate.userId !== userId) {
      throw new BadRequestException('This mandate does not belong to the authenticated user');
    }
    const transactions = await this.transactionRepo.find({
      where: { mandateId: id },
      order: { id: 'DESC' },
      take: 20,
    });
    return { mandate, transactions };
  }

  async cancelMandate(dto: CancelMandateDto, userId: number) {
    const mandate = await this.mandateRepo.findOne({ where: { id: dto.mandateId } });
    if (!mandate) {
      throw new NotFoundException(`Mandate ${dto.mandateId} not found`);
    }
    if (mandate.userId !== userId) {
      throw new BadRequestException('This mandate does not belong to the authenticated user');
    }
    if ([MandateStatus.CANCELLED, MandateStatus.EXPIRED].includes(mandate.status)) {
      return { success: true, message: 'Mandate already inactive', status: mandate.status };
    }

    if (mandate.tokenId) {
      try {
        await this.razorpayApi.deleteToken(mandate.razorpayCustomerId, mandate.tokenId);
      } catch (error) {
        this.logger.warn(`Razorpay token delete failed for mandate ${mandate.id}, cancelling locally anyway: ${error}`);
      }
    }

    await this.mandateRepo.update(mandate.id, {
      status: MandateStatus.CANCELLED,
      endDate: new Date(),
      metadata: { ...(mandate.metadata || {}), cancellationReason: dto.reason ?? null },
    });

    this.logger.log(`Mandate ${mandate.id} cancelled`);
    return { success: true, message: 'Mandate cancelled successfully', status: MandateStatus.CANCELLED };
  }

  // ==========================================================================
  // WEBHOOKS
  //
  // Only the events this integration actually cares about are handled:
  // payment.authorized / payment.captured / payment.failed and
  // token.confirmed / token.expired / token.cancelled. This project uses
  // Razorpay's Orders + Token recurring-payments model, not the
  // Subscriptions product, so subscription.* events are not relevant here
  // and are no longer handled — if your Razorpay account is also running
  // Subscriptions for something else, those events will just be logged
  // as "unhandled" and ignored, which is the correct behaviour for them.
  //
  // CHANGED (problems #2, #3, #14, #15): handleWebhook() now verifies the
  // Razorpay signature itself, as the very first thing it does — before
  // touching razorpay_webhook_events at all — via the new
  // RazorpayApiClient.verifyWebhookSignature(). Previously `_rawBody` /
  // `_signature` were accepted but never used, so nothing here actually
  // checked that an inbound "webhook" really came from Razorpay.
  // ==========================================================================

  async handleWebhook(rawBody: Buffer, signature: string, eventId: string, body: RazorpayWebhookPayload) {
    const signatureValid = await this.razorpayApi.verifyWebhookSignature(rawBody, signature);
    if (!signatureValid) {
      this.logger.error(
        `handleWebhook: invalid signature for event ${eventId} (${body?.event ?? 'unknown'}) — rejecting before any processing.`,
      );
      throw new BadRequestException('Invalid Razorpay webhook signature');
    }

    const existing = await this.webhookEventRepo.findOne({ where: { eventId } });
    if (existing?.status === 'processed') {
      this.logger.warn(`Duplicate Razorpay webhook ignored: ${eventId}`);
      return { success: true, message: 'Already processed' };
    }

    if (existing) {
      await this.webhookEventRepo.update(existing.id, {
        eventType: body.event,
        payload: body as any,
        status: 'received',
        processedAt: null,
      });
    } else {
      try {
        await this.webhookEventRepo.save(
          this.webhookEventRepo.create({ eventId, eventType: body.event, payload: body as any, status: 'received' }),
        );
      } catch (error: any) {
        // Two near-simultaneous deliveries of a brand-new event can both
        // reach here; the unique index on event_id lets only one INSERT
        // win. Treat the loser as the duplicate-webhook case rather than a
        // hard failure.
        if (this.isDuplicateKeyError(error)) {
          this.logger.warn(`handleWebhook: race on first insert for event ${eventId} — already being processed by another delivery.`);
          return { success: true, message: 'Already being processed' };
        }
        throw error;
      }
    }

    try {
      // if (body.event === 'payment.authorized') {
      //   this.logger.log(`payment.authorized: ${body.payload?.payment?.entity?.id}`);
      // } else if (body.event === 'payment.captured') {
      //   await this.onPaymentCaptured(body);
      // } else if (body.event === 'payment.failed') {
      //   await this.onPaymentFailed(body);
      // } else if (body.event === 'token.confirmed') {
      //   // await this.onTokenConfirmed(body);
      //    await this.handleTokenConfirmed(body);

      // }  
      // else if (body.event === 'token.rejected') {
      //   await this.handleTokenRejected(body);
      // }
      
      // else if (body.event === 'token.expired') {
      //   await this.onTokenTerminalStatus(body, MandateStatus.EXPIRED);
      // } else if (body.event === 'token.cancelled') {
      //   await this.onTokenTerminalStatus(body, MandateStatus.CANCELLED);
      // } else {
      //   this.logger.warn(`Unhandled Razorpay webhook event: ${body.event}`);
      // }

      if (body.event === 'payment.authorized') {
        this.logger.log(`payment.authorized: ${body.payload?.payment?.entity?.id}`);
        await this.onPaymentAuthorized(body); 
      } else if (body.event === 'payment.captured') {
        await this.onPaymentCaptured(body);
      } else if (body.event === 'payment.failed') {
        await this.onPaymentFailed(body);
      } else if (body.event === 'token.confirmed') {
        await this.onTokenConfirmed(body);
      } else if (body.event === 'token.rejected') {
        await this.onTokenRejected(body);
      } else if (body.event === 'token.expired') {
        await this.onTokenTerminalStatus(body, MandateStatus.EXPIRED);
      } else if (body.event === 'token.cancelled') {
        await this.onTokenTerminalStatus(body, MandateStatus.CANCELLED);
      } else {
        this.logger.warn(`Unhandled Razorpay webhook event: ${body.event}`);
      }

      await this.webhookEventRepo.update({ eventId }, { status: 'processed', processedAt: new Date() });
      return { success: true, event: body.event };
    } catch (error: any) {
      await this.webhookEventRepo.update({ eventId }, { status: 'failed', error: error?.message ?? String(error) });
      throw error;
    }
  }
  /**
   * FIX: mirrors onTokenConfirmed's mandate-lookup logic (a rejection can
   * arrive while the mandate is still PENDING_AUTHENTICATION or
   * TOKEN_MISSING_AFTER_CAPTURE — it never got a tokenId, so we can't key
   * off tokenId the way onTokenTerminalStatus does for expired/cancelled).
   * Previously this event was routed to the legacy handleTokenRejected(),
   * which wrote status='rejected' directly onto user_subscriptions via raw
   * SQL and never touched the RecurringMandate row at all — so the mandate
   * stayed PENDING_AUTHENTICATION/TOKEN_MISSING_AFTER_CAPTURE forever,
   * while (if a subscription row existed) it disagreed with the mandate
   * about whether this was still usable.
   */
  
//   private async onTokenRejected(body: RazorpayWebhookPayload) {
//     const token = (body.payload as any)?.token?.entity;
//     if (!token?.customer_id) {
//       this.logger.warn('token.rejected: payload missing token.entity.customer_id — ignoring');
//       return;
//     }

//     const candidates = await this.mandateRepo.find({
//       where: {
//         razorpayCustomerId: token.customer_id,
//         status: In([MandateStatus.PENDING_AUTHENTICATION, MandateStatus.TOKEN_MISSING_AFTER_CAPTURE]),
//       },
//       order: { id: 'DESC' },
//     });

//     if (candidates.length === 0) {
//       this.logger.warn(
//         `token.rejected: no pending/token-missing mandate found for customer ${token.customer_id} — nothing to update.`,
//       );
//       return;
//     }

//     // Same ambiguity guard as onTokenConfirmed: if there's more than one
//     // candidate we can't safely tell which one this rejection is for, so
//     // don't guess — surface it for manual reconciliation instead.
//     if (candidates.length > 1) {
//       throw new Error(
//         `token.rejected: customer ${token.customer_id} has ${candidates.length} pending candidate mandates ` +
//         `[${candidates.map((c) => c.id).join(', ')}] — cannot safely determine which one was rejected. ` +
//         'Left for manual reconciliation.',
//       );
//     }

//     const mandate = candidates[0];

//     await this.mandateRepo.update(mandate.id, {
//       status: MandateStatus.FAILED,
//       endDate: new Date(),
//       metadata: {
//         ...(mandate.metadata || {}),
//         tokenRejectedAt: new Date().toISOString(),
//         tokenRejectionDetails: token.recurring_details ?? null,
//       },
//     });

//     this.logger.warn(
//       `Mandate ${mandate.id} marked FAILED — token rejected by bank/NPCI for customer ${token.customer_id}`,
//     );

//     // If a subscription row already exists for this mandate (unlikely at
//     // this point since activateMandateWithToken is what creates it, but
//     // possible if it was created via some other path), keep it consistent.
//     await this.dataSource.query(
//       `UPDATE user_subscriptions
//           SET payment_status = 'failed', status = 'rejected', updated_at = NOW()
//         WHERE recurring_mandate_id = ?`,
//       [mandate.id],
//     );
//   }
//   private isDuplicateKeyError(error: any): boolean {
//     return error?.code === 'ER_DUP_ENTRY' || error?.code === '23505' || error?.errno === 1062;
//   }

//   private async onPaymentCaptured(body: RazorpayWebhookPayload) {
//     const payment = body.payload?.payment?.entity;
//     if (!payment?.order_id) return;

//     const mandate = await this.mandateRepo.findOne({ where: { razorpayOrderId: payment.order_id } });
//     if (mandate) {
//       // This is the authorization payment for a brand-new mandate.
//       await this.activateMandateFromPayment(mandate, payment);
//       return;
//     }

//     // Not an authorization order — check if it's a recurring-charge order.
//     const transaction = await this.transactionRepo.findOne({
//       where: { razorpayOrderId: payment.order_id, transactionType: TransactionType.RECURRING_CHARGE },
//       order: { id: 'DESC' },
//     });
//     if (!transaction) {
//       this.logger.warn(`payment.captured: no mandate or charge transaction found for order ${payment.order_id}`);
//       return;
//     }
//     const chargedMandate = await this.mandateRepo.findOne({ where: { id: transaction.mandateId } });
//     if (!chargedMandate) return;

//     await this.onRecurringDebitCaptured(chargedMandate, transaction, payment);
//   }

//   private async onRecurringDebitCaptured(
//     mandate: RecurringMandate,
//     transaction: RecurringMandateTransaction,
//     payment: any,
//   ) {
//     if (payment.customer_id && mandate.razorpayCustomerId && payment.customer_id !== mandate.razorpayCustomerId) {
//       this.logger.error(
//         `payment.captured: payment ${payment.id} customer (${payment.customer_id}) does not match ` +
//         `mandate ${mandate.id} customer (${mandate.razorpayCustomerId}) — refusing to record.`,
//       );
//       return;
//     }

//     const alreadyRecorded = await this.dataSource.query(
//       `SELECT id FROM user_subscription_payments WHERE razorpay_payment_id = ? OR payment_id = ? LIMIT 1`,
//       [payment.id, payment.id],
//     );
//     if (alreadyRecorded?.length) {
//       this.logger.log(`payment.captured: recurring payment ${payment.id} already recorded — skipping`);
//       return;
//     }

//     const [subscription] = await this.dataSource.query(
//       `SELECT id, next_billing_date FROM user_subscriptions WHERE recurring_mandate_id = ? ORDER BY id DESC LIMIT 1`,
//       [mandate.id],
//     );
//     if (!subscription) {
//       this.logger.error(
//         `payment.captured: recurring payment ${payment.id} captured for mandate ${mandate.id}, but no ` +
//         'user_subscriptions row is linked to it.',
//       );
//       return;
//     }

//     const metadata = this.parseMandateMetadata(mandate);
//     const pricing = await this.computePricing(metadata);
//     const amount = paiseToRupees(Number(payment.amount) || 0);

//     // FIX (problem #13): the transaction-row update, the payment insert,
//     // and the subscription's billing-date/last-payment update are now one
//     // atomic unit — previously these were three separate, independently
//     // committed statements, so a crash between them could leave (for
//     // example) a recorded payment with the subscription's
//     // next_billing_date never advanced.
//     await this.dataSource.transaction(async (manager) => {
//       await manager.update(RecurringMandateTransaction, transaction.id, {
//         razorpayPaymentId: payment.id,
//         status: TransactionStatus.SUCCESS,
//         rawResponse: payment as any,
//       });

//       await manager.query(
//         `INSERT INTO user_subscription_payments (
//            subscription_id, razorpay_subscription_id, user_id, order_id, razorpay_order_id,
//            transaction_id, payment_id, razorpay_payment_id, razorpay_invoice_id,
//            amount, tax_amount, total_amount, currency, quantity, price_per_unit,
//            payment_method, payment_status, webhook_event, webhook_status,
//            webhook_received_at, paid_at, created_at, updated_at
//          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW(), NOW())`,
//         [
//           subscription.id, null, mandate.userId, payment.order_id, payment.order_id, payment.id, payment.id,
//           payment.id, payment.invoice_id || null, amount, pricing.gstAmount, amount, payment.currency || 'INR',
//           pricing.quantity, pricing.pricePerUnit, mandate.paymentMethod, 'paid', 'payment.captured', 'processed',
//         ],
//       );

//       const newNextBillingDate = nextBillingDate(subscription.next_billing_date || new Date(), mandate.frequency);
//       await manager.query(
//         `UPDATE user_subscriptions SET
//            quantity = ?, price_per_unit = ?, current_amount = ?, gst_rate = ?, gst_amount = ?, total_amount = ?,
//            coupan_code = ?, last_payment_id = ?, last_payment_date = NOW(), payment_status = 'paid',
//            razorpay_payment_id = ?, next_billing_date = ?, updated_at = NOW()
//          WHERE id = ?`,
//         [
//           pricing.quantity, pricing.pricePerUnit, pricing.currentAmount, pricing.gstRate, pricing.gstAmount,
//           pricing.totalAmount, pricing.couponCode, payment.id, payment.id, newNextBillingDate, subscription.id,
//         ],
//       );

//       this.logger.log(
//         `Recurring payment captured: mandate=${mandate.id}, subscription=${subscription.id}, ` +
//         `payment=${payment.id}, amount=₹${amount}, next_billing_date=${dayjs(newNextBillingDate).format('YYYY-MM-DD')}`,
//       );
//     });
//   }

//   private async onPaymentFailed(body: RazorpayWebhookPayload) {
//     const payment = body.payload?.payment?.entity;
//     if (!payment?.order_id) return;

//     const mandate = await this.mandateRepo.findOne({ where: { razorpayOrderId: payment.order_id } });
//     if (mandate) {
//       if (mandate.status !== MandateStatus.PENDING_AUTHENTICATION) return;

//       await this.transactionRepo.update(
//         { mandateId: mandate.id, razorpayOrderId: payment.order_id },
//         { status: TransactionStatus.FAILED, failureReason: payment.error_description || 'Authorization payment failed' },
//       );
//       await this.mandateRepo.update(mandate.id, { status: MandateStatus.FAILED, endDate: new Date() });
//       this.logger.log(`Mandate ${mandate.id} authorization failed (order ${payment.order_id})`);
//       return;
//     }

//     const transaction = await this.transactionRepo.findOne({
//       where: { razorpayOrderId: payment.order_id, transactionType: TransactionType.RECURRING_CHARGE },
//       order: { id: 'DESC' },
//     });
//     if (!transaction) {
//       this.logger.warn(`payment.failed: no mandate found for order ${payment.order_id}`);
//       return;
//     }
//     const chargedMandate = await this.mandateRepo.findOne({ where: { id: transaction.mandateId } });
//     if (!chargedMandate) return;

//     const failureReason = payment.error_description || 'Recurring charge failed';
//     await this.transactionRepo.update(transaction.id, {
//       status: TransactionStatus.FAILED,
//       razorpayPaymentId: payment.id ?? null,
//       failureReason,
//       rawResponse: payment as any,
//     });

//     const [subscription] = await this.dataSource.query(
//       `SELECT id FROM user_subscriptions WHERE recurring_mandate_id = ? ORDER BY id DESC LIMIT 1`,
//       [chargedMandate.id],
//     );
//     if (!subscription) {
//       this.logger.error(`payment.failed: charge failed for mandate ${chargedMandate.id}, no linked subscription`);
//       return;
//     }

//     await this.dataSource.query(
//       `UPDATE user_subscriptions SET payment_status = 'failed', last_payment_id = ?, webhook_status = 'failed',
//          failure_reason = ?, updated_at = NOW() WHERE id = ?`,
//       [payment.id ?? null, failureReason, subscription.id],
//     );
//     this.logger.warn(
//       `Recurring payment failed: mandate=${chargedMandate.id}, subscription=${subscription.id}, reason=${failureReason}`,
//     );
//   }

//   private async activateMandateFromPayment(mandate: RecurringMandate, payment: any) {
//     const canAttempt =
//       mandate.status === MandateStatus.PENDING_AUTHENTICATION ||
//       mandate.status === MandateStatus.TOKEN_MISSING_AFTER_CAPTURE;
//     if (!canAttempt) return;

//     const tokenId: string | null = payment.token_id ?? null;
//     const paymentMethod = this.resolvePaymentMethod(mandate, payment.method);

//     if (!tokenId) {
//       await this.dataSource.transaction(async (manager) => {
//         const transaction = await manager.findOne(RecurringMandateTransaction, {
//           where: { mandateId: mandate.id, razorpayOrderId: payment.order_id },
//           order: { id: 'DESC' },
//         });
//         if (transaction) {
//           await manager.update(RecurringMandateTransaction, transaction.id, {
//             razorpayPaymentId: payment.id,
//             status: TransactionStatus.SUCCESS,
//             rawResponse: payment as any,
//           });
//         }
//         await manager.update(RecurringMandate, mandate.id, {
//           status: MandateStatus.TOKEN_MISSING_AFTER_CAPTURE,
//           paymentMethod,
//           metadata: {
//             ...(mandate.metadata || {}),
//             lastCapturedPaymentId: payment.id,
//             tokenMissingFlaggedAt: new Date().toISOString(),
//           },
//         });
//       });
//       this.logger.warn(
//         `Mandate ${mandate.id} captured but token_id still missing — awaiting token.confirmed / reconciliation. ` +
//         'Card authorization NOT refunded yet (see problem #8) — it will be refunded once the token confirms.',
//       );
//       return;
//     }

//     const npciMandateId = payment.upi?.mandate_id ?? tokenId;
//     const { subscriptionId } = await this.activateMandateWithToken(mandate, {
//       tokenId,
//       npciMandateId,
//       paymentMethod,
//       cardMeta: payment.card,
//       orderId: payment.order_id,
//       payment,
//     });
//     this.logger.log(`Mandate ${mandate.id} ACTIVE — token ${tokenId} (${paymentMethod}), subscription ${subscriptionId}`);

//     await this.refundCardAuthorizationIfDue(mandate.id, paymentMethod, payment);
//   }


//   private async refundCardAuthorizationIfDue(mandateId: number, paymentMethod: PaymentMethod, payment: any | null) {
//     if (paymentMethod !== PaymentMethod.CARD || !this.refundCardAuthorization) return;
//     if (!payment?.id) {
//       this.logger.warn(`refundCardAuthorizationIfDue: mandate ${mandateId} has no payment on file to refund — skipping.`);
//       return;
//     }
//     try {
//       await this.razorpayApi.refundPayment(payment.id, payment.amount, {
//         reason: 'card_recurring_authorization_refund',
//         mandate_id: String(mandateId),
//       });
//       this.logger.log(`Refunded card authorization amount for mandate ${mandateId} (payment ${payment.id})`);
//     } catch (error) {
//       this.logger.error(`Failed to auto-refund card authorization for mandate ${mandateId}`, error as any);
//     }
//   }

 
// private async onTokenConfirmed(
//   body: RazorpayWebhookPayload,
// ) {
//   const token =
//     body.payload?.token?.entity;

//   if (!token?.id) {
//     this.logger.warn(
//       'token.confirmed: token.entity.id missing',
//     );
//     return;
//   }

//   const customerId =
//     token.customer_id;

//   /*
//    * ==========================================
//    * 1. FIND PENDING SUBSCRIPTION
//    * ==========================================
//    *
//    * Primary key: subscription_id passed in
//    * `notes` when the payment link / order was
//    * created. This is the only identifier that
//    * is guaranteed to exist before the customer
//    * completes authorization.
//    *
//    * Fallback: razorpay_customer_id, in case
//    * notes weren't set (legacy links) or the
//    * lookup by id fails for some reason.
//    */

//   const paymentEntity =
//     body.payload?.payment?.entity;
//   const orderEntity =
//     body.payload?.order?.entity;

//   const notesSubscriptionId =
//     paymentEntity?.notes?.subscription_id ||
//     orderEntity?.notes?.subscription_id ||
//     token.notes?.subscription_id;

//   let subscriptions: any[] = [];

//   if (notesSubscriptionId) {
//     subscriptions =
//       await this.dataSource.query(
//         `
//         SELECT *
//         FROM user_subscriptions
//         WHERE id = ?
//           AND token_status IN (
//             'pending',
//             'missing'
//           )
//           AND status = 0
//         `,
//         [notesSubscriptionId],
//       );

//     if (
//       !subscriptions ||
//       subscriptions.length === 0
//     ) {
//       this.logger.warn(
//         `token.confirmed: notesSubscriptionId ${notesSubscriptionId} did not match a pending subscription, falling back to customer lookup`,
//       );
//     }
//   }

//   if (
//     !subscriptions ||
//     subscriptions.length === 0
//   ) {
//     subscriptions =
//       await this.dataSource.query(
//         `
//         SELECT *
//         FROM user_subscriptions
//         WHERE razorpay_customer_id = ?
//           AND token_status IN (
//             'pending',
//             'missing'
//           )
//           AND status = 0
//         ORDER BY id DESC
//         `,
//         [customerId],
//       );
//   }

//   if (
//     !subscriptions ||
//     subscriptions.length === 0
//   ) {
//     this.logger.warn(
//       `token.confirmed: no pending subscription found for customer ${customerId}, token ${token.id}, notesSubscriptionId ${notesSubscriptionId ?? 'none'}`,
//     );

//     return;
//   }

//   /*
//    * ==========================================
//    * 2. PICK LATEST SUBSCRIPTION
//    * ==========================================
//    */

//   const subscription =
//     subscriptions[0];

//   /*
//    * ==========================================
//    * 3. DUPLICATE CHECK
//    * ==========================================
//    */

//   if (
//     subscription.token_status ===
//       'active' &&
//     subscription.razorpay_token_id ===
//       token.id
//   ) {
//     this.logger.log(
//       `token.confirmed: subscription ${subscription.id} already active with token ${token.id}`,
//     );

//     return;
//   }

//   /*
//    * ==========================================
//    * 4. PAYMENT METHOD
//    * ==========================================
//    */

//   const paymentMethod =
//     token.method ||
//     subscription.payment_method ||
//     'card';

//   /*
//    * ==========================================
//    * 5. GET TOKEN MAX AMOUNT
//    * ==========================================
//    */

//   let tokenMaxAmount =
//     subscription.token_max_amount;

//   /*
//    * Razorpay token max_amount can be in
//    * paise depending on API response.
//    *
//    * If token.max_amount exists, use it.
//    */

//   if (token.max_amount) {
//     tokenMaxAmount =
//       Number(token.max_amount) / 100;
//   }

//   /*
//    * ==========================================
//    * 6. TOKEN EXPIRY
//    * ==========================================
//    */

//   const tokenExpiry =
//     null;

//   /*
//    * ==========================================
//    * 7. UPDATE USER SUBSCRIPTION
//    * ==========================================
//    */

//   const updateResult =
//     await this.dataSource.query(
//       `
//       UPDATE user_subscriptions
//       SET
//         razorpay_customer_id = ?,
//         razorpay_token_id = ?,

//         token_status = 'active',

//         token_max_amount = ?,

//         token_frequency = ?,

//         token_expiry = ?,

//         razorpay_status = 'active',

//         payment_status = 'authorized',

//         status = 1,

//         auto_renew = 1,

//         updated_at = NOW()

//       WHERE id = ?
//       `,
//       [
//         customerId,

//         token.id,

//         tokenMaxAmount,

//         subscription.token_frequency ||
//           'monthly',

//         tokenExpiry,

//         subscription.id,
//       ],
//     );

//   /*
//    * Sanity check: confirm the UPDATE actually
//    * touched a row. Depending on your driver,
//    * this is usually in updateResult.affectedRows
//    * or updateResult[0].affectedRows / .changedRows.
//    */

//   const affectedRows =
//     updateResult?.affectedRows ??
//     updateResult?.[0]?.affectedRows ??
//     updateResult?.changedRows ??
//     updateResult?.[0]?.changedRows;

//   if (!affectedRows) {
//     this.logger.error(
//       `token.confirmed: UPDATE affected 0 rows for subscription ${subscription.id} — token ${token.id} was NOT saved`,
//     );
//   }

//   /*
//    * ==========================================
//    * 8. SAVE TOKEN DETAILS IN METADATA
//    * ==========================================
//    */

//   let metadata =
//     subscription.metadata;

//   if (typeof metadata === 'string') {
//     try {
//       metadata =
//         JSON.parse(metadata);
//     } catch {
//       metadata = {};
//     }
//   }

//   metadata = {
//     ...(metadata || {}),

//     token_confirmed: true,

//     token_id: token.id,

//     customer_id: customerId,

//     token_method:
//       paymentMethod,

//     token_confirmed_at:
//       new Date().toISOString(),
//   };

//   await this.dataSource.query(
//     `
//     UPDATE user_subscriptions
//     SET
//       metadata = ?,
//       updated_at = NOW()
//     WHERE id = ?
//     `,
//     [
//       JSON.stringify(metadata),
//       subscription.id,
//     ],
//   );

//   /*
//    * ==========================================
//    * 9. LOG
//    * ==========================================
//    */

//   this.logger.log(
//     `token.confirmed: subscription ${subscription.id} ACTIVE — ` +
//       `token ${token.id}, ` +
//       `customer ${customerId}`,
//   );
// }

//   private async onTokenTerminalStatus(body: RazorpayWebhookPayload, status: MandateStatus) {
//     const token = body.payload?.token?.entity;
//     if (!token?.id) return;
//     const mandate = await this.mandateRepo.findOne({ where: { tokenId: token.id } });
//     if (!mandate) return;
//     await this.mandateRepo.update(mandate.id, { status, endDate: new Date() });
//     this.logger.log(`Mandate ${mandate.id} marked ${status} (token ${token.id})`);
//   }

//   private warnIfMaxAmountDrifts(computedRupees: number, dtoMaxAmount?: number) {
//     if (dtoMaxAmount == null) return;
//     if (Math.abs(computedRupees - dtoMaxAmount) > 1) {
//       this.logger.warn(`maxAmount drift: server computed ₹${computedRupees}, frontend sent ₹${dtoMaxAmount}`);
//     }
//   }

  // =========================================================
  // TOKEN CONFIRMED (UPI Autopay / e-mandate registered with bank)
  // =========================================================

/**
 * ASSUMPTIONS MADE IN THIS REFACTOR (please verify against your real schema):
 *
 * 1. `mandateRepo` (RecurringMandate) and `transactionRepo` (RecurringMandateTransaction)
 *    are fully removed. Anything that used to live in `recurring_mandates` is assumed to
 *    now live directly on `user_subscriptions` (this matches the pattern your own
 *    onTokenConfirmed / handleTokenConfirmed / handleTokenRejected methods already used).
 *    You'll need to remove the `mandateRepo` / `transactionRepo` injections from the
 *    constructor and from the module's providers — those aren't in the snippet you sent.
 *
 * 2. MandateStatus -> user_subscriptions column mapping used below:
 *      PENDING_AUTHENTICATION      -> token_status = 'pending'
 *      TOKEN_MISSING_AFTER_CAPTURE -> token_status = 'missing'
 *      FAILED / REJECTED           -> token_status = 'rejected', status = 'rejected'
 *    Adjust the literal strings if your real column values differ.
 *
 * 3. `user_subscriptions` is assumed to have: razorpay_order_id, razorpay_token_id,
 *    end_date, failure_reason, payment_method columns in addition to the ones already
 *    referenced elsewhere in the file (razorpay_customer_id, token_status, status,
 *    payment_status, metadata, etc). Add any that are missing.
 *
 * 4. `transactionRepo` reads are replaced with the literal column list you gave me,
 *    queried straight off `user_subscription_payments`:
 *
 *      SELECT id, subscription_id, razorpay_subscription_id, user_id, order_id,
 *             razorpay_order_id, transaction_id, payment_id, razorpay_payment_id,
 *             razorpay_invoice_id, amount, tax_amount, total_amount, currency,
 *             quantity, price_per_unit, payment_method, payment_status,
 *             webhook_event, webhook_status, webhook_received_at, paid_at,
 *             failure_reason, created_at, updated_at
 *      FROM user_subscription_payments WHERE ...
 *
 *    Since there's now only ONE table for payments (no separate transaction table),
 *    a "recurring charge" is represented as a row that already exists in
 *    user_subscription_payments (e.g. created when the recurring order is placed)
 *    and gets UPDATED — not re-inserted — once the webhook fires. If your flow instead
 *    creates that row only inside this webhook, swap the UPDATE in
 *    onRecurringDebitCaptured back to an INSERT.
 *
 * 5. `activateMandateWithToken`, `computePricing`, `parseMandateMetadata`,
 *    `resolvePaymentMethod`, `nextBillingDate`, `paiseToRupees` are referenced as-is.
 *    They previously took a `RecurringMandate` — they now receive a plain
 *    `user_subscriptions` row instead, so double check their internals still work
 *    (e.g. `mandate.razorpayCustomerId` -> `subscription.razorpay_customer_id`).
 */

// Add this near the top of the class (as a private readonly field) so every method
// below can reuse the exact column list you specified:
//
// private readonly SUBSCRIPTION_PAYMENT_COLUMNS = `
//   id, subscription_id, razorpay_subscription_id, user_id, order_id, razorpay_order_id,
//   transaction_id, payment_id, razorpay_payment_id, razorpay_invoice_id,
//   amount, tax_amount, total_amount, currency, quantity, price_per_unit,
//   payment_method, payment_status, webhook_event, webhook_status,
//   webhook_received_at, paid_at, failure_reason, created_at, updated_at
// `;


private async onPaymentAuthorized(body: RazorpayWebhookPayload) {
  const payment = body.payload?.payment?.entity;
  if (!payment?.order_id) return;
 
  const [subscription] = await this.dataSource.query(
    `SELECT * FROM user_subscriptions WHERE razorpay_order_id = ? LIMIT 1`,
    [payment.order_id],
  );
 
  if (!subscription) {
    this.logger.log(
      `payment.authorized: order ${payment.order_id} is not a known subscription order — ignoring for now.`,
    );
    return;
  }
 
  if (subscription.token_status !== 'pending' && subscription.token_status !== 'missing') {
    return; // already activated or terminal — nothing to do
  }

  // //token_frequency 
 
  // await this.dataSource.query(
  //   `UPDATE user_subscriptions
  //       SET razorpay_customer_id = ?,
  //           razorpay_token_id = ?,
  //           payment_method = ?,
  //           token_status = 'active',
  //           razorpay_status = 'active',
  //           status = 'active',
  //           payment_status = 'authorized',
  //           next_billing_date=
  //           updated_at = NOW()
  //     WHERE id = ?`,
  //   [
  //     payment.customer_id ?? subscription.razorpay_customer_id,
  //     payment.token_id ?? subscription.razorpay_token_id,
  //     payment.method || subscription.payment_method,
  //     subscription.id,
  //   ],
  // );
  await this.dataSource.query(
  `UPDATE user_subscriptions
      SET razorpay_customer_id = ?,
          razorpay_token_id = ?,
          payment_method = ?,
          token_status = 'active',
          razorpay_status = 'active',
          status = 'active',
          payment_status = 'authorized',
          next_billing_date = CASE
            WHEN token_frequency = 'daily'
              THEN DATE_ADD(CURDATE(), INTERVAL 1 DAY)

            WHEN token_frequency = 'monthly'
              THEN DATE_ADD(CURDATE(), INTERVAL 1 MONTH)

            WHEN token_frequency = 'quarterly'
              THEN DATE_ADD(CURDATE(), INTERVAL 3 MONTH)

            WHEN token_frequency IN ('yearly', 'annual')
              THEN DATE_ADD(CURDATE(), INTERVAL 1 YEAR)

            ELSE NULL
          END,
          updated_at = NOW()
    WHERE id = ?`,
  [
    payment.customer_id ?? subscription.razorpay_customer_id,
    payment.token_id ?? subscription.razorpay_token_id,
    payment.method || subscription.payment_method,
    subscription.id,
  ],
);


 
  this.logger.log(
    `payment.authorized: subscription ${subscription.id} linked to token ${payment.token_id} / ` +
    `customer ${payment.customer_id} (awaiting capture/confirmation)`,
  );
}


// private async onTokenConfirmed(
//   body: RazorpayWebhookPayload,
// ) {
//   const token =
//     body.payload?.token?.entity;

//   if (!token?.id) {
//     this.logger.warn(
//       'token.confirmed: token.entity.id missing',
//     );
//     return;
//   }

//   const customerId =
//     token.customer_id;



//   const paymentEntity =
//     body.payload?.payment?.entity;
//   const orderEntity =
//     body.payload?.order?.entity;

//   const notesSubscriptionId =
//     paymentEntity?.notes?.subscription_id ||
//     orderEntity?.notes?.subscription_id ||
//     token.notes?.subscription_id;

//   let subscriptions: any[] = [];

//   if (notesSubscriptionId) {
//     subscriptions =
//       await this.dataSource.query(
//         `
//         SELECT *
//         FROM user_subscriptions
//         WHERE id = ?
//           AND token_status IN (
//             'pending',
//             'missing'
//           )
//           AND status = 0
//         `,
//         [notesSubscriptionId],
//       );

//     if (
//       !subscriptions ||
//       subscriptions.length === 0
//     ) {
//       this.logger.warn(
//         `token.confirmed: notesSubscriptionId ${notesSubscriptionId} did not match a pending subscription, falling back to customer lookup`,
//       );
//     }
//   }

//   if (
//     !subscriptions ||
//     subscriptions.length === 0
//   ) {
//     subscriptions =
//       await this.dataSource.query(
//         `
//         SELECT *
//         FROM user_subscriptions
//         WHERE razorpay_customer_id = ?
//           AND token_status IN (
//             'pending',
//             'missing'
//           )
//           AND status = 0
//         ORDER BY id DESC
//         `,
//         [customerId],
//       );
//   }

//   if (
//     !subscriptions ||
//     subscriptions.length === 0
//   ) {
//     this.logger.warn(
//       `token.confirmed: no pending subscription found for customer ${customerId}, token ${token.id}, notesSubscriptionId ${notesSubscriptionId ?? 'none'}`,
//     );

//     return;
//   }

//   /*
//    * ==========================================
//    * 2. PICK LATEST SUBSCRIPTION
//    * ==========================================
//    */

//   const subscription =
//     subscriptions[0];

//   /*
//    * ==========================================
//    * 3. DUPLICATE CHECK
//    * ==========================================
//    */

//   if (
//     subscription.token_status ===
//       'active' &&
//     subscription.razorpay_token_id ===
//       token.id
//   ) {
//     this.logger.log(
//       `token.confirmed: subscription ${subscription.id} already active with token ${token.id}`,
//     );

//     return;
//   }

//   /*
//    * ==========================================
//    * 4. PAYMENT METHOD
//    * ==========================================
//    */

//   const paymentMethod =
//     token.method ||
//     subscription.payment_method ||
//     'card';

//   /*
//    * ==========================================
//    * 5. GET TOKEN MAX AMOUNT
//    * ==========================================
//    */

//   let tokenMaxAmount =
//     subscription.token_max_amount;

//   /*
//    * Razorpay token max_amount can be in
//    * paise depending on API response.
//    *
//    * If token.max_amount exists, use it.
//    */

//   if (token.max_amount) {
//     tokenMaxAmount =
//       Number(token.max_amount) / 100;
//   }

//   /*
//    * ==========================================
//    * 6. TOKEN EXPIRY
//    * ==========================================
//    */

//   const tokenExpiry =
//     null;

//   /*
//    * ==========================================
//    * 7. UPDATE USER SUBSCRIPTION
//    * ==========================================
//    */

//   const updateResult =
//     await this.dataSource.query(
//       `
//       UPDATE user_subscriptions
//       SET
//         razorpay_customer_id = ?,
//         razorpay_token_id = ?,

//         token_status = 'active',

//         token_max_amount = ?,

//         token_frequency = ?,

//         token_expiry = ?,

//         razorpay_status = 'active',

//         payment_status = 'authorized',

//         status = 1,

//         auto_renew = 1,

//         updated_at = NOW()

//       WHERE id = ?
//       `,
//       [
//         customerId,

//         token.id,

//         tokenMaxAmount,

//         subscription.token_frequency ||
//           'monthly',

//         tokenExpiry,

//         subscription.id,
//       ],
//     );

//   /*
//    * Sanity check: confirm the UPDATE actually
//    * touched a row. Depending on your driver,
//    * this is usually in updateResult.affectedRows
//    * or updateResult[0].affectedRows / .changedRows.
//    */

//   const affectedRows =
//     updateResult?.affectedRows ??
//     updateResult?.[0]?.affectedRows ??
//     updateResult?.changedRows ??
//     updateResult?.[0]?.changedRows;

//   if (!affectedRows) {
//     this.logger.error(
//       `token.confirmed: UPDATE affected 0 rows for subscription ${subscription.id} — token ${token.id} was NOT saved`,
//     );
//   }

//   /*
//    * ==========================================
//    * 8. SAVE TOKEN DETAILS IN METADATA
//    * ==========================================
//    */

//   let metadata =
//     subscription.metadata;

//   if (typeof metadata === 'string') {
//     try {
//       metadata =
//         JSON.parse(metadata);
//     } catch {
//       metadata = {};
//     }
//   }

//   metadata = {
//     ...(metadata || {}),

//     token_confirmed: true,

//     token_id: token.id,

//     customer_id: customerId,

//     token_method:
//       paymentMethod,

//     token_confirmed_at:
//       new Date().toISOString(),
//   };

//   await this.dataSource.query(
//     `
//     UPDATE user_subscriptions
//     SET
//       metadata = ?,
//       updated_at = NOW()
//     WHERE id = ?
//     `,
//     [
//       JSON.stringify(metadata),
//       subscription.id,
//     ],
//   );

//   /*
//    * ==========================================
//    * 9. LOG
//    * ==========================================
//    */

//   this.logger.log(
//     `token.confirmed: subscription ${subscription.id} ACTIVE — ` +
//       `token ${token.id}, ` +
//       `customer ${customerId}`,
//   );
// }


private async onTokenConfirmed(body: RazorpayWebhookPayload) {
  const token = body.payload?.token?.entity;
  if (!token?.id) {
    this.logger.warn('token.confirmed: token.entity.id missing');
    return;
  }
 
  // Primary match: the token_id that onPaymentAuthorized (or, if that hasn't
  // run yet, onPaymentCaptured) already saved onto the subscription.
  let [subscription] = await this.dataSource.query(
    `SELECT * FROM user_subscriptions WHERE razorpay_token_id = ? LIMIT 1`,
    [token.id],
  );
 
  // Fallback for token types that DO carry customer_id on the token entity
  // (some card flows) — not present in the UPI payload you shared, kept as
  // a safety net only.
  if (!subscription && token.customer_id) {
    [subscription] = await this.dataSource.query(
      `SELECT * FROM user_subscriptions
        WHERE razorpay_customer_id = ?
          AND token_status IN ('pending', 'missing')
        ORDER BY id DESC
        LIMIT 1`,
      [token.customer_id],
    );
  }
 
  if (!subscription) {
    this.logger.warn(
      `token.confirmed: no subscription found for token ${token.id} yet (payload has no order_id/customer_id ` +
      'to fall back on). If payment.authorized/payment.captured for this token has not been processed yet, ' +
      'this resolves itself once it is — otherwise this needs manual reconciliation.',
    );
    return;
  }
 
  if (subscription.token_status === 'active' && subscription.razorpay_token_id === token.id) {
    this.logger.log(`token.confirmed: subscription ${subscription.id} already active with token ${token.id}`);
    return;
  }
 
  const paymentMethod = token.method || subscription.payment_method || 'upi';
  const tokenMaxAmount = token.max_amount ? Number(token.max_amount) / 100 : subscription.token_max_amount;
 
  let metadata = subscription.metadata;
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata);
    } catch {
      metadata = {};
    }
  }
 
  const updateResult = await this.dataSource.query(
    `UPDATE user_subscriptions
        SET razorpay_token_id = ?,
            token_status = 'active',
            token_max_amount = ?,
            token_frequency = ?,
            razorpay_status = 'active',
            payment_status = 'authorized',
            status = 1,
            auto_renew = 1,
            metadata = ?,
            updated_at = NOW()
      WHERE id = ?`,
    [
      token.id,
      tokenMaxAmount,
      subscription.token_frequency || 'monthly',
      JSON.stringify({
        ...(metadata || {}),
        token_confirmed: true,
        token_id: token.id,
        token_method: paymentMethod,
        token_confirmed_at: new Date().toISOString(),
      }),
      subscription.id,
    ],
  );
 
  const affectedRows =
    updateResult?.affectedRows ?? updateResult?.[0]?.affectedRows ?? updateResult?.changedRows ?? updateResult?.[0]?.changedRows;
 
  if (!affectedRows) {
    this.logger.error(`token.confirmed: UPDATE affected 0 rows for subscription ${subscription.id} — token ${token.id} was NOT saved`);
    return;
  }
 
  this.logger.log(`token.confirmed: subscription ${subscription.id} ACTIVE — token ${token.id} (${paymentMethod})`);
}



private async onTokenRejected(body: RazorpayWebhookPayload) {
  const token = (body.payload as any)?.token?.entity;
  if (!token?.customer_id) {
    this.logger.warn('token.rejected: payload missing token.entity.customer_id — ignoring');
    return;
  }

  // mandateRepo removed — pending/token-missing state now lives on user_subscriptions.
  const candidates = await this.dataSource.query(
    `SELECT * FROM user_subscriptions
      WHERE razorpay_customer_id = ?
        AND token_status IN ('pending', 'missing')
      ORDER BY id DESC`,
    [token.customer_id],
  );

  if (!candidates || candidates.length === 0) {
    this.logger.warn(
      `token.rejected: no pending/token-missing subscription found for customer ${token.customer_id} — nothing to update.`,
    );
    return;
  }

  // Same ambiguity guard as before: if there's more than one candidate we can't
  // safely tell which one this rejection is for, so don't guess — surface it for
  // manual reconciliation instead.
  if (candidates.length > 1) {
    throw new Error(
      `token.rejected: customer ${token.customer_id} has ${candidates.length} pending candidate subscriptions ` +
      `[${candidates.map((c: any) => c.id).join(', ')}] — cannot safely determine which one was rejected. ` +
      'Left for manual reconciliation.',
    );
  }

  const subscription = candidates[0];

  let metadata = subscription.metadata;
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata);
    } catch {
      metadata = {};
    }
  }

  await this.dataSource.query(
    `UPDATE user_subscriptions
        SET status = 'rejected',
            token_status = 'rejected',
            payment_status = 'failed',
            end_date = NOW(),
            metadata = ?,
            updated_at = NOW()
      WHERE id = ?`,
    [
      JSON.stringify({
        ...(metadata || {}),
        tokenRejectedAt: new Date().toISOString(),
        tokenRejectionDetails: token.recurring_details ?? null,
      }),
      subscription.id,
    ],
  );

  this.logger.warn(
    `Subscription ${subscription.id} marked FAILED/rejected — token rejected by bank/NPCI for customer ${token.customer_id}`,
  );
}

private isDuplicateKeyError(error: any): boolean {
  return error?.code === 'ER_DUP_ENTRY' || error?.code === '23505' || error?.errno === 1062;
}

private async onPaymentCaptured(body: RazorpayWebhookPayload) {
  const payment = body.payload?.payment?.entity;
  if (!payment?.order_id) return;

  // 1) Is this the authorization order for a brand-new subscription?
  const [subscription] = await this.dataSource.query(
    `SELECT * FROM user_subscriptions WHERE razorpay_order_id = ? LIMIT 1`,
    [payment.order_id],
  );
  if (subscription) {
    await this.activateMandateFromPayment(subscription, payment);
    return;
  }

  // 2) Not an authorization order — check if it's a recurring-charge order.
  const [transaction] = await this.dataSource.query(
    `SELECT ${this.SUBSCRIPTION_PAYMENT_COLUMNS} FROM user_subscription_payments
      WHERE razorpay_order_id = ?
      ORDER BY id DESC
      LIMIT 1`,
    [payment.order_id],
  );
  if (!transaction) {
    this.logger.warn(`payment.captured: no subscription or charge transaction found for order ${payment.order_id}`);
    return;
  }

  const [chargedSubscription] = await this.dataSource.query(
    `SELECT user_subscriptions.* , u.name ,u.email , u.phone FROM user_subscriptions LEFT JOIN users u ON u.id =  user_subscriptions.user_id WHERE id = ? LIMIT 1`,
    [transaction.subscription_id],
  );
  if (!chargedSubscription) return;

  await this.onRecurringDebitCaptured(chargedSubscription, transaction, payment);
}

private async onRecurringDebitCaptured(
  subscription: any,
  transaction: any,
  payment: any,
) {
  if (payment.customer_id && subscription.razorpay_customer_id && payment.customer_id !== subscription.razorpay_customer_id) {
    this.logger.error(
      `payment.captured: payment ${payment.id} customer (${payment.customer_id}) does not match ` +
      `subscription ${subscription.id} customer (${subscription.razorpay_customer_id}) — refusing to record.`,
    );
    return;
  }

  const alreadyRecorded = await this.dataSource.query(
    `SELECT id FROM user_subscription_payments
      WHERE (razorpay_payment_id = ? OR payment_id = ?) AND id != ?
      LIMIT 1`,
    [payment.id, payment.id, transaction.id],
  );
  if (alreadyRecorded?.length) {
    this.logger.log(`payment.captured: recurring payment ${payment.id} already recorded — skipping`);
    return;
  }

  const metadata = this.parseMandateMetadata(subscription);
  const pricing = await this.computePricing(metadata);
  const amount = paiseToRupees(Number(payment.amount) || 0);

  // Still one atomic unit: the payment-row update and the subscription's
  // billing-date/last-payment update happen together.
  await this.dataSource.transaction(async (manager) => {
    await manager.query(
      `UPDATE user_subscription_payments
          SET razorpay_payment_id = ?,
              payment_id = ?,
              payment_status = 'paid',
              webhook_event = 'payment.captured',
              webhook_status = 'processed',
              webhook_received_at = NOW(),
              paid_at = NOW(),
              updated_at = NOW()
        WHERE id = ?`,
      [payment.id, payment.id, transaction.id],
    );

    const newNextBillingDate = nextBillingDate(
      subscription.next_billing_date || new Date(),
      subscription.token_frequency || subscription.frequency,
    );

    await manager.query(
      `UPDATE user_subscriptions SET
         quantity = ?, price_per_unit = ?, current_amount = ?, gst_rate = ?, gst_amount = ?, total_amount = ?,
         coupan_code = ?, last_payment_id = ?, last_payment_date = NOW(), payment_status = 'paid',
         razorpay_payment_id = ?, next_billing_date = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        pricing.quantity, pricing.pricePerUnit, pricing.currentAmount, pricing.gstRate, pricing.gstAmount,
        pricing.totalAmount, pricing.couponCode, payment.id, payment.id, newNextBillingDate, subscription.id,
      ],
    );

     await this.createZohoTransaction({
        customer: subscription.name,
        email: subscription.email,
        phone: subscription.phone,

        bookingId: subscription.subscription_code,

        total_amount: amount,

        category: 'subscription',

        convenienceFee: 0,

        charge_amount: 0,
        quantity: pricing.quantity,
      });

    this.logger.log(
      `Recurring payment captured: subscription=${subscription.id}, ` +
      `payment=${payment.id}, amount=₹${amount}, next_billing_date=${dayjs(newNextBillingDate).format('YYYY-MM-DD')}`,
    );
  });
}

private async createZohoTransaction({
    customer,
    email,
    phone,
    bookingId,
    total_amount,
    category,
    convenienceFee,
    charge_amount,
    quantity
  }: {
    customer: string;
    email: string;
    phone: string;
    bookingId: string;
    total_amount: number;
    category: string;
    convenienceFee: any;
    charge_amount: any;
    quantity: any;
  }) {
    const items = [] as any[];

    // Convenience Fee (common for venue & farmstay)
    if (category === 'venue' || category === 'farmstay') {
      items.push({
        itemId: '3975444000000033267', // Convenience Fee
        quantity: 1,
        rate: convenienceFee,
      });
    }

    // Venue Commission
    if (category === 'venue') {
      items.push({
        itemId: '3975444000000033239', // Venue Commission
        quantity: 1,
        rate: charge_amount,
      });
    }

    // Farmstay Commission
    if (category === 'farmstay') {
      items.push({
        itemId: '3975444000000033258', // Farmstay Commission
        quantity: 1,
        rate: charge_amount,
      });
    }

    // // Subscription
    if (category === 'subscription') {
      items.push({
        itemId: '3975444000000033229', // Subscription
        quantity: quantity,
        rate: total_amount,
      });
    }

    return await this.zohoService.completeBookingZoho({
      customer: {
        name: customer,
        email,
        phone,
      },
      items,
      booking: {
        bookingNo: bookingId,
        bookingDate: dayjs().format('YYYY-MM-DD'),
        notes: `Customer ${category} booking`,
      },
      payment: {
        amount: total_amount,
        mode: 'Online',
        date: dayjs().format('YYYY-MM-DD'),
      },
    });
  }

private async onPaymentFailed(body: RazorpayWebhookPayload) {
  const payment = body.payload?.payment?.entity;
  if (!payment?.order_id) return;

  const [subscription] = await this.dataSource.query(
    `SELECT * FROM user_subscriptions WHERE razorpay_order_id = ? LIMIT 1`,
    [payment.order_id],
  );
  if (subscription) {
    if (subscription.token_status !== 'pending') return;

    await this.dataSource.query(
      `UPDATE user_subscriptions
          SET status = 'rejected',
              token_status = 'rejected',
              payment_status = 'failed',
              failure_reason = ?,
              end_date = NOW(),
              updated_at = NOW()
        WHERE id = ?`,
      [payment.error_description || 'Authorization payment failed', subscription.id],
    );
    this.logger.log(`Subscription ${subscription.id} authorization failed (order ${payment.order_id})`);
    return;
  }

  const [transaction] = await this.dataSource.query(
    `SELECT ${this.SUBSCRIPTION_PAYMENT_COLUMNS} FROM user_subscription_payments
      WHERE razorpay_order_id = ?
      ORDER BY id DESC
      LIMIT 1`,
    [payment.order_id],
  );
  if (!transaction) {
    this.logger.warn(`payment.failed: no subscription found for order ${payment.order_id}`);
    return;
  }

  const failureReason = payment.error_description || 'Recurring charge failed';

  await this.dataSource.query(
    `UPDATE user_subscription_payments
        SET payment_status = 'failed',
            razorpay_payment_id = ?,
            failure_reason = ?,
            webhook_event = 'payment.failed',
            webhook_status = 'failed',
            webhook_received_at = NOW(),
            updated_at = NOW()
      WHERE id = ?`,
    [payment.id ?? null, failureReason, transaction.id],
  );

  await this.dataSource.query(
    `UPDATE user_subscriptions SET payment_status = 'failed', last_payment_id = ?, webhook_status = 'failed',
       failure_reason = ?, updated_at = NOW() WHERE id = ?`,
    [payment.id ?? null, failureReason, transaction.subscription_id],
  );
  this.logger.warn(
    `Recurring payment failed: subscription=${transaction.subscription_id}, reason=${failureReason}`,
  );
}

private async activateMandateFromPayment(subscription: any, payment: any) {
  const canAttempt = subscription.token_status === 'pending' || subscription.token_status === 'missing';
  if (!canAttempt) return;

  const tokenId: string | null = payment.token_id ?? null;
  const paymentMethod = this.resolvePaymentMethod(subscription, payment.method);

  if (!tokenId) {
    await this.dataSource.transaction(async (manager) => {
      const [transaction] = await manager.query(
        `SELECT ${this.SUBSCRIPTION_PAYMENT_COLUMNS} FROM user_subscription_payments
          WHERE subscription_id = ? AND razorpay_order_id = ?
          ORDER BY id DESC
          LIMIT 1`,
        [subscription.id, payment.order_id],
      );

      if (transaction) {
        await manager.query(
          `UPDATE user_subscription_payments
              SET razorpay_payment_id = ?,
                  payment_id = ?,
                  payment_status = 'paid',
                  webhook_received_at = NOW(),
                  paid_at = NOW(),
                  updated_at = NOW()
            WHERE id = ?`,
          [payment.id, payment.id, transaction.id],
        );
      }

      let metadata = subscription.metadata;
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch {
          metadata = {};
        }
      }

      await manager.query(
        `UPDATE user_subscriptions
            SET token_status = 'missing',
                payment_method = ?,
                metadata = ?,
                updated_at = NOW()
          WHERE id = ?`,
        [
          paymentMethod,
          JSON.stringify({
            ...(metadata || {}),
            lastCapturedPaymentId: payment.id,
            tokenMissingFlaggedAt: new Date().toISOString(),
          }),
          subscription.id,
        ],
      );
    });

    this.logger.warn(
      `Subscription ${subscription.id} captured but token_id still missing — awaiting token.confirmed / reconciliation. ` +
      'Card authorization NOT refunded yet — it will be refunded once the token confirms.',
    );
    return;
  }

  const npciMandateId = payment.upi?.mandate_id ?? tokenId;
  const { subscriptionId } = await this.activateMandateWithToken(subscription, {
    tokenId,
    npciMandateId,
    paymentMethod,
    cardMeta: payment.card,
    orderId: payment.order_id,
    payment,
  });
  this.logger.log(`Subscription ${subscription.id} ACTIVE — token ${tokenId} (${paymentMethod}), subscription ${subscriptionId}`);

  await this.refundCardAuthorizationIfDue(subscription.id, paymentMethod, payment);
}

private async refundCardAuthorizationIfDue(subscriptionId: number, paymentMethod: PaymentMethod, payment: any | null) {
  if (paymentMethod !== PaymentMethod.CARD || !this.refundCardAuthorization) return;
  if (!payment?.id) {
    this.logger.warn(`refundCardAuthorizationIfDue: subscription ${subscriptionId} has no payment on file to refund — skipping.`);
    return;
  }
  try {
    await this.razorpayApi.refundPayment(payment.id, payment.amount, {
      reason: 'card_recurring_authorization_refund',
      mandate_id: String(subscriptionId),
    });
    this.logger.log(`Refunded card authorization amount for subscription ${subscriptionId} (payment ${payment.id})`);
  } catch (error) {
    this.logger.error(`Failed to auto-refund card authorization for subscription ${subscriptionId}`, error as any);
  }
}

// onTokenConfirmed is unchanged — it already queried user_subscriptions directly
// and never used mandateRepo / transactionRepo.

private async onTokenTerminalStatus(body: RazorpayWebhookPayload, status: MandateStatus) {
  const token = body.payload?.token?.entity;
  if (!token?.id) return;

  const [subscription] = await this.dataSource.query(
    `SELECT * FROM user_subscriptions WHERE razorpay_token_id = ? LIMIT 1`,
    [token.id],
  );
  if (!subscription) return;

  await this.dataSource.query(
    `UPDATE user_subscriptions
        SET status = ?, token_status = ?, end_date = NOW(), updated_at = NOW()
      WHERE id = ?`,
    [status, status, subscription.id],
  );
  this.logger.log(`Subscription ${subscription.id} marked ${status} (token ${token.id})`);
}

private warnIfMaxAmountDrifts(computedRupees: number, dtoMaxAmount?: number) {
  if (dtoMaxAmount == null) return;
  if (Math.abs(computedRupees - dtoMaxAmount) > 1) {
    this.logger.warn(`maxAmount drift: server computed ₹${computedRupees}, frontend sent ₹${dtoMaxAmount}`);
  }
}

// handleTokenConfirmed and handleTokenRejected are unchanged — they already
// queried user_subscriptions directly and never used mandateRepo / transactionRepo.
}
