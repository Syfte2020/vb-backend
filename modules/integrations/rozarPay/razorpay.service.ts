import { Injectable, BadRequestException } from '@nestjs/common';

import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IntegrationService } from '../integSettings/integSettings.service';
import { DataSource } from 'typeorm';

import Razorpay from 'razorpay';
import * as crypto from 'crypto';

import dayjs from 'dayjs';
import axios from 'axios';

import { InvoiceService } from '../../invoice/invoice.service'
import { SocketService } from '../../socket/socket.service';
import { NotificationService } from '../../../notifications/notification.service';

import {
  generateCode
} from '../../../common/utils/code-generator';

@Injectable()
export class RazorpayService {
  constructor(
    private readonly integrationService: IntegrationService,
    private readonly http: HttpService,
    private readonly dataSource: DataSource,

     private invoiceService: InvoiceService,
    private readonly notificationService: NotificationService,
  ) {}

  async subscription(body: any, userId: number, countryId: number) {
    try {
      const [plan] = await this.dataSource.query(
        `SELECT * FROM plans WHERE id=? LIMIT 1`,
        [body.selectedPlan],
      );

      if (!plan) {
        throw new BadRequestException('Plan not found');
      }

      const [user] = await this.dataSource.query(
        `SELECT * FROM users WHERE id=? LIMIT 1`,
        [userId],
      );

      if (!user) {
        throw new BadRequestException('User not found');
      }

      const config =
        await this.integrationService.getIntegrationConfig('razorpay');
      const configData =
        typeof config === 'string' ? JSON.parse(config) : config;
      const razorpay = new Razorpay({
        key_id: configData.key_id,
        key_secret: configData.key_secret,
      });

      /**
       * plan.plan_id must contain Razorpay Plan Id
       * Example:
       * plan_PjN7fdxxxxxxxx
       */

      // const subscription = await razorpay.subscriptions.create({
      //   plan_id: plan.plan_id,
      //   total_count: 12,
      //   quantity: 1,
      //   customer_notify: 1,
      //   notes: {
      //     user_id: String(userId),
      //     plan_id: String(plan.plan_id),
      //   },
      // });

      const subscription = await razorpay.subscriptions.create({
  plan_id:plan.plan_id,
  total_count: 12,
  quantity: 1,
  customer_notify: 1,
});

      const subscriptionCode = `SUB_${Date.now()}`;

      await this.dataSource.query(
        `
      INSERT INTO user_subscriptions
      (
        user_id,
        country_id,
        plan_id,
        subscription_code,
        subscription_id,
        status,
        created_at,
        updated_at
      )
      VALUES
      (?, ?, ?, ?, ?, 'pending', NOW(), NOW())
      `,
        [userId, countryId, plan.id, subscriptionCode, subscription.id],
      );

      return {
      success: true,
      key_id: configData.key_id,
      subscription_id: subscription.id,
      url: subscription.short_url,
    };
    } catch (e) {
      console.log(e);

      throw new BadRequestException('Unable to create Razorpay subscription');
    }
  }

  async verifySubscription(body: any) {
     const config =
    await this.integrationService.getIntegrationConfig('razorpay');

  const configData =
    typeof config === 'string' ? JSON.parse(config) : config;

  const expectedSignature = crypto
    .createHmac('sha256', configData.key_secret)
    .update(
      body.payment_id + '|' + body.subscription_id,
    )
    .digest('hex');

  if (expectedSignature !== body.signature) {
    throw new BadRequestException('Invalid signature');
  }

  await this.dataSource.query(
    `
      UPDATE user_subscriptions
      SET
        status='active',
        subscription_code=?,
        updated_at=NOW()
      WHERE subscription_id=?
    `,
    [
      body.payment_id,
      body.subscription_id,
    ],
  );

  return {
    success: true,
    subscription_id:body.subscription_id
    
  };
  }

