import { Injectable } from '@nestjs/common';
import { CategoryService } from '../category/category.service';
import { VenueService } from '../venue/venue.service';
import { DataSource, Repository, Not, IsNull } from 'typeorm';

@Injectable()
export class HomeService {
  constructor(
    private dataSource: DataSource,
    private categoryService: CategoryService,
    private venueService: VenueService,
  ) {}

  async getHomePageData() {
    const [categories, venues] = await Promise.all([
      this.categoryService.getCategories(),
      this.venueService.getPopularVenues(),
    ]);
    return { categories, venues };
  }

  // async getUserRecentViews(userId: any) {
  //   const result = await this.dataSource.query(
  //     `
  //   SELECT
  //       urv.id,
  //       urv.user_id,
  //       urv.venue_id,
  //       urv.viewed_at,

  //       cv.child_venue_id,
  //       cv.child_venue_name as name,
  //       pv.venue_city as location,
  //       pv.rating as rating,
  //       pv.reviews as reviews,
  //       vg.attachment AS image

  //   FROM user_recent_views urv

  //   LEFT JOIN venue_child cv
  //       ON cv.child_venue_id = urv.venue_id

  //   LEFT JOIN venue_parent pv
  //       ON pv.parent_venue_id = cv.parent_venue_id

  //   LEFT JOIN venue_gallery vg
  //       ON vg.child_venue_id = urv.venue_id
  //       AND vg.image_type = 1

  //   WHERE urv.user_id = ?

  //   ORDER BY urv.viewed_at DESC
  //   LIMIT 20
  //   `,
  //     [userId],
  //   );

  //   return result;
  // }
  async getUserRecentViews(userId: any, category: any) {
    const singular = category.endsWith('s') ? category.slice(0, -1) : category;

    let query = `SELECT
    pl.property_id,

    /* IDs */
    COALESCE(cv.child_venue_id, CAST(uv.id AS CHAR)) AS childVenueId,
    COALESCE(cv.parent_venue_id, CAST(uv.id AS CHAR)) AS parentVenueId,

    /* Names */
    COALESCE(cv.child_venue_name, uv.name) AS venueName,
    COALESCE(pv.venue_name, uv.name) AS parentName,

    /* Location */
    COALESCE(pv.venue_city, uv.city) AS city,
    COALESCE(pv.venue_state, uv.state) AS state,
    COALESCE(pv.venue_country, uv.country) AS country,

    COALESCE(pv.lat, uv.lat) AS lat,
    COALESCE(pv.lng, uv.lng) AS lng,

    /* Details */
    COALESCE(cv.guest_rooms, 0) AS maxGuests,
    COALESCE(cv.banquet_round, 0) AS bedrooms,

    COALESCE(vc.name, uv.name) AS venueType,

    pv.rating,
    pv.user_ratings_total AS reviewCount,
    pv.propety_category AS category,

    /* Cover Image */
    CASE
        WHEN cv.child_venue_id IS NOT NULL THEN
        (
            SELECT vg.attachment
            FROM venue_gallery vg
            WHERE vg.child_venue_id = cv.child_venue_id
              AND vg.image_type = 1
            LIMIT 1
        )
        ELSE
        (
            SELECT ug.images
            FROM unrigistered_gallery ug
            WHERE ug.unreg_id = uv.id
            ORDER BY ug.id
            LIMIT 1
        )
    END AS coverImage,

    /* Gallery */
    CASE
        WHEN cv.child_venue_id IS NOT NULL THEN
        (
            SELECT JSON_ARRAYAGG(
                JSON_OBJECT(
                    'image', vg.attachment
                )
            )
            FROM venue_gallery vg
            WHERE vg.child_venue_id = cv.child_venue_id
        )
        ELSE
        (
            SELECT JSON_ARRAYAGG(
                JSON_OBJECT(
                    'image', ug.images
                )
            )
            FROM unrigistered_gallery ug
            WHERE ug.unreg_id = uv.id
        )
    END AS images,

    /* Likes */
    (
        SELECT COUNT(*)
        FROM property_likes pl2
        WHERE pl2.property_id = pl.property_id
    ) AS totalLikes,

   IF(pls.id IS NULL, 0, 1) AS isLiked,

    /* Price */
    CASE
        WHEN cv.child_venue_id IS NOT NULL THEN
        (
            SELECT MIN(vst.price)
            FROM venue_shift_timing vst
            WHERE vst.child_venue_id = cv.child_venue_id
        )
        ELSE 0
    END AS minPrice

FROM user_recent_views pl

/* Registered venue */
LEFT JOIN venue_child cv
    ON cv.child_venue_id = pl.property_id

LEFT JOIN venue_parent pv
    ON pv.parent_venue_id = cv.parent_venue_id

LEFT JOIN venue_categories vc
    ON vc.id = cv.venue_category_id
    
LEFT JOIN property_likes pls
ON pls.property_id = pl.property_id
AND pls.user_id = pl.user_id

/* Unregistered venue */
LEFT JOIN unrigistered_venues uv
    ON uv.id = CAST(pl.property_id AS UNSIGNED)
    AND pl.property_id REGEXP '^[0-9]+$' AND uv.status = 1

WHERE pl.user_id = ? AND pv.propety_category = ? OR uv.property_type = ?

ORDER BY pl.viewed_at DESC;
`;
    const result = await this.dataSource.query(query, [
      userId,
      singular,
      singular,
    ]);

    return result;
  }
  // async vendor_category(userId: any , country :any) {
  //   const categories = await this.dataSource.query(
  //     `SELECT propety_category
  //      FROM venue_parent
  //      WHERE created_by = ?
  //        AND propety_category IS NOT NULL
  //        AND propety_category != '' AND venue_country = ? GROUP BY propety_category`,
  //     [userId,country]
  //   );

