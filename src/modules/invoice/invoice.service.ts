import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { generatePdfBuffer } from './pdf/pdf.generator';
import { sendInvoiceEmail } from './email/mail.service';

@Injectable()
export class InvoiceService {

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}


async reservation_invoice(id: number) {
 const [row] = await this.dataSource.query(
  `
SELECT
    b.id,
    b.booking_code AS refNo,
    b.booking_type AS type,
    b.invoice_number,
    b.booking_type,

    vp.venue_name,
    vp.parent_venue_id,
    vp.venue_country,
    vp.venue_address,
    vp.venue_city,
    vp.logo,
    vp.phone,
    vp.email,

    CASE
        WHEN b.status = 2 THEN 'CANCELLED'
        WHEN b.status = 1 THEN 'CONFIRMED'
        WHEN b.status = 0 THEN 'PENDING'
        ELSE 'NEW'
    END AS workflowState,

    -- CUSTOMER
    (
        SELECT JSON_OBJECT(
            'name', bp.name,
            'email', bp.email,
            'phone', bp.phone
        )
        FROM booking_parties bp
        WHERE bp.booking_id = b.id
          AND bp.party_type = 'Customer'
        LIMIT 1
    ) AS customer,

    -- VENUE
    (
        SELECT GROUP_CONCAT(
            DISTINCT bv.venue_name_snapshot
            SEPARATOR ', '
        )
        FROM booking_venues bv
        WHERE bv.booking_id = b.id
    ) AS venue,

    -- EVENT DATE
    (
        SELECT MIN(bed.event_date)
        FROM booking_event_dates bed
        WHERE bed.booking_id = b.id
    ) AS fromDate,

    (
        SELECT MAX(bed.event_date)
        FROM booking_event_dates bed
        WHERE bed.booking_id = b.id
    ) AS toDate,

    -- SHIFTS
    (
        SELECT GROUP_CONCAT(
            DISTINCT
            CASE
                WHEN bs.shift_name = 'morning' THEN 'Morning'
                WHEN bs.shift_name = 'afternoon' THEN 'Afternoon'
                WHEN bs.shift_name = 'evening' THEN 'Evening'
                WHEN bs.shift_name = 'full day' THEN 'Full Day'
                ELSE bs.shift_name
            END
            SEPARATOR ', '
        )
        FROM booking_shifts bs
        WHERE bs.booking_id = b.id
    ) AS shift,

    -- CHARGES
    (
        SELECT COALESCE(SUM(bc.total_price),0)
        FROM booking_charges bc
        WHERE bc.booking_id = b.id
    ) AS addon_total,

    -- PAYMENTS
    (
        SELECT COALESCE(SUM(bp.amount_paid),0)
        FROM booking_payments bp
        WHERE bp.booking_id = b.id
    ) AS paid_amount,

    -- TAXES
    (
        SELECT COALESCE(SUM(bt.tax_amount),0)
        FROM booking_taxes bt
        WHERE bt.booking_id = b.id
    ) AS tax_total,

    -- DISCOUNTS
    (
        SELECT COALESCE(SUM(bd.amount),0)
        FROM booking_discounts bd
        WHERE bd.booking_id = b.id
    ) AS discount_total,

    b.base_amount AS base_amt,
    b.total_amount AS amount,
    b.notes,
    b.created_at AS orderDate,

    bet.event_name AS eventType,

    CASE
        WHEN b.status = 2 THEN 'bg-red-500'
        WHEN b.status = 1 THEN 'bg-green-500'
        WHEN b.status = 0 THEN 'bg-amber-500'
        ELSE 'bg-gray-500'
    END AS avatarColor

FROM bookings b

LEFT JOIN booking_venues bv_main
    ON bv_main.booking_id = b.id

LEFT JOIN venue_child vc
    ON vc.child_venue_id = bv_main.child_venue_id

LEFT JOIN venue_parent vp
    ON vp.parent_venue_id = vc.parent_venue_id

LEFT JOIN booking_event_types bet
    ON bet.id = b.booking_event_type_id

WHERE b.id = ?
LIMIT 1
`,
  [id],
);

  row.charges = await this.dataSource.query(
    `
    SELECT
        id,
        charge_type,
        title,
        quantity,
        unit_price,
        total_price
    FROM booking_charges
    WHERE booking_id = ?
    ORDER BY id
    `,
    [id],
  );

   row.taxes = await this.dataSource.query(
    `
    SELECT *
    FROM booking_taxes
    WHERE booking_id = ?
    `,
    [id],
  );

  row.pax_item_snapshot = await this.dataSource.query(
    `
    SELECT
      bps.id,
      bps.booking_pax_id,
      bps.item_id,
      bps.item_name,
      bps.price,
      bps.created_at
    FROM booking_pax_item_snapshot bps
    INNER JOIN booking_pax bp ON bp.id = bps.booking_pax_id
    WHERE bp.booking_id = ?
    `,
    [id],
  );



  if (!row) return null;

  // -------------------------
  // SAFE CUSTOMER PARSE
  // -------------------------
  let customer = null;
  try {
    customer =
      typeof row.customer === 'string'
        ? JSON.parse(row.customer)
        : row.customer;
  } catch {
    customer = null;
  }

  return {
    ...row,
    customer,

    addon_total: Number(row.addon_total || 0),
    tax_total: Number(row.tax_total || 0),
    discount_total: Number(row.discount_total || 0),
    paid_amount: Number(row.paid_amount || 0),
    amount: Number(row.amount || 0),
  };
}

  async downloadPdf(id: number) {
    const data = await this.reservation_invoice(id);
    return generatePdfBuffer(data);
  }

  async emailInvoice(body: any) {
    const data = await this.reservation_invoice(body.id);
     data.email = body.email;

  await sendInvoiceEmail(data);
    return { message: 'Email sent' };
  }

    async sendInvoice(body: any) {
        console.log(body)
    const data = await this.reservation_invoice(body.id);
     console.log(data)
     data.email = body.email;

  await sendInvoiceEmail(data);
    return { message: 'Email sent' };
  }  
  
  async sendeNQUIRY(body: any) {
        console.log(body)
    const data = await this.reservation_invoice(body.id);
     console.log(data)
     data.email = body.email;

  await sendInvoiceEmail(data);
    return { message: 'Email sent' };
  }
}