  async verifys(id: any) 
  {
     const result  = await this.dataSource.query(
    `
      SELECT * FROM  user_subscriptions WHERE subscription_id = ? 
    `,
    [
      id,
    ],
  );
  return result[0];
  }
    async verifyPayment(body: any, id: any) {
    const config =
      await this.integrationService.getIntegrationConfig('razorpay');

    const configData = typeof config === 'string' ? JSON.parse(config) : config;

    const expected = crypto
      .createHmac('sha256', configData.key_secret)
      .update(body.razorpay_payment_id + '|' + body.razorpay_subscription_id)
      .digest('hex');

    if (expected !== body.razorpay_signature) {
      throw new BadRequestException('Invalid Signature');
    }

    await this.dataSource.query(
      `
      UPDATE user_subscriptions
      SET
      status='active',
      updated_at=NOW()
      WHERE subscription_id=?
      `,
      [body.razorpay_subscription_id],
    );

    return {
      success: true,
      message: 'Subscription Activated',
    };
  }

  // payment.service.ts

  async createOrder(body: any) {
    const options = {
      amount: body.amount * 100, // ₹500 => 50000 paise
      currency: 'INR',
      receipt: `RCPT_${Date.now()}`,
      payment_capture: true,
      notes: {
        booking_id: body.booking_id,
      },
    };

    const config =
      await this.integrationService.getIntegrationConfig('razorpay');

    const configData = typeof config === 'string' ? JSON.parse(config) : config;

    const response = await axios.post(
      'https://api.razorpay.com/v1/orders',
      options,
      {
        auth: {
          username: configData.key_id.trim(),
          password: configData.key_secret.trim(),
        },
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    return response?.data;
  }

  async verify(body: any) {
    const config =
      await this.integrationService.getIntegrationConfig('razorpay');
    const configData = typeof config === 'string' ? JSON.parse(config) : config;
    const generatedSignature = crypto
      .createHmac('sha256', configData.key_secret)
      .update(body.razorpay_order_id + '|' + body.razorpay_payment_id)
      .digest('hex');

    if (generatedSignature !== body.razorpay_signature) {
      throw new Error('Payment verification failed');
    }

    // Update booking/payment status


    return {
      success: true,
    };
  }

  async createOnlineBooking(dto: any, id: number, country: any) {

    // ─────────────────────────────────────────────────────────────────────────
    // 0. NORMALIZE INCOMING PAYLOAD
    // ─────────────────────────────────────────────────────────────────────────
    // The frontend now sends a nested shape:
    //   { addons: [{add_on_id, qty, price, total}], booking: {...}, customer: {...}, pricing: {...} }
    // instead of the older flat shape (dto.event, dto.venues[], dto.category, ...).
    // We map everything into one consistent set of variables here so the rest of
    // the function doesn't need to know which shape arrived. Old field names are
    // kept as fallbacks so existing pax/farmstay bookings keep working unchanged.
    const booking      = dto.booking || {};
    const rawPricing   = dto.pricing || {};
    const customer     = dto.customer || dto.customer_details || {};
    const rawAddons    = dto.addons || [];

    const category      = booking.category ?? dto.category;
    const bookingType    = booking.booking_type ?? dto.booking_type ?? dto.reserveType;
    const guestCapacity  = booking.guests ?? dto.event?.guest_capacity ?? 0;
    // const eventType      = booking.event_type ?? dto.event?.event_type ?? null;
    const selectionType  = booking.selection_type ?? dto.event?.selection_type ?? null;
    const selectionMode  = booking.selection_mode ?? dto.event?.selection_mode ?? null;
    const specialRequest = dto.special_request ?? booking.notes ?? null;

    // Single-venue shape (new) vs. multi-venue array shape (old / farmstay)
    const venueId   = booking.venue_id ?? null;
    const venueName = booking.venue_name ?? null;
    const legacyVenues = Array.isArray(dto.venues) ? dto.venues : null;

    // Dates: single `date`, or check_in/check_out range (new) vs. event.date_range /
    // event.event_date (old)
    const singleDate = booking.date ?? null;
    const checkIn    = booking.check_in ?? null;
    const checkOut   = booking.check_out ?? null;

    // Shift: single string (new) vs. array of strings (old)
    const shiftRaw = booking.shift ?? dto.event?.shift ?? null;
    const shifts: string[] = Array.isArray(shiftRaw) ? shiftRaw : (shiftRaw ? [shiftRaw] : []);

    // Customer
    const customerName  = customer.name  ?? null;
    const customerPhone = customer.phone ?? null;
    const customerEmail = customer.email ?? null;

    // Pricing — new payload uses camelCase + a single combined GST figure;
    // legacy payload uses snake_case + separate venue/pax GST figures.
    const pricing = {
      baseAmount:        rawPricing.baseAmount        ?? rawPricing.base_amount ?? 0,
      cleaningAmount:    rawPricing.cleaningAmount     ?? 0,
      convenienceFee:    rawPricing.convenienceFee     ?? 0,
      addonAmount:       rawPricing.addon_amount       ?? rawPricing.addonAmount ?? 0,
      securityDeposit:   rawPricing.securityDeposit    ?? rawPricing.security_deposit ?? 0,
      advanceAmount:     rawPricing.advance_amount     ?? 0,
      reservationAmount: rawPricing.reservation_amount ?? 0,
      walletDiscount:    rawPricing.wallet_discount    ?? 0,
      discountAmount:    rawPricing.discount_amount    ?? 0,
      discountPercent:   rawPricing.discount_percent   ?? 0,
      grandTotal:        rawPricing.grand_total ?? rawPricing.final_total ?? 0,
      // GST — combined (new) or split venue/pax GST (legacy)
      isCombinedGst:     rawPricing.gstAmount != null,
      gstAmount:         rawPricing.gstAmount ?? 0,
      gstPercent:        rawPricing.gstPercent ?? 18,
      gstTotalLegacy:    rawPricing.gst_total ?? 0,
      paxGstLegacy:      rawPricing.pax_gst ?? 0,
    };

    const taxAmountTotal = pricing.isCombinedGst
      ? pricing.gstAmount
      : (pricing.gstTotalLegacy + pricing.paxGstLegacy);

    const discountAmountTotal = pricing.discountAmount || pricing.walletDiscount || 0;

    // -----------------------------
    // 1. CATEGORY
    // -----------------------------
    const singular = category?.endsWith('s')
      ? category.slice(0, -1)
      : category;

    const [categoryRow] = await this.dataSource.query(
      `SELECT id FROM category WHERE name = ? LIMIT 1`,
      [singular],
    );

    // -----------------------------
    // 2. IDS
    // -----------------------------
    let code = generateCode();

    while (true) {
      const rows = await this.dataSource.query(
        `SELECT 1 FROM bookings WHERE invoice_number = ? LIMIT 1`,
        [code],
      );

      if (rows.length === 0) break;
      code = generateCode();
    }

    // 'book' -> 'booked', 'reserve' -> 'reserve', anything else passes through.
    const reserveType = bookingType === 'book' ? 'booked' : (bookingType || 'draft');

       // Event Type
    const eventRows: any = await this.dataSource.query(
      `SELECT id FROM booking_event_types WHERE event_name = ? LIMIT 1`,
      [booking.event_type ?? dto.event?.event_type],
    );

    const eventTypeId = eventRows.length ? eventRows[0].id : null;

    // -----------------------------
    // 3. MAIN BOOKING INSERT
    // -----------------------------
    const result: any = await this.dataSource.query(
      `
      INSERT INTO bookings
      (
        booking_code,
        invoice_number,
        booking_type,
        category,
        country_id,
        status,
        total_pax,
        base_amount,
        discount_amount,
        tax_amount,
        total_amount,
        notes,
        vendor_id,
        created_by,
        updated_by,
        created_at,
        updated_at,
        booking_event_type_id,
        selection_mode,
        selection_type
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `,
      [
        code,
        0,
        reserveType,
        categoryRow?.id || null,
        country,
        'active',

        guestCapacity || 0,
        pricing.baseAmount || 0,
        discountAmountTotal,
        taxAmountTotal,
        pricing.grandTotal || 0,

        specialRequest,

        id,
        id,
        id,
        new Date(),
        new Date(),
        eventTypeId,
        'Online',
        'Online',
      ],
    );

    const bookingId = result.insertId;

   
    // -----------------------------
    // 4. VENUES
    // -----------------------------
    let venueValues: any[] = [];

    if (legacyVenues?.length) {
      // Old multi-venue / farmstay shape
      venueValues = legacyVenues.map((venue: any) => [
        bookingId,
        venue.parent_venue_id || null,
        venue.child_venue_id || null,
        venue.child_venue_name || null,
      ]);
    } else if (venueId) {
      // New single-venue shape
      venueValues = [[
        bookingId,
        null,
        venueId,
        
        venueName,
      ]];
    }

    if (venueValues.length) {
      await this.dataSource.query(
        `
        INSERT INTO booking_venues
        (booking_id, parent_venue_id, child_venue_id, venue_name_snapshot)
        VALUES ?
        `,
        [venueValues],
      );
    }

    // -----------------------------
    // 5. EVENT DATES
    // -----------------------------
    let eventDates: string[] = [];

    // Farmstay / multi-venue date range (old shape)
    if (legacyVenues?.length && legacyVenues[0]?.start_date && legacyVenues[0]?.end_date) {
      eventDates = getDatesBetween(legacyVenues[0].start_date, legacyVenues[0].end_date);
    }
    // Single-venue check-in/check-out range (new shape)
    else if (checkIn && checkOut) {
      eventDates = getDatesBetween(checkIn, checkOut);
    }
    // Event date range (old shape)
    else if (dto.event?.date_range?.start_date && dto.event?.date_range?.end_date) {
      eventDates = getDatesBetween(
        dto.event.date_range.start_date,
        dto.event.date_range.end_date,
      );
    }
    // Multiple selected dates (old shape)
    else if (Array.isArray(dto.event?.event_date)) {
      eventDates = dto.event.event_date;
    }
    // Single date (new shape)
    else if (singleDate) {
      eventDates = [singleDate];
    }
    // Single date (old shape)
    else if (dto.event?.event_date) {
      eventDates = [dto.event.event_date];
    }

    // Remove duplicates
    eventDates = [...new Set(eventDates)];

    // Insert dates
    const eventDateResult: any[] = [];

    for (const date of eventDates) {
      const res: any = await this.dataSource.query(
        `
          INSERT INTO booking_event_dates
          (booking_id, event_date)
          VALUES (?, ?)
        `,
        [bookingId, date],
      );

      eventDateResult.push({
        id: res.insertId,
        date,
      });
    }

    // -----------------------------
    // 6. SHIFTS
    // -----------------------------
    const SHIFT_MAP: any = {
      morning: 1,
      afternoon: 2,
      evening: 3,
    };

    const shiftValues: any[] = [];

    for (const ed of eventDateResult) {
      for (const shift of shifts) {
        const shiftId = SHIFT_MAP[shift.toLowerCase()];
        if (!shiftId) continue;

        shiftValues.push([
          bookingId,
          ed.id,
          0,
          shift,
          'active',
        ]);
      }
    }

    if (shiftValues.length) {
      await this.dataSource.query(
        `
        INSERT INTO booking_shifts
        (booking_id, event_date_id, venue_id, shift_name, status)
        VALUES ?
        `,
        [shiftValues],
      );
    }

    // -----------------------------
    // 7. CUSTOMER
    // -----------------------------
    await this.dataSource.query(
      `
      INSERT INTO booking_parties
      (
        booking_id,
        party_type,
        party_id,
        name,
        phone,
        email
      )
      VALUES (?,?,?,?,?,?)
      `,
      [
        bookingId,
        'customer',
        0,
        customerName,
        customerPhone,
        customerEmail,
      ],
    );

    // -----------------------------
    // 8. SERVICE PROVIDERS
    // -----------------------------
    const providers = dto.service_providers || {};

    const providerValues = Object.entries(providers)
      .filter(([, value]) => value)
      .map(([type, value]: any) => [
        bookingId,
        type,
        0,
        value,
      ]);

    if (providerValues.length) {
      await this.dataSource.query(
        `
        INSERT INTO booking_parties
        (booking_id, party_type, party_id, name)
        VALUES ?
        `,
        [providerValues],
      );
    }

    // -----------------------------
    // 9. CHARGES
    // -----------------------------
    const chargeValues: any[] = [];

    // --------------------
    // 1. BASE AMOUNT
    // --------------------
    chargeValues.push([
      bookingId,
      'base',
      'Base Amount',
      1,
      pricing.baseAmount || 0,
      pricing.baseAmount || 0,
    ]);

    // --------------------
    // 2. ADDONS
    // --------------------
    if (rawAddons.length) {
      // New shape sends { add_on_id, qty, price, total } with no name — look the
      // names up in one batch query so charge rows stay human-readable.
      const addonIds = rawAddons
        .map((a: any) => a.add_on_id)
        .filter((v: any) => v != null);

      let addonNameById: Record<string, string> = {};
      if (addonIds.length) {
        const addonRows = await this.dataSource.query(
          `SELECT add_on_id as id, add_on_name as name FROM add_ons WHERE add_on_id IN (?)`,
          [addonIds],
        );
        addonNameById = Object.fromEntries(
          addonRows.map((r: any) => [r.id, r.name]),
        );
      }

      for (const addon of rawAddons) {
        const name     = addon.name || addonNameById[addon.add_on_id] || 'Add-on';
        const qty      = addon.qty ?? 1;
        const unitPrice = addon.price ?? addon.unit_price ?? 0;
        const total    = addon.total ?? addon.amount ?? (qty * unitPrice);

        chargeValues.push([
          bookingId,
          'addon',
          name,
          qty,
          unitPrice,
          total,
        ]);
      }
    }

    // --------------------
    // 3. CONVENIENCE FEE (new)
    // --------------------
    if (pricing.convenienceFee) {
      chargeValues.push([
        bookingId,
        'convenience_fee',
        'Convenience Fee',
        1,
        pricing.convenienceFee,
        pricing.convenienceFee,
      ]);
    }

    // --------------------
    // 4. CLEANING FEE (new)
    // --------------------
    if (pricing.cleaningAmount) {
      chargeValues.push([
        bookingId,
        'cleaning_fee',
        'Cleaning Fee',
        1,
        pricing.cleaningAmount,
        pricing.cleaningAmount,
      ]);
    }

    // --------------------
    // 5. SECURITY DEPOSIT
    // --------------------
    if (pricing.securityDeposit) {
      chargeValues.push([
        bookingId,
        'security_deposit',
        'Security Deposit',
        1,
        pricing.securityDeposit,
        pricing.securityDeposit,
      ]);
    }

    // --------------------
    // 6. ADVANCE PAYMENT
    // --------------------
    if (pricing.advanceAmount) {
      chargeValues.push([
        bookingId,
        'advance',
        'Advance Payment',
        1,
        pricing.advanceAmount,
        pricing.advanceAmount,
      ]);
    }

    // --------------------
    // 7. RESERVATION AMOUNT
    // --------------------
    if (pricing.reservationAmount) {
      chargeValues.push([
        bookingId,
        'reservation',
        'Reservation Amount',
        1,
        pricing.reservationAmount,
        pricing.reservationAmount,
      ]);
    }

    // --------------------
    // 8. DISCOUNT — explicit discount (old) takes priority over wallet discount (new)
    // --------------------
    if (pricing.discountAmount) {
      chargeValues.push([
        bookingId,
        'discount',
        'Discount',
        1,
        -pricing.discountPercent,
        -pricing.discountAmount,
      ]);
    } else if (pricing.walletDiscount) {
      chargeValues.push([
        bookingId,
        'wallet_discount',
        'Wallet Discount',
        1,
        0,
        -pricing.walletDiscount,
      ]);
    }

    // --------------------
    // INSERT ALL
    // --------------------
    await this.dataSource.query(
      `
      INSERT INTO booking_charges
      (booking_id, charge_type, title, quantity, unit_price, total_price)
      VALUES ?
      `,
      [chargeValues],
    );

    // -----------------------------
    // TAXES — combined GST (new) or split venue/pax GST (legacy)
    // -----------------------------
    const taxes: any[] = [];

    if (pricing.isCombinedGst) {
      if (pricing.gstAmount > 0) {
        taxes.push([
          bookingId,
          'GST',
          pricing.gstPercent || 18,
          0,
          pricing.gstAmount,
        ]);
      }
    } else {
      if (pricing.gstTotalLegacy > 0) {
        taxes.push([
          bookingId,
          'Venue GST',
          18,
          0,
          pricing.gstTotalLegacy,
        ]);
      }

      if (pricing.paxGstLegacy > 0) {
        taxes.push([
          bookingId,
          'PAX GST',
          5,
          0,
          pricing.paxGstLegacy,
        ]);
      }
    }

    if (taxes.length) {
      await this.dataSource.query(
        `
        INSERT INTO booking_taxes
        (booking_id, tax_name, tax_percent, taxable_amount, tax_amount)
        VALUES ?
        `,
        [taxes],
      );
    }

    // -----------------------------
    // 10. LOGS
    // -----------------------------
    await this.createLog(
      'booking',
      bookingId,
      'created',
      `Booking ${code} created`,
      id,
      null,
      {
        booking_type: reserveType,
        customer: customerName,
        total_amount: pricing.grandTotal,
      },
    );

    // Realtime
    // this.socketService.realtime(
    //   id.toString(),
    //   'Booking',
    //   `Booking ${code} created`
    // );

    // Email
    const invoiceData = {
      email: customerEmail,
      id: bookingId,
    };
    this.invoiceService.sendInvoice(invoiceData);

    await this.notificationService.createNotification({
      type: reserveType,
      referenceId: bookingId,
      title: `New ${reserveType}`,
      message: `New ${reserveType} received - ${code}`,
      createdBy: id,
    });

    return {
      success: true,
      booking_id: bookingId,
      invoice_number: code,
    };
  }



async createLog(
  module: string,
  recordId: number,
  action: string,
  description: string,
  userId?: number,
  oldValue?: any,
  newValue?: any,
) {
  await this.dataSource.query(
  `
  INSERT INTO booking_logs
  (
    booking_id,
    action,
    description,
    old_value,
    new_value,
    created_by,
    created_at
  )
  VALUES (?,?,?,?,?,?,?)
  `,
  [
    recordId,
     module,
    description,
    null,
    JSON.stringify(newValue),
    userId,
    new Date(),
  ]
);

}
  //

}




function getDatesBetween(startDate: string, endDate: string) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  const result: string[] = [];

  while (start <= end) {
    const yyyy = start.getFullYear();
    const mm = String(start.getMonth() + 1).padStart(2, '0');
    const dd = String(start.getDate()).padStart(2, '0');

    result.push(`${yyyy}-${mm}-${dd}`);

    start.setDate(start.getDate() + 1);
  }

  return result;
}

function parseDate(dateStr: string): Date {
  if (!dateStr) throw new Error('Invalid date input');

  const parts = dateStr.split('-');

  // if format is DD-MM-YYYY
  if (parts[0].length === 2) {
    const [dd, mm, yyyy] = parts.map(Number);
    return new Date(yyyy, mm - 1, dd);
  }

  // if format is YYYY-MM-DD
  const [yyyy, mm, dd] = parts.map(Number);
  return new Date(yyyy, mm - 1, dd);
}