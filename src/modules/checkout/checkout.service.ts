import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class CheckoutService {
  constructor(private dataSource: DataSource) {}

  async checkoutSuccess(id :any) {

  const imageBaseUrl = process.env.PUBLIC_AWS_BUCKET_URL; // or S3 URL

const query = `
 SELECT
    b.id,
    b.booking_code AS refNo,
    b.booking_type AS type,
    b.invoice_number,
    b.booking_type,
    b.total_pax,
    b.estimated_total,
    b.reservation_end_date,

    vp.venue_name,
    vp.parent_venue_id,
    vp.venue_country,
    vp.venue_address,
    vp.venue_city,
    vp.logo,
    vp.phone,
    vp.email,

    vc.child_venue_id,


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
    rpt.points AS earn_point,

    CASE
        WHEN b.status = 2 THEN 'bg-red-500'
        WHEN b.status = 1 THEN 'bg-green-500'
        WHEN b.status = 0 THEN 'bg-amber-500'
        ELSE 'bg-gray-500'
    END AS avatarColor ,

  CONCAT(
    ?, '/',
    (
        SELECT vg.attachment
        FROM venue_gallery vg
        WHERE vg.child_venue_id = vc.child_venue_id
        ORDER BY vg.id ASC
        LIMIT 1
    )
) AS venue_image

    

FROM bookings b

LEFT JOIN booking_venues bv_main
    ON bv_main.booking_id = b.id

LEFT JOIN venue_child vc
    ON vc.child_venue_id = bv_main.child_venue_id

LEFT JOIN venue_parent vp
    ON vp.parent_venue_id = vc.parent_venue_id

LEFT JOIN booking_event_types bet
    ON bet.id = b.booking_event_type_id
    
LEFT JOIN reward_point_transactions rpt
    ON rpt.booking_id = b.id AND rpt.transaction_type ='reward'
    
    WHERE b.booking_code = ?
    LIMIT 1
`

const result = await this.dataSource.query(query, [
  imageBaseUrl,
 id,
]);

return result;

  }
}