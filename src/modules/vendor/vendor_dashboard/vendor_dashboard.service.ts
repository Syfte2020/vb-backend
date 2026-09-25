import { BadRequestException, Injectable , ForbiddenException} from '@nestjs/common';
import { DataSource } from 'typeorm';
import dayjs from 'dayjs';
import { ToggleShiftBlockDto } from './dto/toggle-shift-block.dto';

interface DashboardFilter {
  startDate: string;
  endDate: string;
  venueId: string | null;
}

@Injectable()
export class VendorDashboardService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Vendor dashboard
   *
   * Returns:
   * - Revenue
   * - Confirmed bookings
   * - Active enquiries
   * - Venue health
   * - Occupancy
   */
  async getDashboard(vendorId: number, body: any) {
    const filter = this.validateDashboardFilter(body);

    const [
      revenue,
      confirmedBookings,
      activeEnquiries,
      venueHealth,
      occupancy,
    ] = await Promise.all([
      this.getRevenue(vendorId, filter),
      this.getConfirmedBookings(vendorId, filter),
      this.getActiveEnquiries(vendorId, filter),
      this.getVenueHealth(vendorId, filter),
      this.getOccupancy(vendorId, filter),
    ]);

    return {
      revenue,
      confirmed_bookings: confirmedBookings,
      active_enquiries: activeEnquiries,
      venue_health: venueHealth,
      occupancy,
    };
  }

  /**
   * Validate and normalize dashboard filters
   */
  private validateDashboardFilter(body: any): DashboardFilter {
    const { startDate, endDate, venueId } = body;

    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid startDate or endDate');
    }

    if (start > end) {
      throw new BadRequestException('startDate cannot be greater than endDate');
    }

    return {
      startDate: `${startDate} 00:00:00`,
      endDate: `${endDate} 23:59:59`,
      venueId:
        venueId !== undefined && venueId !== null && venueId !== ''
          ? venueId
          : null,
    };
  }

  /**
   * Revenue
   */
  private async getRevenue(vendorId: number, filter: DashboardFilter) {
 
    const venueQuery = `
  SELECT
    COALESCE(
      bv.child_venue_id,
      bv.parent_venue_id
    ) AS venue_id,

    bv.venue_name_snapshot AS venue_name,

    COALESCE(
      SUM(
        CASE
          WHEN bc.charge_type IN (
            'base',
            'addon',
            'convenience_fee',
            'cleaning_fee'
          )
          THEN bc.total_price
          ELSE 0
        END
      ),
      0
    ) AS revenue_amount

  FROM booking_charges bc

  INNER JOIN bookings b
    ON b.id = bc.booking_id

  INNER JOIN booking_venues bv
    ON bv.booking_id = b.id

  WHERE b.vendor_id = ?

    ${
      filter.venueId
        ? `
          AND bv.child_venue_id = ?
        `
        : ''
    }

    ${filter.startDate ? `AND b.created_at >= ?` : ''}

    ${filter.endDate ? `AND b.created_at <= ?` : ''}

  GROUP BY
    COALESCE(
      bv.child_venue_id,
      bv.parent_venue_id
    ),
    bv.venue_name_snapshot

  ORDER BY revenue_amount DESC
`;

    const params: any[] = [vendorId];

    if (filter.venueId) {
      params.push(filter.venueId);
    }

    if (filter.startDate) {
      params.push(filter.startDate);
    }

    if (filter.endDate) {
      params.push(filter.endDate);
    }

    const venueRows = await this.dataSource.query(venueQuery, params);
    // AND b.created_at >= ?
    // AND b.created_at <= ?
    // const venueRows = await this.dataSource.query(venueQuery, [
    //   vendorId,
    //   filter.startDate,
    //   filter.endDate,
    // ]);

    const revenue = venueRows.map((item: any) => ({
      venue_id: item.venue_id !== null ? Number(item.venue_id) : null,

      venue_name: item.venue_name,

      revenue_amount: Number(item.revenue_amount || 0),
    }));

    
    const conditions = [
      `b.vendor_id = ?`,
      `b.created_at >= ?`,
      `b.created_at <= ?`,
    ];

    const params1 = [vendorId, filter.startDate, filter.endDate];

    if (filter.venueId) {
      conditions.push(`bv.child_venue_id = ?`);
      params1.push(filter.venueId);
    }

    const totalQuery = `
  SELECT
    COALESCE(
      SUM(
        CASE
          WHEN bc.charge_type IN (
            'base',
            'addon',
            'convenience_fee',
            'cleaning_fee'
          )
          THEN bc.total_price
          ELSE 0
        END
      ),
      0
    ) AS total_revenue
  FROM booking_charges bc
  INNER JOIN bookings b
    ON b.id = bc.booking_id
    INNER JOIN booking_venues bv
    ON bv.booking_id = b.id
  WHERE ${conditions.join(' AND ')}
`;

    const totalResult = await this.dataSource.query(totalQuery, params1);

    return {
      total_revenue: Number(totalResult[0]?.total_revenue || 0),

      revenue,
    };
  }

  private async getConfirmedBookings(
    vendorId: number,
    filter: DashboardFilter,
  ) {
    const query = `
    SELECT
      bv.child_venue_id,
      bv.venue_name_snapshot AS venue_name,
      COUNT(DISTINCT b.id) AS confirmed_bookings

    FROM bookings b

    INNER JOIN booking_venues bv
      ON bv.booking_id = b.id

    WHERE
      b.created_at >= ?
      AND b.created_at <= ?
      AND b.vendor_id = ?
      AND b.booking_type = 'booked'
      AND b.status = 'active'
      AND (
        ? IS NULL
        OR bv.child_venue_id = ?
      )

    GROUP BY
      bv.child_venue_id,
      bv.venue_name_snapshot

    ORDER BY
      bv.child_venue_id DESC
  `;

    const result = await this.dataSource.query(query, [
      filter.startDate,
      filter.endDate,
      vendorId,
      filter.venueId,
      filter.venueId,
    ]);

    const confirmedBookings = result.map((item: any) => ({
      child_venue_id:
        item.child_venue_id !== null ? Number(item.child_venue_id) : null,

      venue_name: item.venue_name,

      confirmed_bookings: Number(item.confirmed_bookings || 0),
    }));

    // Total confirmed bookings
    const totalConfirmedBookings = confirmedBookings.reduce(
      (total, item) => total + item.confirmed_bookings,
      0,
    );

    return {
      total_confirmed_bookings: totalConfirmedBookings,

      confirmed_bookings: confirmedBookings,
    };
  }

  private async getActiveEnquiries(vendorId: number, filter: DashboardFilter) {
    const conditions = [
      `b.created_at >= ?`,
      `b.created_at <= ?`,
      `b.vendor_id = ?`,
      `b.booking_type IN ('pax', 'lead')`,
      `b.status IN ('active', '0')`,
    ];

    const params = [filter.startDate, filter.endDate, vendorId];

    if (filter.venueId) {
      conditions.push(`bv.child_venue_id = ?`);
      params.push(filter.venueId);
    }

    const query = `
  SELECT
    bv.child_venue_id,
    bv.venue_name_snapshot AS venue_name,
    COUNT(DISTINCT b.id) AS active_enquiries

  FROM bookings b

  INNER JOIN booking_venues bv
    ON bv.booking_id = b.id

  WHERE ${conditions.join(' AND ')}

  GROUP BY
    bv.child_venue_id,
    bv.venue_name_snapshot

  ORDER BY
    bv.child_venue_id DESC
`;

    const result = await this.dataSource.query(query, params);

    const activeEnquiries = result.map((item: any) => ({
      child_venue_id:
        item.child_venue_id !== null ? Number(item.child_venue_id) : null,

      venue_name: item.venue_name,

      active_enquiries: Number(item.active_enquiries || 0),
    }));

    const totalActiveEnquiries = activeEnquiries.reduce(
      (total, item) => total + item.active_enquiries,
      0,
    );

    return {
      total_active_enquiries: totalActiveEnquiries,

      active_enquiries: activeEnquiries,
    };
  }

  private async getVenueHealth(vendorId: number, filter: DashboardFilter) {
    const conditions = [`vc.created_by = ?`];

    const params: any[] = [vendorId];

    if (filter.venueId) {
      conditions.push(`vc.child_venue_id = ?`);
      params.push(filter.venueId);
    }

    const query = `
    SELECT
      vc.child_venue_id,
      vc.child_venue_name AS venue_name,

      (
        CASE
          WHEN vc.child_venue_name IS NOT NULL
            AND TRIM(vc.child_venue_name) != ''
          THEN 25
          ELSE 0
        END

        +

        CASE
          WHEN vc.more_info IS NOT NULL
            AND TRIM(vc.more_info) != ''
          THEN 25
          ELSE 0
        END

        +

        CASE
          WHEN EXISTS (
            SELECT 1
            FROM venue_gallery vg
            WHERE vg.child_venue_id = vc.child_venue_id
          )
          THEN 25
          ELSE 0
        END

        +

        CASE
          WHEN vc.publish_status = 1
          THEN 25
          ELSE 0
        END
      ) AS health_score

    FROM venue_child vc

    WHERE ${conditions.join(' AND ')}

    ORDER BY vc.child_venue_id DESC
  `;

    const result = await this.dataSource.query(query, params);

    return result.map((item: any) => ({
      child_venue_id:
        item.child_venue_id !== null ? Number(item.child_venue_id) : null,

      venue_name: item.venue_name,

      venue_health: `${Number(item.health_score || 0)}/100`,
    }));
  }

  /**
   * Occupancy
   */
  private async getOccupancy(vendorId: number, filter: DashboardFilter) {
    const venueId = filter.venueId ?? null;

    // ============================================================
    // 1. TOTAL VENUES
    // ============================================================

    const venueConditions = [`vc.created_by = ?`];
    const venueParams: any[] = [vendorId];

    if (venueId) {
      venueConditions.push(`vc.child_venue_id = ?`);
      venueParams.push(venueId);
    }

    const venueQuery = `
    SELECT
      COUNT(DISTINCT vc.child_venue_id) AS total_venues

    FROM venue_child vc

    WHERE ${venueConditions.join(' AND ')}
  `;

    const venueResult = await this.dataSource.query(venueQuery, venueParams);

    const totalVenues = Number(venueResult[0]?.total_venues || 0);

    // ============================================================
    // 2. BOOKED VENUE DAYS
    // ============================================================

    const bookedDaysConditions = [
      `b.vendor_id = ?`,
      `b.status = 'active'`,
      `b.booking_type = 'booked'`,
      `DATE(bed.event_date) BETWEEN DATE(?) AND DATE(?)`,
    ];

    const bookedDaysParams: any[] = [
      vendorId,
      filter.startDate,
      filter.endDate,
    ];

    if (venueId) {
      bookedDaysConditions.push(`bv.child_venue_id = ?`);
      bookedDaysParams.push(venueId);
    }

    const bookedDaysQuery = `
    SELECT
      COUNT(
        DISTINCT CONCAT(
          bv.child_venue_id,
          '-',
          DATE(bed.event_date)
        )
      ) AS booked_venue_days

    FROM bookings b

    INNER JOIN booking_venues bv
      ON bv.booking_id = b.id

    INNER JOIN booking_event_dates bed
      ON bed.booking_id = b.id

    WHERE ${bookedDaysConditions.join(' AND ')}
  `;

    const bookedDaysResult = await this.dataSource.query(
      bookedDaysQuery,
      bookedDaysParams,
    );

    const bookedVenueDays = Number(bookedDaysResult[0]?.booked_venue_days || 0);

    // ============================================================
    // 3. CONFIRMED BOOKINGS
    // ============================================================

    const confirmedConditions = [
      `b.vendor_id = ?`,
      `b.status = 'active'`,
      `b.booking_type = 'booked'`,
      `b.created_at >= ?`,
      `b.created_at <= ?`,
    ];

    const confirmedParams: any[] = [vendorId, filter.startDate, filter.endDate];

    if (venueId) {
      confirmedConditions.push(`bv.child_venue_id = ?`);
      confirmedParams.push(venueId);
    }

    const confirmedBookingsQuery = `
    SELECT
      COUNT(DISTINCT b.id) AS confirmed_bookings

    FROM bookings b

    INNER JOIN booking_venues bv
      ON bv.booking_id = b.id

    WHERE ${confirmedConditions.join(' AND ')}
  `;

    const confirmedBookingsResult = await this.dataSource.query(
      confirmedBookingsQuery,
      confirmedParams,
    );

    const confirmedBookings = Number(
      confirmedBookingsResult[0]?.confirmed_bookings || 0,
    );

    // ============================================================
    // 4. TOTAL DAYS
    // ============================================================

    const totalDays = this.getDateDifference(filter.startDate, filter.endDate);

    // ============================================================
    // 5. AVAILABLE VENUE DAYS
    // ============================================================

    const availableVenueDays = totalVenues * totalDays;

    // ============================================================
    // 6. OCCUPANCY %
    // ============================================================

    const occupancy =
      availableVenueDays > 0
        ? Math.min(
            100,
            Math.round((bookedVenueDays / availableVenueDays) * 100),
          )
        : 0;

    // ============================================================
    // RESPONSE
    // ============================================================

    return {
      venue_id: venueId ? Number(venueId) : null,

      total_venues: totalVenues,

      occupancy: `${occupancy}%`,

      booked_days: bookedVenueDays,

      total_days: totalDays,

      available_venue_days: availableVenueDays,

      confirmed_bookings: confirmedBookings,
    };
  }
  /**
   * Calculate inclusive number of days
   */
  private getDateDifference(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const difference = end.getTime() - start.getTime();

    return Math.floor(difference / (1000 * 60 * 60 * 24)) + 1;
  }

  async occupancy(userId: number, query: any) {
    const { category, startDate, endDate, venueId } = query;

    // ----------------------------------------------------
    // VALIDATION
    // ----------------------------------------------------

    if (!category) {
      throw new BadRequestException('Category is required');
    }

    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }

    // ----------------------------------------------------
    // CATEGORY
    // ----------------------------------------------------

    const singular = category.endsWith('s') ? category.slice(0, -1) : category;

    const categoryResult = await this.dataSource.query(
      `
      SELECT
        id,
        name
      FROM category
      WHERE name = ?
      LIMIT 1
    `,
      [singular],
    );

    if (!categoryResult.length) {
      throw new BadRequestException('Invalid category');
    }

    const categoryId = categoryResult[0].id;

    // ----------------------------------------------------
    // BOOKINGS
    // ----------------------------------------------------

    let sql = `
    SELECT
      b.id,

      b.booking_code,
      b.booking_type,
      b.category,

      b.vendor_id,

      b.status,

      b.total_pax,
      b.total_amount,

      b.reservation_end_date,

      /*
       * Actual reservation start date
       */
      b.created_at,

      /*
       * Booking → Venue
       */
      bv.child_venue_id,
      bv.parent_venue_id,
      bv.venue_name_snapshot,

      /*
       * Child venue
       */
      v.child_venue_name,
      v.venue_category_id,

      /*
       * Customer
       */
      u.id AS customer_id,
      u.name AS customer_name,
      u.phone AS customer_phone,
      u.email AS customer_email,

      /*
       * Event date
       */
      bed.event_date

    FROM bookings b

    /*
     * ------------------------------------------------
     * BOOKING VENUES
     * ------------------------------------------------
     */
    INNER JOIN booking_venues bv
      ON bv.booking_id = b.id

    /*
     * ------------------------------------------------
     * CHILD VENUE
     * ------------------------------------------------
     */
    LEFT JOIN venue_child v
      ON v.child_venue_id = bv.child_venue_id

    /*
     * ------------------------------------------------
     * CUSTOMER
     * ------------------------------------------------
     *
     * Keep this only if bookings.customer_id exists.
     */
    LEFT JOIN users u
      ON u.id = b.created_by

    /*
     * ------------------------------------------------
     * EVENT DATES
     * ------------------------------------------------
     */
    LEFT JOIN booking_event_dates bed
      ON bed.booking_id = b.id

    WHERE b.vendor_id = ?
      AND b.category = ?

      /*
       * Booking overlaps requested date range
       */
      AND DATE(
        COALESCE(
          bed.event_date,
          b.created_at
        )
      ) <= ?

      AND DATE(
        COALESCE(
          b.reservation_end_date,
          bed.event_date,
          b.created_at
        )
      ) >= ?
  `;

    const params: any[] = [userId, categoryId, endDate, startDate];

    // ----------------------------------------------------
    // VENUE FILTER
    // ----------------------------------------------------

    if (venueId) {
      sql += `
      AND bv.child_venue_id = ?
    `;

      params.push(Number(venueId));
    }

    // ----------------------------------------------------
    // ORDER
    // ----------------------------------------------------

    sql += `
    ORDER BY
      COALESCE(
        bed.event_date,
        b.created_at
      ) ASC,
      b.id ASC
  `;

    const bookings = await this.dataSource.query(sql, params);

    // ----------------------------------------------------
    // FORMAT DATETIME
    // ----------------------------------------------------

    const formatDate = (value: any) => {
      if (!value) {
        return null;
      }

      const date = new Date(value);

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');

      const day = String(date.getDate()).padStart(2, '0');

      return `${year}-${month}-${day}`;
    };

    const formatTime = (value: any) => {
      if (!value) {
        return null;
      }

      const date = new Date(value);

      const hours = String(date.getHours()).padStart(2, '0');

      const minutes = String(date.getMinutes()).padStart(2, '0');

      return `${hours}:${minutes}`;
    };

    // ----------------------------------------------------
    // TRANSFORM
    // ----------------------------------------------------

    const formattedBookings = bookings.map((booking: any) => {
      const bookingDate = booking.event_date || booking.created_at;

      const endDateValue =
        booking.reservation_end_date ||
        booking.event_date ||
        booking.created_at;

      return {
        id: String(booking.id),

        resourceId: String(booking.child_venue_id),

        resourceName:
          booking.child_venue_name ||
          booking.venue_name_snapshot ||
          `Venue #${booking.child_venue_id}`,

        title:
          booking.booking_code ||
          booking.booking_type ||
          `Booking #${booking.id}`,

        date: formatDate(bookingDate),

        endDate: formatDate(endDateValue),

        startTime: formatTime(bookingDate),

        endTime: formatTime(booking.reservation_end_date || bookingDate),

        status: booking.booking_type,

        guests: Number(booking.total_pax || 0),

        amount: Number(booking.total_amount || 0),

        customer:
          booking.customer_id || booking.customer_name
            ? {
                id: booking.customer_id ? String(booking.customer_id) : null,

                name: booking.customer_name || '',

                phone: booking.customer_phone || '',

                email: booking.customer_email || '',
              }
            : null,

        notes: '',

        team: [],

        bookingCode: booking.booking_code || null,

        bookingType: booking.booking_type || null,
      };
    });

    // ----------------------------------------------------
    // RESPONSE
    // ----------------------------------------------------

    return {
      success: true,

      data: {
        bookings: formattedBookings,
      },
    };
  }

  // async calendar(
  //     userId: number,
  //     query: any,
  //   ) {
  //     const {
  //       category,
  //       startDate,
  //       endDate,
  //       venueId,
  //     } = query;

  //     if (!category) {
  //       throw new BadRequestException(
  //         'Category is required',
  //       );
  //     }

  //     if (!startDate || !endDate) {
  //       throw new BadRequestException(
  //         'startDate and endDate are required',
  //       );
  //     }

  //     /* ---------------------------------------------------- */
  //     /* RESOURCES                                             */
  //     /* ---------------------------------------------------- */

  //     const resources = await this.dataSource.query(
  //       `
  //       SELECT
  //         vc.child_venue_id,
  //         vc.child_venue_name AS name,
  //         COALESCE(vc.guest_rooms,0) AS capacity,
  //         (
  //           SELECT vg.attachment
  //           FROM venue_gallery vg
  //           WHERE vg.child_venue_id = vc.child_venue_id
  //           LIMIT 1
  //         ) AS feature_image
  //       FROM venue_child vc
  //       INNER JOIN venue_parent vp
  //         ON vp.parent_venue_id = vc.parent_venue_id
  //       WHERE vp.created_by = ?
  //       ${
  //         venueId
  //           ? 'AND vc.child_venue_id = ?'
  //           : ''
  //       }
  //       `,
  //       venueId
  //         ? [userId, venueId]
  //         : [userId],
  //     );

  //     /* ---------------------------------------------------- */
  //     /* BOOKINGS                                              */
  //     /* ---------------------------------------------------- */

  //   const bookings = await this.dataSource.query(
  //   `
  //   SELECT
  //     /* -------------------------------------------------- */
  //     /* BOOKING                                            */
  //     /* -------------------------------------------------- */

  //     b.id,

  //     b.invoice_number AS bookingNumber,

  //     b.status AS bookingStatus,

  //     /* -------------------------------------------------- */
  //     /* VENUE                                              */
  //     /* -------------------------------------------------- */

  //     bs.venue_id AS venueId,

  //     COALESCE(
  //       bv.venue_name_snapshot,
  //       vc.child_venue_name
  //     ) AS venueName,

  //     /* -------------------------------------------------- */
  //     /* EVENT DATE                                         */
  //     /* -------------------------------------------------- */

  //     bed.event_date AS date,

  //     /* -------------------------------------------------- */
  //     /* SHIFT                                              */
  //     /* -------------------------------------------------- */

  //     bs.shift_name AS shift,

  //     bs.start_time AS startTime,

  //     bs.end_time AS endTime,

  //     /* -------------------------------------------------- */
  //     /* SHIFT PAX                                          */
  //     /* -------------------------------------------------- */

  //     COALESCE(
  //       bs.pax,
  //       0
  //     ) AS guests,

  //     /* -------------------------------------------------- */
  //     /* SHIFT PRICE                                        */
  //     /* -------------------------------------------------- */

  //     COALESCE(
  //       bs.price,
  //       0
  //     ) AS amount,

  //     /* -------------------------------------------------- */
  //     /* SHIFT STATUS                                       */
  //     /* -------------------------------------------------- */

  //     bs.status AS shiftStatus,

  //     /* -------------------------------------------------- */
  //     /* CUSTOMER                                           */
  //     /* -------------------------------------------------- */

  //     u.name AS customerName,
  //     u.phone AS customerPhone,

  //     u.email AS customerEmail

  //   FROM bookings b

  //   /* ---------------------------------------------------- */
  //   /* BOOKING VENUE                                        */
  //   /* ---------------------------------------------------- */

  //   INNER JOIN booking_venues bv
  //     ON bv.booking_id = b.id

  //   /* ---------------------------------------------------- */
  //   /* EVENT DATE                                           */
  //   /* ---------------------------------------------------- */

  //   INNER JOIN booking_event_dates bed
  //     ON bed.booking_id = b.id

  //   /* ---------------------------------------------------- */
  //   /* BOOKING SHIFT                                        */
  //   /* ---------------------------------------------------- */

  //   INNER JOIN booking_shifts bs
  //     ON bs.booking_id = b.id
  //     AND bs.event_date_id = bed.id
  //     AND bs.venue_id = bv.child_venue_id

  //   /* ---------------------------------------------------- */
  //   /* VENUE                                                */
  //   /* ---------------------------------------------------- */

  //   LEFT JOIN venue_child vc
  //     ON vc.child_venue_id = bs.venue_id

  //   /* ---------------------------------------------------- */
  //   /* CUSTOMER                                             */
  //   /* ---------------------------------------------------- */

  //   LEFT JOIN users u
  //     ON u.id = b.created_by

  //   /* ---------------------------------------------------- */
  //   /* FILTER                                               */
  //   /* ---------------------------------------------------- */

  //   WHERE b.vendor_id = ?

  //     AND b.category = ?

  //     AND DATE(bed.event_date)
  //         BETWEEN ? AND ?

  //   ${
  //     venueId
  //       ? 'AND bs.venue_id = ?'
  //       : ''
  //   }

  //   ORDER BY
  //     bed.event_date ASC,
  //     bs.start_time ASC
  //   `,
  //   venueId
  //     ? [
  //         userId,
  //         category,
  //         startDate,
  //         endDate,
  //         venueId,
  //       ]
  //     : [
  //         userId,
  //         category,
  //         startDate,
  //         endDate,
  //       ],
  // );

  //     /* ---------------------------------------------------- */
  //     /* SHIFT PRICING                                         */
  //     /* ---------------------------------------------------- */

  //     const shiftPricing = await this.dataSource.query(
  //       `
  //       SELECT
  //         id,
  //         shift_name AS label,
  //         shift_key AS \`key\`,
  //         price,
  //         price_per_pax AS pricePerPax
  //       FROM venue_shift
  //       WHERE vendor_id = ?
  //       `,
  //       [userId],
  //     );

  //     /* ---------------------------------------------------- */
  //     /* SIDEBAR                                               */
  //     /* ---------------------------------------------------- */

  //     const sidebarSections = [
  //       {
  //         id: 'spaces',
  //         label: 'Spaces',
  //         items: resources.map(
  //           (item) => ({
  //             id: String(item.id),
  //             label: item.name,
  //             color: '#a44bf3',
  //             dot: true,
  //           }),
  //         ),
  //       },
  //     ];

  //     return {
  //       resources,
  //       bookings,
  //       shiftPricing,
  //       sidebarSections,
  //     };
  //   }

  // async calendar(userId: number, query: any) {
  //   const { category, startDate, endDate, venueId } = query;

  //   if (!category) {
  //     throw new BadRequestException('Category is required');
  //   }

  //   if (!startDate || !endDate) {
  //     throw new BadRequestException('startDate and endDate are required');
  //   }

  //   const normalizedCategory = category.endsWith('s')
  //     ? category.slice(0, -1)
  //     : category;

  //   /*
  //    * ----------------------------------------------------
  //    * VENUES
  //    * ----------------------------------------------------
  //    */

  //   if (normalizedCategory === 'venue') {
  //     return this.getVenueCalendar(userId, startDate, endDate, venueId);
  //   }

  //   /*
  //    * ----------------------------------------------------
  //    * FARMSTAYS
  //    * ----------------------------------------------------
  //    */

  //   if (normalizedCategory === 'farmstay') {
  //     return this.getFarmstayCalendar(userId, startDate, endDate, venueId);
  //   }

  //   /*
  //    * ----------------------------------------------------
  //    * OTHER CATEGORIES
  //    * ----------------------------------------------------
  //    */

  //   console.log('loading-------------');

  //   return this.getGenericCalendar(
  //     userId,
  //     normalizedCategory,
  //     startDate,
  //     endDate,
  //     venueId,
  //   );
  // }

  async calendar(userId: number, query: any) {
  const {
    category,
    startDate,
    endDate,
    venueId,
    filters,
  } = query;

  if (!category) {
    throw new BadRequestException(
      'Category is required',
    );
  }

  if (!startDate || !endDate) {
    throw new BadRequestException(
      'startDate and endDate are required',
    );
  }

  const normalizedCategory =
    category.endsWith('s')
      ? category.slice(0, -1)
      : category;

  // ============================================================
  // VENUE ID
  // ============================================================
  //
  // Only pass venueId when a venue is actually selected.
  //
  // "all", null, undefined, "", "NaN"
  // => no venue filter
  //
  // Example:
  // venueId = "V10003" => filter by V10003='a
  // venueId = null     => all venues
  // ============================================================

  let normalizedVenueId = filters ? (filters.venue ==='all' ? '':filters.venue):'';

  // ============================================================
  // VENUES
  // ============================================================

  if (normalizedCategory === 'venue') {
    return this.getVenueCalendar(
      userId,
      startDate,
      endDate,
      normalizedVenueId,
    );
  }

  // ============================================================
  // FARMSTAYS
  // ============================================================

  if (normalizedCategory === 'farmstay') {
    return this.getFarmstayCalendar(
      userId,
      startDate,
      endDate,
      normalizedVenueId,
    );
  }

  // ============================================================
  // OTHER CATEGORIES
  // ============================================================

  console.log('loading-------------');

  return this.getGenericCalendar(
    userId,
    normalizedCategory,
    startDate,
    endDate,
    normalizedVenueId,
  );
}

  /*
   * ======================================================
   * VENUE CALENDAR
   * ======================================================
   */

  private async getVenueCalendar(
    userId: number,
    startDate: string,
    endDate: string,
    venueId?: any,
  ) {
    console.log("=========================")
    console.log(venueId)

    const BaseUrl = process.env.FILE_URL;
    /*
     * ----------------------------------------------------
     * 1. VENUES / RESOURCES
     * ----------------------------------------------------
     */

    const venueWhere = venueId
      ? `
        AND vc.child_venue_id = ?
      `
      : '';

    const venueParams = venueId ? [userId, venueId] : [userId];

    const resources = await this.dataSource.query(
      `
        SELECT
          vc.child_venue_id,
          vc.child_venue_name AS name,

          COALESCE(
            vc.guest_rooms,
            0
          ) AS capacity,

           vg.attachment 

        FROM venue_child vc
        LEFT JOIN venue_parent vp ON vp.parent_venue_id = vc.parent_venue_id
        LEFT JOIN venue_gallery vg ON vg.child_venue_id = vc.child_venue_id AND image_type =1
        WHERE vc.created_by = ? AND vp.propety_category = 'venue' 
        AND vc.publish_status= 1  

        ${venueWhere}

        ORDER BY vc.child_venue_name ASC
        `,
      venueParams,
    );

    /*
     * ----------------------------------------------------
     * 2. VENUE SHIFT PRICING
     *
     * venue_shift_header
     * venue_shift_timing
     * ----------------------------------------------------
     */

    const shiftWhere = venueId
      ? `
        AND vst.child_venue_id = ?
      `
      : '';

    const shiftParams = venueId
      ? [userId, startDate, endDate, venueId]
      : [userId, startDate, endDate];


    const shifts = await this.dataSource.query(
      `
  SELECT
      vst.child_venue_id AS venueId,
      vsh.id AS shiftId,
      vsh.name AS shiftName,
      vsh.custom_name AS customName,
      vsh.Shift_type AS shiftType,
      vst.from_date AS fromDate,
      vst.to_date AS toDate,
      vst.from_time AS startTime,
      vst.to_time AS endTime,
      vst.price AS price,
      vst.base_price AS basePrice

    FROM venue_shift_timing vst

   INNER JOIN venue_shift_header vsh
  ON vsh.Shift_type = vst.shift_type
  AND vsh.child_id = vst.child_venue_id

    INNER JOIN venue_child vc
      ON vc.child_venue_id = vst.child_venue_id

    WHERE
      vc.created_by = ? AND vsh.publish = 1 

  AND (
    vst.from_date IS NULL
    OR vst.to_date IS NULL
    OR (
      vst.from_date <= ?
      AND vst.to_date >= ?
    )
  )

  ${shiftWhere}

  ORDER BY
    vst.child_venue_id,
    vst.from_time ASC
  `,
      shiftParams,
    );

    /*
     * ----------------------------------------------------
     * 3. BOOKINGS
     * ----------------------------------------------------
     */

    const bookingWhere = venueId
      ? `
        AND bv.child_venue_id = ?
      `
      : '';

    const bookingParams = venueId
      ? [userId, 1, startDate, endDate, venueId]
      : [userId, 1, startDate, endDate];

    const bookings = await this.dataSource.query(
      `
    SELECT
    b.id,
    b.invoice_number AS bookingNumber,
    b.status AS bookingStatus,

    bv.child_venue_id AS venueId,

    COALESCE(
      bv.venue_name_snapshot,
      vc.child_venue_name
    ) AS venueName,

    bed.event_date AS date,

    bs.shift_name AS shift,
    bs.start_time AS startTime,
    bs.end_time AS endTime,

    b.total_pax AS guests,
    COALESCE(bs.price, 0) AS amount,

    bs.status AS shiftStatus,

    bp.name AS customerName,
    bp.phone AS customerPhone,
    bp.email AS customerEmail,

    b.booking_type as status ,
    b.booking_type ,
    bet.event_name 

FROM bookings b

INNER JOIN booking_venues bv
    ON bv.booking_id = b.id
    
INNER JOIN booking_event_types bet
    ON bet.id = b.booking_event_type_id

INNER JOIN booking_event_dates bed
    ON bed.booking_id = b.id

INNER JOIN booking_shifts bs
    ON bs.booking_id = b.id

LEFT JOIN venue_child vc
    ON vc.child_venue_id = bs.venue_id

LEFT JOIN booking_parties bp
    ON bp.booking_id = b.id AND party_type ='customer' 

LEFT JOIN users u
    ON u.id = b.created_by

WHERE b.vendor_id = ?
  AND b.category = ? AND b.booking_type IN ('booked','reserve','quotation')
  
  AND DATE(bed.event_date) BETWEEN ? AND ?

  AND (
  b.reservation_end_date IS NULL
  OR DATE(b.reservation_end_date) >= CURDATE()
)

ORDER BY
    bed.event_date ASC,
    bs.start_time ASC
  `,
      bookingParams,
    );

    const leadParams = venueId
  ? [userId, 1, startDate, endDate, venueId]
  : [userId, 1, startDate, endDate];

const leads = await this.dataSource.query(
  `
    SELECT
      b.id AS leadId,
      b.invoice_number AS leadNumber,
      b.booking_type AS bookingType,
      b.status AS leadStatus,

      bv.child_venue_id AS venueId,

      COALESCE(
        bv.venue_name_snapshot,
        vc.child_venue_name
      ) AS venueName,

      vld.lead_source AS leadSource,

      bp.name AS customerName,
      bp.phone AS customerPhone,
      bp.email AS customerEmail,

      bet.event_name AS eventName,

      bed.event_date AS eventDate,

      bs.shift_name AS shiftName,
      bs.start_time AS startTime,
      bs.end_time AS endTime,

      COALESCE(bs.pax, 0) AS guests,
      COALESCE(bs.price, 0) AS amount,

      b.created_at AS createdAt,
      b.updated_at AS updatedAt

    FROM bookings b

    INNER JOIN venue_leads_details vld
      ON vld.venue_lead_id = b.id

    INNER JOIN booking_venues bv
      ON bv.booking_id = b.id

    LEFT JOIN venue_child vc
      ON vc.child_venue_id = bv.child_venue_id

    LEFT JOIN booking_parties bp
      ON bp.booking_id = b.id
      AND bp.party_type = 'customer'

    LEFT JOIN booking_event_types bet
      ON bet.id = b.booking_event_type_id

    LEFT JOIN booking_event_dates bed
      ON bed.booking_id = b.id

    LEFT JOIN booking_shifts bs
      ON bs.booking_id = b.id
      AND bs.venue_id = bv.child_venue_id

    WHERE b.vendor_id = ?
      AND b.category = ?
      AND b.booking_type = 'lead'

      AND DATE(bed.event_date) BETWEEN ? AND ?

      ${
        venueId
          ? `AND bv.child_venue_id = ?`
          : ''
      }

    ORDER BY
      bed.event_date ASC,
      bs.start_time ASC
  `,
  leadParams,
);

    /*
     * ----------------------------------------------------
     * 4. BOOKING SHIFTS
     * ----------------------------------------------------
     */

    const bookingShifts = await this.dataSource.query(
      `
        SELECT

          bs.id,

          bs.booking_id AS bookingId,

          bs.event_date_id AS eventDateId,

          bs.venue_id AS venueId,

          bs.shift_name AS shiftName,

          bs.start_time AS startTime,

          bs.end_time AS endTime,

          COALESCE(
            bs.pax,
            0
          ) AS guests,

          COALESCE(
            bs.price,
            0
          ) AS price,

          b.booking_type as status

        FROM booking_shifts bs

        INNER JOIN bookings b
          ON b.id = bs.booking_id

        WHERE b.vendor_id = ?

        AND b.category = ?

        AND DATE(b.reservation_end_date)
            <= ?

        AND DATE(
          COALESCE(
            b.reservation_end_date,
            b.reservation_end_date
          )
        ) >= ?

        ${venueId ? 'AND bs.venue_id = ?' : ''}

        ORDER BY
          bs.booking_id,
          bs.start_time ASC
        `,
      venueId
        ? [userId, 1, startDate, endDate, venueId]
        : [userId, 1, startDate, endDate],
    );

    /*
     * ----------------------------------------------------
     * 5. EVENT DATES
     * ----------------------------------------------------
     */

    const eventDates = await this.dataSource.query(
      `
        SELECT

          bed.id,

          bed.booking_id AS bookingId,

          bed.event_date AS eventDate,

          bed.note

        FROM booking_event_dates bed

        INNER JOIN bookings b
          ON b.id = bed.booking_id

        WHERE b.vendor_id = ?

        AND b.category = ?

        AND DATE(bed.event_date)
            BETWEEN ? AND ?

        ORDER BY
          bed.event_date ASC
        `,
      [userId, 'venue', startDate, endDate],
    );

    const general_setting = await this.dataSource.query(
      `select * from venue_booking_setting WHERE vendor_id = ? `,
      [userId],
    );   
    
    const venue_calendar_blocks = await this.dataSource.query(
      `select 
        id,
      venue_id,
      DATE_FORMAT(block_date, '%Y-%m-%d') AS block_date,
      shift_key,
      reason,
      created_by
      from venue_calendar_blocks WHERE created_by = ? `,
      [userId],
    );

    /*
     * ----------------------------------------------------
     * 6. MAP SHIFTS TO BOOKINGS
     * ----------------------------------------------------
     */


    const formattedBookings = await Promise.all(
      bookings.map(async (booking) => {
        const bookingShift = bookingShifts.find(
          (shift) => Number(shift.bookingId) === Number(booking.id),
        );

        const eventDate = eventDates.find(
          (event) => Number(event.bookingId) === Number(booking.id),
        );

        // Get venue/child venue ID from booking
        const venueId =
          booking.venueId ?? booking.childVenueId ?? booking.raw?.venueId;

        return {
          id: booking.id,

          resourceId: venueId,

          venueId: venueId,

          venueName: booking.venueName,

          bookingNumber: booking.bookingNumber,

          customerName: booking.customerName?.trim(),

          date: dayjs(booking.date).format('YYYY-MM-DD'),

          startDate: dayjs(booking.date).format('YYYY-MM-DD'),

          endDate: dayjs(booking.date).format('YYYY-MM-DD'),

          shift: booking?.shiftName ?? '',

          shiftKey: booking?.shiftName ?? '',

          startTime: bookingShift?.startTime ?? null,

          endTime: bookingShift?.endTime ?? null,

          amount: Number(bookingShift?.price ?? booking.amount ?? 0),

          guests: Number(bookingShift?.guests ?? booking.guests ?? 0),

          status: booking.status,

          booking_type: booking.booking_type,

          category: 'venues',

          note: eventDate?.note ?? '',

          raw: booking,
        };
      }),
    );
    /*
     * ----------------------------------------------------
     * 7. FORMAT RESOURCES
     * ----------------------------------------------------
     */

    const formattedResources = await Promise.all(
      resources.map(async (resource) => {
        const venue_settings = await this.dataSource.query(
          `
      SELECT *
      FROM venue_child_settings vcs
      WHERE vcs.child_id = ?
      `,
          [resource.child_venue_id],
        );

        return {
          id: String(resource.child_venue_id),

          name: resource.name,

          label: resource.name,

          capacity: Number(resource.capacity || 0),

          venueId: resource.id,

          icon: '🏛️',

          image: `${BaseUrl}/${resource.attachment}`,

          venue_settings,
        };
      }),
    );

    /*
     * ----------------------------------------------------
     * 8. GROUP SHIFT PRICING BY VENUE
     * ----------------------------------------------------
     */
    console.log(shifts);

    const shiftPricing = shifts
      .filter((shift) => Number(shift.price || 0) > 0)
      .reduce((result, shift) => {
        const key = String(shift.venueId);

        if (!result[key]) {
          result[key] = [];
        }

        result[key].push({
          id: shift.shiftId,

          key: shift.shiftType ?? shift.shiftName,

          label: shift.customName || shift.shiftName || shift.shiftType,

          price: Number(shift.price || 0),

          basePrice: Number(shift.basePrice || 0),

          startTime: shift.startTime,
          endTime: shift.endTime,
        });

        return result;
      }, {});

    return {
      success: true,

      data: {
        category: 'venues',

        resources: formattedResources,

        bookings: formattedBookings,

        shiftPricing,

        eventDates,

        general_setting,

        venue_calendar_blocks,
        leads
        
      },
    };
  }

  /*
   * ======================================================
   * FARMSTAY CALENDAR
   * ======================================================
   */

  private async getFarmstayCalendar(
    userId: number,
    startDate: string,
    endDate: string,
    venueId?: number,
  ) {
    const pricing = await this.dataSource.query(
      `
        SELECT

          pp.id,

          pp.child_venue_id AS venueId,

          pp.name,

          pp.pricing_key AS pricingKey,

          pp.amount,

          pp.enabled,

          pp.category

        FROM property_pricing pp

        INNER JOIN venue_child vc
          ON vc.child_venue_id = pp.child_venue_id

        WHERE vc.created_by = ?

        AND pp.category = ?

        AND pp.enabled = 1

        ${venueId ? 'AND pp.child_venue_id = ?' : ''}

        ORDER BY
          pp.child_venue_id,
          pp.id
        `,
      venueId ? [userId, 'farmstay', venueId] : [userId, 'farmstay'],
    );

    const resources = await this.dataSource.query(
      `SELECT
          vc.child_venue_id,
          vc.child_venue_name AS name,
          COALESCE(
            vc.guest_rooms,
            0
          ) AS capacity
        FROM venue_child vc
        LEFT JOIN venue_parent vp ON vp.parent_venue_id = vc.parent_venue_id
        WHERE vc.created_by = ?
        ${venueId ? 'AND vc.child_venue_id = ?' : ''}
        ORDER BY
          vc.child_venue_name ASC`,
      venueId ? [userId, venueId] : [userId],
    );

    const bookings = await this.dataSource.query(
      `
        SELECT

          b.id,

          bv.child_venue_id AS venueId,

          vc.child_venue_name AS venueName,

          b.invoice_number AS bookingNumber,

          b.reservation_end_date AS startDate,

          b.reservation_end_date AS endDate,

          b.booking_type as status ,
          

          COALESCE(
            b.total_pax,
            0
          ) AS guests,

         u.last_name AS customerName,

          COALESCE(
            (
              SELECT SUM(
                bc.total_price
              )
              FROM booking_charges bc
              WHERE bc.booking_id = b.id
            ),
            0
          ) AS amount

        FROM bookings b

        INNER JOIN booking_venues bv
    ON bv.booking_id = b.id

        INNER JOIN venue_child vc
          ON vc.child_venue_id = bv.child_venue_id

        LEFT JOIN users u
          ON u.id = b.created_by

        WHERE b.vendor_id = ?

        AND b.category = ?

        AND DATE(b.reservation_end_date)
            <= ?

        AND DATE(
          COALESCE(
            b.reservation_end_date,
            b.reservation_end_date
          )
        ) >= ?

        ${venueId ? 'AND bv.child_venue_id = ?' : ''}

        ORDER BY
          b.reservation_end_date ASC
        `,
      venueId
        ? [userId, 'farmstay', endDate, startDate, venueId]
        : [userId, 'farmstay', endDate, startDate],
    );

    return {
      success: true,

      data: {
        category: 'farmstays',

        resources: resources.map((resource) => ({
          id: resource.child_venue_id,

          name: resource.name,

          label: resource.name,

          capacity: Number(resource.capacity || 0),

          venueId: resource.id,

          icon: '🏡',

          image: null,
        })),

        bookings: bookings.map((booking) => ({
          id: booking.id,

          resourceId: booking.venueId,

          venueId: booking.venueId,

          venueName: booking.venueName,

          bookingNumber: booking.bookingNumber,

          customerName: booking.customerName?.trim(),

          date: booking.startDate,

          startDate: booking.startDate,

          endDate: booking.endDate,

          amount: Number(booking.amount || 0),

          guests: Number(booking.guests || 0),

          status: booking.status,

          category: 'farmstays',

          raw: booking,
        })),

        pricing: pricing.map((item) => ({
          id: item.id,

          venueId: item.venueId,

          key: item.pricingKey,

          label: item.name,

          price: Number(item.amount || 0),

          enabled: Boolean(item.enabled),

          category: item.category,
        })),
      },
    };
  }

  /*
   * ======================================================
   * GENERIC CATEGORIES
   * ======================================================
   */

  private async getGenericCalendar(
    userId: number,
    category: string,
    startDate: string,
    endDate: string,
    venueId?: number,
  ) {
    const resources = await this.dataSource.query(
      `
        SELECT

          vc.child_venue_id,

          vc.child_venue_name AS name,

          COALESCE(
            vc.guest_rooms,
            0
          ) AS capacity

        FROM venue_child vc 
        

        WHERE vc.created_by = ?

        ${venueId ? 'AND vc.child_venue_id = ?' : ''}

        ORDER BY
          vc.child_venue_name ASC
        `,
      venueId ? [userId, venueId] : [userId],
    );

    const bookings = await this.dataSource.query(
      `
  SELECT
    b.id,
    b.invoice_number AS bookingNumber,
    b.status AS bookingStatus,

    bs.venue_id AS venueId,

    COALESCE(
      bv.venue_name_snapshot,
      vc.child_venue_name
    ) AS venueName,

    bed.event_date AS date,

    bs.shift_name AS shift,
    bs.start_time AS startTime,
    bs.end_time AS endTime,

    b.total_pax AS guests,
    COALESCE(bs.price, 0) AS amount,

    bs.status AS shiftStatus,

    u.name AS customerName,
    u.phone AS customerPhone,
    u.email AS customerEmail

FROM bookings b

INNER JOIN booking_venues bv
    ON bv.booking_id = b.id

INNER JOIN booking_event_dates bed
    ON bed.booking_id = b.id

INNER JOIN booking_shifts bs
    ON bs.booking_id = b.id

LEFT JOIN venue_child vc
    ON vc.child_venue_id = bs.venue_id

LEFT JOIN users u
    ON u.id = b.created_by

WHERE b.vendor_id = ?
  AND b.category = ?
  
  AND DATE(bed.event_date) BETWEEN ? AND ?

ORDER BY
    bed.event_date ASC,
    bs.start_time ASC

 
  `,
      venueId
        ? [userId, 1, startDate, endDate, venueId]
        : [userId, 1, startDate, endDate],
    );
   

    const general_setting = await this.dataSource.query(
      `select * from venue_booking_setting WHERE vendor_id = ? `,
      [userId],
    );

    return {
      success: true,

      data: {
        category,

        resources: resources.map((resource) => ({
          id: String(resource.child_venue_id),
          name: resource.name,
          capacity: Number(resource.capacity || 0),
          icon: '🏛️',
          image: null,
        })),

        bookings: bookings.map((booking) => ({
          id: booking.id,

          resourceId: booking.venueId,

          venueId: booking.venueId,

          venueName: booking.venueName,

          bookingNumber: booking.bookingNumber,

          date: booking.startDate,

          startDate: booking.startDate,

          endDate: booking.endDate,

          customerName: booking.customerName?.trim(),

          amount: Number(booking.amount || 0),

          guests: Number(booking.guests || 0),

          status: booking.status,

          category,

          raw: booking,
        })),

        general_setting,
        shiftPricing: {},

        eventDates: [
          ...new Set(bookings.map((booking) => booking.date).filter(Boolean)),
        ],

        sidebarSections: [],
      },
    };
  }

  //subscription
  async subscriptionDetails(userId: number) {
    const [subscription] = await this.dataSource.query(
      `
    SELECT
      us.id AS subscription_id,
      us.subscription_code,
      us.status,
      us.start_date,
      us.next_billing_date,
      us.end_date,
      us.quantity,
      us.price_per_unit,
      us.current_amount,
      us.total_amount,
      us.auto_renew,

      p.id AS plan_id,
      p.plan_name,
      p.plan_title,
      p.description,
      p.amount AS plan_amount,
      p.discount,
      p.offer_amount,
      p.min_venue,
      p.max_venue,
      p.modules

    FROM user_subscriptions us
    LEFT JOIN plans p
      ON p.id = us.plan_id
    WHERE us.user_id = ?
    ORDER BY us.id DESC
    LIMIT 1
    `,
      [userId],
    );

    const history = await this.dataSource.query(
      `
    SELECT
      id,
      order_id,
      razorpay_order_id,
      payment_id,
      razorpay_payment_id,
      amount,
      tax_amount,
      total_amount,
      currency,
      quantity,
      price_per_unit,
      payment_method,
      payment_status,
      paid_at,
      failure_reason,
      created_at
    FROM user_subscription_payments
    WHERE user_id = ?
    ORDER BY created_at DESC
    `,
      [userId],
    );

    return {
      subscription: subscription || null,
      history,
    };
  }

  async getdashboardRevenue(
    vendor_id: number,
    filters: {
      parentVenueId?: number;
      childVenueId?: string;
      venueId?: string;
      bookingType?: string;
      category?: string;
      countryId?: number;
      bookingEventTypeId?: number;
      bookingStatus?: string;
    },
  ) {
    const {
      parentVenueId,
      childVenueId,
      venueId,
      bookingType,
      category,
      countryId,
      bookingEventTypeId,
      bookingStatus,
    } = filters;

    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;

    const startDate = `${previousYear}-01-01 00:00:00`;
    const endDate = `${currentYear + 1}-01-01 00:00:00`;

    // ============================================================
    // BUILD COMMON FILTERS
    // ============================================================

    function buildFilters(
      baseParams: any[],
      baseClause: string,
      includeBookingType: boolean,
    ) {
      const params = [...baseParams];
      let clause = baseClause;

      // ==========================================================
      // VENUE FILTER
      //
      // Priority:
      // 1. venueId
      // 2. parentVenueId
      // 3. childVenueId
      // 4. No venue filter = ALL VENUES
      // ==========================================================

      const hasVenueId =
        typeof venueId === 'string' && venueId.trim().length > 0;

      if (hasVenueId) {
        /*
         * venueId is a STRING.
         *
         * It can match either:
         *   booking_venues.parent_venue_id
         *   booking_venues.child_venue_id
         *
         * Do NOT use Number(venueId).
         */

        clause += `
        AND EXISTS (
          SELECT 1
          FROM booking_venues bv
          WHERE bv.booking_id = b.id
            AND child_venue_id = ?
        )
      `;

        params.push(venueId.trim(), venueId.trim());
      } else if (parentVenueId !== undefined && parentVenueId !== null) {
        clause += `
        AND EXISTS (
          SELECT 1
          FROM booking_venues bv
          WHERE bv.booking_id = b.id
            AND bv.parent_venue_id = ?
        )
      `;

        params.push(parentVenueId);
      } else if (childVenueId !== undefined && childVenueId !== null) {
        clause += `
        AND EXISTS (
          SELECT 1
          FROM booking_venues bv
          WHERE bv.booking_id = b.id
            AND bv.child_venue_id = ?
        )
      `;

        params.push(childVenueId);
      }

      // ==========================================================
      // BOOKING TYPE
      // ==========================================================

      if (bookingType && includeBookingType) {
        clause += `
        AND b.booking_type = ?
      `;

        params.push(bookingType);
      }

      // ==========================================================
      // CATEGORY
      // ==========================================================

      if (category) {
        clause += `
        AND b.category = ?
      `;

        params.push(category);
      }

      // ==========================================================
      // COUNTRY
      // ==========================================================

      if (countryId !== undefined && countryId !== null) {
        clause += `
        AND b.country_id = ?
      `;

        params.push(countryId);
      }

      // ==========================================================
      // BOOKING EVENT TYPE
      // ==========================================================

      if (bookingEventTypeId !== undefined && bookingEventTypeId !== null) {
        clause += `
        AND b.booking_event_type_id = ?
      `;

        params.push(bookingEventTypeId);
      }

      // ==========================================================
      // BOOKING STATUS
      // ==========================================================

      if (bookingStatus) {
        clause += `
        AND b.status = ?
      `;

        params.push(bookingStatus);
      }

      return {
        clause,
        params,
      };
    }

    // ============================================================
    // 1. REVENUE FILTERS
    // ============================================================

    const { clause: revenueFilters, params: revenueParams } = buildFilters(
      [vendor_id, startDate, endDate],
      `
      b.vendor_id = ?
      AND bp.payment_status = 'paid'
      AND bp.payment_date >= ?
      AND bp.payment_date < ?
      AND b.status IS NOT NULL
    `,
      true,
    );

    // ============================================================
    // 2. BOOKING / ENQUIRY FILTERS
    // ============================================================

    const { clause: bookingFilters, params: bookingParams } = buildFilters(
      [vendor_id, startDate, endDate],
      `
      b.vendor_id = ?
      AND b.created_at >= ?
      AND b.created_at < ?
      AND b.status IS NOT NULL
    `,
      false,
    );

    // ============================================================
    // 3. REVENUE QUERY
    // ============================================================

    const revenueQuery = `
    SELECT
      YEAR(bp.payment_date) AS year,
      MONTH(bp.payment_date) AS month,

      COALESCE(
        SUM(
          CASE

            WHEN bp.payment_type IN (
              'base_amount',
              'addon',
              'advance',
              'convenience_fee'
            )
            THEN COALESCE(bp.amount_paid, 0)

            WHEN bp.payment_type = 'refund'
            THEN -COALESCE(bp.amount_paid, 0)

            ELSE 0

          END
        ),
        0
      ) AS revenue

    FROM booking_payments bp

    INNER JOIN bookings b
      ON b.id = bp.booking_id

    WHERE
      ${revenueFilters}

    GROUP BY
      YEAR(bp.payment_date),
      MONTH(bp.payment_date)

    ORDER BY
      year ASC,
      month ASC
  `;

    // ============================================================
    // 4. BOOKINGS QUERY
    // ============================================================

    const bookingsQuery = `
    SELECT
      YEAR(b.created_at) AS year,
      MONTH(b.created_at) AS month,

      COUNT(DISTINCT b.id) AS bookings

    FROM bookings b

    WHERE
      ${bookingFilters}

      AND b.booking_type = 'booked'

    GROUP BY
      YEAR(b.created_at),
      MONTH(b.created_at)

    ORDER BY
      year ASC,
      month ASC
  `;

    // ============================================================
    // 5. ENQUIRIES QUERY
    // ============================================================

    const enquiriesQuery = `
    SELECT
      YEAR(b.created_at) AS year,
      MONTH(b.created_at) AS month,

      COUNT(DISTINCT b.id) AS enquiries,

      COUNT(
        DISTINCT CASE
          WHEN b.status IN (
            'active',
            'completed'
          )
          THEN b.id
        END
      ) AS converted,

      COALESCE(
        SUM(
          COALESCE(b.total_pax, 0)
        ),
        0
      ) AS pax

    FROM bookings b

    WHERE
      ${bookingFilters}

      AND b.booking_type = 'lead'

    GROUP BY
      YEAR(b.created_at),
      MONTH(b.created_at)

    ORDER BY
      year ASC,
      month ASC
  `;

    // ============================================================
    // 6. EXECUTE QUERIES
    // ============================================================

    const [revenueRows, bookingRows, enquiryRows] = await Promise.all([
      this.dataSource.query(revenueQuery, revenueParams),

      this.dataSource.query(bookingsQuery, bookingParams),

      this.dataSource.query(enquiriesQuery, bookingParams),
    ]);

    // ============================================================
    // 7. MONTHS
    // ============================================================

    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    // ============================================================
    // 8. LOOKUP MAPS
    // ============================================================

    const revenueMap = new Map<string, any>();
    const bookingMap = new Map<string, any>();
    const enquiryMap = new Map<string, any>();

    revenueRows.forEach((row: any) => {
      const key = `${Number(row.year)}-${Number(row.month)}`;

      revenueMap.set(key, row);
    });

    bookingRows.forEach((row: any) => {
      const key = `${Number(row.year)}-${Number(row.month)}`;

      bookingMap.set(key, row);
    });

    enquiryRows.forEach((row: any) => {
      const key = `${Number(row.year)}-${Number(row.month)}`;

      enquiryMap.set(key, row);
    });

    // ============================================================
    // 9. FINAL DASHBOARD DATA
    // ============================================================

    const dashboardData = months.map((month, index) => {
      const monthNumber = index + 1;

      const currentKey = `${currentYear}-${monthNumber}`;

      const previousKey = `${previousYear}-${monthNumber}`;

      const currentRevenue = revenueMap.get(currentKey);

      const previousRevenue = revenueMap.get(previousKey);

      const currentBooking = bookingMap.get(currentKey);

      const previousBooking = bookingMap.get(previousKey);

      const currentEnquiry = enquiryMap.get(currentKey);

      const previousEnquiry = enquiryMap.get(previousKey);

      return {
        month,

        // ======================================================
        // REVENUE
        // ======================================================

        'This Year': Number(currentRevenue?.revenue || 0),

        'Last Year': Number(previousRevenue?.revenue || 0),

        // ======================================================
        // BOOKINGS
        // ======================================================

        [`${currentYear} Bookings`]: Number(currentBooking?.bookings || 0),

        [`${previousYear} Bookings`]: Number(previousBooking?.bookings || 0),

        // ======================================================
        // ENQUIRIES
        // ======================================================

        [`${currentYear} Enquiries`]: Number(currentEnquiry?.enquiries || 0),

        [`${previousYear} Enquiries`]: Number(previousEnquiry?.enquiries || 0),

        // ======================================================
        // CONVERTED
        // ======================================================

        [`${currentYear} Converted`]: Number(currentEnquiry?.converted || 0),

        [`${previousYear} Converted`]: Number(previousEnquiry?.converted || 0),

        // ======================================================
        // PAX
        // ======================================================

        [`${currentYear} Pax`]: Number(currentEnquiry?.pax || 0),

        [`${previousYear} Pax`]: Number(previousEnquiry?.pax || 0),
      };
    });

    // ============================================================
    // 10. RESPONSE
    // ============================================================

    return {
      currentYear,
      previousYear,

      // Return selected venue so frontend can know
      // which filter was applied.
      venueId:
        typeof venueId === 'string' && venueId.trim() !== ''
          ? venueId.trim()
          : null,

      // true = all venues
      // false = specific venue
      allVenues: !venueId || venueId.trim() === '',

      data: dashboardData,
    };
  }

  async getEventRevenue(vendor_id: number , body:any) {
    // ============================================================
    // REVENUE
    // ============================================================

    const revenueQuery = `
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN bc.charge_type IN (
              'base',
              'addon',
              'convenience_fee',
              'cleaning_fee'
            )
            THEN bc.total_price
            ELSE 0
          END
        ),
        0
      ) AS total,

      COALESCE(
        SUM(
          CASE
            WHEN b.selection_mode = 'online'
             AND bc.charge_type IN (
               'base',
               'addon',
               'convenience_fee',
               'cleaning_fee'
             )
            THEN bc.total_price
            ELSE 0
          END
        ),
        0
      ) AS online,

      COALESCE(
        SUM(
          CASE
            WHEN b.selection_mode <> 'online'
              OR b.selection_mode IS NULL
            AND bc.charge_type IN (
              'base',
              'addon',
              'convenience_fee',
              'cleaning_fee'
            )
            THEN bc.total_price
            ELSE 0
          END
        ),
        0
      ) AS offline

    FROM booking_charges bc

    INNER JOIN bookings b
      ON b.id = bc.booking_id

    WHERE b.vendor_id = ? AND b.booking_type = 'booked' AND status = 'active'
  `;

    const revenueResult = await this.dataSource.query(revenueQuery, [
      vendor_id,
    ]);

    // ============================================================
    // LEADS
    // ============================================================

    const leadsQuery = `
    SELECT
      COUNT(*) AS total,

      SUM(
        CASE
          WHEN b.selection_mode = 'online'
          THEN 1
          ELSE 0
        END
      ) AS online,

      SUM(
        CASE
          WHEN b.selection_mode <> 'online'
            OR b.selection_mode IS NULL
          THEN 1
          ELSE 0
        END
      ) AS offline

    FROM bookings b

    WHERE
      b.booking_type = 'lead'
      AND b.vendor_id = ?
  `;

    const leadsResult = await this.dataSource.query(leadsQuery, [vendor_id]);

    // ============================================================
    // EVENTS / BOOKINGS
    // ============================================================

    const eventsQuery = `
    SELECT
      COUNT(*) AS total,

      SUM(
        CASE
          WHEN b.selection_mode = 'online'
          THEN 1
          ELSE 0
        END
      ) AS online,

      SUM(
        CASE
          WHEN b.selection_mode <> 'online'
            OR b.selection_mode IS NULL
          THEN 1
          ELSE 0
        END
      ) AS offline

    FROM bookings b

    WHERE
      b.booking_type <> 'lead'
      AND b.vendor_id = ?
  `;

    const eventsResult = await this.dataSource.query(eventsQuery, [vendor_id]);

    // ============================================================
    // RESPONSE
    // ============================================================

    return {
      revenue: {
        online: Number(revenueResult[0]?.online || 0),
        offline: Number(revenueResult[0]?.offline || 0),
        total: Number(revenueResult[0]?.total || 0),
      },

      leads: {
        online: Number(leadsResult[0]?.online || 0),
        offline: Number(leadsResult[0]?.offline || 0),
        total: Number(leadsResult[0]?.total || 0),
      },

      events: {
        online: Number(eventsResult[0]?.online || 0),
        offline: Number(eventsResult[0]?.offline || 0),
        total: Number(eventsResult[0]?.total || 0),
      },
    };
  }

  async calendarSetting(body: {
    venueId: string;
    date: string;
    mode?: string;
  }) {
    const { venueId, date, mode = 'venue' } = body;

    if (!venueId) {
      throw new BadRequestException('venueId is required');
    }

    if (!date) {
      throw new BadRequestException('date is required');
    }

    const sql = `
    SELECT
      id,
      child_id AS childId,
      \`group\`,
      \`key\`,
      value,
      type,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM venue_child_settings
    WHERE child_id = ?
      AND \`group\` = 'publication'
      AND \`key\` IN ('reserve', 'instant','pricingModel')
      AND value = 'true'
    ORDER BY \`key\`
  `;

    const rows = await this.dataSource.query(sql, [venueId]);

    const setting = rows || null;

    return {
      venueId,
      date,
      mode,
      publication: setting || null,
    };
  }

  async venueList(user_id: any, category: any) {
    const normalizedCategory = category?.trim()?.toLowerCase();

    const singular = normalizedCategory?.endsWith('s')
      ? normalizedCategory.slice(0, -1)
      : normalizedCategory;

    const query = `
    SELECT
    *

    FROM venue_child cv
    LEFT JOIN venue_parent ON venue_parent.parent_venue_id = cv.parent_venue_id

    WHERE
       cv.created_by = ?  AND propety_category = ? AND cv.publish_status= 1`;

    const result = await this.dataSource.query(query, [user_id, singular]);
    return result;
  }

