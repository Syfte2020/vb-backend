import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Not, IsNull } from 'typeorm';

import { VenueChild } from '../../modules/listing/entities/venue-child.entity';

import {
  generateCode
} from '../../common/utils/code-generator';

import { sentEnquireEmail } from '../invoice/email/mail.service';

@Injectable()
export class VenueDetailService {
  constructor(
    private dataSource: DataSource,
    // private invoiceService: InvoiceService,
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
async getVenuesDetailData(country: any, id: any,category: any) {

    const singular = category.endsWith("s")
    ? category.slice(0, -1)
    : category;

  const [categorys] = await this.dataSource.query(
    `SELECT id FROM category WHERE name = ? LIMIT 1`,
    [singular],
  );

  if (!categorys) {
    return [];
  }

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
        SELECT pp.amount
        FROM property_pricing pp
        WHERE pp.child_venue_id = vc.child_venue_id
          AND pp.enabled = 1
          AND pp.pricing_key = 'nightly'
        LIMIT 1
    )
    ELSE (
         SELECT MIN(vst.price)
    FROM venue_shift_timing vst
    WHERE vst.child_venue_id = vc.child_venue_id
      AND vst.price > 0
      AND EXISTS (
          SELECT 1
          FROM venue_shift_header vsh
          WHERE vsh.child_id = vst.child_venue_id
            AND vsh.publish = 1
      )
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


  

    const venue_seating_styles = await this.dataSource.query(
    `
    SELECT *
    FROM venue_seating_styles vss
    WHERE vss.venue_id = ?
    `,
    [id],
  );

    const venue_policies = await this.dataSource.query(
    `
    SELECT *
    FROM venue_policies vp
    WHERE vp.venue_id = ?
    `,
    [id],
  );

    const venue_terms_condition = await this.dataSource.query(
    `
    SELECT *
    FROM venue_terms_condition vtc
    WHERE child_venue_id = ?
    `,
    [id],
  );

  const guest_love_this_place = await this.dataSource.query(
    `
    SELECT *
    FROM venue_guest_love_features vglf 
    LEFT JOIN guest_love_features gvf ON gvf.id = vglf.feature_id
    WHERE vglf.venue_id = ?
    `,
    [id],
  );

  const nearbyplaces = await this.dataSource.query(
  `
  SELECT
    nvp.*,
    CASE
      WHEN nvp.photo_url IS NOT NULL AND nvp.photo_url != ''
      THEN CONCAT(?, nvp.photo_url)
      ELSE NULL
    END AS photo_url
  FROM venue_nearby_places nvp
  WHERE nvp.venue_id = ?
  `,
  [process.env.PUBLIC_AWS_BUCKET_URL + '/', id],
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
    WHERE vsh.child_id = ? AND vsh.publish = 1
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

//   // Booking check
//   const bookingShifts = await this.dataSource.query(
//     `
//     SELECT
//         DATE_FORMAT(bed.event_date, '%Y-%m-%d') AS event_date,

//         CASE
//             WHEN b.category = 1
//             THEN LOWER(REPLACE(bs.shift_name, ' ', ''))
//             ELSE 'fullday'
//         END AS shift_name,

//         bs.status,
//         b.booking_type,
//         b.category
//     FROM bookings b
//     INNER JOIN booking_event_dates bed
//         ON bed.booking_id = b.id
//     INNER JOIN booking_venues bv
//         ON bv.booking_id = b.id
//     LEFT JOIN booking_shifts bs
//         ON bs.booking_id = b.id
//         AND bs.event_date_id = bed.id
//     WHERE bv.child_venue_id = ?  AND b.booking_type IN ('booked', 'reserve')
//     `,
//     [id],
//   );

//   const shiftTypes = ["morning", "afternoon", "evening"];

//   const SHIFT_STATUS: Record<string, Record<string, string>> = {};
//   const fullyBookedDates: string[] = [];
//   const partiallyBookedDates: string[] = [];

//   for (const row of bookingShifts) {
//     const date = row.event_date;

//     if (!SHIFT_STATUS[date]) {
//       SHIFT_STATUS[date] = Object.fromEntries(
//         shiftTypes.map((shift) => [shift, "available"]),
//       );
//     }

//     if (Number(row.category) === 1) {
//       if (row.shift_name!=='Full Day') {
//         SHIFT_STATUS[date][row.shift_name] = row.booking_type.toLowerCase();
//       }
//       else if (row.shift_name==='Full Day')
//       {
// fullyBookedDates.push(date);
//  shiftTypes.forEach((shift) => {
//         SHIFT_STATUS[date][shift] = row.booking_type.toLowerCase();
//       });
//       }
//     } else {
//       fullyBookedDates.push(date);
//       shiftTypes.forEach((shift) => {
//         SHIFT_STATUS[date][shift] = row.booking_type.toLowerCase();
//       });
//     }
//   }

//   for (const [date, shiftMap] of Object.entries(SHIFT_STATUS)) {
//     if (fullyBookedDates.includes(date)) continue;

//     const bookedCount = shiftTypes.filter(
//       (shift) => shiftMap[shift] !== "available",
//     ).length;

//     if (bookedCount === shiftTypes.length) {
//       fullyBookedDates.push(date);
//     } else if (bookedCount > 0) {
//       partiallyBookedDates.push(date);
//     }
//   }
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
  WHERE bv.child_venue_id = ?
    AND b.booking_type IN ('booked', 'reserve')
  `,
  [id],
);

const shiftTypes = ["morning", "afternoon", "evening"];

const SHIFT_STATUS: Record<
  string,
  {
    morning: string;
    afternoon: string;
    evening: string;
  }
> = {};

const fullyBookedDates: string[] = [];
const partiallyBookedDates: string[] = [];

for (const row of bookingShifts) {
  const date = row.event_date;
  const bookingType = row.booking_type.toLowerCase(); // booked | reserve
  const shiftName = (row.shift_name || "").toLowerCase();

  if (!SHIFT_STATUS[date]) {
    SHIFT_STATUS[date] = {
      morning: "available",
      afternoon: "available",
      evening: "available",
    };
  }

  // Event Booking (Morning / Afternoon / Evening / Full Day)
  if (Number(row.category) === 1) {
    if (shiftName === "fullday") {
      shiftTypes.forEach((shift) => {
        SHIFT_STATUS[date][shift] = bookingType;
      });
    } else if (shiftTypes.includes(shiftName)) {
      SHIFT_STATUS[date][shiftName] = bookingType;
    }
  }
  // Stay Booking (always full day)
  else {
    shiftTypes.forEach((shift) => {
      SHIFT_STATUS[date][shift] = bookingType;
    });
  }
}

// Find Fully / Partially Booked Dates
for (const [date, shiftMap] of Object.entries(SHIFT_STATUS)) {
  const statuses = shiftTypes.map((shift) => shiftMap[shift]);

  // All shifts booked
  if (statuses.every((status) => status === "booked")) {
    fullyBookedDates.push(date);
  }
  // At least one shift booked/reserved
  else if (
    statuses.some(
      (status) => status === "booked" || status === "reserve",
    )
  ) {
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

// Settings categorys.id
  const user_subscriptions = await this.dataSource.query(
    `
    SELECT *
    FROM user_subscriptions us
    WHERE user_id = ? AND  country_id = ? AND category_id = ?
    `,
    [venues.created_by,country,2],
  );

  //---------------------------------------------
// Gallery
//---------------------------------------------
const categoryGallery = await this.dataSource.query(
  `
  SELECT
      gc.id,
      gc.name AS title,
      vg.id AS imageId,
      CASE
          WHEN vg.attachment IS NOT NULL
               AND vg.attachment <> ''
          THEN CONCAT(
              TRIM(TRAILING '/' FROM ?),
              '/',
              TRIM(LEADING '/' FROM vg.attachment)
          )
          ELSE NULL
      END AS attachment
  FROM venue_gallery_category gc
  LEFT JOIN venue_gallery vg
      ON vg.g_category = gc.id
  WHERE gc.child_id = ?
  ORDER BY gc.id, vg.id
  `,
  [bucketUrl, id],
);

const galleryMap = new Map();

for (const row of categoryGallery) {
  if (!galleryMap.has(row.id)) {
    galleryMap.set(row.id, {
      id: row.id,
      title: row.title,
      images: [],
    });
  }

  if (row.attachment) {
    galleryMap.get(row.id).images.push({
      id: row.imageId,
      attachment: row.attachment,
    });
  }
}

const categoryWiseGallery = [...galleryMap.values()];

/* ---------------------------------------------
   Additional Images (No Category)
--------------------------------------------- */

const uncategorizedGallery = await this.dataSource.query(
  `
  SELECT
      vg.id AS imageId,
      CASE
          WHEN vg.attachment IS NOT NULL
               AND vg.attachment <> ''
          THEN CONCAT(
              TRIM(TRAILING '/' FROM ?),
              '/',
              TRIM(LEADING '/' FROM vg.attachment)
          )
          ELSE NULL
      END AS attachment
  FROM venue_gallery vg
  WHERE vg.child_venue_id = ?
    AND (
        vg.g_category IS NULL
        OR vg.g_category NOT IN (
            SELECT id
            FROM venue_gallery_category
            WHERE child_id = ?
        )
    )
  ORDER BY vg.id
  `,
  [bucketUrl, id, id],
);

const additionalImages = uncategorizedGallery
  .filter((row) => row.attachment)
  .map((row) => ({
    id: row.imageId,
    attachment: row.attachment,
  }));

if (additionalImages.length) {
  categoryWiseGallery.push({
    id: 0,
    title: "Additional Images",
    images: additionalImages,
  });
}
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
  user_subscriptions,
  categoryWiseGallery,
  venue_seating_styles,
  venue_terms_condition,
  venue_policies,
  guest_love_this_place,
  nearbyplaces
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

async sendEnquiry(category: any, country: any,dto: any,id: any) {

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
  const eventRows: any = await this.dataSource.query(
    `SELECT id FROM booking_event_types WHERE event_name = ? LIMIT 1`,
    [dto.eventType],
  );
  

   //Find Which Vendor Under 
     const [vendor_detial] = await this.dataSource.query(
      `SELECT created_by FROM venue_child WHERE child_venue_id = ? LIMIT 1`,
      [dto.venueId],
    );

  const eventTypeId = eventRows.length ? eventRows[0].id : null;

const result: any = await this.dataSource.query(
  `
  INSERT INTO bookings
  (
    booking_code,
    booking_type,
    category,
    country_id,
    status,
    total_pax,
    booking_event_type_id,
    created_at,
    updated_at,
    selection_mode,
    selection_type,
    vendor_id,
    created_by,
    updated_by
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?, ?, ?)
  `,
  [
    code,
    "enquiry",
    categoryRow?.id ?? null,
    country,
    "active",
    dto.guests,
    eventTypeId,
    "Online",
    "Online",
    vendor_detial.created_by,// Venue create by vendor ID,
    id,
    id,
  ]
);

  const bookingId = result.insertId;

  await this.dataSource.query(
    `
    INSERT INTO booking_venues
    (
      booking_id,
      child_venue_id,
      venue_name_snapshot
    )
    VALUES (?, ?, ?)
    `,
    [
      bookingId,
      dto.venueId,
      dto.venueName,
    ],
  );

  await this.dataSource.query(
    `
    INSERT INTO booking_event_dates
    (
      booking_id,
      event_date
    )
    VALUES (?, ?)
    `,
    [
      bookingId,
      dto.date,
    ],
  );

  await this.dataSource.query(
    `
    INSERT INTO booking_shifts
    (
      booking_id,
      event_date_id,
      venue_id,
      shift_name,
      status
    )
    VALUES (?, LAST_INSERT_ID(), 0, ?, 'active')
    `,
    [
      bookingId,
      dto.shift,
    ],
  );

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
    VALUES (?, 'customer', 0, ?, ?, ?)
    `,
    [
      bookingId,
      dto.name,
      dto.phone,
      dto.email,
    ],
  );

  const Enquiredata = {
      email: dto.email,
      id: bookingId,
      customerName: dto.name,
      venueName: dto.venueName,
      enquiryId: code,
      enquiryDate: new Date(),
      eventDate: dto.date,
      eventType: dto.eventType,
      guests: dto.guests,
      message: 'hello',//`We are looking for a wedding venue with indoor dining, stage decoration, catering, and parking facilities for approximately ${dto.guests} guests. Please share your best package and availability `,
  };

  sentEnquireEmail(Enquiredata);

  return {
    success: true,
    bookingId,
    code,
  };
}

}
