import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Not, IsNull } from 'typeorm';

import { VenueChild } from '../../modules/listing/entities/venue-child.entity';

@Injectable()
export class VenueDetailService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(VenueChild)
    private readonly childRepo: Repository<VenueChild>,
  ) {}
// async getVenuesDetailData(country: any, id: any) {
//   const bucketUrl = process.env.PUBLIC_AWS_BUCKET_URL;

//   const result = await this.dataSource.query(
//     `
//     SELECT
//       CASE
//         WHEN attachment IS NOT NULL AND attachment <> ''
//         THEN CONCAT(TRIM(TRAILING '/' FROM ?), '/', TRIM(LEADING '/' FROM attachment))
//         ELSE NULL
//       END AS attachment
//     FROM venue_gallery
//     WHERE child_venue_id = ?
//     `,
//     [bucketUrl, id],
//   );  
  
// const categories = await this.dataSource.query(
//   `
//   SELECT
//       gc.id,
//       gc.name AS title,
//       COUNT(vg.id) AS count
//   FROM venue_gallery_category gc
//   LEFT JOIN venue_gallery vg
//       ON vg.g_category = gc.id
//   WHERE gc.child_id = ?
//   GROUP BY gc.id, gc.name
//   ORDER BY gc.id
//   `,
//   [id]
// );

// const sectionConfig = categories.map((item, index) => ({
//   label: String(index + 1).padStart(2, "0"),
//   title: item.title,
//   count: Number(item.count),
// }));
// const gallery=  result.map((item) => item.attachment).filter(Boolean);


// const [venues] = await this.dataSource.query(
// `
// SELECT
//     vc.*,
//     vp.*,

//     -- Min Price
//     CASE
//         WHEN vp.propety_category = 'farmstay' THEN (
//             SELECT amount
//             FROM property_pricing
//             WHERE child_venue_id = vc.child_venue_id
//               AND enabled = 1
//               AND pricing_key = 'nightly'
//             LIMIT 1
//         )
//         ELSE (
//             SELECT MIN(vst.price)
//             FROM venue_shift_timing vst
//             WHERE vst.child_venue_id = vc.child_venue_id
//         )
//     END AS minPrice,

//     -- Farmstay pricing
//     (
//         SELECT amount
//         FROM property_pricing
//         WHERE child_venue_id = vc.child_venue_id
//           AND enabled = 1
//           AND pricing_key = 'nightly'
//         LIMIT 1
//     ) AS nightly_amount,

//     (
//         SELECT amount
//         FROM property_pricing
//         WHERE child_venue_id = vc.child_venue_id
//           AND enabled = 1
//           AND pricing_key = 'weekly'
//         LIMIT 1
//     ) AS weekly_amount,

//     (
//         SELECT amount
//         FROM property_pricing
//         WHERE child_venue_id = vc.child_venue_id
//           AND enabled = 1
//           AND pricing_key = 'cleaning_fee'
//         LIMIT 1
//     ) AS cleaning_amount,

//     (
//         SELECT amount
//         FROM property_pricing
//         WHERE child_venue_id = vc.child_venue_id
//           AND enabled = 1
//           AND pricing_key = 'extendedStayDiscount'
//         LIMIT 1
//     ) AS extended_discount,

//     (
//         SELECT amount
//         FROM property_pricing
//         WHERE child_venue_id = vc.child_venue_id
//           AND enabled = 1
//           AND pricing_key = 'extra_person'
//         LIMIT 1
//     ) AS extra_person_amount

// FROM venue_child vc
// LEFT JOIN venue_parent vp
//     ON vp.parent_venue_id = vc.parent_venue_id

// WHERE vc.child_venue_id = ?
// LIMIT 1
// `,
// [id],
// );
// const shifts = await this.dataSource.query(
//   `
//   SELECT
//       LOWER(REPLACE(vsh.name, ' ', '')) AS id,
//       vsh.name AS label,
//       CONCAT(
//           DATE_FORMAT(MIN(vst.from_time), '%h:%i %p'),
//           ' – ',
//           DATE_FORMAT(MAX(vst.to_time), '%h:%i %p')
//       ) AS time,
//       MIN(vst.price) AS price
//   FROM venue_shift_header vsh
//   LEFT JOIN venue_shift_timing vst
//       ON vst.shift_type = vsh.shift_type
//      AND vst.child_venue_id = vsh.child_id
//   WHERE vsh.child_id = ?
//   GROUP BY
//       vsh.id,
//       vsh.name,
//       vsh.shift_type
//   ORDER BY vsh.id
//   `,
//   [id],
// );