//   async action_required(vendor_id: number,body:any) {
//     const reminders = await this.dataSource.query(
//       `
//   SELECT
//     b.id,
//     b.booking_type,
//     b.status,
//     b.total_amount,
//     b.reservation_end_date,
//     b.cancellation_date,
//     bed.event_date,

//     COALESCE(p.total_paid, 0) AS total_paid,

//     (
//         b.total_amount - COALESCE(p.total_paid, 0)
//     ) AS pending_amount,

//     CASE
//         WHEN b.booking_type = 'reserve'
//              AND b.reservation_end_date IS NOT NULL
//              AND NOW() BETWEEN
//                  DATE_SUB(b.reservation_end_date, INTERVAL 24 HOUR)
//                  AND b.reservation_end_date
//         THEN 'RESERVATION_EXPIRY_REMINDER'

//         WHEN b.booking_type IN ('booked', 'booking', 'instant')
//              AND b.reservation_end_date IS NOT NULL
//              AND NOW() BETWEEN
//                  DATE_SUB(b.reservation_end_date, INTERVAL 12 HOUR)
//                  AND b.reservation_end_date
//         THEN 'INSTANCE_BOOKING_CONFIRMATION'

//         WHEN b.booking_type IN ('booked', 'booking', 'instant')
//              AND bed.event_date IS NOT NULL
//              AND NOW() BETWEEN
//                  DATE_SUB(bed.event_date, INTERVAL 4 HOUR)
//                  AND bed.event_date
//         THEN 'EVENT_REMINDER'