  //   return categories.map(item => `${item.propety_category}s`);
  // }
  async vendor_category(userId: number, country: string) {
    const categories = await this.dataSource.query(
      `
    SELECT DISTINCT propety_category
    FROM venue_parent
    WHERE created_by = ?
      AND venue_country = ?
      AND propety_category IS NOT NULL
      AND TRIM(propety_category) <> ''
    `,
      [userId, country],
    );

    return categories.map(({ propety_category }) => {
      return propety_category.endsWith('s')
        ? propety_category
        : `${propety_category}s`;
    });
  }

  // async recommeded_property(state:any) {
  //   const recommeded = await this.dataSource.query(
  //     `
  //     SELECT
  //         cv.child_venue_id,
  //         cv.child_venue_name AS name,
  //         vp.venue_city AS location,
  //         COALESCE(vp.rating, 5) AS rating,
  //         vp.user_ratings_total AS reviews,

  //         COUNT(DISTINCT b.id) AS total_bookings,

  //         COALESCE(SUM(b.total_amount), 0) AS revenue,

  //         MAX(b.created_at) AS last_booking,
  //  IF(pls.id IS NULL, 0, 1) AS isLiked,
  //         /* Cover image */
  //         (
  //             SELECT vg.attachment
  //             FROM venue_gallery vg
  //             WHERE vg.child_venue_id = cv.child_venue_id
  //             ORDER BY vg.id ASC
  //             LIMIT 1
  //         ) AS image,

  //         /* Gallery */
  //         (
  //             SELECT JSON_ARRAYAGG(vg.attachment)
  //             FROM venue_gallery vg
  //             WHERE vg.child_venue_id = cv.child_venue_id
  //         ) AS gallery,

  //         (
  //             COUNT(DISTINCT b.id) * 5 +
  //             (COALESCE(SUM(b.total_amount), 0) / 10000) +
  //             (COALESCE(vp.rating, 5) * 20) +
  //             CASE
  //                 WHEN MAX(b.created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 20
  //                 WHEN MAX(b.created_at) >= DATE_SUB(CURDATE(), INTERVAL 90 DAY) THEN 10
  //                 ELSE 0
  //             END
  //         ) AS recommendation_score

  //     FROM venue_child cv

  //     LEFT JOIN booking_venues bv
  //         ON bv.child_venue_id = cv.child_venue_id

  //     LEFT JOIN bookings b
  //         ON b.id = bv.booking_id
  //         AND b.status IN (0,1)

  //     LEFT JOIN venue_parent vp
  //         ON vp.parent_venue_id = cv.parent_venue_id

  // LEFT JOIN property_likes pls
  //         ON pls.property_id = cv.child_venue_id
  //         AND pls.user_id = ?

  //     WHERE
  //         cv.publish_status = 1
  //         AND vp.venue_state = ?

  //     GROUP BY
  //         cv.child_venue_id,
  //         cv.child_venue_name,
  //         vp.venue_city,
  //         vp.rating,
  //         vp.user_ratings_total

  //     ORDER BY recommendation_score DESC

  //     LIMIT 10
  //     `,
  //     [state],
  //   );

