import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { NotificationService } from '../../notifications/notification.service';

import { SocketService } from '../socket/socket.service';

@Injectable()
export class BookingService {
  constructor(private readonly dataSource: DataSource,
private readonly notificationService: NotificationService,
 private socketService: SocketService,

  ) {}
  createBooking(data: any) {
    return { message: 'booking created', data };
  }

  async profile_main_page(id: number) {
  const notifications = await this.dataSource.query(
    `
    SELECT *
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    `,
    [id],
  );


  const currentSql = `SELECT
    b.id AS bookingId,

    bed.id AS eventDateId,
    bed.event_date,
    DATEDIFF(bed.event_date, CURDATE()) AS daysLeft,

    bv.child_venue_id,
    bv.parent_venue_id,
    bv.venue_name_snapshot,

    bs.shift_name,
    bs.start_time,
    bs.end_time,
    bs.pax,
    bs.price,
    b.total_pax,

    cv.child_venue_name,
    pv.venue_city,
    pv.venue_state,

    (
        SELECT attachment
        FROM venue_gallery vg
        WHERE vg.child_venue_id = bv.child_venue_id
          AND vg.image_type = 1
        LIMIT 1
    ) AS coverImage

FROM bookings b

INNER JOIN (
    SELECT
        booking_id,
        MIN(event_date) AS next_event_date
    FROM booking_event_dates
    WHERE event_date >= CURDATE()
    GROUP BY booking_id
) nextEvent
    ON nextEvent.booking_id = b.id

INNER JOIN booking_event_dates bed
    ON bed.booking_id = nextEvent.booking_id
   AND bed.event_date = nextEvent.next_event_date

INNER JOIN booking_venues bv
    ON bv.booking_id = b.id

LEFT JOIN booking_shifts bs
    ON bs.booking_id = b.id
   AND bs.event_date_id = bed.id
   AND bs.venue_id = bv.id

LEFT JOIN venue_child cv
    ON cv.child_venue_id = bv.child_venue_id

LEFT JOIN venue_parent pv
    ON pv.parent_venue_id = bv.parent_venue_id

WHERE
    b.created_by=? 
    AND b.booking_type = 'booked'
    AND b.status='active'
AND bed.event_date >= CURDATE()
ORDER BY bed.event_date ASC
LIMIT 1`;

const holdSql = `
SELECT
    b.id AS bookingId,
    b.reservation_end_date,

    bed.id AS eventDateId,
    bed.event_date,

    bv.child_venue_id,
    bv.parent_venue_id,
    bv.venue_name_snapshot,

    bs.shift_name,
    bs.start_time,
    bs.end_time,
    bs.pax,
    bs.price,

    cv.child_venue_name,
    pv.venue_city,
    pv.venue_state,

    (
        SELECT vg.attachment
        FROM venue_gallery vg
        WHERE vg.child_venue_id = bv.child_venue_id
          AND vg.image_type = 1
        LIMIT 1
    ) AS coverImage

FROM bookings b

INNER JOIN (
    SELECT
        booking_id,
        MIN(event_date) AS next_event_date
    FROM booking_event_dates
    WHERE event_date >= CURDATE()
    GROUP BY booking_id
) nextEvent
    ON nextEvent.booking_id = b.id

INNER JOIN booking_event_dates bed
    ON bed.booking_id = nextEvent.booking_id
   AND bed.event_date = nextEvent.next_event_date

INNER JOIN booking_venues bv
    ON bv.booking_id = b.id

LEFT JOIN booking_shifts bs
    ON bs.booking_id = b.id
   AND bs.event_date_id = bed.id
   AND bs.venue_id = bv.id

LEFT JOIN venue_child cv
    ON cv.child_venue_id = bv.child_venue_id

LEFT JOIN venue_parent pv
    ON pv.parent_venue_id = bv.parent_venue_id

WHERE
    b.created_by = ?
    AND b.booking_type = 'reserve'
    AND b.status = 'active'
    AND b.reservation_end_date >= NOW()
    AND b.reservation_end_date <= DATE_ADD(NOW(), INTERVAL 7 DAY)

ORDER BY b.reservation_end_date ASC
LIMIT 1;
`;
  const upcomingSql = `SELECT
    b.id AS bookingId,

    bed.id AS eventDateId,
    bed.event_date,
    DATEDIFF(bed.event_date, CURDATE()) AS daysLeft,

    bv.child_venue_id,
    bv.parent_venue_id,
    bv.venue_name_snapshot,

    bs.shift_name,
    bs.start_time,
    bs.end_time,
    b.total_pax as pax,
    bs.price,

    cv.child_venue_name,
    pv.venue_city,
    pv.venue_state,

    (
        SELECT attachment
        FROM venue_gallery vg
        WHERE vg.child_venue_id = bv.child_venue_id
          AND vg.image_type = 1
        LIMIT 1
    ) AS coverImage

FROM bookings b

INNER JOIN (
    SELECT
        booking_id,
        MIN(event_date) AS next_event_date
    FROM booking_event_dates
    WHERE event_date >= CURDATE()
    GROUP BY booking_id
) nextEvent
    ON nextEvent.booking_id = b.id

INNER JOIN booking_event_dates bed
    ON bed.booking_id = nextEvent.booking_id
   AND bed.event_date = nextEvent.next_event_date

INNER JOIN booking_venues bv
    ON bv.booking_id = b.id

LEFT JOIN booking_shifts bs
    ON bs.booking_id = b.id
   AND bs.event_date_id = bed.id
   AND bs.venue_id = bv.id

LEFT JOIN venue_child cv
    ON cv.child_venue_id = bv.child_venue_id

LEFT JOIN venue_parent pv
    ON pv.parent_venue_id = bv.parent_venue_id

WHERE
    b.created_by = ?
    AND b.booking_type = 'booked'
    AND b.status = 'active'
    AND bed.event_date >= CURDATE()

ORDER BY bed.event_date ASC
LIMIT 10 OFFSET 1;`



 const [currentBooking] = await this.dataSource.query(currentSql, [id]);

const [reservationHold] = await this.dataSource.query(holdSql, [id]);

const upcomingBookings = await this.dataSource.query(upcomingSql, [id]);

return {
  notification: notifications,
  currentBooking: currentBooking,
  reservationHold: reservationHold ?? null,
  upcomingBookings,
};

}  

async allbookingData(id: number) {
const currentSql = `
SELECT
    b.id AS id,
    b.booking_code AS bookingId,
    b.estimated_total,

    CONCAT(c.name, 's') AS name,

    cv.child_venue_name AS propertyName,
    cv.created_by AS vendor_id,
    cv.child_venue_id AS childVenueId,

    /* =====================================================
       VENUE IMAGE
       ===================================================== */
    (
        SELECT vg.attachment
        FROM venue_gallery vg
        WHERE vg.child_venue_id = cv.child_venue_id
          AND vg.image_type = 1
        LIMIT 1
    ) AS image,

    pv.propety_category AS category,

    /* =====================================================
       EVENT DATE
       14 Aug 2026
       OR
       14 - 16 Aug 2026
       ===================================================== */
    CASE
        WHEN bed.start_date = bed.end_date THEN
            DATE_FORMAT(bed.start_date, '%d %b %Y')

        ELSE
            CONCAT(
                DATE_FORMAT(bed.start_date, '%d'),
                ' - ',
                DATE_FORMAT(bed.end_date, '%d %b %Y')
            )
    END AS date,

    /* =====================================================
       RAW START / END DATE
       ===================================================== */
    bed.start_date AS startDate,
    bed.end_date AS endDate,

    /* Existing fields */
    cv.guest_rooms AS nights,
    cv.guest_rooms AS guests,

    /* =====================================================
       SHIFT
       ===================================================== */
    bs.shiftLabel AS shiftLabel,
    bs.shiftTime AS shiftTime,

    COALESCE(bs.amountINR, 0) AS amountINR,

    b.notes AS specialRequest,

    /* =====================================================
       BOOKING
       ===================================================== */
    b.booking_type AS bookingType,

    CASE
        WHEN b.status = 'cancelled'
            THEN 'cancelled'

        WHEN LOWER(TRIM(b.booking_type)) = 'pax'
            THEN 'pax'

        WHEN LOWER(TRIM(b.booking_type)) = 'enquiry'
            THEN 'enquiry'

        WHEN LOWER(TRIM(b.booking_type)) = 'reserve'
            THEN 'reservation'

        WHEN LOWER(TRIM(b.booking_type)) NOT IN (
            'enquiry',
            'reserve',
            'pax'
        )
        AND bed.start_date > CURDATE()
            THEN 'upcoming'

        WHEN LOWER(TRIM(b.booking_type)) NOT IN (
            'enquiry',
            'reserve',
            'pax'
        )
        AND CURDATE() BETWEEN bed.start_date AND bed.end_date
            THEN 'ongoing'

        ELSE 'Completed'
    END AS bookingStatus,

    /* =====================================================
       VENDOR
       ===================================================== */
    pv.venue_name AS vendorName,
    pv.venue_name AS vendorGSTIN,
    pv.venue_address AS address,
    pv.venue_state AS placeOfSupply,

    u.state AS customerState,

    /* =====================================================
       RESERVATION
       ===================================================== */
    b.reservation_end_date AS holdExpiresAt,

    b.total_amount AS total_amount,

    /* =====================================================
       DAYS LEFT
       ===================================================== */
    DATEDIFF(
        bed.start_date,
        CURDATE()
    ) AS daysLeft,

    /* =====================================================
       EVENT DATE
       ===================================================== */
    CASE
        WHEN bed.start_date = bed.end_date THEN
            DATE_FORMAT(
                bed.start_date,
                '%Y-%m-%d'
            )

        ELSE
            CONCAT(
                DATE_FORMAT(
                    bed.start_date,
                    '%Y-%m-%d'
                ),
                ' - ',
                DATE_FORMAT(
                    bed.end_date,
                    '%Y-%m-%d'
                )
            )
    END AS eventDate,

    /* =====================================================
       PAYMENT SUMMARY
       ===================================================== */
    COALESCE(ps.totalPaid, 0) AS totalPaid,

    COALESCE(bs.amountINR, 0) AS totalAmount,

    GREATEST(
        COALESCE(bs.amountINR, 0)
        -
        COALESCE(ps.totalPaid, 0),
        0
    ) AS pendingAmount,

    CASE
        WHEN COALESCE(ps.totalPaid, 0)
             >= COALESCE(bs.amountINR, 0)
            THEN 'Paid'

        WHEN COALESCE(ps.totalPaid, 0) = 0
            THEN 'Unpaid'

        ELSE 'Pending'
    END AS paymentStatus,

    /* =====================================================
       LATEST PAYMENT
       ===================================================== */
    bp.payment_method AS paymentMode,
    bp.transaction_id,
    bp.payment_date,
    bp.paid_at,

    /* =====================================================
       PAYMENT HISTORY
       ===================================================== */
    COALESCE(
        ps.paymentHistory,
        JSON_ARRAY()
    ) AS paymentHistory,

    /* =====================================================
       PAX / PACKAGE DETAILS
       ===================================================== */
    COALESCE(
        (
            SELECT JSON_ARRAYAGG(
                JSON_OBJECT(
                    'id',
                    pax.id,

                    'bookingId',
                    pax.booking_id,

                    'packageId',
                    pax.package_id,

                    'packageName',
                    pax.package_name,

                    'paxCount',
                    pax.pax_count,

                    'pricePerPax',
                    pax.price_per_pax,

                    'total',
                    pax.total,

                    'createdAt',
                    pax.created_at,

                    'updatedAt',
                    pax.updated_at,

                    'items',
                    COALESCE(
                        (
                            SELECT JSON_ARRAYAGG(
                                JSON_OBJECT(
                                    'id',
                                    ppi.id,

                                    'categoryId',
                                    ppi.category_id,

                                    'itemId',
                                    ppi.item_id,

                                    'itemName',
                                    COALESCE(
                                        pil.item_name,
                                        ppi.item_name
                                    ),

                                    'itemPrice',
                                    COALESCE(
                                        pil.item_price,
                                        0
                                    ),

                                    'itemPrice1',
                                    COALESCE(
                                        pil.item_price_1,
                                        0
                                    ),

                                    'createdAt',
                                    ppi.created_at,

                                    'image',
                                    pil.image,

                                    'foodPre',
                                    pil.food_pre
                                )
                            )

                            FROM booking_pax_items ppi

                            LEFT JOIN package_items_list pil
                                ON pil.id = ppi.item_id

                            WHERE ppi.booking_pax_id = pax.id
                        ),
                        JSON_ARRAY()
                    )
                )
            )

            FROM booking_pax pax

            WHERE pax.booking_id = b.id
        ),
        JSON_ARRAY()
    ) AS paxPackages

FROM bookings b

/* =====================================================
   BOOKING VENUES
   ===================================================== */
INNER JOIN booking_venues bv
    ON bv.booking_id = b.id

/* =====================================================
   CATEGORY
   ===================================================== */
INNER JOIN category c
    ON c.id = b.category

/* =====================================================
   CHILD VENUE
   ===================================================== */
INNER JOIN venue_child cv
    ON cv.child_venue_id = bv.child_venue_id

/* =====================================================
   PARENT VENUE
   ===================================================== */
LEFT JOIN venue_parent pv
    ON pv.parent_venue_id = cv.parent_venue_id

/* =====================================================
   EVENT DATES

   IMPORTANT:
   Instead of joining every event_date row,
   we get only MIN and MAX.

   Example:
   2026-08-14
   2026-08-15
   2026-08-16

   becomes:

   start_date = 2026-08-14
   end_date   = 2026-08-16
   ===================================================== */
INNER JOIN (
    SELECT
        booking_id,

        MIN(event_date) AS start_date,

        MAX(event_date) AS end_date

    FROM booking_event_dates

    GROUP BY booking_id
) bed
    ON bed.booking_id = b.id

/* =====================================================
   BOOKING SHIFTS

   Aggregate all shifts for the booking/venue
   so shifts don't create duplicate booking rows.
   ===================================================== */
LEFT JOIN (
    SELECT
        booking_id,
        venue_id,

        GROUP_CONCAT(
            DISTINCT shift_name
            ORDER BY start_time
            SEPARATOR ', '
        ) AS shiftLabel,

        GROUP_CONCAT(
            DISTINCT CONCAT(
                TIME_FORMAT(start_time, '%h:%i %p'),
                ' - ',
                TIME_FORMAT(end_time, '%h:%i %p')
            )
            ORDER BY start_time
            SEPARATOR ', '
        ) AS shiftTime,

        SUM(
            COALESCE(price, 0)
        ) AS amountINR

    FROM booking_shifts

    GROUP BY
        booking_id,
        venue_id

) bs
    ON bs.booking_id = b.id
    AND bs.venue_id = bv.id

/* =====================================================
   PAYMENT SUMMARY + PAYMENT HISTORY
   ===================================================== */
LEFT JOIN (
    SELECT
        booking_id,

        SUM(
            COALESCE(amount_paid, 0)
        ) AS totalPaid,

        JSON_ARRAYAGG(
            JSON_OBJECT(
                'id',
                id,

                'paymentDate',
                payment_date,

                'paymentType',
                payment_type,

                'paymentMethod',
                payment_method,

                'transactionId',
                transaction_id,

                'amountPaid',
                amount_paid,

                'paymentStatus',
                payment_status,

                'paidAt',
                paid_at
            )
        ) AS paymentHistory

    FROM booking_payments

    GROUP BY booking_id

) ps
    ON ps.booking_id = b.id

/* =====================================================
   LATEST PAYMENT
   ===================================================== */
LEFT JOIN (
    SELECT
        p1.*
    FROM booking_payments p1

    INNER JOIN (
        SELECT
            booking_id,
            MAX(id) AS id

        FROM booking_payments

        GROUP BY booking_id

    ) p2
        ON p1.id = p2.id

) bp
    ON bp.booking_id = b.id

/* =====================================================
   CUSTOMER
   ===================================================== */
LEFT JOIN users u
    ON u.id = b.created_by

/* =====================================================
   USER FILTER
   ===================================================== */
WHERE b.created_by = ?

/* =====================================================
   LATEST BOOKINGS FIRST
   ===================================================== */
ORDER BY b.created_at DESC;
`;



 const currentBooking = await this.dataSource.query(currentSql, [id]);






return {
  ALLBOOKINGS: currentBooking ?? null
};

}

async editRequest(body: any, userId: number) {
  const {
    booking_id,
    child_venue_id,
    category,
    reference_type,
    message,
    vendor_id,
  } = body;

  // Check conversation
  let conversation = await this.dataSource.query(
    `
    SELECT id
    FROM conversations
    WHERE reference_type = ?
      AND reference_id = ?
      AND category = ?
    LIMIT 1
    `,
    [reference_type, booking_id, category],
  );

  let conversationId: number;

  if (conversation.length) {
    conversationId = conversation[0].id;
  } else {
    const result: any = await this.dataSource.query(
      `
      INSERT INTO conversations
      (
        category,
        subject,
        venue_id,
        customer_id,
        vendor_id,
        reference_type,
        reference_id,
        created_by,
        created_at,
        updated_at
      )
      VALUES
      (?, ?, ?, ?, ?, ? , ? , ?, NOW(), NOW())
      `,
      [
        category,
        `Edit Request #${booking_id}`,
        child_venue_id,
       
        userId,
vendor_id,
 reference_type,
        booking_id,
        userId,
      ],
    );

    conversationId = result.insertId;
  }

  // Insert Message
  await this.dataSource.query(
    `
    INSERT INTO messages
    (
      conversation_id,
      sender_type,
      sender_id,
      role,
      message,
      is_read,
      sent_at,
      created_at
    )
    VALUES
    (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `,
    [
      conversationId,
      'user',
      userId,
      'me',
      message,
      0,
    ],
  );

  // Update Conversation
  await this.dataSource.query(
    `
    UPDATE conversations
    SET
      last_message = ?,
      last_message_at = NOW(),
      unread_count = unread_count + 1,
      updated_at = NOW()
    WHERE id = ?
    `,
    [message, conversationId],
  );

  // Activity Log
  await this.createLog(
    'booking',
    booking_id,
    'edit_request',
    'Customer requested booking modification.',
    userId,
    null,
    {
      message,
    },
  );

  // Notification
  await this.notificationService.createNotification({
    type: 'Booking',
    referenceId: booking_id,
    title: 'Booking Edit Request',
    message: 'Customer has requested changes to the booking.',
    createdBy: userId,
  });

  // Socket
//   this.socketService.realtime(
//     userId.toString(),
//     'Booking',
//     'Your edit request has been sent successfully.',
//   );

  return {
    success: true,
    message: 'Edit request submitted successfully.',
    conversationId,
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

async getUnreadMessageCount(userId: number) {
  const [result] = await this.dataSource.query(
    `
    SELECT COUNT(*) AS unread_count
    FROM messages m
    INNER JOIN conversations c
      ON c.id = m.conversation_id
    WHERE m.sender_id != ?
      AND m.is_read = 0
      AND (
        c.customer_id = ?
        OR c.vendor_id = ?
      )
    `,
    [userId, userId, userId],
  );

  return {
    success: true,
    unreadCount: Number(result?.unread_count ?? 0),
  };
}

async getMessageTemplate(actionKey: string) {
  const rows = await this.dataSource.query(
    `
    SELECT
      id,
      action_key,
      title,
      message,
      message_type,
      color
    FROM message_templates
    WHERE action_key = ?
      AND is_active = 1
    LIMIT 1
    `,
    [actionKey],
  );

  return rows[0] || null;
}
private replaceTemplateVariables(
  template: string,
  data: any,
) {
  return template
    .replace(
      /{{customerName}}/g,
      data.customerName || 'Customer',
    )
    .replace(
      /{{bookingRef}}/g,
      data.bookingRef || '',
    )
    .replace(
      /{{eventDate}}/g,
      data.eventDate || '',
    )
    .replace(
      /{{venueName}}/g,
      data.venueName || '',
    )
    .replace(
      /{{finalAmount}}/g,
      data.finalAmount || '',
    );
}

async createQuotationChatMessage(
  bookingId: number,
  conversationId: number,
  vendorId: number,
  quotation: any,
) {
  const template = await this.getMessageTemplate(
    'quotation_sent',
  );

  if (!template) {
    throw new Error(
      'Quotation message template not found',
    );
  }

  //Status Update

   await this.dataSource.query(
      `
      INSERT INTO booking_status_logs
      (
        booking_id,
        previous_status_code,
        status_code,
        status,
        message,
        changed_by,
        changed_by_type,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ? , ?, NOW())
      `,
      [
        bookingId,

        // First status has no previous status
        null,

        "QUOATION",

        "Negotiating",

        "Booking Negotiating to customer",

        vendorId,

        "vendor",
      ],
    );

    await this.dataSource.query(
      ` UPDATE bookings SET status = ? WHERE id = ? `,['Negotiating',bookingId]);

  //Negotiating

//   const message = this.replaceTemplateVariables(
//     template.message,
//     {
//       customerName: quotation.customerName,
//       bookingRef: quotation.bookingRef,
//       eventDate: quotation.eventDate,
//       venueName: quotation.venueName,
//       finalAmount: quotation.finalAmount,
//     },
//   );

//   const metadata = {
//     quotation_id: quotation.quotationId,

//     original_amount: Number(
//       quotation.originalAmount || 0,
//     ),

//     discount_amount: Number(
//       quotation.discountAmount || 0,
//     ),

//     additional_charges: Number(
//       quotation.additionalCharges || 0,
//     ),

//     final_amount: Number(
//       quotation.finalAmount || 0,
//     ),

//     notes: quotation.notes || '',
//   };

//   const result = await this.dataSource.query(
//     `
//     INSERT INTO messages
//     (
//       conversation_id,
//       sender_type,
//       sender_id,
//       message,
//       message_type,
//       metadata,
//       role,
//       attachment_url,
//       reply_to,
//       is_read,
//       sent_at,
//       created_at
//     )
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
//     `,
//     [
//       conversationId,
//       'vendor',
//       vendorId,
//       message,
//       template.message_type,
//       JSON.stringify(metadata),
//       'vendor',
//       null,
//       0,
//       0,
//     ],
//   );

const message = `Hello ${quotation.booking_ref}, your quotation for ${quotation.venue_name} is ready. The final amount is ${quotation.final_amount || 0}. Please review it and let us know if you have any questions.`;
const metadata = {
  quotation_id: quotation.booking_ref,

  original_amount: Number(
    quotation.original_amount || 0,
  ),

  discount_amount: Number(
    quotation.discount_amount || 0,
  ),

  additional_charges: Number(
    quotation.additional_charges || 0,
  ),

  final_amount: Number(
    quotation.final_amount || 0,
  ),

  notes: quotation.notes || '',
};

const result = await this.dataSource.query(
  `
  INSERT INTO messages
  (
    conversation_id,
    sender_type,
    sender_id,
    message,
    message_type,
    metadata,
    role,
    attachment_url,
    reply_to,
    is_read,
    sent_at,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `,
  [
    conversationId,
    'user',
    vendorId,
    message,
    'quotation',
    JSON.stringify(metadata),
    'them',
    null,
    0,
    0,
  ],
);

  const rows = await this.dataSource.query(
    `
    SELECT
      id,
      conversation_id,
      sender_type,
      sender_id,
      message,
      message_type,
      metadata,
      role,
      attachment_url,
      reply_to,
      is_read,
      read_at,
      sent_at,
      created_at
    FROM messages
    WHERE id = ?
    LIMIT 1
    `,
    [result.insertId],
  );

  const newMessage = rows[0];

  return newMessage;
}


async cancelpax(
  userId: number,
  body: any
) {

//Status Update

   await this.dataSource.query(
      `
      INSERT INTO booking_status_logs
      (
        booking_id,
        previous_status_code,
        status_code,
        status,
        message,
        changed_by,
        changed_by_type,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ? , ?, NOW())
      `,
      [
        body.id,
        null,
        "QUOATION",
        "Cancelled",
        "Booking Cancelled By vendor",
        userId,
        "vendor",
      ],
    );
  await this.dataSource.query(
  `UPDATE bookings 
   SET status = ?,
       cancellation_reason = ?,
       cancellation_date = NOW()
   WHERE id = ?`,
  [
    'Cancelled',
    body.reason,
    body.id,
  ],
);


// const message = `your quotation for has been cancelled.`;
// const metadata = {};

// const result = await this.dataSource.query(
//   `
//   INSERT INTO messages
//   (
//     conversation_id,
//     sender_type,
//     sender_id,
//     message,
//     message_type,
//     metadata,
//     role,
//     attachment_url,
//     reply_to,
//     is_read,
//     sent_at,
//     created_at
//   )
//   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
//   `,
//   [
//     conversationId,
//     'user',
//     userId,
//     message,
//     'quotation',
//     JSON.stringify(metadata),
//     'them',
//     null,
//     0,
//     0,
//   ],
// );


}



// async proposal_status(
//   userId: number,
//   body: any,
// ) {
//   try {
//     const bookingId = body.id;
//     const conversationId = body.conversation;
//     const status = body.status;
//     const reason = body.reason?.trim() || '';

//     // -----------------------------------------
//     // VALIDATION
//     // -----------------------------------------

//     if (!bookingId) {
//       console.error('Booking ID is required');
//     }

//     if (!conversationId) {
//       console.error('Conversation ID is required');
//     }

//     if (!status) {
//       console.error('Status is required');
//     }

//     // -----------------------------------------
//     // GET CURRENT BOOKING STATUS
//     // -----------------------------------------

//     const bookingRows: any = await this.dataSource.query(
//       `
//       SELECT status
//       FROM bookings
//       WHERE id = ?
//       LIMIT 1
//       `,
//       [bookingId],
//     );

//     if (!bookingRows || bookingRows.length === 0) {
//       console.error('Booking not found');
//     }

//     const previousStatus = bookingRows[0].status;

//     let bookingStatus: string | null = null;
// let message: string | null = null;
// let statusCode: string | null = null;
// let logStatus: string | null = null;
//     // -----------------------------------------
//     // CUSTOMER ACCEPTED PROPOSAL
//     // -----------------------------------------

//     if (status === 'pending_customer_approval') {
//       bookingStatus = 'approval';
//       statusCode = 'approval';
//       logStatus = 'Negotiating';

//       message =
//         'The customer has accepted the quotation and is waiting for your confirmation.';
//     }

//     // -----------------------------------------
//     // CUSTOMER REJECTED PROPOSAL
//     // -----------------------------------------

//     else if (status === 'Rejected') {
//       bookingStatus = 'Cancelled';
//       statusCode = 'Cancelled';
//       logStatus = 'Cancelled';

//       message = reason
//         ? `The customer has rejected the quotation. Reason: ${reason}`
//         : 'The customer has rejected the quotation. The booking has been cancelled.';
//     }

//     // -----------------------------------------
//     // CUSTOMER REQUESTED CHANGES
//     // -----------------------------------------

//     else if (status === 'Review') {
//       bookingStatus = 'New';
//       statusCode = 'New';
//       logStatus = 'Negotiating';

//       message = reason
//         ? `The customer has requested changes to the quotation. Request: ${reason}`
//         : 'The customer has requested changes to the quotation.';
//     }

//     // -----------------------------------------
//     // INVALID STATUS
//     // -----------------------------------------

//     else {
//       console.error(
//         `Invalid proposal status: ${status}`,
//       );
//     }

//     // -----------------------------------------
//     // UPDATE BOOKING
//     // -----------------------------------------

//     await this.dataSource.query(
//       `
//       UPDATE bookings
//       SET status = ?
//       WHERE id = ?
//       `,
//       [
//         bookingStatus,
//         bookingId,
//       ],
//     );

//     // -----------------------------------------
//     // BOOKING STATUS LOG
//     // -----------------------------------------

//     await this.dataSource.query(
//       `
//       INSERT INTO booking_status_logs
//       (
//         booking_id,
//         previous_status_code,
//         status_code,
//         status,
//         message,
//         changed_by,
//         changed_by_type,
//         created_at
//       )
//       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
//       `,
//       [
//         bookingId,
//         previousStatus,
//         statusCode,
//         logStatus,
//         message,
//         userId,
//         'customer',
//       ],
//     );

//     // -----------------------------------------
//     // MESSAGE
//     // -----------------------------------------

//     const metadata = {
//       booking_id: bookingId,
//       status,
//       booking_status: bookingStatus,
//       reason,
//     };

//     await this.dataSource.query(
//       `
//       INSERT INTO messages
//       (
//         conversation_id,
//         sender_type,
//         sender_id,
//         message,
//         message_type,
//         metadata,
//         role,
//         attachment_url,
//         reply_to,
//         is_read,
//         sent_at,
//         created_at
//       )
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
//       `,
//       [
//         conversationId,
//         'user',
//         userId,
//         message,
//         'quotation',
//         JSON.stringify(metadata),
//         'them',
//         null,
//         0,
//         0,
//       ],
//     );

//     // -----------------------------------------
//     // RESPONSE
//     // -----------------------------------------

//     return {
//       success: true,
//       bookingId,
//       status,
//       bookingStatus,
//       message,
//     };

//   } catch (error) {
//     console.error('proposal_status error:', error);

   

//     console.error(
//       'Unable to update proposal status',
//     );
//   }
// }

async proposal_status(
  userId: number,
  body: any,
) {
  try {
    const bookingId = body.id;
    const conversationId = body.conversation;
    const status = body.status;
    const reason = body.reason?.trim() || '';

    if (!bookingId) {
      console.error('Booking ID is required');
    }

    if (!conversationId) {
      console.error('Conversation ID is required');
    }

    if (!status) {
      console.error('Status is required');
    }

    // Get current booking status
    const bookingRows: any = await this.dataSource.query(
      `
      SELECT status
      FROM bookings
      WHERE id = ?
      LIMIT 1
      `,
      [bookingId],
    );

    if (!bookingRows?.length) {
      // console.error('Booking not found');
    }

    const previousStatus = bookingRows[0].status;

    let bookingStatus = '';
    let message = '';
    let statusCode = '';
    let logStatus = '';

    // -----------------------------------------
    // CUSTOMER ACCEPTED QUOTATION
    // -----------------------------------------
    if (status === 'pending_customer_approval') {

      // Vendor-side status
      bookingStatus = 'pending_vendor_confirmation';

      statusCode = 'QUOTATION_ACCEPTED';

      logStatus = 'pending_vendor_confirmation';

      message =
        'The customer has accepted the quotation. Please review and confirm the booking.';

    }

    // -----------------------------------------
    // CUSTOMER REQUESTED CHANGES
    // -----------------------------------------
    else if (status === 'Review') {

      bookingStatus = 'Review';

      statusCode = 'QUOTATION_CHANGES_REQUESTED';

      logStatus = 'Review';

      message = reason
        ? `The customer has requested changes to the quotation. Request: ${reason}`
        : 'The customer has requested changes to the quotation.';

    }    
    
    else if (status === 'Sign_Contract') {

      bookingStatus = 'Sign_Contract';

      statusCode = 'QUOTATION_SIGN_CONTRACT';

      logStatus = 'Sign_Contract';

     message = reason
  ? `The vendor has requested you to sign the contract. Request: ${reason}`
  : 'The vendor has requested you to sign the contract.';

    }

    // -----------------------------------------
    // CUSTOMER REJECTED QUOTATION
    // -----------------------------------------
    else if (status === 'Rejected') {

      bookingStatus = 'Rejected';

      statusCode = 'QUOTATION_REJECTED';

      logStatus = 'Rejected';

      message = reason
        ? `The customer has rejected the quotation. Reason: ${reason}`
        : 'The customer has rejected the quotation.';

    }    
    else if (status === 'confirmed') {

      bookingStatus = 'confirmed';

      statusCode = 'QUOTATION_CONFIRMED';

      logStatus = 'confirmed';

      message = reason
        ? `The customer has confirmed the quotation. Reason: ${reason}`
        : 'The customer has confirmed the quotation.';

    } 
    else if (status === 'confirmed_vendor') {

      bookingStatus = 'confirmed_vendor';

      statusCode = 'QUOTATION_CONVERTED';

      logStatus = 'confirmed_vendor';

      message = reason
        ? `The Vendor has confirmed the Booking. Reason: ${reason}`
        : 'The Vendor has confirmed the Booking.';

    }

    else {
     
    }

    // -----------------------------------------
    // UPDATE BOOKING
    // -----------------------------------------

    await this.dataSource.query(
      `
      UPDATE bookings
      SET status = ?
      WHERE id = ?
      `,
      [
        bookingStatus,
        bookingId,
      ],
    );

    // -----------------------------------------
    // STATUS LOG
    // -----------------------------------------

    await this.dataSource.query(
      `
      INSERT INTO booking_status_logs
      (
        booking_id,
        previous_status_code,
        status_code,
        status,
        message,
        changed_by,
        changed_by_type,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        bookingId,
        previousStatus,
        statusCode,
        logStatus,
        message,
        userId,
        'customer',
      ],
    );

    // -----------------------------------------
    // MESSAGE
    // -----------------------------------------

    const metadata = {
      booking_id: bookingId,
      customer_status: status,
      vendor_status: bookingStatus,
      reason,
    };

    await this.dataSource.query(
      `
      INSERT INTO messages
      (
        conversation_id,
        sender_type,
        sender_id,
        message,
        message_type,
        metadata,
        role,
        attachment_url,
        reply_to,
        is_read,
        sent_at,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        conversationId,
        'user',
        userId,
        message,
        'quotation',
        JSON.stringify(metadata),
        'them',
        null,
        0,
        0,
      ],
    );

    const conversations: any = await this.dataSource.query(
  `
  SELECT customer_id, vendor_id
  FROM conversations
  WHERE id = ?
  LIMIT 1
  `,
  [conversationId],
);

if (!conversations?.length) {
  console.error('Conversation not found');
}

const conversation = conversations[0];

let receiverId :any = '';

if (Number(userId) === Number(conversation.customer_id)) {
  // Current user = customer
  receiverId = Number(conversation.vendor_id);
} else if (Number(userId) === Number(conversation.vendor_id)) {
  // Current user = vendor
  receiverId = Number(conversation.customer_id);
} else {
  console.error(
    'User is not part of this conversation',
  );
}

this.socketService.realtime(
  receiverId.toString(),
  'Message',
  message,
);



    return {
      success: true,
      bookingId,
      customerStatus: status,
      vendorStatus: bookingStatus,
      message,
    };

  } catch (error) {
    console.error('proposal_status error:', error);

   
  }

}




}