//         WHEN b.booking_type = 'quotation'
//              AND bed.event_date IS NOT NULL
//              AND NOW() BETWEEN
//                  DATE_SUB(bed.event_date, INTERVAL 24 HOUR)
//                  AND bed.event_date
//         THEN 'QUOTATION_REMINDER'

//         WHEN b.booking_type IN ('booked', 'booking', 'instant')
//              AND bed.event_date IS NOT NULL
//              AND NOW() BETWEEN
//                  DATE_SUB(bed.event_date, INTERVAL 7 DAY)
//                  AND bed.event_date
//              AND (
//                  b.total_amount - COALESCE(p.total_paid, 0)
//              ) > 0
//         THEN 'PAYMENT_REMINDER'

//         WHEN b.booking_type = 'booked'
//              AND bed.event_date IS NOT NULL
//              AND NOW() > bed.event_date
//         THEN 'SETTLEMENT_REMINDER'
//     END AS reminder_type

// FROM bookings b

// LEFT JOIN booking_event_dates bed
//     ON bed.booking_id = b.id

// INNER JOIN booking_venues bv
//     ON bv.booking_id = b.id
    

// LEFT JOIN (
//     SELECT
//         booking_id,
//         SUM(
//             CASE
//                 WHEN payment_status = 'paid'
//                 THEN amount_paid
//                 ELSE 0
//             END
//         ) AS total_paid
//     FROM booking_payments
//     GROUP BY booking_id
// ) p
//     ON p.booking_id = b.id

