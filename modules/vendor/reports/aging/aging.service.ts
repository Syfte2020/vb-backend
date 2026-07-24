import { Injectable,BadRequestException,
  ConflictException, } from '@nestjs/common';
import { DataSource, Repository, Not, IsNull, LessThan } from 'typeorm';
import { StorageService } from 'src/common/storage/storage.service';

import { v4 as uuidv4 } from "uuid";

type UploadFile = {
  id: string;
  buffer: Buffer;
  mimetype: string;
};

@Injectable()


export class AgingService {
  constructor(
    private dataSource: DataSource,
    private storageService: StorageService,
  ) {}

  async all_report(userId: any) 
  {
   const [dashboard] = await this.dataSource.query(
`
SELECT

    /* Booking Stats */
    COUNT(*) AS total_bookings,

    SUM(b.total_amount) AS total_booking_amount,

    SUM(CASE WHEN b.status='Booked' THEN 1 ELSE 0 END) AS booked,

    SUM(CASE WHEN b.status='Completed' THEN 1 ELSE 0 END) AS completed,

    SUM(CASE WHEN b.status='Cancelled' THEN 1 ELSE 0 END) AS cancelled,

    /* Payment Summary */

    COALESCE((
        SELECT SUM(bp.amount_paid)
        FROM booking_payments bp
        INNER JOIN bookings b2 ON b2.id = bp.booking_id
        WHERE bp.payment_status='paid'
        AND b2.vendor_id = b.vendor_id
    ),0) AS total_received,

    SUM(b.total_amount) -
    COALESCE((
        SELECT SUM(bp.amount_paid)
        FROM booking_payments bp
        INNER JOIN bookings b2 ON b2.id = bp.booking_id
        WHERE bp.payment_status='paid'
        AND b2.vendor_id = b.vendor_id
    ),0) AS total_pending,

    /* Booking Charges */

    COALESCE((
        SELECT SUM(total_price)
        FROM booking_charges bc
        INNER JOIN bookings b3 ON b3.id=bc.booking_id
        WHERE b3.vendor_id=b.vendor_id
    ),0) AS total_charges,

    /* Base Amount */

    SUM(b.base_amount) AS total_base_amount,

    /* Discount */

    SUM(b.discount_amount) AS total_discount,

    /* Tax */

    SUM(b.tax_amount) AS total_tax

FROM bookings b

WHERE b.vendor_id=?;
`,
[userId]
);
// return dashboard;


const [
  kpis,
  chart,
  breakdown,
  bookings,
  agingBuckets,
  agingRows,
] = await Promise.all([
  this.getKpis(userId),
  this.getChart(userId),
  this.getBreakdown(userId),
  this.getBookings(userId),
  this.getAgingBuckets(userId),
  this.getAgingRows(userId),
]);

return {
  venues: {
    kpis,
    chart,
    breakdown,
    bookings,
    aging: {
      bucketValues: agingBuckets,
      rows: agingRows,
    },
  },
};

  }