// const iconMap = {
//   morning: "Sunrise",
//   afternoon: "Sun",
//   evening: "Moon",
//   fullday: "CalendarDays",
// };



// const shiftData = shifts.map((shift) => ({
//   id: shift.id,
//   label: shift.label,
//   time: shift.time,
//   icon: iconMap[shift.id] || "Clock",
//   price: shift.price,
// }));


// //Booking CHECK

// const bookingShifts = await this.dataSource.query(
// `
// SELECT
//     DATE_FORMAT(bed.event_date, '%Y-%m-%d') AS event_date,

//     CASE
//         WHEN b.category = 1
//         THEN LOWER(REPLACE(bs.shift_name, ' ', ''))
//         ELSE 'fullday'
//     END AS shift_name,

//     bs.status,
//     b.booking_type,
//     b.category
// FROM bookings b
// INNER JOIN booking_event_dates bed
//     ON bed.booking_id = b.id
// INNER JOIN booking_venues bv
//     ON bv.booking_id = b.id
// LEFT JOIN booking_shifts bs
//     ON bs.booking_id = b.id
//     AND bs.event_date_id = bed.id
// WHERE bv.child_venue_id = ?
// `,
// [id]
// );
// const shiftTypes = ["morning", "afternoon", "evening"];

// const SHIFT_STATUS: Record<string, Record<string, string>> = {};
// const fullyBookedDates: string[] = [];
// const partiallyBookedDates: string[] = [];

// for (const row of bookingShifts) {
//   const date = row.event_date;

//   if (!SHIFT_STATUS[date]) {
//     SHIFT_STATUS[date] = Object.fromEntries(
//       shiftTypes.map((shift) => [shift, "available"])
//     );
//   }

//   if (Number(row.category) === 1) {
//     // Venue - mark only the booked shift
//     if (row.shift_name) {
//       SHIFT_STATUS[date][row.shift_name] =
//         row.booking_type.toLowerCase();
//     }
//   } else {
//     // Farmstay / Other - entire day booked
//     fullyBookedDates.push(date);

//     shiftTypes.forEach((shift) => {
//       SHIFT_STATUS[date][shift] = row.booking_type.toLowerCase();
//     });
//   }
// }

// // Only calculate venue bookings
// for (const [date, shifts] of Object.entries(SHIFT_STATUS)) {
//   // Skip dates already marked as fully booked (farmstay)
//   if (fullyBookedDates.includes(date)) continue;

//   const bookedCount = shiftTypes.filter(
//     (shift) => shifts[shift] !== "available"
//   ).length;

//   if (bookedCount === shiftTypes.length) {
//     fullyBookedDates.push(date);
//   } else if (bookedCount > 0) {
//     partiallyBookedDates.push(date);
//   }
// }

// // Amenties

// const amenities = await this.dataSource.query(
//     `
//     SELECT *  
//     FROM venue_child_amenities vca 
//     LEFT JOIN amenities a ON a.id = vca.amenities_id
//     LEFT JOIN amenities_categories ac ON ac.id = a.amenities_category_id
//     WHERE child_venue_id = ? 
//     `,
//     [id],
//   ); 

//   const amenitiesList = amenities.map(item => item.name);

//   const groupedAmenities = Object.values(
//   amenities.reduce((acc, item) => {
//     const heading = item.category || "Other";

//     if (!acc[heading]) {
//       acc[heading] = {
//         heading,
//         items: [],
//       };
//     }

//     acc[heading].items.push(item.name);

//     return acc;
//   }, {})
// );

// //EVENT
// const events = await this.dataSource.query(
//     `
//     SELECT *  
//     FROM venue_event_tags vet 
//     LEFT JOIN booking_event_types bet ON bet.id = vet.event_id
//     WHERE child_venue_id = ? 
//     `,
//     [id],
//   ); 

// //Settings
// const venue_settings = await this.dataSource.query(
//     `
//     SELECT *  
//     FROM venue_child_settings vcs 
//     WHERE child_id = ? 
//     `,
//     [id],
//   ); 