// WHERE
//     b.vendor_id = ? AND bv.child_venue_id =? AND
//     AND
//     (
//         (
//             b.booking_type = 'reserve'
//             AND b.reservation_end_date IS NOT NULL
//             AND NOW() BETWEEN
//                 DATE_SUB(b.reservation_end_date, INTERVAL 24 HOUR)
//                 AND b.reservation_end_date
//         )

//         OR

//         (
//             b.booking_type IN ('booked', 'booking', 'instant')
//             AND b.reservation_end_date IS NOT NULL
//             AND NOW() BETWEEN
//                 DATE_SUB(b.reservation_end_date, INTERVAL 12 HOUR)
//                 AND b.reservation_end_date
//         )

//         OR

//         (
//             b.booking_type IN ('booked', 'booking', 'instant')
//             AND bed.event_date IS NOT NULL
//             AND NOW() BETWEEN
//                 DATE_SUB(bed.event_date, INTERVAL 4 HOUR)
//                 AND bed.event_date
//         )

//         OR

//         (
//             b.booking_type = 'quotation'
//             AND bed.event_date IS NOT NULL
//             AND NOW() BETWEEN
//                 DATE_SUB(bed.event_date, INTERVAL 24 HOUR)
//                 AND bed.event_date
//         )

//         OR

