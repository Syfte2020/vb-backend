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

//   async reservation_invoice(id: number) {
    
//  const [row] = await this.dataSource.query(
//     `
//     SELECT
//         b.booking_id AS id,
//         b.booking_auto_id AS refNo,
//         b.booking_type AS type,

//         CASE
//             WHEN b.status = '2' THEN 'CANCELLED'
//             WHEN b.booking_type = 2 THEN 'RESERVED'
//             WHEN b.booking_type = 4 THEN 'NEW'
//             WHEN b.status = '1' THEN 'CONFIRMED'
//             WHEN b.status = '0' THEN 'PENDING'
//             ELSE 'NEW'
//         END AS workflowState,

//         b.billing_first_name AS name,
//         b.billing_email AS email,
//         b.billing_phone AS phone,

//         (
//             SELECT GROUP_CONCAT(
//                 DISTINCT vc.child_venue_name
//                 ORDER BY vc.child_venue_name
//                 SEPARATOR ', '
//             )
//             FROM booking_child_venue bcv
//             INNER JOIN venue_child vc
//                 ON vc.child_venue_id = bcv.child_venue_id
//             WHERE bcv.booking_id = b.booking_id
//         ) AS venue,

//         b.booked_no_of_people AS guests,
//         b.total_booking_price AS amountNum,
//         b.total_booking_price AS amount,
//         b.from_date AS eventDate,
//         b.created_at AS orderDate,
//         b.base_amount_of_hall AS base_amt,

//         (
//             SELECT GROUP_CONCAT(
//                 DISTINCT CASE
//                     WHEN bs.shift_id = 1 THEN 'Morning'
//                     WHEN bs.shift_id = 2 THEN 'Afternoon'
//                     WHEN bs.shift_id = 3 THEN 'Evening'
//                 END
//                 ORDER BY bs.shift_id
//                 SEPARATOR ', '
//             )
//             FROM booking_shift bs
//             WHERE bs.booking_id = b.booking_id
//         ) AS shift,

//         b.booking_auto_id AS source,
//         b.booking_auto_id AS caterer,
//         b.booking_auto_id AS decorator,
//         b.booking_auto_id AS paymentStatus,
//         b.booking_auto_id AS assignedStaff,

//         bet.event_name AS eventType,

//         CASE
//             WHEN b.status = '2' THEN 'bg-red-500'
//             WHEN b.booking_type = 2 THEN 'bg-pink-500'
//             WHEN b.booking_type = 4 THEN 'bg-blue-500'
//             WHEN b.status = '1' THEN 'bg-emerald-500'
//             WHEN b.status = '0' THEN 'bg-amber-500'
//             ELSE 'bg-violet-500'
//         END AS avatarColor,

//         b.booking_auto_id AS tag,

//         (
//             SELECT COALESCE(SUM(ba.price * COALESCE(ba.qty,1)), 0)
//             FROM booking_addon ba
//             WHERE ba.booking_id = b.booking_id
//         ) AS addon_total,

// COALESCE(
// (
//     SELECT JSON_ARRAYAGG(
//         JSON_OBJECT(
//             'id', ba.addon_id,
//             'name', ba.addon_name,
//             'price', ba.price,
//             'qty', COALESCE(ba.qty, 1),
//             'total', ba.price * COALESCE(ba.qty, 1)
//         )
//     )
//     FROM booking_addon ba
//     LEFT JOIN add_ons ad
//         ON CAST(ad.add_on_id AS CHAR) = CAST(ba.addon_id AS CHAR)
//     WHERE CAST(ba.booking_id AS CHAR) = CAST(b.booking_id AS CHAR)
// ),
// JSON_ARRAY()
// ) AS addons

//     FROM bookings b

//     LEFT JOIN booking_event_types bet
//         ON bet.id = b.booking_event_type_id

//     WHERE b.booking_id = ?

//     LIMIT 1;
//     `,
//     [id],
//   );

//   if (!row) {
//     return null;
//   }

//   row.addons =
//     typeof row.addons === 'string'
//       ? JSON.parse(row.addons)
//       : row.addons || [];

//   row.addon_total = Number(row.addon_total || 0);

//   return row;
//   }
// async reservation_invoice(id: number) {
//  const [row] = await this.dataSource.query(
//   `
// SELECT
//     b.id,
//     b.booking_code AS refNo,
//     b.booking_type AS type,
//     b.invoice_number,
//     b.booking_type,