  private async getKpis(vendorId: number) {
  const [current] = await this.dataSource.query(
    `
    SELECT

        COUNT(*) total_bookings,

        COALESCE(SUM(total_amount),0) total_revenue,

        COALESCE(SUM(base_amount),0) base_amount,

        ROUND(
            SUM(CASE WHEN status='Completed' THEN 1 ELSE 0 END)
            *100/COUNT(*),
            2
        ) completion_rate

    FROM bookings

    WHERE vendor_id=?
    AND MONTH(created_at)=MONTH(CURDATE())
    AND YEAR(created_at)=YEAR(CURDATE())
    `,
    [vendorId],
  );

  const [payments] = await this.dataSource.query(
    `
    SELECT

        COALESCE(SUM(bp.amount_paid),0) received

    FROM booking_payments bp

    INNER JOIN bookings b
        ON b.id=bp.booking_id

    WHERE b.vendor_id=?
    AND bp.payment_status='Success'
    `,
    [vendorId],
  );

  return [
    {
      value: `₹${Number(current.total_revenue).toLocaleString('en-IN')}`,
      growth: 0,
      up: true,
      sparkline: [],
    },
    {
      value: String(current.total_bookings),
      growth: 0,
      up: true,
      sparkline: [],
    },
    {
      value: `₹${Number(payments.received).toLocaleString('en-IN')}`,
      growth: 0,
      up: true,
      sparkline: [],
    },
    {
      value: `${Number(current.completion_rate || 0).toFixed(0)}%`,
      growth: 0,
      up: true,
      sparkline: [],
    },
  ];
}

private async getChart(vendorId: number) {
  const rows = await this.dataSource.query(
    `
    SELECT
        YEAR(created_at) AS year,
        MONTH(created_at) AS month,
        COUNT(*) AS total
    FROM bookings
    WHERE vendor_id = ?
      AND created_at >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)
    GROUP BY YEAR(created_at), MONTH(created_at)
    ORDER BY YEAR(created_at), MONTH(created_at)
    `,
    [vendorId],
  );

  const months = new Array(12).fill(0);

  const now = new Date();

  rows.forEach((row: any) => {
    const rowDate = new Date(row.year, row.month - 1);

    const diff =
      (now.getFullYear() - rowDate.getFullYear()) * 12 +
      (now.getMonth() - rowDate.getMonth());

    if (diff >= 0 && diff < 12) {
      months[11 - diff] = Number(row.total);
    }
  });

  return months;
}

private async getBreakdown(vendorId: number) {
  const [result] = await this.dataSource.query(
    `
    SELECT

        SUM(CASE
            WHEN booking_type = 'Online' THEN 1
            ELSE 0
        END) AS online_bookings,

        SUM(CASE
            WHEN booking_type = 'Offline' THEN 1
            ELSE 0
        END) AS offline_bookings,

        SUM(CASE
            WHEN status = 'Cancelled' THEN 1
            ELSE 0
        END) AS cancelled,

        COALESCE((
            SELECT
                SUM(b.total_amount - IFNULL(p.received,0))
            FROM bookings b
            LEFT JOIN (
                SELECT
                    booking_id,
                    SUM(amount_paid) AS received
                FROM booking_payments
                WHERE payment_status='Success'
                GROUP BY booking_id
            ) p ON p.booking_id=b.id
            WHERE b.vendor_id=?
        ),0) AS pending_amount

    FROM bookings

    WHERE vendor_id=?;
    `,
    [vendorId, vendorId],
  );

  const totalBookings =
    Number(result.online_bookings) +
    Number(result.offline_bookings);

  return [
    {
      label: 'Online bookings',
      value: String(result.online_bookings),
      pct:
        totalBookings === 0
          ? 0
          : Math.round((result.online_bookings * 100) / totalBookings),
    },
    {
      label: 'Offline bookings',
      value: String(result.offline_bookings),
      pct:
        totalBookings === 0
          ? 0
          : Math.round((result.offline_bookings * 100) / totalBookings),
    },
    {
      label: 'Pending payments',
      value: `₹${Number(result.pending_amount).toLocaleString('en-IN')}`,
      pct: 100,
    },
    {
      label: 'Cancelled',
      value: String(result.cancelled),
      pct:
        totalBookings === 0
          ? 0
          : Math.round((result.cancelled * 100) / totalBookings),
    },
  ];
}
private async getBookings(vendorId: number) {
  const bookings = await this.dataSource.query(
    `
    SELECT
        b.id,
        b.booking_code,
        b.invoice_number,
        b.selection_type,
        b.status,
        b.total_amount,
        b.invoice_date,

        p.payment_date,
        p.payment_method,
        p.payment_type

    FROM bookings b

    LEFT JOIN (
        SELECT
            booking_id,
            MAX(payment_date) AS payment_date,
            SUBSTRING_INDEX(
                GROUP_CONCAT(payment_method ORDER BY payment_date DESC),
                ',',
                1
            ) AS payment_method,
            SUBSTRING_INDEX(
                GROUP_CONCAT(payment_type ORDER BY payment_date DESC),
                ',',
                1
            ) AS payment_type
        FROM booking_payments
        GROUP BY booking_id
    ) p
        ON p.booking_id = b.id

    WHERE b.vendor_id = ?

    ORDER BY b.created_at DESC

    LIMIT 5
    `,
    [vendorId],
  );

  const bookingIds = bookings.map((b) => b.id);

  if (!bookingIds.length) {
    return [];
  }

  const charges = await this.dataSource.query(
    `
    SELECT
        booking_id,
        charge_type,
        title,
        total_price
    FROM booking_charges
    WHERE booking_id IN (?)
    ORDER BY booking_id,id
    `,
    [bookingIds],
  );

  return bookings.map((booking) => ({
    id: booking.id,

    // Replace with customer name when available
    name: booking.booking_code,

    amount: Number(booking.total_amount),

    date: booking.invoice_date,

    // Replace with venue name when available
    detail: booking.selection_type,

    status: booking.status,

    paidOn: booking.payment_date,

    paymentMode: [
      booking.payment_type,
      booking.payment_method,
    ]
      .filter(Boolean)
      .join(" · "),

    breakdown: charges
      .filter((c) => c.booking_id === booking.id)
      .map((c) => ({
        label: c.title,
        value: Number(c.total_price),
        negative:
          c.charge_type?.toLowerCase() === "refund",
      })),
  }));
}

private async getAgingBuckets(vendorId: number): Promise<number[]> {
  const [result] = await this.dataSource.query(
    `
    SELECT

        SUM(
            CASE
                WHEN age_days BETWEEN 0 AND 30
                THEN outstanding
                ELSE 0
            END
        ) AS bucket_30,

        SUM(
            CASE
                WHEN age_days BETWEEN 31 AND 60
                THEN outstanding
                ELSE 0
            END
        ) AS bucket_60,

        SUM(
            CASE
                WHEN age_days BETWEEN 61 AND 90
                THEN outstanding
                ELSE 0
            END
        ) AS bucket_90,

        SUM(
            CASE
                WHEN age_days > 90
                THEN outstanding
                ELSE 0
            END
        ) AS bucket_90_plus

    FROM (

        SELECT

            b.id,

            DATEDIFF(CURDATE(), b.invoice_date) AS age_days,

            GREATEST(
                b.total_amount - IFNULL(p.received,0),
                0
            ) AS outstanding

        FROM bookings b

        LEFT JOIN (

            SELECT
                booking_id,
                SUM(amount_paid) AS received
            FROM booking_payments
            WHERE payment_status='Success'
            GROUP BY booking_id

        ) p
            ON p.booking_id=b.id

        WHERE b.vendor_id=?

    ) x
    `,
    [vendorId],
  );

  return [
    Number(result.bucket_30 || 0),
    Number(result.bucket_60 || 0),
    Number(result.bucket_90 || 0),
    Number(result.bucket_90_plus || 0),
  ];
}

private async getAgingRows(vendorId: number) {
  const rows = await this.dataSource.query(
    `
    SELECT

        b.id,

        b.booking_code,

        b.total_amount AS total,

        GREATEST(
            b.total_amount - IFNULL(p.received,0),
            0
        ) AS outstanding,

        CASE
            WHEN DATEDIFF(CURDATE(), b.invoice_date) > 30
            THEN GREATEST(
                b.total_amount - IFNULL(p.received,0),
                0
            )
            ELSE 0
        END AS overdue,

        CASE
            WHEN DATEDIFF(CURDATE(), b.invoice_date) <= 30
            THEN GREATEST(
                b.total_amount - IFNULL(p.received,0),
                0
            )
            ELSE 0
        END AS d30,

        DATEDIFF(CURDATE(), b.invoice_date) AS age_days

    FROM bookings b

    LEFT JOIN (

        SELECT
            booking_id,
            SUM(amount_paid) AS received
        FROM booking_payments
        WHERE payment_status='Success'
        GROUP BY booking_id

    ) p
        ON p.booking_id = b.id

    WHERE b.vendor_id = ?

    HAVING outstanding > 0

    ORDER BY age_days DESC

    LIMIT 10
    `,
    [vendorId],
  );

  return rows.map((row: any) => ({
    id: row.id,

    total: Number(row.total),

    outstanding: Number(row.outstanding),

    overdue: Number(row.overdue),

    d30: Number(row.d30),

    // Replace with customer name when you have a customer table
    customer: row.booking_code,

    age:
      row.age_days === 1
        ? "1 day ago"
        : `${row.age_days} days ago`,
  }));
}
}