//         (
//             b.booking_type IN ('booked', 'booking', 'instant')
//             AND bed.event_date IS NOT NULL
//             AND NOW() BETWEEN
//                 DATE_SUB(bed.event_date, INTERVAL 7 DAY)
//                 AND bed.event_date
//             AND (
//                 b.total_amount - COALESCE(p.total_paid, 0)
//             ) > 0
//         )

//         OR

//         (
//             b.booking_type = 'booked'
//             AND bed.event_date IS NOT NULL
//             AND NOW() > bed.event_date
//         )
//     );
//   `,
//       [vendor_id],
//     );

//     const alerts: any = [];

//     const reservationCount = reminders.filter(
//       (x) => x.reminder_type === 'RESERVATION_EXPIRY_REMINDER',
//     ).length;

//     if (reservationCount > 0) {
//       alerts.push({
//         id: 1,
//         level: 'critical',
//         Icon: 'Clock',
//         text: `${reservationCount} reservations expiring in less than 24 hours`,
//         action: 'View Reservations',
//       });
//     }

//     const paymentCount = reminders.filter(
//       (x) => x.reminder_type === 'PAYMENT_REMINDER',
//     ).length;

//     if (paymentCount > 0) {
//       alerts.push({
//         id: 2,
//         level: 'critical',
//         Icon: 'CreditCard',
//         text: `${paymentCount} payments pending before event`,
//         action: 'View Payments',
//       });
//     }