  //   return recommeded;
  // }
  async recommeded_property(state: string, category: string) {
    const singular = category.endsWith('s') ? category.slice(0, -1) : category;
    const recommeded = await this.dataSource.query(
      `
    SELECT
        cv.child_venue_id,
        cv.child_venue_name AS name,
        vp.venue_city AS location,
        COALESCE(vp.rating, 5) AS rating,
        vp.user_ratings_total AS reviews,

        COUNT(DISTINCT b.id) AS total_bookings,

        COALESCE(SUM(b.total_amount), 0) AS revenue,

        MAX(b.created_at) AS last_booking,

        IF(MAX(pls.id) IS NULL, 0, 1) AS isLiked,

        /* Cover Image */
        (
            SELECT vg.attachment
            FROM venue_gallery vg
            WHERE vg.child_venue_id = cv.child_venue_id
            ORDER BY vg.id ASC
            LIMIT 1
        ) AS image,

        /* Gallery */
        (
            SELECT JSON_ARRAYAGG(vg.attachment)
            FROM venue_gallery vg
            WHERE vg.child_venue_id = cv.child_venue_id
        ) AS gallery,

        (
            COUNT(DISTINCT b.id) * 5 +
            (COALESCE(SUM(b.total_amount), 0) / 10000) +
            (COALESCE(vp.rating, 5) * 20) +
            CASE
                WHEN MAX(b.created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 20
                WHEN MAX(b.created_at) >= DATE_SUB(CURDATE(), INTERVAL 90 DAY) THEN 10
                ELSE 0
            END
        ) AS recommendation_score

    FROM venue_child cv

    LEFT JOIN booking_venues bv
        ON bv.child_venue_id = cv.child_venue_id

    LEFT JOIN bookings b
        ON b.id = bv.booking_id
        AND b.status IN (0,1)

    LEFT JOIN venue_parent vp
        ON vp.parent_venue_id = cv.parent_venue_id

    LEFT JOIN property_likes pls
        ON pls.property_id = cv.child_venue_id
        AND pls.user_id = cv.created_at

    WHERE
        cv.publish_status = 1
        AND vp.venue_state = ?
        AND vp.propety_category = ?

    GROUP BY
        cv.child_venue_id,
        cv.child_venue_name,
        vp.venue_city,
        vp.rating,
        vp.user_ratings_total

    ORDER BY recommendation_score DESC

    LIMIT 10
    `,
      [state, singular],
    );

    return recommeded;
  }

  async getNearbyCities(state: string) {
    const sql = `
    SELECT
      id,
      name,
      slug,
      image,
      latitude,
      longitude,
      district,
      popularity_score
    FROM destinations
    WHERE status = 1 AND state =?
    ORDER BY popularity_score DESC
    LIMIT 5
  `;

    return this.dataSource.query(sql, [state]);
  }
async find_your_tier(uid: number) {
  // Get booking count & amount
  const [booking] = await this.dataSource.query(
    `
    SELECT
      COUNT(*) AS booking_count,
      COALESCE(SUM(total_amount), 0) AS booking_amount
    FROM bookings
    WHERE selection_mode = 'Online'
      AND booking_type = 'booked'
      AND created_by = ?
    `,
    [uid],
  );

  const bookingCount = Number(booking.booking_count);
  const bookingAmount = Number(booking.booking_amount);

  // Get all tiers
  const tiers = await this.dataSource.query(
    `
    SELECT *
    FROM member_tier
    ORDER BY max_booking ASC
    `,
  );

  let currentTier = tiers[0] || null;

  for (const tier of tiers) {
    const maxBooking = Number(tier.max_booking);
    const bookAmount = Number(tier.book_amount);

    // Diamond
    if (tier.name === 'Diamond') {
      if (
        bookingCount >= maxBooking ||
        bookingAmount >= bookAmount
      ) {
        currentTier = tier;
      }
    }

    // Other tiers: ONLY max_booking
    else if (bookingCount <= maxBooking) {
      currentTier = tier;
      break;
    }
  }

  return {
    bookingCount,
    bookingAmount,
    tier: currentTier,
  };
}

async searchVenues(dto: any) {
  const {
    search = "",
    city = "",
    lat,
    lng,
    category,
  } = dto;

  const params: any[] = [];

  let sql = `
    SELECT
      vc.child_venue_id as id,
      vc.parent_venue_id,
      vc.child_venue_name as name,
      vc.venue_category_id,
      vc.publish_status,
      vc.publish,

      vp.venue_name,
      vp.venue_company_name,
      vp.venue_address,
      vp.venue_country,
      vp.venue_state,
      vp.venue_city,
      vp.venue_pincode,
      vp.district,
      vp.lat,
      vp.lng,
      vp.rating,
      vp.reviews,
      vp.user_ratings_total,
      vp.logo,
      vp.propety_category

    FROM venue_child vc

    INNER JOIN venue_parent vp
      ON vp.parent_venue_id = vc.parent_venue_id

    WHERE 1 = 1
  `;

  // Only published venues
  sql += `
    AND vc.publish_status = 1
  `;

  sql += `
    AND vp.publish_status = 1
  `;

  // Venue name search
  if (search.trim()) {
    sql += `
      AND (
        vc.child_venue_name LIKE ?
        OR vp.venue_name LIKE ?
        OR vp.venue_company_name LIKE ?
      )
    `;

    const searchValue = `%${search.trim()}%`;

    params.push(
      searchValue,
      searchValue,
      searchValue,
    );
  }

  // Location-wise search
  if (city.trim()) {
    sql += `
      AND (
        vp.venue_city LIKE ?
        OR vp.district LIKE ?
      )
    `;

    const cityValue = `%${city.trim()}%`;

    params.push(
      cityValue,
      cityValue,
    );
  }

  // Category filter
  if (category) {
    sql += `
      AND (
        vp.propety_category = ?
        OR vc.venue_category_id = ?
      )
    `;

    params.push(
      category,
      category,
    );
  }

  sql += `
    ORDER BY
      vp.sponsered DESC,
      vp.rating DESC,
      vc.child_venue_name ASC

    LIMIT 40
  `;

  const rows = await this.dataSource.query(sql, params);

  return {
    success: true,
    data: rows,
  };
}
}