// return {
//   gallery:gallery,
//   category : sectionConfig,
//   venues : venues,
//   shifts : shiftData,
//   SHIFT_STATUS : SHIFT_STATUS,
//   Amenities : amenitiesList,
//   Amenitiesgroup  : groupedAmenities,
//   events  : events,
//   venue_settings  : venue_settings,
//    fullyBookedDates,
//   partiallyBookedDates,
// }
  
// }
async getVenuesDetailData(country: any, id: any) {
  const bucketUrl = process.env.PUBLIC_AWS_BUCKET_URL;

  // ── Step 0: figure out whether this id is a registered (venue_child)
  // or unregistered (unrigistered_venues) property. Everything below
  // branches off this, since shifts/amenities/categories/bookings only
  // exist for registered venues.
  const [registeredCheck] = await this.dataSource.query(
    `SELECT child_venue_id FROM venue_child WHERE child_venue_id = ? LIMIT 1`,
    [id],
  );

  const isRegistered = !!registeredCheck;

  // ─────────────────────────────────────────────────────────────
  // UNREGISTERED VENUE PATH — no shifts/amenities/categories/bookings
  // exist for these, so we return the same response shape with those
  // sections empty rather than querying tables that don't apply.
  // ─────────────────────────────────────────────────────────────
  if (!isRegistered) {
    const [unregVenue] = await this.dataSource.query(
      `
      SELECT
        CAST(uv.id AS CHAR) AS childVenueId,
        CAST(uv.id AS CHAR) AS parentVenueId,
        uv.name              AS venue_name,
        uv.name              AS child_venue_name,
        uv.name              AS parentVenueName,
        uv.address              AS venue_address,
        uv.city ,
        uv.state,
        uv.country,
        uv.lat,
        uv.lng,
        0                    AS maxGuests,
        0                    AS bedrooms,
        uv.name              AS venueType,
         'venue'             AS category,
         'venue'             AS venue_mode,
        uv.rating            AS rating,
        uv.user_ratings_total   ,
        0                    AS minPrice,
        'unregitered'        AS property
      FROM unrigistered_venues uv
      WHERE uv.id = ?
      LIMIT 1
      `,
      [id],
    );

    const unregGallery = await this.dataSource.query(
      `
      SELECT
        CASE
          WHEN ug.images IS NOT NULL AND ug.images <> ''
          THEN CONCAT(TRIM(TRAILING '/' FROM ?), '/', TRIM(LEADING '/' FROM ug.images))
          ELSE NULL
        END AS attachment
      FROM unrigistered_gallery ug
      WHERE ug.unreg_id = ?
      ORDER BY ug.id
      `,
      [bucketUrl, id],
    );

    const staticImages = [
  `https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR2jZ8sQroZAExxaFjQ8NQoIuKw0gggqGACS5ji8tMOhg&s`,
  `https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR2jZ8sQroZAExxaFjQ8NQoIuKw0gggqGACS5ji8tMOhg&s`,
  `https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR2jZ8sQroZAExxaFjQ8NQoIuKw0gggqGACS5ji8tMOhg&s`,
  `https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR2jZ8sQroZAExxaFjQ8NQoIuKw0gggqGACS5ji8tMOhg&s`,
  `https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR2jZ8sQroZAExxaFjQ8NQoIuKw0gggqGACS5ji8tMOhg&s`,
];

// Add static images until there are 4
while (unregGallery.length < 4) {
  unregGallery.push({
    attachment: staticImages[unregGallery.length],
  });
}

    const gallery = unregGallery.map((item) => item.attachment).filter(Boolean);

return {
  gallery,
  category: [],
  venues: unregVenue ?? null,
  shifts: [
    {
      id: "morning",
      label: "Morning",
      time: "06:00 AM – 12:00 PM",
      icon: "Sunrise",
      price: 25000,
    },
    {
      id: "afternoon",
      label: "Afternoon",
      time: "12:00 PM – 05:00 PM",
      icon: "Sun",
      price: 35000,
    },
    {
      id: "evening",
      label: "Evening",
      time: "05:00 PM – 11:00 PM",
      icon: "Moon",
      price: 35000,
    },
  ],
  SHIFT_STATUS: {
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
  },
  Amenities: [],
  Amenitiesgroup: [],
  events: [],
  venue_settings: [],
  fullyBookedDates: [],
  partiallyBookedDates: [],
};
  }

  // ─────────────────────────────────────────────────────────────
  // REGISTERED VENUE PATH — your original logic, unchanged
  // ─────────────────────────────────────────────────────────────
  const result = await this.dataSource.query(
    `
    SELECT
      CASE
        WHEN attachment IS NOT NULL AND attachment <> ''
        THEN CONCAT(TRIM(TRAILING '/' FROM ?), '/', TRIM(LEADING '/' FROM attachment))
        ELSE NULL
      END AS attachment
    FROM venue_gallery
    WHERE child_venue_id = ?
    `,
    [bucketUrl, id],
  );

  const categories = await this.dataSource.query(
    `
    SELECT
        gc.id,
        gc.name AS title,
        COUNT(vg.id) AS count
    FROM venue_gallery_category gc
    LEFT JOIN venue_gallery vg
        ON vg.g_category = gc.id
    WHERE gc.child_id = ?
    GROUP BY gc.id, gc.name
    ORDER BY gc.id
    `,
    [id],
  );

  const sectionConfig = categories.map((item, index) => ({
    label: String(index + 1).padStart(2, "0"),
    title: item.title,
    count: Number(item.count),
  }));
  const gallery = result.map((item) => item.attachment).filter(Boolean);

  const [venues] = await this.dataSource.query(
    `
    SELECT
        vc.*,
        vp.*,
'regitered'        AS property,
        -- Min Price
        CASE
            WHEN vp.propety_category = 'farmstay' THEN (
                SELECT amount
                FROM property_pricing
                WHERE child_venue_id = vc.child_venue_id
                  AND enabled = 1
                  AND pricing_key = 'nightly'
                LIMIT 1
            )
            ELSE (
                SELECT MIN(vst.price)
                FROM venue_shift_timing vst
                WHERE vst.child_venue_id = vc.child_venue_id
            )
        END AS minPrice,

        -- Farmstay pricing
        (
            SELECT amount
            FROM property_pricing
            WHERE child_venue_id = vc.child_venue_id
              AND enabled = 1
              AND pricing_key = 'nightly'
            LIMIT 1
        ) AS nightly_amount,

        (
            SELECT amount
            FROM property_pricing
            WHERE child_venue_id = vc.child_venue_id
              AND enabled = 1
              AND pricing_key = 'weekly'
            LIMIT 1
        ) AS weekly_amount,

        (
            SELECT amount
            FROM property_pricing
            WHERE child_venue_id = vc.child_venue_id
              AND enabled = 1
              AND pricing_key = 'cleaning_fee'
            LIMIT 1
        ) AS cleaning_amount,

        (
            SELECT amount
            FROM property_pricing
            WHERE child_venue_id = vc.child_venue_id
              AND enabled = 1
              AND pricing_key = 'extendedStayDiscount'
            LIMIT 1
        ) AS extended_discount,

        (
            SELECT amount
            FROM property_pricing
            WHERE child_venue_id = vc.child_venue_id
              AND enabled = 1
              AND pricing_key = 'extra_person'
            LIMIT 1
        ) AS extra_person_amount

    FROM venue_child vc
    LEFT JOIN venue_parent vp
        ON vp.parent_venue_id = vc.parent_venue_id

    WHERE vc.child_venue_id = ?
    LIMIT 1
    `,
    [id],
  );

  const shifts = await this.dataSource.query(
    `
    SELECT
        LOWER(REPLACE(vsh.name, ' ', '')) AS id,
        vsh.name AS label,
        CONCAT(
            DATE_FORMAT(MIN(vst.from_time), '%h:%i %p'),
            ' – ',
            DATE_FORMAT(MAX(vst.to_time), '%h:%i %p')
        ) AS time,
        MIN(vst.price) AS price
    FROM venue_shift_header vsh
    LEFT JOIN venue_shift_timing vst
        ON vst.shift_type = vsh.shift_type
       AND vst.child_venue_id = vsh.child_id
    WHERE vsh.child_id = ?
    GROUP BY
        vsh.id,
        vsh.name,
        vsh.shift_type
    ORDER BY vsh.id
    `,
    [id],
  );

  const iconMap = {
    morning: "Sunrise",
    afternoon: "Sun",
    evening: "Moon",
    fullday: "CalendarDays",
  };

  const shiftData = shifts.map((shift) => ({
    id: shift.id,
    label: shift.label,
    time: shift.time,
    icon: iconMap[shift.id] || "Clock",
    price: shift.price,
  }));

  // Booking check
  const bookingShifts = await this.dataSource.query(
    `
    SELECT
        DATE_FORMAT(bed.event_date, '%Y-%m-%d') AS event_date,

        CASE
            WHEN b.category = 1
            THEN LOWER(REPLACE(bs.shift_name, ' ', ''))
            ELSE 'fullday'
        END AS shift_name,

        bs.status,
        b.booking_type,
        b.category
    FROM bookings b
    INNER JOIN booking_event_dates bed
        ON bed.booking_id = b.id
    INNER JOIN booking_venues bv
        ON bv.booking_id = b.id
    LEFT JOIN booking_shifts bs
        ON bs.booking_id = b.id
        AND bs.event_date_id = bed.id
    WHERE bv.child_venue_id = ?  AND b.booking_type IN ('booked', 'reserve')
    `,
    [id],
  );

  const shiftTypes = ["morning", "afternoon", "evening"];

  const SHIFT_STATUS: Record<string, Record<string, string>> = {};
  const fullyBookedDates: string[] = [];
  const partiallyBookedDates: string[] = [];

  for (const row of bookingShifts) {
    const date = row.event_date;

    if (!SHIFT_STATUS[date]) {
      SHIFT_STATUS[date] = Object.fromEntries(
        shiftTypes.map((shift) => [shift, "available"]),
      );
    }

    if (Number(row.category) === 1) {
      if (row.shift_name) {
        SHIFT_STATUS[date][row.shift_name] = row.booking_type.toLowerCase();
      }
    } else {
      fullyBookedDates.push(date);
      shiftTypes.forEach((shift) => {
        SHIFT_STATUS[date][shift] = row.booking_type.toLowerCase();
      });
    }
  }

  for (const [date, shiftMap] of Object.entries(SHIFT_STATUS)) {
    if (fullyBookedDates.includes(date)) continue;

    const bookedCount = shiftTypes.filter(
      (shift) => shiftMap[shift] !== "available",
    ).length;

    if (bookedCount === shiftTypes.length) {
      fullyBookedDates.push(date);
    } else if (bookedCount > 0) {
      partiallyBookedDates.push(date);
    }
  }

  // Amenities
  const amenities = await this.dataSource.query(
    `
    SELECT *
    FROM venue_child_amenities vca
    LEFT JOIN amenities a ON a.id = vca.amenities_id
    LEFT JOIN amenities_categories ac ON ac.id = a.amenities_category_id
    WHERE child_venue_id = ?
    `,
    [id],
  );

  const amenitiesList = amenities.map((item) => item.name);

  const groupedAmenities = Object.values(
    amenities.reduce((acc, item) => {
      const heading = item.category || "Other";
      if (!acc[heading]) {
        acc[heading] = { heading, items: [] };
      }
      acc[heading].items.push(item.name);
      return acc;
    }, {}),
  );

  // Events
  const events = await this.dataSource.query(
    `
    SELECT *
    FROM venue_event_tags vet
    LEFT JOIN booking_event_types bet ON bet.id = vet.event_id
    WHERE child_venue_id = ?
    `,
    [id],
  );

  // Settings
  const venue_settings = await this.dataSource.query(
    `
    SELECT *
    FROM venue_child_settings vcs
    WHERE child_id = ?
    `,
    [id],
  );

  return {
    gallery,
    category: sectionConfig,
    venues,
    shifts: shiftData,
    SHIFT_STATUS,
    Amenities: amenitiesList,
    Amenitiesgroup: groupedAmenities,
    events,
    venue_settings,
    fullyBookedDates,
    partiallyBookedDates,
  };
}



async loadAddons(country: any, body: any) 
{

  const result = await this.dataSource.query(
    `SELECT *
    FROM venue_addon LEFT JOIN add_ons ON add_ons.add_on_id = venue_addon.addon_id
    WHERE venue_addon.child_venue_id = ?`,[body.id]);

    return result;
  
}

}