//     const confirmationCount = reminders.filter(
//       (x) => x.reminder_type === 'INSTANCE_BOOKING_CONFIRMATION',
//     ).length;

//     if (confirmationCount > 0) {
//       alerts.push({
//         id: 3,
//         level: 'medium',
//         Icon: 'CheckCircle',
//         text: `${confirmationCount} booking${confirmationCount > 1 ? 's' : ''} awaiting confirmation`,
//         action: 'Confirm Now',
//       });
//     }

//     const quotationCount = reminders.filter(
//       (x) => x.reminder_type === 'QUOTATION_REMINDER',
//     ).length;

//     if (quotationCount > 0) {
//       alerts.push({
//         id: 4,
//         level: 'medium',
//         Icon: 'FileText',
//         text: `${quotationCount} quotation${quotationCount > 1 ? 's' : ''} awaiting customer response`,
//         action: 'View Quotes',
//       });
//     }

//     const settlementCount = reminders.filter(
//       (x) => x.reminder_type === 'SETTLEMENT_REMINDER',
//     ).length;

//     if (settlementCount > 0) {
//       alerts.push({
//         id: 5,
//         level: 'low',
//         Icon: 'DollarSign',
//         text: `${settlementCount} settlement${settlementCount > 1 ? 's' : ''} pending`,
//         action: 'Process Settlement',
//       });
//     }

//     return alerts;
//   }
// async action_required(vendor_id: number, body: any) {
//   const rawVenueId = body?.venueId;

//   // Venue ID is a string in the API
//   let venueId: string | undefined;

//   if (typeof rawVenueId === 'string') {
//     const trimmed = rawVenueId.trim();

//     if (
//       trimmed !== '' &&
//       trimmed.toLowerCase() !== 'all' &&
//       trimmed.toLowerCase() !== 'null' &&
//       trimmed.toLowerCase() !== 'undefined' &&
//       trimmed.toLowerCase() !== 'nan'
//     ) {
//       venueId = trimmed;
//     }
//   }

//   // ---------------------------------------------------------
//   // VENUE FILTER
//   // Selected venue  -> filter by venue
//   // No venue / all  -> all venues
//   // ---------------------------------------------------------
//   const venueWhere = venueId
//     ? `bv.child_venue_id = ?`
//     : '';

//   const params: any[] = [vendor_id];

//   if (venueId) {
//     params.push(venueId);
//   }

//   const reminders = await this.dataSource.query(
//     `
//     SELECT
//       b.id,
//       b.booking_type,
//       b.status,
//       b.total_amount,
//       b.reservation_end_date,
//       b.cancellation_date,
//       bed.event_date,

//       COALESCE(p.total_paid, 0) AS total_paid,

//       (
//         b.total_amount - COALESCE(p.total_paid, 0)
//       ) AS pending_amount,

//       CASE

//         /* Reservation expiring within 24 hours */
//         WHEN b.booking_type = 'reserve'
//           AND b.reservation_end_date IS NOT NULL
//           AND NOW() BETWEEN
//             DATE_SUB(b.reservation_end_date, INTERVAL 24 HOUR)
//             AND b.reservation_end_date
//         THEN 'RESERVATION_EXPIRY_REMINDER'

//         /* Booking confirmation within 12 hours */
//         WHEN b.booking_type IN ('booked', 'booking', 'instant')
//           AND b.reservation_end_date IS NOT NULL
//           AND NOW() BETWEEN
//             DATE_SUB(b.reservation_end_date, INTERVAL 12 HOUR)
//             AND b.reservation_end_date
//         THEN 'INSTANCE_BOOKING_CONFIRMATION'

//         /* Event starting within 4 hours */
//         WHEN b.booking_type IN ('booked', 'booking', 'instant')
//           AND bed.event_date IS NOT NULL
//           AND NOW() BETWEEN
//             DATE_SUB(bed.event_date, INTERVAL 4 HOUR)
//             AND bed.event_date
//         THEN 'EVENT_REMINDER'

//         /* Quotation event within 24 hours */
//         WHEN b.booking_type = 'quotation'
//           AND bed.event_date IS NOT NULL
//           AND NOW() BETWEEN
//             DATE_SUB(bed.event_date, INTERVAL 24 HOUR)
//             AND bed.event_date
//         THEN 'QUOTATION_REMINDER'

//         /* Payment pending within 7 days before event */
//         WHEN b.booking_type IN ('booked', 'booking', 'instant')
//           AND bed.event_date IS NOT NULL
//           AND NOW() BETWEEN
//             DATE_SUB(bed.event_date, INTERVAL 7 DAY)
//             AND bed.event_date
//           AND (
//             b.total_amount - COALESCE(p.total_paid, 0)
//           ) > 0
//         THEN 'PAYMENT_REMINDER'

//         /* Event already passed */
//         WHEN b.booking_type = 'booked'
//           AND bed.event_date IS NOT NULL
//           AND NOW() > bed.event_date
//         THEN 'SETTLEMENT_REMINDER'

//       END AS reminder_type

//     FROM bookings b

//     LEFT JOIN booking_event_dates bed
//       ON bed.booking_id = b.id

//     INNER JOIN booking_venues bv
//       ON bv.booking_id = b.id

//     LEFT JOIN (
//       SELECT
//         booking_id,
//         SUM(
//           CASE
//             WHEN payment_status = 'paid'
//             THEN amount_paid
//             ELSE 0
//           END
//         ) AS total_paid
//       FROM booking_payments
//       GROUP BY booking_id
//     ) p
//       ON p.booking_id = b.id

//     WHERE
//       b.vendor_id = ?

//       ${venueWhere}