//     vp.venue_name,
//     vp.parent_venue_id,
//     vp.venue_country,
//     vp.venue_address,
//     vp.venue_city,
//     vp.logo,
//     vp.phone,
//     vp.email,

//     CASE
//         WHEN b.status = 2 THEN 'CANCELLED'
//         WHEN b.status = 1 THEN 'CONFIRMED'
//         WHEN b.status = 0 THEN 'PENDING'
//         ELSE 'NEW'
//     END AS workflowState,

//     -- CUSTOMER
//     (
//         SELECT JSON_OBJECT(
//             'name', bp.name,
//             'email', bp.email,
//             'phone', bp.phone
//         )
//         FROM booking_parties bp
//         WHERE bp.booking_id = b.id
//           AND bp.party_type = 'Customer'
//         LIMIT 1
//     ) AS customer,

//     -- VENUE
//     (
//         SELECT GROUP_CONCAT(
//             DISTINCT bv.venue_name_snapshot
//             SEPARATOR ', '
//         )
//         FROM booking_venues bv
//         WHERE bv.booking_id = b.id
//     ) AS venue,

//     -- EVENT DATE
//     (
//         SELECT MIN(bed.event_date)
//         FROM booking_event_dates bed
//         WHERE bed.booking_id = b.id
//     ) AS fromDate,

//     (
//         SELECT MAX(bed.event_date)
//         FROM booking_event_dates bed
//         WHERE bed.booking_id = b.id
//     ) AS toDate,

//     -- SHIFTS
//     (
//         SELECT GROUP_CONCAT(
//             DISTINCT
//             CASE
//                 WHEN bs.shift_name = 'morning' THEN 'Morning'
//                 WHEN bs.shift_name = 'afternoon' THEN 'Afternoon'
//                 WHEN bs.shift_name = 'evening' THEN 'Evening'
//                 WHEN bs.shift_name = 'full day' THEN 'Full Day'
//                 ELSE bs.shift_name
//             END
//             SEPARATOR ', '
//         )
//         FROM booking_shifts bs
//         WHERE bs.booking_id = b.id
//     ) AS shift,

//     -- CHARGES
//     (
//         SELECT COALESCE(SUM(bc.total_price),0)
//         FROM booking_charges bc
//         WHERE bc.booking_id = b.id
//     ) AS addon_total,

//     -- PAYMENTS
//     (
//         SELECT COALESCE(SUM(bp.amount_paid),0)
//         FROM booking_payments bp
//         WHERE bp.booking_id = b.id
//     ) AS paid_amount,

//     -- TAXES
//     (
//         SELECT COALESCE(SUM(bt.tax_amount),0)
//         FROM booking_taxes bt
//         WHERE bt.booking_id = b.id
//     ) AS tax_total,

//     -- DISCOUNTS
//     (
//         SELECT COALESCE(SUM(bd.amount),0)
//         FROM booking_discounts bd
//         WHERE bd.booking_id = b.id
//     ) AS discount_total,

//     b.base_amount AS base_amt,
//     b.total_amount AS amount,
//     b.notes,
//     b.created_at AS orderDate,

//     bet.event_name AS eventType,

//     CASE
//         WHEN b.status = 2 THEN 'bg-red-500'
//         WHEN b.status = 1 THEN 'bg-green-500'
//         WHEN b.status = 0 THEN 'bg-amber-500'
//         ELSE 'bg-gray-500'
//     END AS avatarColor

// FROM bookings b

// LEFT JOIN booking_venues bv_main
//     ON bv_main.booking_id = b.id

// LEFT JOIN venue_child vc
//     ON vc.child_venue_id = bv_main.child_venue_id

// LEFT JOIN venue_parent vp
//     ON vp.parent_venue_id = vc.parent_venue_id

// LEFT JOIN booking_event_types bet
//     ON bet.id = b.booking_event_type_id

// WHERE b.id = ?
// LIMIT 1
// `,
//   [id],
// );

//   if (!row) return null;

//   // -------------------------
//   // SAFE CUSTOMER PARSE
//   // -------------------------
//   let customer = null;
//   try {
//     customer =
//       typeof row.customer === 'string'
//         ? JSON.parse(row.customer)
//         : row.customer;
//   } catch {
//     customer = null;
//   }

//   return {
//     ...row,
//     customer,

//     addon_total: Number(row.addon_total || 0),
//     tax_total: Number(row.tax_total || 0),
//     discount_total: Number(row.discount_total || 0),
//     paid_amount: Number(row.paid_amount || 0),
//     amount: Number(row.amount || 0),
//   };
// }
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
}