//       AND
//       (
//         /* Reservation expiry */
//         (
//           b.booking_type = 'reserve'
//           AND b.reservation_end_date IS NOT NULL
//           AND NOW() BETWEEN
//             DATE_SUB(b.reservation_end_date, INTERVAL 24 HOUR)
//             AND b.reservation_end_date
//         )

//         OR

//         /* Booking confirmation */
//         (
//           b.booking_type IN ('booked', 'booking', 'instant')
//           AND b.reservation_end_date IS NOT NULL
//           AND NOW() BETWEEN
//             DATE_SUB(b.reservation_end_date, INTERVAL 12 HOUR)
//             AND b.reservation_end_date
//         )

//         OR

//         /* Event reminder */
//         (
//           b.booking_type IN ('booked', 'booking', 'instant')
//           AND bed.event_date IS NOT NULL
//           AND NOW() BETWEEN
//             DATE_SUB(bed.event_date, INTERVAL 4 HOUR)
//             AND bed.event_date
//         )

//         OR

//         /* Quotation reminder */
//         (
//           b.booking_type = 'quotation'
//           AND bed.event_date IS NOT NULL
//           AND NOW() BETWEEN
//             DATE_SUB(bed.event_date, INTERVAL 24 HOUR)
//             AND bed.event_date
//         )

//         OR

//         /* Payment reminder */
//         (
//           b.booking_type IN ('booked', 'booking', 'instant')
//           AND bed.event_date IS NOT NULL
//           AND NOW() BETWEEN
//             DATE_SUB(bed.event_date, INTERVAL 7 DAY)
//             AND bed.event_date
//           AND (
//             b.total_amount - COALESCE(p.total_paid, 0)
//           ) > 0
//         )

//         OR

//         /* Settlement reminder */
//         (
//           b.booking_type = 'booked'
//           AND bed.event_date IS NOT NULL
//           AND NOW() > bed.event_date
//         )
//       )

//     ORDER BY bed.event_date ASC
//     `,
//     params,
//   );

//   // ---------------------------------------------------------
//   // ALERTS
//   // ---------------------------------------------------------

//   const alerts: any[] = [];

//   const reservationCount = reminders.filter(
//     (x) => x.reminder_type === 'RESERVATION_EXPIRY_REMINDER',
//   ).length;

//   if (reservationCount > 0) {
//     alerts.push({
//       id: 1,
//       level: 'critical',
//       Icon: 'Clock',
//       text: `${reservationCount} reservations expiring in less than 24 hours`,
//       action: 'View Reservations',
//     });
//   }

//   const paymentCount = reminders.filter(
//     (x) => x.reminder_type === 'PAYMENT_REMINDER',
//   ).length;

//   if (paymentCount > 0) {
//     alerts.push({
//       id: 2,
//       level: 'critical',
//       Icon: 'CreditCard',
//       text: `${paymentCount} payments pending before event`,
//       action: 'View Payments',
//     });
//   }

//   const confirmationCount = reminders.filter(
//     (x) => x.reminder_type === 'INSTANCE_BOOKING_CONFIRMATION',
//   ).length;

//   if (confirmationCount > 0) {
//     alerts.push({
//       id: 3,
//       level: 'medium',
//       Icon: 'CheckCircle',
//       text: `${confirmationCount} booking${
//         confirmationCount > 1 ? 's' : ''
//       } awaiting confirmation`,
//       action: 'Confirm Now',
//     });
//   }

//   const quotationCount = reminders.filter(
//     (x) => x.reminder_type === 'QUOTATION_REMINDER',
//   ).length;

//   if (quotationCount > 0) {
//     alerts.push({
//       id: 4,
//       level: 'medium',
//       Icon: 'FileText',
//       text: `${quotationCount} quotation${
//         quotationCount > 1 ? 's' : ''
//       } awaiting customer response`,
//       action: 'View Quotes',
//     });
//   }

//   const settlementCount = reminders.filter(
//     (x) => x.reminder_type === 'SETTLEMENT_REMINDER',
//   ).length;

//   if (settlementCount > 0) {
//     alerts.push({
//       id: 5,
//       level: 'low',
//       Icon: 'DollarSign',
//       text: `${settlementCount} settlement${
//         settlementCount > 1 ? 's' : ''
//       } pending`,
//       action: 'Process Settlement',
//     });
//   }

//   return alerts;
// }

async action_required(vendor_id: number, body: any) {
  let venueId: string | undefined;

  if (typeof body?.venueId === 'string') {
    const value = body.venueId.trim();

    if (
      value !== '' &&
      value.toLowerCase() !== 'all' &&
      value.toLowerCase() !== 'null' &&
      value.toLowerCase() !== 'undefined' &&
      value.toLowerCase() !== 'nan'
    ) {
      venueId = value;
    }
  }

  const alerts: any[] = [];

  // 1. Reservation expiry
  const reservationCount =
    await this.getReservationExpiryCount(vendor_id, venueId);

  if (reservationCount > 0) {
    alerts.push({
      id: 1,
      level: 'critical',
      Icon: 'Clock',
      text: `${reservationCount} reservations expiring in less than 24 hours`,
      action: 'View Reservations',
    });
  }

  // 2. Payment reminder
  const paymentCount =
    await this.getPaymentReminderCount(vendor_id, venueId);

  if (paymentCount > 0) {
    alerts.push({
      id: 2,
      level: 'critical',
      Icon: 'CreditCard',
      text: `${paymentCount} payments pending before event`,
      action: 'View Payments',
    });
  }

  // 3. Booking confirmation
  const confirmationCount =
    await this.getBookingConfirmationCount(vendor_id, venueId);

  if (confirmationCount > 0) {
    alerts.push({
      id: 3,
      level: 'medium',
      Icon: 'CheckCircle',
      text: `${confirmationCount} booking${
        confirmationCount > 1 ? 's' : ''
      } awaiting confirmation`,
      action: 'Confirm Now',
    });
  }

  // 4. Quotation reminder
  const quotationCount =
    await this.getQuotationReminderCount(vendor_id, venueId);

  if (quotationCount > 0) {
    alerts.push({
      id: 4,
      level: 'medium',
      Icon: 'FileText',
      text: `${quotationCount} quotation${
        quotationCount > 1 ? 's' : ''
      } awaiting customer response`,
      action: 'View Quotes',
    });
  }

  // 5. Settlement
  const settlementCount =
    await this.getSettlementReminderCount(vendor_id, venueId);

  if (settlementCount > 0) {
    alerts.push({
      id: 5,
      level: 'low',
      Icon: 'DollarSign',
      text: `${settlementCount} settlement${
        settlementCount > 1 ? 's' : ''
      } pending`,
      action: 'Process Settlement',
    });
  }

  return alerts;
}

  async leads_piplines(vendor_id: number) {
    const rows = await this.dataSource.query(
      `
    SELECT
      s.stage AS label,
      COALESCE(COUNT(b.id), 0) AS count,
      COALESCE(SUM(b.estimated_total), 0) AS total_value

    FROM (
      SELECT 'New Lead' AS stage, 'New, Active' AS status
      UNION ALL
      SELECT 'Contacted', 'Contacted'
      UNION ALL
      SELECT 'Quote Sent', 'pending_vendor_confirmation'
      UNION ALL
      SELECT 'Negotiation', 'Negotiating'
      UNION ALL
      SELECT 'Reserved', 'Sign_Contract'
      UNION ALL
      SELECT 'Converted', 'confirmed'
      UNION ALL
      SELECT 'Lost', 'Cancelled'
    ) s

   LEFT JOIN bookings b
  ON b.booking_type IN ('pax', 'lead')
  AND b.vendor_id = ?
  AND (
    (
      s.stage = 'New Lead'
      AND b.status IN ('New', 'Active')
    )

    OR (
      s.stage = 'Converted'
      AND b.status IN (
        'confirmed',
        'confirmed_vendor'
      )
    )

    OR (
      s.stage NOT IN ('New Lead', 'Converted')
      AND b.status = s.status
    )
  )

    GROUP BY s.stage

    ORDER BY FIELD(
      s.stage,
      'New Lead',
      'Contacted',
      'Quote Sent',
      'Negotiation',
      'Reserved',
      'Converted',
      'Lost'
    )
    `,
      [vendor_id],
    );

    const stageColors: Record<string, string> = {
      'New Lead': '#6366f1',
      Contacted: '#0ea5e9',
      'Quote Sent': '#f59e0b',
      Negotiation: '#f97316',
      Reserved: '#a44bf3',
      Converted: '#10b981',
      Lost: '#ef4444',
    };

    // Total number of leads
    const totalLeads = rows.reduce(
      (sum: number, row: any) => sum + Number(row.count),
      0,
    );

    // Total pipeline value
    const pipelineValue = rows.reduce(
      (sum: number, row: any) => sum + Number(row.total_value),
      0,
    );

    // Converted
    const converted = rows.find((row: any) => row.label === 'Converted');

    const convertedCount = Number(converted?.count || 0);

    // Lost
    const lost = rows.find((row: any) => row.label === 'Lost');

    const lostCount = Number(lost?.count || 0);

    // Average deal size
    const avgDealSize = totalLeads > 0 ? pipelineValue / totalLeads : 0;

    // Conversion rate
    const conversionRate =
      totalLeads > 0 ? (convertedCount / totalLeads) * 100 : 0;

    // Maximum count for progress %
    const maxCount = Math.max(...rows.map((r: any) => Number(r.count)), 1);

    const STAGES = rows.map((r: any) => ({
      label: r.label,
      count: Number(r.count),
      value: `₹${Number(r.total_value).toLocaleString('en-IN')}`,
      color: stageColors[r.label],
      pct: Math.round((Number(r.count) / maxCount) * 100),
    }));

    const SUMMARY = [
      {
        label: 'Pipeline Value',
        value: `₹${pipelineValue.toLocaleString('en-IN')}`,
        color: 'text-violet-600 dark:text-violet-400',
      },
      {
        label: 'Conversion Rate',
        value: `${conversionRate.toFixed(1)}%`,
        color: 'text-emerald-600 dark:text-emerald-400',
      },
      {
        label: 'Avg Deal Size',
        value: `₹${Math.round(avgDealSize).toLocaleString('en-IN')}`,
        color: 'text-sky-600 dark:text-sky-400',
      },
      {
        label: 'Lost Deals',
        value: lostCount.toString(),
        color: 'text-red-500 dark:text-red-400',
      },
    ];

    return {
      stages: STAGES,
      summary: SUMMARY,
    };
  }

  async getLeadSourcesAndVenueBook(
  vendorId: number,
  body: any,
) {
  // =========================================================
  // VENUE ID
  // =========================================================

  let venueId: string | undefined;

  if (typeof body?.venueId === 'string') {
    const value = body.venueId.trim();

    if (
      value !== '' &&
      value.toLowerCase() !== 'all' &&
      value.toLowerCase() !== 'null' &&
      value.toLowerCase() !== 'undefined' &&
      value.toLowerCase() !== 'nan'
    ) {
      venueId = value;
    }
  }

  // =========================================================
  // 1. VENUEBOOK COUNT
  // booking_type = pax / enquiry
  // =========================================================

  let venueBookResult: any[];

  if (venueId) {
    venueBookResult = await this.dataSource.query(
      `
      SELECT COUNT(DISTINCT b.id) AS count
      FROM bookings b
      INNER JOIN booking_venues bv
        ON bv.booking_id = b.id
      WHERE b.vendor_id = ?
        AND bv.child_venue_id = ?
        AND b.booking_type IN ('pax', 'enquiry')
      `,
      [vendorId, venueId],
    );
  } else {
    venueBookResult = await this.dataSource.query(
      `
      SELECT COUNT(DISTINCT b.id) AS count
      FROM bookings b
      WHERE b.vendor_id = ?
        AND b.booking_type IN ('pax', 'enquiry')
      `,
      [vendorId],
    );
  }

  const venueBookCount = Number(
    venueBookResult?.[0]?.count || 0,
  );

  // =========================================================
  // 2. LEAD SOURCE COUNTS
  // =========================================================

  let leadRows: any[];

  if (venueId) {
    leadRows = await this.dataSource.query(
      `
      SELECT
        vld.lead_source,
        COUNT(DISTINCT b.id) AS count
      FROM bookings b

      INNER JOIN venue_leads_details vld
        ON vld.venue_lead_id = b.id

      INNER JOIN booking_venues bv
        ON bv.booking_id = b.id

      WHERE b.vendor_id = ?
        AND bv.child_venue_id = ?
        AND b.booking_type = 'lead'

      GROUP BY vld.lead_source
      `,
      [vendorId, venueId],
    );
  } else {
    leadRows = await this.dataSource.query(
      `
      SELECT
        vld.lead_source,
        COUNT(DISTINCT b.id) AS count
      FROM bookings b

      INNER JOIN venue_leads_details vld
        ON vld.venue_lead_id = b.id

      WHERE b.vendor_id = ?
        AND b.booking_type = 'lead'

      GROUP BY vld.lead_source
      `,
      [vendorId],
    );
  }

  // =========================================================
  // 3. COMBINE VENUEBOOK + LEAD SOURCES
  // =========================================================

  const sourceMap: Record<string, string> = {
    'Phone Call': 'Direct Calls',
    'Walk-in': 'Walk-ins',
    Referral: 'Referrals',
    Google: 'Google',
    WhatsApp: 'WhatsApp',
    Instagram: 'Instagram',
    Facebook: 'Facebook',
    Email: 'Email',
    'Select Source': 'Select Source',
    Other: 'Other',
  };

  const colors: Record<string, string> = {
    venuebook: '#7c3aed',
    'Phone Call': '#0ea5e9',
    'Walk-in': '#10b981',
    Referral: '#f59e0b',
    Google: '#ef4444',
    WhatsApp: '#22c55e',
    Instagram: '#e1306c',
    Facebook: '#1877f2',
    Email: '#8b5cf6',
    'Select Source': '#94a3b8',
    Other: '#64748b',
  };

  const combined: any[] = [];

  // VenueBook
  if (venueBookCount > 0) {
    combined.push({
      key: 'venuebook',
      name: 'venuebook.in',
      count: venueBookCount,
      color: colors.venuebook,
    });
  }

  // Lead sources
  for (const row of leadRows) {
    const source = row.lead_source?.trim() || 'Other';
    const count = Number(row.count || 0);

    if (count > 0) {
      combined.push({
        key: source,
        name: sourceMap[source] || source,
        count,
        color: colors[source] || '#64748b',
      });
    }
  }

  // =========================================================
  // 4. TOTAL COUNT
  // =========================================================

  const total = combined.reduce(
    (sum, item) => sum + item.count,
    0,
  );

  // =========================================================
  // 5. PERCENTAGE
  // =========================================================

  const result = combined.map((item) => ({
    name: item.name,

    value:
      total > 0
        ? Number(((item.count / total) * 100).toFixed(2))
        : 0,

    count: item.count,

    color: item.color,
  }));

  return result;
}


  private async getReservationExpiryCount(
  vendorId: number,
  venueId?: string,
): Promise<number> {
  let result: any[];

  if (venueId) {
    result = await this.dataSource.query(
      `
      SELECT COUNT(DISTINCT b.id) AS count
      FROM bookings b
      INNER JOIN booking_venues bv
        ON bv.booking_id = b.id
      WHERE b.vendor_id = ?
        AND bv.child_venue_id = ?
        AND b.booking_type = 'reserve'
        AND b.reservation_end_date IS NOT NULL
        AND NOW() BETWEEN
          DATE_SUB(b.reservation_end_date, INTERVAL 24 HOUR)
          AND b.reservation_end_date
      `,
      [vendorId, venueId],
    );
  } else {
    result = await this.dataSource.query(
      `
      SELECT COUNT(DISTINCT b.id) AS count
      FROM bookings b
      WHERE b.vendor_id = ?
        AND b.booking_type = 'reserve'
        AND b.reservation_end_date IS NOT NULL
        AND NOW() BETWEEN
          DATE_SUB(b.reservation_end_date, INTERVAL 24 HOUR)
          AND b.reservation_end_date
      `,
      [vendorId],
    );
  }

  return Number(result?.[0]?.count || 0);
}

private async getPaymentReminderCount(
  vendorId: number,
  venueId?: string,
): Promise<number> {
  let result: any[];

  if (venueId) {
    result = await this.dataSource.query(
      `
      SELECT COUNT(DISTINCT b.id) AS count
      FROM bookings b

      INNER JOIN booking_event_dates bed
        ON bed.booking_id = b.id

      INNER JOIN booking_venues bv
        ON bv.booking_id = b.id

      LEFT JOIN (
        SELECT
          booking_id,
          SUM(
            CASE
              WHEN payment_status = 'paid'
              THEN amount_paid
              ELSE 0
            END
          ) AS total_paid
        FROM booking_payments
        GROUP BY booking_id
      ) p
        ON p.booking_id = b.id

      WHERE b.vendor_id = ?
        AND bv.child_venue_id = ?
        AND b.booking_type IN ('booked', 'booking', 'instant')
        AND bed.event_date IS NOT NULL

        AND NOW() BETWEEN
          DATE_SUB(bed.event_date, INTERVAL 7 DAY)
          AND bed.event_date

        AND (
          b.total_amount - COALESCE(p.total_paid, 0)
        ) > 0
      `,
      [vendorId, venueId],
    );
  } else {
    result = await this.dataSource.query(
      `
      SELECT COUNT(DISTINCT b.id) AS count
      FROM bookings b

      INNER JOIN booking_event_dates bed
        ON bed.booking_id = b.id

      LEFT JOIN (
        SELECT
          booking_id,
          SUM(
            CASE
              WHEN payment_status = 'paid'
              THEN amount_paid
              ELSE 0
            END
          ) AS total_paid
        FROM booking_payments
        GROUP BY booking_id
      ) p
        ON p.booking_id = b.id

      WHERE b.vendor_id = ?
        AND b.booking_type IN ('booked', 'booking', 'instant')
        AND bed.event_date IS NOT NULL

        AND NOW() BETWEEN
          DATE_SUB(bed.event_date, INTERVAL 7 DAY)
          AND bed.event_date

        AND (
          b.total_amount - COALESCE(p.total_paid, 0)
        ) > 0
      `,
      [vendorId],
    );
  }

  return Number(result?.[0]?.count || 0);
}

private async getBookingConfirmationCount(
  vendorId: number,
  venueId?: string,
): Promise<number> {
  let result: any[];

  if (venueId) {
    result = await this.dataSource.query(
      `
      SELECT COUNT(DISTINCT b.id) AS count
      FROM bookings b

      INNER JOIN booking_venues bv
        ON bv.booking_id = b.id

      WHERE b.vendor_id = ?
        AND bv.child_venue_id = ?
        AND b.booking_type IN ('booked', 'booking', 'instant')
        AND b.reservation_end_date IS NOT NULL

        AND NOW() BETWEEN
          DATE_SUB(b.reservation_end_date, INTERVAL 12 HOUR)
          AND b.reservation_end_date
      `,
      [vendorId, venueId],
    );
  } else {
    result = await this.dataSource.query(
      `
      SELECT COUNT(DISTINCT b.id) AS count
      FROM bookings b

      WHERE b.vendor_id = ?
        AND b.booking_type IN ('booked', 'booking', 'instant')
        AND b.reservation_end_date IS NOT NULL

        AND NOW() BETWEEN
          DATE_SUB(b.reservation_end_date, INTERVAL 12 HOUR)
          AND b.reservation_end_date
      `,
      [vendorId],
    );
  }

  return Number(result?.[0]?.count || 0);
}

private async getQuotationReminderCount(
  vendorId: number,
  venueId?: string,
): Promise<number> {
  let result: any[];

  if (venueId) {
    result = await this.dataSource.query(
      `
      SELECT COUNT(DISTINCT b.id) AS count
      FROM bookings b

      INNER JOIN booking_event_dates bed
        ON bed.booking_id = b.id

      INNER JOIN booking_venues bv
        ON bv.booking_id = b.id

      WHERE b.vendor_id = ?
        AND bv.child_venue_id = ?
        AND b.booking_type = 'quotation'
        AND bed.event_date IS NOT NULL

        AND NOW() BETWEEN
          DATE_SUB(bed.event_date, INTERVAL 24 HOUR)
          AND bed.event_date
      `,
      [vendorId, venueId],
    );
  } else {
    result = await this.dataSource.query(
      `
      SELECT COUNT(DISTINCT b.id) AS count
      FROM bookings b

      INNER JOIN booking_event_dates bed
        ON bed.booking_id = b.id

      WHERE b.vendor_id = ?
        AND b.booking_type = 'quotation'
        AND bed.event_date IS NOT NULL

        AND NOW() BETWEEN
          DATE_SUB(bed.event_date, INTERVAL 24 HOUR)
          AND bed.event_date
      `,
      [vendorId],
    );
  }

  return Number(result?.[0]?.count || 0);
}

private async getSettlementReminderCount(
  vendorId: number,
  venueId?: string,
): Promise<number> {
  let result: any[];

  if (venueId) {
    result = await this.dataSource.query(
      `
      SELECT COUNT(DISTINCT b.id) AS count
      FROM bookings b

      INNER JOIN booking_event_dates bed
        ON bed.booking_id = b.id

      INNER JOIN booking_venues bv
        ON bv.booking_id = b.id

      WHERE b.vendor_id = ?
        AND bv.child_venue_id = ?
        AND b.booking_type = 'booked'
        AND bed.event_date IS NOT NULL
        AND NOW() > bed.event_date
      `,
      [vendorId, venueId],
    );
  } else {
    result = await this.dataSource.query(
      `
      SELECT COUNT(DISTINCT b.id) AS count
      FROM bookings b

      INNER JOIN booking_event_dates bed
        ON bed.booking_id = b.id

      WHERE b.vendor_id = ?
        AND b.booking_type = 'booked'
        AND bed.event_date IS NOT NULL
        AND NOW() > bed.event_date
      `,
      [vendorId],
    );
  }

  return Number(result?.[0]?.count || 0);
}


    private async assertOwnsVenue(venueId: number, vendorUserId: number): Promise<void> {
    const rows = await this.dataSource.query(
      `SELECT child_venue_id FROM venue_child WHERE child_venue_id = ? AND created_by = ? LIMIT 1`,
      [venueId, vendorUserId],
    );
    if (!rows.length) {
      throw new ForbiddenException('You do not have access to this venue.');
    }
  }
 
  /**
   * Returns blocks in the exact dayShiftKey("YYYY-MM-DD", shiftKey) shape
   * MonthView.jsx / OccupancyHeatmap.jsx's own disabledShifts map already
   * uses ({ "2026-09-20::morning": true, "2026-09-21::fullday": true }),
   * so the response can be merged straight into that state with no
   * reshaping needed on the client.
   */
  async listBlocks(
    venueId: number,
    vendorUserId: number,
    from: string,
    to: string,
  ): Promise<Record<string, true>> {
    await this.assertOwnsVenue(venueId, vendorUserId);
 
    const rows: Array<{ block_date: string | Date; shift_key: string }> =
      await this.dataSource.query(
        `SELECT block_date, shift_key
           FROM venue_calendar_blocks
          WHERE venue_id = ? AND block_date BETWEEN ? AND ?`,
        [venueId, from, to],
      );
 
    const map: Record<string, true> = {};
    for (const row of rows) {
      const dateStr =
        row.block_date instanceof Date
          ? row.block_date.toISOString().slice(0, 10)
          : String(row.block_date);
      map[`${dateStr}::${row.shift_key}`] = true;
    }
    return map;
  }
 
  /**
   * blocked: true  -> UPSERT the row (idempotent — calling this twice in a
   *                   row just refreshes reason/updated_at, never throws on
   *                   the unique (venue_id, block_date, shift_key) index).
   * blocked: false -> DELETE the row if present. Deleting a row that
   *                   doesn't exist is a no-op, not an error, so a
   *                   double-click "unblock" is safe too.
   */
  async toggleBlock(
    venueId: any,
    vendorUserId: number,
    dto: any,
  ) {
    await this.assertOwnsVenue(venueId, vendorUserId);
 
    if (dto.blocked) {
      await this.dataSource.query(
        `INSERT INTO venue_calendar_blocks
           (venue_id, block_date, shift_key, reason, created_by)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           reason = VALUES(reason),
           updated_at = CURRENT_TIMESTAMP`,
        [venueId, dto.date, dto.shiftKey, dto.reason ?? null, vendorUserId],
      );
    } else {
      await this.dataSource.query(
        `DELETE FROM venue_calendar_blocks
          WHERE venue_id = ? AND block_date = ? AND shift_key = ?`,
        [venueId, dto.date, dto.shiftKey],
      );
    }
 
    return { date: dto.date, shiftKey: dto.shiftKey, blocked: dto.blocked };
  }


}