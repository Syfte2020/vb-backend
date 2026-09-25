import { Injectable,BadRequestException,
  ConflictException, } from '@nestjs/common';
import { DataSource, Repository, Not, IsNull, LessThan } from 'typeorm';
import { StorageService } from 'src/common/storage/storage.service';

import { v4 as uuidv4 } from "uuid";
import { SocketService } from '../../socket/socket.service';


import axios from 'axios'

type UploadFile = {
  id: string;
  buffer: Buffer;
  mimetype: string;
};

@Injectable()


export class VenueListingService {
  constructor(
    private dataSource: DataSource,
    private storageService: StorageService,
      private socketService: SocketService,
  ) {}

  async getListData(userId: any, id: any, country: any) {
    const result = await this.dataSource.query(
      `
    SELECT 

        cv.child_venue_id as id,
        cv.child_venue_name as name,
        cv.guest_rooms as guests,
        pv.venue_city as location,
        pv.venue_address as address,
        pv.venue_name as parentName,
        cv.publish_status as status,
        vg.attachment AS image

    FROM venue_child cv


    LEFT JOIN venue_parent pv
        ON pv.parent_venue_id = cv.parent_venue_id

    LEFT JOIN venue_gallery vg
        ON vg.child_venue_id = cv.child_venue_id
        AND vg.image_type = '1'

    WHERE cv.created_by = ? AND propety_category = ? AND  venue_country = ?
    `,
      [userId, id, country],
    );


    return result;
  }

//   async getList(userId: any, id: any) {
//     const basicDetails = await this.dataSource.query(
//       `SELECT  
//         child_venue_name as title, more_info as description, venue_category_id as category,
//         min_guest as minCapacity, guest_rooms  as maxCapacity, venue_address  as address,
//         venue_city  as city, venue_state  as state, venue_pincode  as pincode,
//          venue_country  as country,
//         propety_category , cv.publish_status,
//         cv.banquet_round as totalRooms , cv.cocktail_round as bedsPerRoom 
//       FROM venue_child cv
//       LEFT JOIN venue_parent pv ON pv.parent_venue_id = cv.parent_venue_id
//       WHERE cv.child_venue_id = ?
//       `,
//       [id],
//     );

//     const citys = basicDetails[0].city+','+basicDetails[0].state;

//     this.syncNearbyAttractions(id,citys)

// const photos = await this.dataSource.query(
//   `
//   SELECT attachment
//   FROM venue_gallery
//   WHERE child_venue_id = ?
//   ORDER BY
//     CASE
//       WHEN image_type = '1' THEN 0
//       WHEN image_type IS NULL THEN 1
//       ELSE 2
//     END,
//     image_type ASC,
//     id ASC
//   `,
//   [id],
// );
//     const selected_amenities = await this.dataSource.query(
//       `SELECT amenities_id
//       FROM venue_child_amenities
//       WHERE child_venue_id = ?`,
//       [id],
//     );

//     const venueEventTags = await this.dataSource.query(
//       `SELECT event_id
//       FROM venue_event_tags
//       WHERE child_venue_id = ?`,
//       [id],
//     );

//     const venue_tags = await this.dataSource.query(
//       `SELECT venue_cat_id
//       FROM venue_tags
//       WHERE child_venue_id = ?`,
//       [id],
//     );

//     const venue_child_settings = await this.dataSource.query(
//       `SELECT *
//       FROM venue_child_settings
//       WHERE child_id = ?`,
//       [id],
//     );

//     const venue_terms = await this.dataSource.query(
//       `SELECT *
//       FROM venue_terms_condition
//       WHERE child_venue_id = ?`,
//       [id],
//     );

// const venue_addon = await this.dataSource.query(
//       `SELECT *
//       FROM venue_addon
//       WHERE child_venue_id = ?`,
//       [id],
//     );
    
//     const property_pricing = await this.dataSource.query(
//       `SELECT *
//       FROM property_pricing
//       WHERE child_venue_id = ?`,
//       [id],
//     );

//  const shifts = await this.dataSource.query(
//   `
//   SELECT vsh.*, vst.*
//   FROM venue_shift_header vsh
//   LEFT JOIN venue_shift_timing vst
//     ON vst.id = (
//       SELECT id
//       FROM venue_shift_timing
//       WHERE shift_type = vsh.Shift_type
//         AND child_venue_id = vsh.child_id
//       ORDER BY id ASC
//       LIMIT 1
//     )
//   WHERE vsh.child_id = ?
//   `,
//   [id],
// );
//     const pricing = {};

//     shifts.forEach((row) => {
//       const key = (row.name || '').toLowerCase(); // morning | afternoon | evening

//       if (!key) return;

//       pricing[key] = {
//         start: row.from_time,
//         end: row.to_time,
//         price: row.price,
//         enabled: row.publish == 1 ? true : false,
//       };
//     });

//     const baseUrl = process.env.FILE_URL;

//     const photo_ctegory = await this.dataSource.query(
//       `SELECT 
//   vgc.id AS category_id,
//   vgc.child_id,
//   vgc.name AS category_name,

//   vg.id AS image_id,
//   vg.attachment,
//   vg.name AS image_name,
//   vg.g_category,
//   vg.description,
//   vg.image_type,
//   vg.file_extension,
//   vg.created_at,
//   vg.updated_at

// FROM venue_gallery_category vgc
// LEFT JOIN venue_gallery vg 
//   ON vg.g_category = vgc.id

// WHERE vgc.child_id = ? AND  vgc.name !='additonal images'
// ORDER BY vgc.id, vg.id
//       `,
//       [id],
//     );

//     const grouped = {};

//     for (const row of photo_ctegory) {
//       const key = row.category_id;

//       if (!grouped[key]) {
//         grouped[key] = {
//           id: row.category_id,
//           name: row.category_name,
//           child_id: row.child_id,
//           images: [],
//         };
//       }

//       if (row.image_id) {
//         const cleanBase = baseUrl?.replace(/\/$/, '');

//         grouped[key].images.push({
//           id: row.image_id,
//           images: row.attachment ? `${cleanBase}/${row.attachment}` : null,
//           name: row.image_name,
//           description: row.description,
//           image_type: row.image_type,
//           file_extension: row.file_extension,
//         });
//       }
//     }

//     const result = Object.values(grouped);

//     const Setting_grouped = venue_child_settings.reduce((acc, item) => {
//       if (!acc[item.group]) {
//         acc[item.group] = {};
//       }

//       let value: any = item.value;

//       // boolean conversion
//       if (value === 'true') {
//         value = true;
//       } else if (value === 'false') {
//         value = false;
//       }

//       acc[item.group][item.key] = value;

//       return acc;
//     }, {});

//      const venue_guest_loves = await this.dataSource.query(
//       `SELECT feature_id
//       FROM venue_guest_love_features
//       WHERE venue_id = ?`,
//       [id],
//     ); 
    
//     const venue_nearby_places = await this.dataSource.query(
//       `SELECT *
//       FROM venue_nearby_places
//       WHERE venue_id = ?`,
//       [id],
//     );

//     return {
//       ...basicDetails[0],
//       photos: photos.map((p) => `${baseUrl}/${p.attachment}`),
//       amenities: selected_amenities.map((p) => p.amenities_id),
//       pricing: pricing,
//       photoSections: result,
//       event_tags: venueEventTags.map((p) => p.event_id),
//       venue_tags: venue_tags.map((p) => p.venue_cat_id),
//       cancellationPolicy: venue_terms[0]?.cancellation_policy ?? null,
//       termsAccepted: venue_terms[0]?.platform_agreement == 1 ? true : false,
//       houseRules: venue_terms[0]?.venue_rule ?? null,
//       settings: Setting_grouped,
//       addons: venue_addon,
//       property_pricing: property_pricing,
//       highlights:venue_guest_loves?.map(
//       (item) => Number(item.feature_id)
//     ) || [],
//     nearbyAttractions:venue_nearby_places
//       //venue_guest_loves: venue_guest_loves,
//     };
//   }

// async getList(userId: any, id: any) {

//   const baseUrl =
//     process.env.FILE_URL?.replace(/\/$/, '') || '';

//   // =====================================================
//   // 1. BASIC + CAPACITY + FLOATING + PARKING
//   // =====================================================

//   const basicDetails =
//     await this.dataSource.query(
//       `
//       SELECT

//         cv.child_venue_id,

//         cv.child_venue_name AS title,
//         cv.more_info AS description,
//         cv.venue_category_id AS category,

//         cv.min_guest AS minCapacity,

//         cv.guest_rooms AS maxCapacity,

//         cv.floating_capacity AS floatingCapacity,

//         pv.venue_address AS address,
//         pv.venue_city AS city,
//         pv.venue_state AS state,
//         pv.venue_pincode AS pincode,
//         pv.venue_country AS country,

//         pv.propety_category,

//         cv.publish_status,

//         cv.total_meeting_space,

//         cv.total_rooms AS totalRooms,
//         cv.beds_per_room AS bedsPerRoom,

//         cv.meeting_space AS meetingRooms,

//         cv.bedrooms,
//         cv.bathrooms,

//         cv.parking_cars,
//         cv.parking_two_wheelers,
//         cv.parking_buses

//       FROM venue_child cv

//       LEFT JOIN venue_parent pv
//         ON pv.parent_venue_id =
//            cv.parent_venue_id

//       WHERE cv.child_venue_id = ?

//       LIMIT 1
//       `,
//       [id],
//     );

//   if (
//     !basicDetails ||
//     basicDetails.length === 0
//   ) {
//     throw new BadRequestException(
//       'Venue not found',
//     );
//   }

//   const basic =
//     basicDetails[0];


//   // =====================================================
//   // 2. CITY FOR GOOGLE NEARBY
//   // =====================================================

//   const city =
//     [
//       basic.city,
//       basic.state,
//     ]
//       .filter(Boolean)
//       .join(',');

//   /*
//    * IMPORTANT:
//    *
//    * Do NOT sync Google attractions here.
//    *
//    * getList() can be called many times.
//    *
//    * If you want to sync:
//    *
//    * await this.syncNearbyAttractions(id, city);
//    *
//    * call it from a dedicated endpoint / create flow.
//    */


//   // =====================================================
//   // 3. PHOTOS
//   // =====================================================

//   const photos =
//     await this.dataSource.query(
//       `
//       SELECT
//         attachment

//       FROM venue_gallery

//       WHERE child_venue_id = ?

//       ORDER BY

//         CASE
//           WHEN image_type = '1'
//             THEN 0

//           WHEN image_type IS NULL
//             THEN 1

//           ELSE 2
//         END,

//         image_type ASC,
//         id ASC
//       `,
//       [id],
//     );


//   // =====================================================
//   // 4. AMENITIES
//   // =====================================================

//   const selected_amenities =
//     await this.dataSource.query(
//       `
//       SELECT amenities_id

//       FROM venue_child_amenities

//       WHERE child_venue_id = ?
//       `,
//       [id],
//     );


//   // =====================================================
//   // 5. EVENT TAGS
//   // =====================================================

//   const venueEventTags =
//     await this.dataSource.query(
//       `
//       SELECT event_id

//       FROM venue_event_tags

//       WHERE child_venue_id = ?
//       `,
//       [id],
//     );


//   // =====================================================
//   // 6. VENUE TAGS
//   // =====================================================

//   const venue_tags =
//     await this.dataSource.query(
//       `
//       SELECT venue_cat_id

//       FROM venue_tags

//       WHERE child_venue_id = ?
//       `,
//       [id],
//     );


//   // =====================================================
//   // 7. SETTINGS
//   // =====================================================

//   const venue_child_settings =
//     await this.dataSource.query(
//       `
//       SELECT *

//       FROM venue_child_settings

//       WHERE child_id = ?
//       `,
//       [id],
//     );


//   // =====================================================
//   // 8. TERMS
//   // =====================================================

//   const venue_terms =
//     await this.dataSource.query(
//       `
//       SELECT *

//       FROM venue_terms_condition

//       WHERE child_venue_id = ?
//       `,
//       [id],
//     );


//   // =====================================================
//   // 9. ADDONS
//   // =====================================================

//   const venue_addon =
//     await this.dataSource.query(
//       `
//       SELECT *

//       FROM venue_addon

//       WHERE child_venue_id = ?
//       `,
//       [id],
//     );


//   // =====================================================
//   // 10. PROPERTY PRICING
//   // =====================================================

//   const property_pricing =
//     await this.dataSource.query(
//       `
//       SELECT *

//       FROM property_pricing

//       WHERE child_venue_id = ?
//       `,
//       [id],
//     );


//   // =====================================================
//   // 11. SHIFTS / PRICING
//   // =====================================================

//   const shifts =
//     await this.dataSource.query(
//       `
//       SELECT
//         vsh.*,
//         vst.*

//       FROM venue_shift_header vsh

//       LEFT JOIN venue_shift_timing vst
//         ON vst.id = (
//           SELECT id

//           FROM venue_shift_timing

//           WHERE shift_type = vsh.Shift_type
//             AND child_venue_id = vsh.child_id

//           ORDER BY id ASC

//           LIMIT 1
//         )

//       WHERE vsh.child_id = ?
//       `,
//       [id],
//     );


//   const pricing: any = {};


//   shifts.forEach((row) => {

//     const key =
//       String(
//         row.name || '',
//       ).toLowerCase();

//     if (!key) {
//       return;
//     }

//     pricing[key] = {
//       start: row.from_time,
//       end: row.to_time,
//       price: row.price,
//       enabled:
//         Number(row.publish) === 1,
//     };

//   });


//   // =====================================================
//   // 12. PHOTO CATEGORIES
//   // =====================================================

//   const photo_ctegory =
//     await this.dataSource.query(
//       `
//       SELECT

//         vgc.id AS category_id,
//         vgc.child_id,
//         vgc.name AS category_name,

//         vg.id AS image_id,
//         vg.attachment,
//         vg.name AS image_name,
//         vg.g_category,
//         vg.description,
//         vg.image_type,
//         vg.file_extension,
//         vg.created_at,
//         vg.updated_at

//       FROM venue_gallery_category vgc

//       LEFT JOIN venue_gallery vg
//         ON vg.g_category = vgc.id

//       WHERE vgc.child_id = ?
//         AND vgc.name != 'additonal images'

//       ORDER BY
//         vgc.id,
//         vg.id
//       `,
//       [id],
//     );


//   const grouped: any = {};


//   for (
//     const row of photo_ctegory
//   ) {

//     const key =
//       row.category_id;

//     if (!grouped[key]) {

//       grouped[key] = {

//         id: row.category_id,

//         name:
//           row.category_name,

//         child_id:
//           row.child_id,

//         images: [],

//       };

//     }


//     if (row.image_id) {

//       grouped[key].images.push({

//         id:
//           row.image_id,

//         images:
//           row.attachment
//             ? `${baseUrl}/${row.attachment}`
//             : null,

//         name:
//           row.image_name,

//         description:
//           row.description,

//         image_type:
//           row.image_type,

//         file_extension:
//           row.file_extension,

//       });

//     }

//   }


//   const result =
//     Object.values(grouped);


//   // =====================================================
//   // 13. GROUP SETTINGS
//   // =====================================================

//   const Setting_grouped =
//     venue_child_settings.reduce(
//       (acc, item) => {

//         if (!acc[item.group]) {
//           acc[item.group] = {};
//         }

//         let value: any =
//           item.value;

//         if (value === 'true') {
//           value = true;
//         } else if (
//           value === 'false'
//         ) {
//           value = false;
//         }

//         acc[item.group][item.key] =
//           value;

//         return acc;

//       },
//       {},
//     );


//   // =====================================================
//   // 14. GUEST LOVE
//   // =====================================================

//   const venue_guest_loves =
//     await this.dataSource.query(
//       `
//       SELECT
//         feature_id

//       FROM venue_guest_love_features

//       WHERE venue_id = ?
//         AND is_active = 1

//       ORDER BY sort_order ASC
//       `,
//       [id],
//     );


//   // =====================================================
//   // 15. NEARBY ATTRACTIONS
//   // =====================================================

//   const venue_nearby_places =
//     await this.dataSource.query(
//       `
//       SELECT

//         id,
//         venue_id,
//         google_place_id,

//         place_name,
//         place_type,
//         place_type_label,

//         address,

//         latitude,
//         longitude,

//         google_maps_url,

//         photo_name,
//         photo_url,

//         distance_meters,
//         drive_duration_seconds,

//         drive_duration_text,
//         distance_text,

//         sort_order,
//         is_active,

//         last_google_sync_at,

//         created_at,
//         updated_at

//       FROM venue_nearby_places

//       WHERE venue_id = ?

//       ORDER BY
//         is_active DESC,
//         sort_order ASC,
//         id ASC
//       `,
//       [id],
//     );


//   // =====================================================
//   // 16. SEATING STYLES
//   // =====================================================

//   const seatingRows =
//     await this.dataSource.query(
//       `
//       SELECT

//         id,
//         venue_id,
//         seating_type,
//         is_enabled,
//         capacity,
//         sort_order

//       FROM venue_seating_styles

//       WHERE venue_id = ?

//       ORDER BY
//         sort_order ASC,
//         id ASC
//       `,
//       [id],
//     );


//   // =====================================================
//   // 17. CONVERT SEATING TABLE → OBJECT
//   // =====================================================

//   const seatingStyles: any = {};

//   for (
//     const row of seatingRows
//   ) {

//     seatingStyles[
//       row.seating_type
//     ] = {

//       enabled:
//         Number(
//           row.is_enabled,
//         ) === 1,

//       capacity:
//         Number(
//           row.capacity || 0,
//         ),

//     };

//   }


//   // =====================================================
//   // 18. PARKING OBJECT
//   // =====================================================

//   const parking = {

//     cars:
//       Number(
//         basic.parking_cars || 0,
//       ),

//     twoWheelers:
//       Number(
//         basic.parking_two_wheelers || 0,
//       ),

//     buses:
//       Number(
//         basic.parking_buses || 0,
//       ),

//   };


//   // =====================================================
//   // 19. RETURN
//   // =====================================================

//   return {

//     ...basic,

//     // -----------------------------------------------
//     // CAPACITY
//     // -----------------------------------------------

//     minCapacity:
//       Number(
//         basic.minCapacity || 0,
//       ),

//     maxCapacity:
//       Number(
//         basic.maxCapacity || 0,
//       ),

//     floatingCapacity:
//       Number(
//         basic.floatingCapacity || 0,
//       ),

//     totalDesks:
//       Number(
//         basic.totalDesks || 0,
//       ),

//     meetingRooms:
//       Number(
//         basic.meetingRooms || 0,
//       ),

//     bedrooms:
//       Number(
//         basic.bedrooms || 0,
//       ),

//     bathrooms:
//       Number(
//         basic.bathrooms || 0,
//       ),

//     totalRooms:
//       Number(
//         basic.totalRooms || 0,
//       ),

//     bedsPerRoom:
//       Number(
//         basic.bedsPerRoom || 0,
//       ),

//     // -----------------------------------------------
//     // SEATING
//     // -----------------------------------------------

//     seatingStyles,

//     // -----------------------------------------------
//     // PARKING
//     // -----------------------------------------------

//     parking,

//     // -----------------------------------------------
//     // PHOTOS
//     // -----------------------------------------------

//     photos:
//       photos.map((p) =>
//         p.attachment
//           ? `${baseUrl}/${p.attachment}`
//           : null,
//       ),

//     // -----------------------------------------------
//     // AMENITIES
//     // -----------------------------------------------

//     amenities:
//       selected_amenities.map(
//         (p) =>
//           Number(
//             p.amenities_id,
//           ),
//       ),

//     // -----------------------------------------------
//     // PRICING
//     // -----------------------------------------------

//     pricing,

//     // -----------------------------------------------
//     // PHOTO SECTIONS
//     // -----------------------------------------------

//     photoSections:
//       result,

//     // -----------------------------------------------
//     // TAGS
//     // -----------------------------------------------

//     event_tags:
//       venueEventTags.map(
//         (p) =>
//           Number(
//             p.event_id,
//           ),
//       ),

//     venue_tags:
//       venue_tags.map(
//         (p) =>
//           Number(
//             p.venue_cat_id,
//           ),
//       ),

//     // -----------------------------------------------
//     // TERMS
//     // -----------------------------------------------

//     cancellationPolicy:
//       venue_terms[0]
//         ?.cancellation_policy ??
//       null,

//     termsAccepted:
//       Number(
//         venue_terms[0]
//           ?.platform_agreement,
//       ) === 1,

//     houseRules:
//       venue_terms[0]
//         ?.venue_rule ??
//       null,

//     // -----------------------------------------------
//     // SETTINGS
//     // -----------------------------------------------

//     settings:
//       Setting_grouped,

//     // -----------------------------------------------
//     // ADDONS
//     // -----------------------------------------------

//     addons:
//       venue_addon,

//     // -----------------------------------------------
//     // PROPERTY PRICING
//     // -----------------------------------------------

//     property_pricing:
//       property_pricing,

//     // -----------------------------------------------
//     // HIGHLIGHTS
//     // -----------------------------------------------

//     highlights:
//       venue_guest_loves.map(
//         (item) =>
//           Number(
//             item.feature_id,
//           ),
//       ),

//     // -----------------------------------------------
//     // NEARBY
//     // -----------------------------------------------

//     nearbyAttractions:
//       venue_nearby_places,

//   };
// }

async getList(
  userId: any,
  id: any,
) {
  const baseUrl =
    process.env.FILE_URL?.replace(/\/$/, '') || '';

  // =====================================================
  // 1. BASIC + CAPACITY + FLOATING + PARKING
  // =====================================================

  const basicDetails =
    await this.dataSource.query(
      `
      SELECT

        cv.child_venue_id,

        cv.child_venue_name AS title,

        cv.more_info AS description,

        cv.venue_category_id AS category,

        cv.min_guest AS minCapacity,

        cv.guest_rooms AS maxCapacity,

        cv.floating_capacity AS floatingCapacity,

        pv.venue_address AS address,

        pv.venue_city AS city,

        pv.venue_state AS state,

        pv.venue_pincode AS pincode,

        pv.venue_country AS country,

        pv.propety_category,

        cv.publish_status,

        cv.total_meeting_space,

        cv.total_rooms AS totalRooms,

        cv.beds_per_room AS bedsPerRoom,

        cv.meeting_space AS meetingRooms,

        cv.bedrooms,

        cv.bathrooms,

        cv.parking_cars,

        cv.parking_two_wheelers,

        cv.parking_buses

      FROM venue_child cv

      LEFT JOIN venue_parent pv
        ON pv.parent_venue_id =
           cv.parent_venue_id

      WHERE cv.child_venue_id = ?

      LIMIT 1
      `,
      [id],
    );

  // =====================================================
  // VENUE NOT FOUND
  // =====================================================

  if (
    !basicDetails ||
    basicDetails.length === 0
  ) {
    throw new BadRequestException(
      'Venue not found',
    );
  }

  const basic =
    basicDetails[0];


  // =====================================================
  // 2. CITY FOR GOOGLE NEARBY
  // =====================================================

  const city =
    [
      basic.city,
      basic.state,
    ]
      .filter(Boolean)
      .join(',');

  /*
   * IMPORTANT:
   *
   * Do NOT call Google sync from getList().
   *
   * getList() can be called many times.
   *
   * Nearby attractions should be created
   * from your dedicated sync/create endpoint.
   */


  // =====================================================
  // 3. PHOTOS
  // =====================================================

  const photos =
    await this.dataSource.query(
      `
      SELECT
        attachment

      FROM venue_gallery vg
      LEFT JOIN venue_gallery_category vgc  ON vgc.id = vg.g_category

      WHERE child_venue_id = ?    AND vgc.name LIKE 'additonal images'

      ORDER BY

        CASE
          WHEN vg.image_type = '1'
            THEN 0

          WHEN vg.image_type IS NULL
            THEN 1

          ELSE 2
        END,

        vg.image_type ASC,

        vg.id ASC
      `,
      [id],
    );


const reels =
    await this.dataSource.query(
      `
      SELECT
        reel_url

      FROM venue_reels

      WHERE child_venue_id = ?

      `,
      [id],
    );


  // =====================================================
  // 4. AMENITIES
  // =====================================================

  const selected_amenities =
    await this.dataSource.query(
      `
      SELECT
        amenities_id

      FROM venue_child_amenities

      WHERE child_venue_id = ?
      `,
      [id],
    );


  // =====================================================
  // 5. EVENT TAGS
  // =====================================================

  const venueEventTags =
    await this.dataSource.query(
      `
      SELECT
        event_id

      FROM venue_event_tags

      WHERE child_venue_id = ?
      `,
      [id],
    );


  // =====================================================
  // 6. VENUE TAGS
  // =====================================================

  const venue_tags =
    await this.dataSource.query(
      `
      SELECT
        venue_cat_id

      FROM venue_tags

      WHERE child_venue_id = ?
      `,
      [id],
    );


  // =====================================================
  // 7. SETTINGS
  // =====================================================

  const venue_child_settings =
    await this.dataSource.query(
      `
      SELECT *

      FROM venue_child_settings

      WHERE child_id = ?
      `,
      [id],
    );


  // =====================================================
  // 8. VENUE TERMS
  // =====================================================

  const venue_terms =
    await this.dataSource.query(
      `
      SELECT
        id,
        child_venue_id,
        cancellation_policy,
        venue_rule,
        platform_agreement,
        created_at,
        updated_at

      FROM venue_terms_condition

      WHERE child_venue_id = ?

      LIMIT 1
      `,
      [id],
    );


  // =====================================================
  // 8.1 CUSTOM CANCELLATION TIERS
  // =====================================================

  const venue_cancellation_tiers =
    await this.dataSource.query(
      `
      SELECT
        id,
        venue_id,
        tier_no,
        from_days,
        to_days,
        refund_percentage,
        is_active

      FROM venue_cancellation_tiers

      WHERE venue_id = ?

      AND is_active = 1

      ORDER BY
        tier_no ASC
      `,
      [id],
    );


  // =====================================================
  // 8.2 VENUE POLICIES
  // =====================================================

  const venue_policies =
    await this.dataSource.query(
      `
      SELECT
        id,
        venue_id,

        music_morning_until,
        music_afternoon_until,
        music_evening_until,

        noise_restriction,

        outside_vendors_allowed,

        decor_rule,

        smoking_policy,

        pets_allowed,

        created_at,
        updated_at

      FROM venue_policies

      WHERE venue_id = ?

      LIMIT 1
      `,
      [id],
    );


  // =====================================================
  // 9. ADDONS
  // =====================================================

  const venue_addon =
    await this.dataSource.query(
      `
      SELECT *

      FROM venue_addon

      WHERE child_venue_id = ?
      `,
      [id],
    );


  // =====================================================
  // 10. PROPERTY PRICING
  // =====================================================

  const property_pricing =
    await this.dataSource.query(
      `
      SELECT *

      FROM property_pricing

      WHERE child_venue_id = ?
      `,
      [id],
    );


  // =====================================================
  // 11. SHIFTS / PRICING
  // =====================================================

  const shifts =
    await this.dataSource.query(
      `
      SELECT
        vsh.*,
        vst.*

      FROM venue_shift_header vsh

      LEFT JOIN venue_shift_timing vst

        ON vst.id = (

          SELECT id

          FROM venue_shift_timing

          WHERE shift_type =
                vsh.Shift_type

          AND child_venue_id =
              vsh.child_id

          ORDER BY id ASC

          LIMIT 1
        )

      WHERE vsh.child_id = ?
      `,
      [id],
    );


  // =====================================================
  // SHIFT PRICING OBJECT
  // =====================================================

  const pricing: any = {};


  shifts.forEach((row) => {

    const key =
      String(
        row.name || '',
      ).toLowerCase();


    if (!key) {
      return;
    }


    pricing[key] = {

      start:
        row.from_time,

      end:
        row.to_time,

      price:
        row.price,

      enabled:
        Number(
          row.publish,
        ) === 1,

    };

  });


  // =====================================================
  // 12. PHOTO CATEGORIES
  // =====================================================

  const photo_ctegory =
    await this.dataSource.query(
      `
      SELECT

        vgc.id AS category_id,

        vgc.child_id,

        vgc.name AS category_name,

        vg.id AS image_id,

        vg.attachment,

        vg.name AS image_name,

        vg.g_category,

        vg.description,

        vg.image_type,

        vg.file_extension,

        vg.created_at,

        vg.updated_at

      FROM venue_gallery_category vgc

      LEFT JOIN venue_gallery vg
        ON vg.g_category = vgc.id

      WHERE vgc.child_id = ?

      AND vgc.name != 'additonal images'

      ORDER BY
        vgc.id,
        vg.id
      `,
      [id],
    );


  // =====================================================
  // GROUP PHOTO CATEGORIES
  // =====================================================

  const grouped: any = {};


  for (
    const row of photo_ctegory
  ) {

    const key =
      row.category_id;


    if (!grouped[key]) {

      grouped[key] = {

        id:
          row.category_id,

        name:
          row.category_name,

        child_id:
          row.child_id,

        images: [],

      };

    }


    if (row.image_id) {

      grouped[key].images.push({

        id:
          row.image_id,

        images:
          row.attachment
            ? `${baseUrl}/${row.attachment}`
            : null,

        name:
          row.image_name,

        description:
          row.description,

        image_type:
          row.image_type,

        file_extension:
          row.file_extension,

      });

    }

  }


  const result =
    Object.values(grouped);


  // =====================================================
  // 13. GROUP SETTINGS
  // =====================================================

  const Setting_grouped =
    venue_child_settings.reduce(
      (
        acc,
        item,
      ) => {

        if (!acc[item.group]) {
          acc[item.group] = {};
        }


        let value: any =
          item.value;


        if (
          value === 'true'
        ) {

          value = true;

        } else if (
          value === 'false'
        ) {

          value = false;

        }


        acc[item.group][item.key] =
          value;


        return acc;

      },
      {},
    );


  // =====================================================
  // 14. GUEST LOVE
  // =====================================================

  const venue_guest_loves =
    await this.dataSource.query(
      `
      SELECT
        feature_id

      FROM venue_guest_love_features

      WHERE venue_id = ?

      AND is_active = 1

      ORDER BY
        sort_order ASC
      `,
      [id],
    );


  // =====================================================
  // 15. NEARBY ATTRACTIONS
  // =====================================================

  const venue_nearby_places =
    await this.dataSource.query(
      `
      SELECT

        id,

        venue_id,

        google_place_id,

        place_name,

        place_type,

        place_type_label,

        address,

        latitude,

        longitude,

        google_maps_url,

        photo_name,

        photo_url,

        distance_meters,

        drive_duration_seconds,

        drive_duration_text,

        distance_text,

        sort_order,

        is_active,

        last_google_sync_at,

        created_at,

        updated_at

      FROM venue_nearby_places

      WHERE venue_id = ?

      ORDER BY

        is_active DESC,

        sort_order ASC,

        id ASC
      `,
      [id],
    );


  // =====================================================
  // 16. SEATING STYLES
  // =====================================================

  const seatingRows =
    await this.dataSource.query(
      `
      SELECT

        id,

        venue_id,

        seating_type,

        is_enabled,

        capacity,

        sort_order

      FROM venue_seating_styles

      WHERE venue_id = ?

      ORDER BY

        sort_order ASC,

        id ASC
      `,
      [id],
    );


  // =====================================================
  // 17. SEATING OBJECT
  // =====================================================

  const seatingStyles: any = {};


  for (
    const row of seatingRows
  ) {

    seatingStyles[
      row.seating_type
    ] = {

      enabled:
        Number(
          row.is_enabled,
        ) === 1,

      capacity:
        Number(
          row.capacity || 0,
        ),

    };

  }


  // =====================================================
  // 18. PARKING OBJECT
  // =====================================================

  const parking = {

    cars:
      Number(
        basic.parking_cars || 0,
      ),

    twoWheelers:
      Number(
        basic.parking_two_wheelers || 0,
      ),

    buses:
      Number(
        basic.parking_buses || 0,
      ),

  };


  // =====================================================
  // 19. TERMS OBJECT
  // =====================================================

  const terms =
    venue_terms[0] || null;


  // =====================================================
  // 20. POLICY OBJECT
  // =====================================================

  const policy =
    venue_policies[0] || null;


  const policies = {

    musicTiming: {

      morning:
        policy?.music_morning_until ||
        null,

      afternoon:
        policy?.music_afternoon_until ||
        null,

      evening:
        policy?.music_evening_until ||
        null,

    },


    noiseRestriction:
      policy?.noise_restriction ||
      null,


    outsideVendorsAllowed:
      Number(
        policy?.outside_vendors_allowed,
      ) === 1,


    decorRule:
      policy?.decor_rule ||
      null,


    smoking:
      policy?.smoking_policy ||
      null,


    petsAllowed:
      Number(
        policy?.pets_allowed,
      ) === 1,

  };


  // =====================================================
  // 21. CUSTOM CANCELLATION TIERS OBJECT
  // =====================================================

  const customCancellationTiers =
    venue_cancellation_tiers.map(
      (tier) => ({

        fromDays:
          String(
            tier.from_days,
          ),

        toDays:
          String(
            tier.to_days,
          ),

        refund:
          String(
            tier.refund_percentage,
          ),

      }),
    );

        const citys = basicDetails[0].city+','+basicDetails[0].state;

    this.syncNearbyAttractions(id,citys)


  // =====================================================
  // 22. RETURN
  // =====================================================

  return {

    ...basic,


    // ===================================================
    // CAPACITY
    // ===================================================

    minCapacity:
      Number(
        basic.minCapacity || 0,
      ),

    maxCapacity:
      Number(
        basic.maxCapacity || 0,
      ),

    floatingCapacity:
      Number(
        basic.floatingCapacity || 0,
      ),

    totalDesks:
      Number(
        basic.totalDesks || 0,
      ),

    meetingRooms:
      Number(
        basic.meetingRooms || 0,
      ),

    bedrooms:
      Number(
        basic.bedrooms || 0,
      ),

    bathrooms:
      Number(
        basic.bathrooms || 0,
      ),

    totalRooms:
      Number(
        basic.totalRooms || 0,
      ),

    bedsPerRoom:
      Number(
        basic.bedsPerRoom || 0,
      ),


    // ===================================================
    // SEATING
    // ===================================================

    seatingStyles,


    // ===================================================
    // PARKING
    // ===================================================

    parking,


    // ===================================================
    // PHOTOS
    // ===================================================

    photos:
      photos.map(
        (p) =>
          p.attachment
            ? `${baseUrl}/${p.attachment}`
            : null,
      ),
  reel_video:
      reels.map(
        (r) =>
          r.reel_url
            ? `${baseUrl}/${r.reel_url}`
            : null,
      ),


    // ===================================================
    // AMENITIES
    // ===================================================

    amenities:
      selected_amenities.map(
        (p) =>
            p.amenities_id
          
      ),


    // ===================================================
    // PRICING
    // ===================================================

    pricing,


    // ===================================================
    // PHOTO SECTIONS
    // ===================================================

    photoSections:
      result,


    // ===================================================
    // TAGS
    // ===================================================

    event_tags:
      venueEventTags.map(
        (p) =>
          Number(
            p.event_id,
          ),
      ),


    venue_tags:
      venue_tags.map(
        (p) =>
          Number(
            p.venue_cat_id,
          ),
      ),


    // ===================================================
    // TERMS
    // ===================================================

    cancellationPolicy:
      terms?.cancellation_policy ??
      null,


    customCancellationTiers,


    houseRules:
      terms?.venue_rule ??
      null,


    termsAccepted:
      Number(
        terms?.platform_agreement,
      ) === 1,


    // ===================================================
    // POLICIES
    // ===================================================

    policies,


    // ===================================================
    // SETTINGS
    // ===================================================

    settings:
      Setting_grouped,


    // ===================================================
    // ADDONS
    // ===================================================

    addons:
      venue_addon,


    // ===================================================
    // PROPERTY PRICING
    // ===================================================

    property_pricing:
      property_pricing,


    // ===================================================
    // HIGHLIGHTS
    // ===================================================

    highlights:
      venue_guest_loves.map(
        (item) =>
          Number(
            item.feature_id,
          ),
      ),


    // ===================================================
    // NEARBY
    // ===================================================

    nearbyAttractions:
      venue_nearby_places,

  };
}

  async getGalleryCategory(id: any) {
    const basicDetail = await this.dataSource.query(
      `SELECT  *
      FROM venue_gallery_category vgc
      WHERE vgc.child_id = ?
      `,
      [id],
    );

    return {
      category: basicDetail.map((p) => p.name),
    };
  }
  async updateListing(id: any, body: any, files: any) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const {
        title,
        description,
        category,
        minCapacity,
        maxCapacity,
        amenities,
        event_tags,
        venue_tags,
        photos,
        photoSections,
        pricing,
        cancellationPolicy,
        houseRules,
        termsAccepted,
        cancellationWindowDays
      } = body;

      /* ─────────────────────────────
      1. MAIN TABLE UPDATE
    ───────────────────────────── */
      await queryRunner.query(
        `UPDATE venue_child SET 
        child_venue_name = ?,
        more_info = ?,
        venue_category_id = ?,
        min_guest = ?,
        guest_rooms = ?
      WHERE child_venue_id = ?`,
        [title, description, category, minCapacity, maxCapacity, id],
      );

      /* ─────────────────────────────
      Helper: safe JSON parse
    ───────────────────────────── */
      const safeJson = (val: any) => {
        if (!val) return [];
        if (typeof val === 'string') {
          try {
            return JSON.parse(val);
          } catch {
            return [];
          }
        }
        return val;
      };

      const amenityArr = safeJson(amenities);
      const eventArr = safeJson(event_tags);
      const venueArr = safeJson(venue_tags);
      const pricingObj = safeJson(pricing);
      const photoSectionsObj = safeJson(photoSections);

      /* ─────────────────────────────
      2. AMENITIES
    ───────────────────────────── */
      await queryRunner.query(
        `DELETE FROM venue_child_amenities WHERE child_venue_id = ?`,
        [id],
      );

      for (const a of amenityArr) {
        await queryRunner.query(
          `INSERT INTO venue_child_amenities (child_venue_id, amenities_id)
         VALUES (?, ?)`,
          [id, a],
        );
      }

      /* ─────────────────────────────
      3. EVENT TAGS
    ───────────────────────────── */
      await queryRunner.query(
        `DELETE FROM venue_event_tags WHERE child_venue_id = ?`,
        [id],
      );

      for (const b of eventArr) {
        await queryRunner.query(
          `INSERT INTO venue_event_tags (child_venue_id, event_id)
         VALUES (?, ?)`,
          [id, b],
        );
      }

      /* ─────────────────────────────
      4. VENUE TAGS
    ───────────────────────────── */
      await queryRunner.query(
        `DELETE FROM venue_tags WHERE child_venue_id = ?`,
        [id],
      );

      for (const c of venueArr) {
        await queryRunner.query(
          `INSERT INTO venue_tags (child_venue_id, venue_cat_id)
         VALUES (?, ?)`,
          [id, c],
        );
      }

      /* ─────────────────────────────
      5. PRICING
    ───────────────────────────── */
      const shiftMap: Record<string, number> = {
        morning: 1,
        afternoon: 2,
        evening: 3,
      };

      for (const [key, value] of Object.entries(pricingObj || {})) {
        const shiftId = shiftMap[key];
        if (!shiftId) continue;

        const shift: any = value;

        await queryRunner.query(
          `UPDATE venue_shift_header 
         SET publish = ? 
         WHERE Shift_type = ? AND child_id = ?`,
          [shift?.enabled ? 1 : 0, shiftId, id],
        );

        await queryRunner.query(
          `UPDATE venue_shift_timing 
         SET price = ?, from_time = ?, to_time = ? 
         WHERE shift_type = ? AND child_venue_id = ?`,
          [
            shift?.price ?? 0,
            shift?.start ?? null,
            shift?.end ?? null,
            shiftId,
            id,
          ],
        );
      }

      /* ─────────────────────────────
      6. TERMS
    ───────────────────────────── */
      const existing = await queryRunner.query(
        `SELECT id FROM venue_terms_condition WHERE child_venue_id = ?`,
        [id],
      );

      if (existing.length > 0) {
        await queryRunner.query(
          `UPDATE venue_terms_condition
         SET cancellation_policy = ?,
             venue_rule = ?,
             platform_agreement = ?,
             plus_days = ?,
             updated_at = NOW()
         WHERE child_venue_id = ?`,
          [cancellationPolicy, houseRules, termsAccepted ? 1 : 0, cancellationWindowDays, id],
        );
      } else {
        await queryRunner.query(
          `INSERT INTO venue_terms_condition
         (child_venue_id, cancellation_policy, venue_rule, platform_agreement, plus_days , created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ? , NOW(), NOW())`,
          [id, cancellationPolicy, houseRules, termsAccepted ? 1 : 0, cancellationWindowDays],
        );
      }

      for (const section of photoSectionsObj) {
        const { cat_id, name, description, images = [] } = section;

        console.log('➡️ Section:', name);

        // 1. CHECK CATEGORY EXISTS
        let category: any = await this.dataSource.query(
          `SELECT id FROM venue_gallery_category 
       WHERE child_id = ? AND name = ?`,
          [id, name],
        );

        let categoryId: any;

        // 2. INSERT IF NOT EXISTS
        if (!category.length) {
          const result = await this.dataSource.query(
            `INSERT INTO venue_gallery_category 
        (child_id, name, description, created_at, updated_at)
        VALUES (?, ?, ?, NOW(), NOW())`,
            [id, name, description],
          );

          categoryId = result.insertId;
          console.log('🆕 Category created:', categoryId);
        } else {
          categoryId = category[0].id;

          // UPDATE NAME/DESCRIPTION IF EDITED
          await this.dataSource.query(
            `UPDATE venue_gallery_category
         SET name = ?, description = ?, updated_at = NOW()
         WHERE id = ?`,
            [name, description, categoryId],
          );

          console.log('✏️ Category updated:', categoryId);
        }

        // 3. PROCESS IMAGES
        for (const img of images || []) {
          let finalUrl = img;

          // If blob → upload
          if (typeof img === 'string' && img.startsWith('blob:')) {
            console.log('📤 Uploading blob image...');

            finalUrl = await this.storageService.upload(img, 'vb_gallery');
          }

          // 4. UPSERT IMAGE
          const exists = await this.dataSource.query(
            `SELECT id FROM venue_gallery 
         WHERE child_venue_id = ? 
         AND g_category = ? 
         AND attachment = ?`,
            [id, categoryId, finalUrl],
          );

          if (!exists.length) {
            await this.dataSource.query(
              `INSERT INTO venue_gallery 
          (child_venue_id, g_category, attachment, created_at)
          VALUES (?, ?, ?, NOW())`,
              [id, categoryId, finalUrl],
            );

            console.log('➕ Image inserted:', finalUrl);
          } else {
            console.log('ℹ️ Image already exists');
          }
        }
      }

      //photoSections

      /* ─────────────────────────────
      COMMIT
    ───────────────────────────── */
      await queryRunner.commitTransaction();

      return { success: true };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
 

  /* ─────────────────────────────
     BASIC
  ───────────────────────────── */

  // async updateBasic(id: any, body: any) {
  //   const { title, description, category, propety_category,highlights } = body;

  //   await this.dataSource.query(
  //     `UPDATE venue_child SET
  //       child_venue_name = ?,
  //       more_info = ?,
  //       venue_category_id = ?
  //     WHERE child_venue_id = ?`,
  //     [title, description, category, id],
  //   );



  //   return {
  //     success: true,
  //   };
  // }

//   async updateBasic(id: any, body: any) {
//   const {
//     title,
//     description,
//     category,
//     propety_category,
//     highlights,
//   } = body;

//   const venueId = id;

//   // if (!Number.isInteger(venueId)) {
//   //   throw new BadRequestException('Invalid venue ID');
//   // }

//   const selectedHighlights = Array.isArray(highlights)
//     ? highlights
//         .map((item) => Number(item))
//         .filter((item) => Number.isInteger(item))
//     : [];

//   const queryRunner = this.dataSource.createQueryRunner();

//   await queryRunner.connect();
//   await queryRunner.startTransaction();

//   try {
//     // =====================================================
//     // 1. Update venue
//     // =====================================================

//     await queryRunner.query(
//       `
//       UPDATE venue_child
//       SET
//         child_venue_name = ?,
//         more_info = ?,
//         venue_category_id = ?
//       WHERE child_venue_id = ?
//       `,
//       [
//         title,
//         description,
//         category,
//         venueId,
//       ],
//     );

//     // =====================================================
//     // 2. Get existing highlights
//     // =====================================================

//     const existingHighlights =
//       await queryRunner.query(
//         `
//         SELECT
//           id,
//           feature_id,
//           sort_order,
//           is_active
//         FROM venue_guest_love_features
//         WHERE venue_id = ?
//         `,
//         [venueId],
//       );

//     // =====================================================
//     // 3. Delete highlights which are NOT selected anymore
//     // =====================================================

//     if (selectedHighlights.length > 0) {
//       const placeholders = selectedHighlights
//         .map(() => '?')
//         .join(',');

//       await queryRunner.query(
//         `
//         DELETE FROM venue_guest_love_features
//         WHERE venue_id = ?
//           AND feature_id NOT IN (${placeholders})
//         `,
//         [
//           venueId,
//           ...selectedHighlights,
//         ],
//       );
//     } else {
//       // No highlights selected → delete all
//       await queryRunner.query(
//         `
//         DELETE FROM venue_guest_love_features
//         WHERE venue_id = ?
//         `,
//         [venueId],
//       );
//     }

//     // =====================================================
//     // 4. Insert / Update selected highlights
//     // =====================================================

//     for (
//       let index = 0;
//       index < selectedHighlights.length;
//       index++
//     ) {
//       const featureId =
//         selectedHighlights[index];

//       const sortOrder = index + 1;

//       const existing =
//         existingHighlights.find(
//           (item) =>
//             Number(item.feature_id) ===
//             featureId,
//         );

//       if (existing) {
//         // ==============================================
//         // Already exists → UPDATE
//         // ==============================================

//         await queryRunner.query(
//           `
//           UPDATE venue_guest_love_features
//           SET
//             sort_order = ?,
//             is_active = 1,
//             updated_at = NOW()
//           WHERE id = ?
//           `,
//           [
//             sortOrder,
//             existing.id,
//           ],
//         );
//       } else {
//         // ==============================================
//         // Doesn't exist → INSERT
//         // ==============================================

//         await queryRunner.query(
//           `
//           INSERT INTO venue_guest_love_features
//           (
//             venue_id,
//             feature_id,
//             sort_order,
//             is_active,
//             created_at,
//             updated_at
//           )
//           VALUES (?, ?, ?, 1, NOW(), NOW())
//           `,
//           [
//             venueId,
//             featureId,
//             sortOrder,
//           ],
//         );
//       }
//     }

//     // =====================================================
//     // 5. Commit
//     // =====================================================

//     await queryRunner.commitTransaction();

//     return {
//       success: true,
//     };
//   } catch (error) {
//     await queryRunner.rollbackTransaction();

//     console.error(
//       'updateBasic error:',
//       error,
//     );

//     throw error;
//   } finally {
//     await queryRunner.release();
//   }
// }

async updateBasic(id: any, body: any) {
  const {
    title,
    description,
    category,
    propety_category,
    highlights,
    nearbyAttractions,
  } = body;

  const venueId = id;

  const selectedHighlights = Array.isArray(highlights)
    ? highlights
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item))
    : [];

  // =====================================================
  // NEARBY ATTRACTIONS
  // =====================================================

  const nearbyList = Array.isArray(
    nearbyAttractions,
  )
    ? nearbyAttractions
    : [];

  // Maximum 4 selected
  const selectedNearby = nearbyList.filter(
    (place) =>
      Number(place.is_active) === 1,
  );

  if (selectedNearby.length > 4) {
    throw new BadRequestException(
      'Maximum 4 nearby attractions can be selected',
    );
  }

  const queryRunner =
    this.dataSource.createQueryRunner();

  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // =====================================================
    // 1. UPDATE VENUE
    // =====================================================

    await queryRunner.query(
      `
      UPDATE venue_child
      SET
        child_venue_name = ?,
        more_info = ?,
        venue_category_id = ?
      WHERE child_venue_id = ?
      `,
      [
        title,
        description,
        category,
        venueId,
      ],
    );

    // =====================================================
    // 2. GET EXISTING HIGHLIGHTS
    // =====================================================

    const existingHighlights =
      await queryRunner.query(
        `
        SELECT
          id,
          feature_id,
          sort_order,
          is_active
        FROM venue_guest_love_features
        WHERE venue_id = ?
        `,
        [venueId],
      );

    // =====================================================
    // 3. DELETE HIGHLIGHTS NOT SELECTED
    // =====================================================

    if (
      selectedHighlights.length > 0
    ) {
      const placeholders =
        selectedHighlights
          .map(() => '?')
          .join(',');

      await queryRunner.query(
        `
        DELETE FROM venue_guest_love_features
        WHERE venue_id = ?
          AND feature_id NOT IN (${placeholders})
        `,
        [
          venueId,
          ...selectedHighlights,
        ],
      );
    } else {
      await queryRunner.query(
        `
        DELETE FROM venue_guest_love_features
        WHERE venue_id = ?
        `,
        [venueId],
      );
    }

    // =====================================================
    // 4. INSERT / UPDATE HIGHLIGHTS
    // =====================================================

    for (
      let index = 0;
      index < selectedHighlights.length;
      index++
    ) {
      const featureId =
        selectedHighlights[index];

      const sortOrder = index + 1;

      const existing =
        existingHighlights.find(
          (item) =>
            Number(item.feature_id) ===
            featureId,
        );

      if (existing) {
        await queryRunner.query(
          `
          UPDATE venue_guest_love_features
          SET
            sort_order = ?,
            is_active = 1,
            updated_at = NOW()
          WHERE id = ?
          `,
          [
            sortOrder,
            existing.id,
          ],
        );
      } else {
        await queryRunner.query(
          `
          INSERT INTO venue_guest_love_features
          (
            venue_id,
            feature_id,
            sort_order,
            is_active,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, 1, NOW(), NOW())
          `,
          [
            venueId,
            featureId,
            sortOrder,
          ],
        );
      }
    }

    // =====================================================
    // 5. GET ALL EXISTING NEARBY PLACES
    // =====================================================

    const existingNearby =
      await queryRunner.query(
        `
        SELECT
          id,
          venue_id,
          google_place_id,
          place_name,
          place_type,
          place_type_label,
          address,
          latitude,
          longitude,
          google_maps_url,
          photo_name,
          photo_url,
          distance_meters,
          drive_duration_seconds,
          drive_duration_text,
          distance_text,
          sort_order,
          is_active,
          last_google_sync_at,
          created_at,
          updated_at
        FROM venue_nearby_places
        WHERE venue_id = ?
        ORDER BY id ASC
        `,
        [venueId],
      );

    // =====================================================
    // 6. REMOVE DUPLICATE GOOGLE PLACES
    //
    // Example:
    //
    // id 1 → Google Place A
    // id 2 → Google Place A
    //
    // Keep the first record.
    // =====================================================

    const seenGooglePlaceIds =
      new Set<string>();

    for (const place of existingNearby) {
      const googlePlaceId =
        String(
          place.google_place_id || '',
        ).trim();

      if (!googlePlaceId) {
        continue;
      }

      if (
        seenGooglePlaceIds.has(
          googlePlaceId,
        )
      ) {
        await queryRunner.query(
          `
          DELETE FROM venue_nearby_places
          WHERE id = ?
            AND venue_id = ?
          `,
          [
            place.id,
            venueId,
          ],
        );
      } else {
        seenGooglePlaceIds.add(
          googlePlaceId,
        );
      }
    }

    // =====================================================
    // 7. RELOAD AFTER DUPLICATE CLEANUP
    // =====================================================

    const cleanNearby =
      await queryRunner.query(
        `
        SELECT
          id,
          google_place_id
        FROM venue_nearby_places
        WHERE venue_id = ?
        `,
        [venueId],
      );

    // =====================================================
    // 8. UPDATE ALL NEARBY PLACES
    //
    // Selected = is_active 1
    // Unselected = is_active 0
    // =====================================================

    for (
      const place of cleanNearby
    ) {

      
      const incoming =
        nearbyList.find(
          (item) =>
            Number(item.id) ===
            Number(place.id),
        );

      // ---------------------------------------------------
      // Not present in frontend anymore
      // → inactive
      // ---------------------------------------------------

      if (!incoming) {

       
        await queryRunner.query(
          `
          UPDATE venue_nearby_places
          SET
            is_active = 0,
            updated_at = NOW()
          WHERE id = ?
            AND venue_id = ?
          `,
          [
            place.id,
            venueId,
          ],
        );

        continue;
      }

      const isActive =
        Number(
          incoming.is_active,
        ) === 1;

      // ---------------------------------------------------
      // UNSELECTED
      // ---------------------------------------------------

      if (!isActive) {
        await queryRunner.query(
          `
          UPDATE venue_nearby_places
          SET
            is_active = 0,
            updated_at = NOW()
          WHERE id = ?
            AND venue_id = ?
          `,
          [
            place.id,
            venueId,
          ],
        );

        continue;
      }

      // ===================================================
      // SELECTED
      // ===================================================

      // KM from frontend
      const distanceKm =
        Number(
          incoming.distance ?? 0,
        );

      // Minutes from frontend
      const travelMinutes =
        Number(
          incoming.travel ?? 0,
        );

      // ---------------------------------------------------
      // Validate values
      // ---------------------------------------------------

      if (
        !Number.isFinite(
          distanceKm,
        ) ||
        distanceKm < 0
      ) {
        throw new BadRequestException(
          `Invalid distance for ${place.id}`,
        );
      }

      if (
        !Number.isFinite(
          travelMinutes,
        ) ||
        travelMinutes < 0
      ) {
        throw new BadRequestException(
          `Invalid travel time for ${place.id}`,
        );
      }

      // ---------------------------------------------------
      // Convert:
      //
      // KM → meters
      // Minutes → seconds
      // ---------------------------------------------------

      const distanceMeters =
        Math.round(
          distanceKm * 1000,
        );

      const durationSeconds =
        Math.round(
          travelMinutes * 60,
        );

      // ---------------------------------------------------
      // Text values
      // ---------------------------------------------------

      const distanceText =
        `${distanceKm}`;

      const driveDurationText =
        this.formatDuration(
          travelMinutes,
        );

      // ---------------------------------------------------
      // Find selected order
      // ---------------------------------------------------

      const selectedIndex =
        selectedNearby.findIndex(
          (item) =>
            Number(item.id) ===
            Number(place.id),
        );

      const sortOrder =
        selectedIndex >= 0
          ? selectedIndex + 1
          : 999;

          console.log(selectedIndex)//distance: 22,travel: 20

      // ---------------------------------------------------
      // UPDATE
      // ---------------------------------------------------

      await queryRunner.query(
        `
        UPDATE venue_nearby_places
        SET
          distance_meters = ?,
          drive_duration_seconds = ?,
          distance_text = ?,
          drive_duration_text = ?,
          sort_order = ?,
          is_active = 1,
          updated_at = NOW()
        WHERE id = ?
          AND venue_id = ?
        `,
        [
          distanceMeters,

          durationSeconds,

          distanceText,

          driveDurationText,

          sortOrder,

          place.id,

          venueId,
        ],
      );
    }

    // =====================================================
    // 9. COMMIT
    // =====================================================

    await queryRunner.commitTransaction();

    // =====================================================
    // 10. RETURN UPDATED NEARBY DATA
    // =====================================================

    const updatedNearby =
      await this.dataSource.query(
        `
        SELECT
          id,
          venue_id,
          google_place_id,
          place_name,
          place_type,
          place_type_label,
          address,
          latitude,
          longitude,
          google_maps_url,
          photo_name,
          photo_url,
          distance_meters,
          drive_duration_seconds,
          drive_duration_text,
          distance_text,
          sort_order,
          is_active,
          last_google_sync_at,
          created_at,
          updated_at
        FROM venue_nearby_places
        WHERE venue_id = ?
        ORDER BY
          is_active DESC,
          sort_order ASC,
          id ASC
        `,
        [venueId],
      );

    return {
      success: true,

      nearbyAttractions:
        updatedNearby,

      selectedNearby:
        updatedNearby.filter(
          (item) =>
            Number(item.is_active) === 1,
        ),
    };
  } catch (error) {
    await queryRunner.rollbackTransaction();

    console.error(
      'updateBasic error:',
      error,
    );

    throw error;
  } finally {
    await queryRunner.release();
  }
}

  /* ─────────────────────────────
     CAPACITY
  ───────────────────────────── */

//   async updateCapacity(id: any, body: any) {
//     const { minCapacity, maxCapacity , bedsPerRoom , bathrooms , bedrooms, meetingRooms,totalDesks,totalRooms } = body;
// // let cocktail_round = null;
// // let banquet_round = null;

// // 👇 map based on category/type
// // switch (category) {
// //   case "room_type_1":
// //     cocktail_round = bedsPerRoom;
// //     banquet_round = bathrooms;
// //     break;

// //   case "room_type_2":
// //     cocktail_round = bedrooms;
// //     banquet_round = meetingRooms;
// //     break;

// //   case "workspace":
// //     cocktail_round = totalDesks;
// //     banquet_round = totalRooms;
// //     break;

// //   default:
// //     cocktail_round = totalRooms;
// //     banquet_round = totalRooms;
// //     break;
// // }

//     await this.dataSource.query(
//       `UPDATE venue_child SET
//         min_guest = ?,
//         guest_rooms = ?,
//         cocktail_round= ? ,
//         banquet_round= ? 
//       WHERE child_venue_id = ?`,
//       [minCapacity, maxCapacity, bedsPerRoom,totalRooms, id],
//     );

//     return {
//       success: true,
//     };
//   }

// async updateCapacity(
//   id: any,
//   body: any,
// ) {
//   const {
//     minCapacity,
//     maxCapacity,
//     floatingCapacity,

//     seatingStyles,

//     totalDesks,
//     meetingRooms,
//     bedrooms,
//     bathrooms,
//     totalRooms,
//     bedsPerRoom,

//     parking,
//   } = body;

//   const venueId = id;

//   const queryRunner =
//     this.dataSource.createQueryRunner();

//   await queryRunner.connect();
//   await queryRunner.startTransaction();

//   try {

//     // =====================================================
//     // 1. UPDATE / INSERT CAPACITY
//     // =====================================================

//     await queryRunner.query(
//       `
//       INSERT INTO venue_capacity
//       (
//         venue_id,
//         min_capacity,
//         max_capacity,
//         floating_capacity,
//         total_desks,
//         meeting_rooms,
//         bedrooms,
//         bathrooms,
//         total_rooms,
//         beds_per_room,
//         created_at,
//         updated_at
//       )
//       VALUES
//       (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())

//       ON DUPLICATE KEY UPDATE

//         min_capacity = VALUES(min_capacity),
//         max_capacity = VALUES(max_capacity),
//         floating_capacity = VALUES(floating_capacity),

//         total_desks = VALUES(total_desks),
//         meeting_rooms = VALUES(meeting_rooms),

//         bedrooms = VALUES(bedrooms),
//         bathrooms = VALUES(bathrooms),

//         total_rooms = VALUES(total_rooms),
//         beds_per_room = VALUES(beds_per_room),

//         updated_at = NOW()
//       `,
//       [
//         venueId,

//         Number(minCapacity) || 0,
//         Number(maxCapacity) || 0,
//         Number(floatingCapacity) || 0,

//         Number(totalDesks) || 0,
//         Number(meetingRooms) || 0,

//         Number(bedrooms) || 0,
//         Number(bathrooms) || 0,

//         Number(totalRooms) || 0,
//         Number(bedsPerRoom) || 0,
//       ],
//     );


//     // =====================================================
//     // 2. SEATING STYLES
//     // =====================================================

//     if (
//       seatingStyles &&
//       typeof seatingStyles === 'object'
//     ) {

//       for (
//         const [
//           seatingType,
//           seatingData,
//         ] of Object.entries(
//           seatingStyles,
//         )
//       ) {

//         const data =
//           seatingData as any;

//         await queryRunner.query(
//           `
//           INSERT INTO venue_seating_styles
//           (
//             venue_id,
//             seating_type,
//             is_enabled,
//             capacity,
//             created_at,
//             updated_at
//           )
//           VALUES
//           (?, ?, ?, ?, NOW(), NOW())

//           ON DUPLICATE KEY UPDATE

//             is_enabled = VALUES(is_enabled),
//             capacity = VALUES(capacity),
//             updated_at = NOW()
//           `,
//           [
//             venueId,

//             seatingType,

//             data?.enabled ? 1 : 0,

//             Number(
//               data?.capacity || 0,
//             ),
//           ],
//         );
//       }
//     }


//     // =====================================================
//     // 3. PARKING
//     // =====================================================

//     if (
//       parking &&
//       typeof parking === 'object'
//     ) {

//       await queryRunner.query(
//         `
//         INSERT INTO venue_parking
//         (
//           venue_id,
//           cars,
//           two_wheelers,
//           buses,
//           created_at,
//           updated_at
//         )
//         VALUES
//         (?, ?, ?, ?, NOW(), NOW())

//         ON DUPLICATE KEY UPDATE

//           cars = VALUES(cars),
//           two_wheelers = VALUES(two_wheelers),
//           buses = VALUES(buses),

//           updated_at = NOW()
//         `,
//         [
//           venueId,

//           Number(
//             parking.cars || 0,
//           ),

//           Number(
//             parking.twoWheelers || 0,
//           ),

//           Number(
//             parking.buses || 0,
//           ),
//         ],
//       );
//     }


//     // =====================================================
//     // 4. OPTIONAL:
//     // KEEP OLD venue_child FIELDS IN SYNC
//     // =====================================================

//     await queryRunner.query(
//       `
//       UPDATE venue_child
//       SET
//         min_guest = ?,
//         guest_rooms = ?,
//         cocktail_round = ?,
//         banquet_round = ?
//       WHERE child_venue_id = ?
//       `,
//       [
//         Number(minCapacity) || 0,

//         Number(maxCapacity) || 0,

//         Number(bedsPerRoom) || 0,

//         Number(totalRooms) || 0,

//         venueId,
//       ],
//     );


//     // =====================================================
//     // 5. COMMIT
//     // =====================================================

//     await queryRunner.commitTransaction();


//     return {
//       success: true,
//       message:
//         'Venue capacity updated successfully',
//     };

//   } catch (error) {

//     await queryRunner.rollbackTransaction();

//     console.error(
//       'updateCapacity error:',
//       error,
//     );

//     throw error;

//   } finally {

//     await queryRunner.release();

//   }
// }

async updateCapacity(
  id: any,
  body: any,
) {
  const {
    minCapacity,
    maxCapacity,
    floatingCapacity,

    seatingStyles,

    totalDesks,
    meetingRooms,
    bedrooms,
    bathrooms,
    totalRooms,
    bedsPerRoom,

    parking,
  } = body;

  const venueId = id;

  const queryRunner =
    this.dataSource.createQueryRunner();

  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // =====================================================
    // 1. UPDATE VENUE CHILD
    // =====================================================

    await queryRunner.query(
      `
      UPDATE venue_child
      SET
        min_guest = ?,
        guest_rooms = ?,

        floating_capacity = ?,

        bedrooms = ?,
        bathrooms = ?,
        total_rooms = ?,
        beds_per_room = ?,

        parking_cars = ?,
        parking_two_wheelers = ?,
        parking_buses = ?,

        updated_at = NOW()

      WHERE child_venue_id = ?
      `,
      [
        Number(minCapacity) || 0,

        Number(maxCapacity) || 0,

        Number(floatingCapacity) || 0,

        Number(bedrooms) || 0,
        Number(bathrooms) || 0,
        Number(totalRooms) || 0,
        Number(bedsPerRoom) || 0,

        Number(parking?.cars) || 0,
        Number(parking?.twoWheelers) || 0,
        Number(parking?.buses) || 0,

        venueId,
      ],
    );


    // =====================================================
    // 2. SEATING STYLES
    // =====================================================

    if (
      seatingStyles &&
      typeof seatingStyles === 'object'
    ) {

      for (
        const [
          seatingType,
          seatingData,
        ] of Object.entries(
          seatingStyles,
        )
      ) {
        const data =
          seatingData as any;

        await queryRunner.query(
          `
          INSERT INTO venue_seating_styles
          (
            venue_id,
            seating_type,
            is_enabled,
            capacity,
            created_at,
            updated_at
          )
          VALUES
          (?, ?, ?, ?, NOW(), NOW())

          ON DUPLICATE KEY UPDATE

            is_enabled = VALUES(is_enabled),
            capacity = VALUES(capacity),
            updated_at = NOW()
          `,
          [
            venueId,

            seatingType,

            data?.enabled
              ? 1
              : 0,

            Number(
              data?.capacity || 0,
            ),
          ],
        );
      }
    }


    // =====================================================
    // 3. UPDATE EXISTING VENUE CHILD SEATING COLUMNS
    //
    // Keep old columns synchronized if old APIs still use
    // theater/classroom/etc.
    // =====================================================

    const styles =
      seatingStyles || {};

    await queryRunner.query(
      `
      UPDATE venue_child
      SET

        theater = ?,
        banquet_round = ?,
        classroom = ?,
        boardroom = ?,
        u_shape = ?,
        cocktail_round = ?,
        hollow_square = ?

      WHERE child_venue_id = ?
      `,
      [
        Number(
          styles.theatre?.capacity || 0,
        ),

        Number(
          styles.banquet?.capacity || 0,
        ),

        Number(
          styles.classroom?.capacity || 0,
        ),

        Number(
          styles.boardroom?.capacity || 0,
        ),

        Number(
          styles.ushape?.capacity || 0,
        ),

        Number(
          styles.cocktail?.capacity || 0,
        ),

        Number(
          styles.hollow_square?.capacity || 0,
        ),

        venueId,
      ],
    );


    // =====================================================
    // 4. COMMIT
    // =====================================================

    await queryRunner.commitTransaction();


    // =====================================================
    // 5. RETURN UPDATED DATA
    // =====================================================

    const venue =
      await this.dataSource.query(
        `
        SELECT
          child_venue_id,

          min_guest,
          guest_rooms,
          floating_capacity,

          bedrooms,
          bathrooms,
          total_rooms,
          beds_per_room,

          parking_cars,
          parking_two_wheelers,
          parking_buses,

          theater,
          banquet_round,
          classroom,
          boardroom,
          u_shape,
          cocktail_round,
          hollow_square

        FROM venue_child

        WHERE child_venue_id = ?
        `,
        [venueId],
      );


    const seating =
      await this.dataSource.query(
        `
        SELECT
          id,
          venue_id,
          seating_type,
          is_enabled,
          capacity,
          sort_order,
          created_at,
          updated_at

        FROM venue_seating_styles

        WHERE venue_id = ?

        ORDER BY
          sort_order ASC,
          id ASC
        `,
        [venueId],
      );


    return {
      success: true,

      message:
        'Venue capacity updated successfully',

      data: {
        venue:
          venue?.[0] || null,

        seatingStyles:
          seating,
      },
    };

  } catch (error) {

    await queryRunner.rollbackTransaction();

    console.error(
      'updateCapacity error:',
      error,
    );

    throw error;

  } finally {

    await queryRunner.release();

  }
}

  /* ─────────────────────────────
     AMENITIES
  ───────────────────────────── */

  async updateAmenities(id: any, body: any) {
    const amenities = this.safeJson(body.selected_amenities);

    await this.dataSource.query(
      `DELETE FROM venue_child_amenities
       WHERE child_venue_id = ?`,
      [id],
    );

    for (const a of amenities) {
      await this.dataSource.query(
        `INSERT INTO venue_child_amenities
        (child_venue_id, amenities_id)
        VALUES (?, ?)`,
        [id, a],
      );
    }

    return {
      success: true,
    };
  }

  /* ─────────────────────────────
     LOCATION
  ───────────────────────────── */

  async updateLocation(id: any, body: any) {
    const { address, city, state, pincode, country } = body;

    // await this.dataSource.query(
    //   `UPDATE venue_child SET
    //     address = ?,
    //     city = ?,
    //     state = ?,
    //     pincode = ?,
    //     country = ?
    //   WHERE child_venue_id = ?`,
    //   [address, city, state, pincode, country, id],
    // );

    return {
      success: true,
    };
  }

  private formatDuration(
  totalMinutes: number,
): string {
  const minutes = Math.round(
    Number(totalMinutes) || 0,
  );

  const hours = Math.floor(
    minutes / 60,
  );

  const remainingMinutes =
    minutes % 60;

  if (hours > 0 && remainingMinutes > 0) {
    return `${hours} hr ${remainingMinutes} min`;
  }

  if (hours > 0) {
    return `${hours} hr`;
  }

  return `${remainingMinutes} min`;
}

  /* ─────────────────────────────
     TAGS
  ───────────────────────────── */

  async updateTags(id: any, body: any) {
    const venue_tags = this.safeJson(body.venue_tags);

    const event_tags = this.safeJson(body.event_tags);

    await this.dataSource.query(
      `DELETE FROM venue_tags
       WHERE child_venue_id = ?`,
      [id],
    );

    for (const tag of venue_tags) {
      await this.dataSource.query(
        `INSERT INTO venue_tags
        (child_venue_id, venue_cat_id)
        VALUES (?, ?)`,
        [id, tag],
      );
    }

    await this.dataSource.query(
      `DELETE FROM venue_event_tags
       WHERE child_venue_id = ?`,
      [id],
    );

    for (const tag of event_tags) {
      await this.dataSource.query(
        `INSERT INTO venue_event_tags
        (child_venue_id, event_id)
        VALUES (?, ?)`,
        [id, tag],
      );
    }

    return {
      success: true,
    };
  }

  /* ─────────────────────────────
     PRICING
  ───────────────────────────── */

  async updatePricing(id: any, body: any) {
    const pricing = this.safeJson(body.pricing);

   if (body.type === "venue") {
  const shiftMap: Record<string, number> = {
    morning: 1,
    afternoon: 2,
    evening: 3,
    full_day: 4,
  };

  for (const [key, value] of Object.entries(pricing)) {
    const shiftId = shiftMap[key];
    if (!shiftId) continue;

    const shift: any = value;

    // Check if shift header exists
    const header = await this.dataSource.query(
      `SELECT id
       FROM venue_shift_header
       WHERE child_id = ?
         AND Shift_type = ?
       LIMIT 1`,
      [id, shiftId]
    );

    if (header.length > 0) {
      // Update existing shift header
      await this.dataSource.query(
        `UPDATE venue_shift_header
         SET
            publish = ?,
            from_time = ?,
            to_time = ?,
            base_price_update = ?
         WHERE child_id = ?
           AND Shift_type = ?`,
        [
          shift.enabled ? 1 : 0,
          shift.start ?? null,
          shift.end ?? null,
          shift.price ?? 0,
          id,
          shiftId,
        ]
      );
    } else if (shift.enabled) {
      // Insert new shift header only when enabled
      await this.dataSource.query(
        `INSERT INTO venue_shift_header
        (
          name,
          custom_name,
          Shift_type,
          child_id,
          from_time,
          to_time,
          base_price_update,
          publish,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [
          key.charAt(0).toUpperCase() + key.slice(1), // Morning
          key.charAt(0).toUpperCase() + key.slice(1),
          shiftId,
          id,
          shift.start ?? null,
          shift.end ?? null,
          shift.price ?? 0,
        ]
      );
    }

    // Venue shift timing
    // await this.dataSource.query(
    //   `INSERT INTO venue_shift_timing
    //   (
    //     child_venue_id,
    //     shift_type,
    //     price,
    //     from_time,
    //     to_time
    //   )
    //   VALUES (?, ?, ?, ?, ?)
    //   ON DUPLICATE KEY UPDATE
    //     price = VALUES(price),
    //     from_time = VALUES(from_time),
    //     to_time = VALUES(to_time)`,
    //   [
    //     id,
    //     shiftId,
    //     shift.price ?? 0,
    //     shift.start ?? null,
    //     shift.end ?? null,
    //   ]
    // );
    const timing= await this.dataSource.query(
  `SELECT id
   FROM venue_shift_timing
   WHERE child_venue_id = ?
     AND shift_type = ?
   LIMIT 1`,
  [id, shiftId]
);

if (timing.length > 0) {
  await this.dataSource.query(
    `UPDATE venue_shift_timing
     SET
       price = ?,
       from_time = ?,
       to_time = ?
     WHERE id = ?`,
    [
      shift.price ?? 0,
      shift.start ?? null,
      shift.end ?? null,
      timing[0].id,
    ]
  );
} else {
  await this.dataSource.query(
    `INSERT INTO venue_shift_timing
      (
        child_venue_id,
        shift_type,
        price,
        from_time,
        to_time
      )
     VALUES (?, ?, ?, ?, ?)`,
    [
      id,
      shiftId,
      shift.price ?? 0,
      shift.start ?? null,
      shift.end ?? null,
    ]
  );
}
  }
}
  else
  {
const pricingRows = [
  {
    pricing_key: "nightly",
    amount: body.pricing.nightlyRate,
  },
  {
    pricing_key: "weekly",
    amount: body.pricing.weekendRate,
  },
  {
    pricing_key: "cleaning_fee",
    amount: body.pricing.cleaningFee,
  },
];

for (const item of pricingRows) {
  if (!item.amount) continue;

  const existing = await this.dataSource.query(
    `
    SELECT id
    FROM property_pricing
    WHERE child_venue_id = ?
      AND pricing_key = ?
    LIMIT 1
    `,
    [id, item.pricing_key]
  );

  if (existing.length) {
    await this.dataSource.query(
      `
      UPDATE property_pricing
      SET amount = ?
      WHERE child_venue_id = ?
        AND pricing_key = ?
      `,
      [item.amount, id, item.pricing_key]
    );
  } else {
    await this.dataSource.query(
      `
      INSERT INTO property_pricing
      (
        child_venue_id,
        name,
        pricing_key,
        amount,
        enabled,
        category
      )
      VALUES (?, ?, ?, ?, 1, ?)
      `,
      [
        id,
        item.pricing_key,
        item.pricing_key,
        item.amount,
        body.type,
      ]
    );
  }
}
  }

    return {
      success: true,
    };
  }

  /* ─────────────────────────────
     TERMS
  ───────────────────────────── */

  // async updateTerms(id: any, body: any) {
  //   const { cancellationPolicy, houseRules, termsAccepted } = body;

  //   const existing = await this.dataSource.query(
  //     `SELECT id
  //      FROM venue_terms_condition
  //      WHERE child_venue_id = ?`,
  //     [id],
  //   );

  //   if (existing.length > 0) {
  //     await this.dataSource.query(
  //       `UPDATE venue_terms_condition
  //        SET cancellation_policy = ?,
  //            venue_rule = ?,
  //            platform_agreement = ?,
  //            updated_at = NOW()
  //        WHERE child_venue_id = ?`,
  //       [cancellationPolicy, houseRules, termsAccepted ? 1 : 0, id],
  //     );
  //   } else {
  //     await this.dataSource.query(
  //       `INSERT INTO venue_terms_condition
  //       (
  //         child_venue_id,
  //         cancellation_policy,
  //         venue_rule,
  //         platform_agreement,
  //         created_at,
  //         updated_at
  //       )
  //       VALUES (?, ?, ?, ?, NOW(), NOW())`,
  //       [id, cancellationPolicy, houseRules, termsAccepted ? 1 : 0],
  //     );
  //   }

  //   return {
  //     success: true,
  //   };
  // }

 async updateTerms(
  id: any,
  body: any,
) {
  const {
    cancellationPolicy,
    customCancellationTiers,
    houseRules,
    policies,
    termsAccepted,
    cancellationWindowDays,
  } = body;

  const venueId = id;

  const queryRunner =
    this.dataSource.createQueryRunner();

  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {

    // =====================================================
    // 1. VENUE TERMS CONDITION
    // =====================================================

    const existingTerms =
      await queryRunner.query(
        `
        SELECT id
        FROM venue_terms_condition
        WHERE child_venue_id = ?
        LIMIT 1
        `,
        [venueId],
      );


    if (existingTerms.length > 0) {

      await queryRunner.query(
        `
        UPDATE venue_terms_condition
        SET
          cancellation_policy = ?,
          venue_rule = ?,
          platform_agreement = ?,
          plus_days = ?,
          updated_at = NOW()
        WHERE child_venue_id = ?
        `,
        [
          cancellationPolicy || null,
          houseRules || null,
          termsAccepted ? 1 : 0,
          cancellationWindowDays,
          venueId,
        ],
      );

    } else {

      await queryRunner.query(
        `
        INSERT INTO venue_terms_condition
        (
          child_venue_id,
          cancellation_policy,
          venue_rule,
          platform_agreement,
          plus_days,
          created_at,
          updated_at
        )
        VALUES
        (?, ?, ?, ?, NOW(), NOW())
        `,
        [
          venueId,
          cancellationPolicy || null,
          houseRules || null,
          termsAccepted ? 1 : 0,
          cancellationWindowDays
        ],
      );

    }


    // =====================================================
    // 2. CUSTOM CANCELLATION TIERS
    // =====================================================

    // Always remove old tiers first.
    // This prevents duplicate/stale tiers.
    await queryRunner.query(
      `
      DELETE FROM venue_cancellation_tiers
      WHERE venue_id = ?
      `,
      [venueId],
    );


    // Insert only when custom policy is selected
    if (
      cancellationPolicy === 'custom' &&
      Array.isArray(
        customCancellationTiers,
      )
    ) {

      for (
        let index = 0;
        index <
        customCancellationTiers.length;
        index++
      ) {

        const tier =
          customCancellationTiers[index];

        await queryRunner.query(
          `
          INSERT INTO venue_cancellation_tiers
          (
            venue_id,
            tier_no,
            from_days,
            to_days,
            refund_percentage,
            is_active,
            created_at,
            updated_at
          )
          VALUES
          (?, ?, ?, ?, ?, 1, NOW(), NOW())
          `,
          [
            venueId,

            index + 1,

            Number(
              tier?.fromDays || 0,
            ),

            Number(
              tier?.toDays || 0,
            ),

            Number(
              tier?.refund || 0,
            ),
          ],
        );

      }
    }


    // =====================================================
    // 3. VENUE POLICIES
    // =====================================================

    const existingPolicies =
      await queryRunner.query(
        `
        SELECT id
        FROM venue_policies
        WHERE venue_id = ?
        LIMIT 1
        `,
        [venueId],
      );


    const musicTiming =
      policies?.musicTiming || {};


    const morning =
      musicTiming?.morning || null;

    const afternoon =
      musicTiming?.afternoon || null;

    const evening =
      musicTiming?.evening || null;


    const noiseRestriction =
      policies?.noiseRestriction || null;

    const outsideVendorsAllowed =
      policies?.outsideVendorsAllowed
        ? 1
        : 0;

    const decorRule =
      policies?.decorRule || null;

    const smokingPolicy =
      policies?.smoking || null;

    const petsAllowed =
      policies?.petsAllowed
        ? 1
        : 0;


    if (existingPolicies.length > 0) {

      // =================================================
      // UPDATE EXISTING POLICIES
      // =================================================

      await queryRunner.query(
        `
        UPDATE venue_policies
        SET
          music_morning_until = ?,
          music_afternoon_until = ?,
          music_evening_until = ?,

          noise_restriction = ?,

          outside_vendors_allowed = ?,

          decor_rule = ?,

          smoking_policy = ?,

          pets_allowed = ?,

          updated_at = NOW()

        WHERE venue_id = ?
        `,
        [
          morning,
          afternoon,
          evening,

          noiseRestriction,

          outsideVendorsAllowed,

          decorRule,

          smokingPolicy,

          petsAllowed,

          venueId,
        ],
      );

    } else {

      // =================================================
      // INSERT NEW POLICIES
      // =================================================

      await queryRunner.query(
        `
        INSERT INTO venue_policies
        (
          venue_id,

          music_morning_until,
          music_afternoon_until,
          music_evening_until,

          noise_restriction,

          outside_vendors_allowed,

          decor_rule,

          smoking_policy,

          pets_allowed,

          created_at,
          updated_at
        )
        VALUES
        (
          ?, ?, ?, ?,
          ?, ?,
          ?, ?,
          ?,
          NOW(), NOW()
        )
        `,
        [
          venueId,

          morning,
          afternoon,
          evening,

          noiseRestriction,

          outsideVendorsAllowed,

          decorRule,

          smokingPolicy,

          petsAllowed,
        ],
      );

    }


    // =====================================================
    // 4. COMMIT
    // =====================================================

    await queryRunner.commitTransaction();


    return {
      success: true,
      message:
        'Terms and policies updated successfully',
    };

  } catch (error) {

    await queryRunner.rollbackTransaction();

    console.error(
      'updateTerms error:',
      error,
    );

    throw error;

  } finally {

    await queryRunner.release();
  }
}

  /* ─────────────────────────────
     PHOTOS
  ───────────────────────────── */
// async updatePhotos(id: string, body: any, files: any[],uid:any) {
//   const photoSections = this.safeJson(body.photoSections);
//   const existingPhotos = this.safeJson(body.existingPhotos);

//   const fileMap = new Map<string, any>();

//   for (const file of files || []) {
//     fileMap.set(file.id, file);
//   }

//   const finalPhotos: string[] = [];

//   /*
//   ---------------------------
//   MAIN PHOTOS (UNCHANGED)
//   ---------------------------
//   */
//   for (const photo of existingPhotos) {
//     if (typeof photo === 'string') {
//       finalPhotos.push(photo);
//       continue;
//     }

//     if (photo?.type === 'new') {
//       const file = fileMap.get(photo.id);

//       if (!file) continue;

//       const url = await this.storageService.upload(
//         file,
//         'venue/photos',
//       );

//       finalPhotos.push(url);
//     }

//     if (photo?.path) {
//       finalPhotos.push(photo.path);
//     }
//   }

//   /*
// -----------------------------------
// MAIN PHOTOS DB UPDATE
// -----------------------------------
// */

// for (const photo of finalPhotos) {
//   const exists = await this.dataSource.query(
//     `SELECT id 
//      FROM venue_gallery
//      WHERE child_venue_id = ?
//      AND attachment = ?`,
//     [id, photo],
//   );

//   if (!exists.length) {
//     await this.dataSource.query(
//       `INSERT INTO venue_gallery
//       (child_venue_id, g_category, attachment, created_at) 
//       VALUES (?, ?, ?, NOW())`,
//       [id,exists.g_category, photo],
//     );
//   }
// }

//   /*
//   ---------------------------
//   SECTIONS + DB FIXED
//   ---------------------------
//   */
//   for (const section of photoSections || []) {
//     const { id: sectionId, name, description, images = [] } = section;

//     // ✅ 1. CATEGORY UPSERT (FIXED POSITION)
//     let category: any = await this.dataSource.query(
//       `SELECT id
//        FROM venue_gallery_category
//        WHERE child_id = ?
//        AND name = ?`,
//       [id, name],
//     );

//     let categoryId: any;

//     if (!category.length) {
//       const result = await this.dataSource.query(
//         `INSERT INTO venue_gallery_category
//         (child_id, name, description, created_at, updated_at)
//         VALUES (?, ?, ?, NOW(), NOW())`,
//         [id, name, description],
//       );

//       categoryId = result.insertId;
//     } else {
//       categoryId = category[0].id;

//       await this.dataSource.query(
//         `UPDATE venue_gallery_category
//          SET name = ?,
//              description = ?,
//              updated_at = NOW()
//          WHERE id = ?`,
//         [name, description, categoryId],
//       );
//     }

//     /*
//     ---------------------------
//     2. IMAGE PROCESSING + INSERT
//     ---------------------------
//     */
//     for (const img of images || []) {
//       let finalUrl = '';

//       // EXISTING
//       if (img.type === 'existing') {
//         finalUrl = img.path;
//       }

//       // NEW UPLOAD
//       if (img.type === 'new') {
//         const file = fileMap.get(img.id);

//         if (!file) continue;

//         finalUrl = await this.storageService.upload(
//           file,
//           'venue/gallery',
//         );
//       }

//       if (!finalUrl) continue;

//       // CHECK EXIST
//       const exists = await this.dataSource.query(
//         `SELECT id
//          FROM venue_gallery
//          WHERE child_venue_id = ?
//          AND g_category = ?
//          AND attachment = ?`,
//         [id, categoryId, finalUrl],
//       );

//       // INSERT IF NOT EXISTS
//       if (!exists.length) {
//         await this.dataSource.query(
//           `INSERT INTO venue_gallery
//           (child_venue_id, g_category, attachment, created_at)
//           VALUES (?, ?, ?, NOW())`,
//           [id, categoryId, finalUrl],
//         );
//       }
//     }
//   }

//   return {
//     success: true,
//     photos: finalPhotos,
//   };
// }
// async updatePhotos(id: string, body: any, files: any[], uid: any , reel?: any,) {
//   const photoSections = this.safeJson(body.photoSections);
//   const existingPhotos = this.safeJson(body.existingPhotos);

//   const fileMap = new Map<string, any>();

//   for (const file of files || []) {
//     fileMap.set(file.id, file);
//   }

//   const finalPhotos: string[] = [];

//   /*
//   ---------------------------
//   MAIN PHOTOS
//   ---------------------------
//   Only photos that are genuinely NEW get uploaded + inserted. Anything
//   already existing (plain string, or { type: 'existing' }) is left alone —
//   no upload call, no DB write — it's already there. This also fixes the
//   duplicate-insert bug: the old code ran the exists-check/insert against
//   every photo including untouched existing ones.
//   */
//   let newCoverUrl: string | null = null;

//   for (const photo of existingPhotos || []) {
//     // Legacy shape — a bare existing URL string. Nothing to do.
//     if (typeof photo === 'string') {
//       finalPhotos.push(photo);
//       continue;
//     }

//     // Already-existing photo (untouched). Skip upload/insert entirely.
//     if (photo?.type === 'existing') {
//       finalPhotos.push(photo.path);

//       if (photo.isCover || photo.category_key === 2) {
//         newCoverUrl = photo.path;
//       }
//       continue;
//     }

//     // Genuinely new photo — upload it, then insert once.
//     if (photo?.type === 'new') {
//       const file = fileMap.get(photo.id);

//       if (!file) continue;

//       const url = await this.storageService.upload(file, 'venue/photos');

//       finalPhotos.push(url);

//       // category_key: 2 = cover, 3 = additional — read from the photo
//       // itself (the frontend already computes this), not derived from
//       // a broken `exists` reference like before.
//       const categoryKey = photo.isCover ? 2 : (photo.category_key || 3);

//       await this.dataSource.query(
//         `INSERT INTO venue_gallery
//          (child_venue_id, g_category, attachment, created_at)
//          VALUES (?, ?, ?, NOW())`,
//         [id, categoryKey, url],
//       );

//       if (photo.isCover) {
//         newCoverUrl = url;
//       }
//     }
//   }

//   /*
//   ---------------------------
//   COVER PROMOTION / DEMOTION
//   ---------------------------
//   Whatever photo is currently flagged as cover (existing or new) becomes
//   g_category = 2. Any other row for this venue that was previously marked
//   as cover gets demoted to 3, so there's never more than one cover row.
//   */
//   if (newCoverUrl) {
//     // Demote any previous cover that isn't the current one.
//     await this.dataSource.query(
//       `UPDATE venue_gallery
//        SET g_category = 3
//        WHERE child_venue_id = ?
//        AND g_category = 2
//        AND attachment != ?`,
//       [id, newCoverUrl],
//     );

//     // Promote the current cover (covers the case where it was an
//     // *existing* photo that just got dragged to position 0 — its DB row
//     // already exists, we just need to flip its category).
//     await this.dataSource.query(
//       `UPDATE venue_gallery
//        SET g_category = 2
//        WHERE child_venue_id = ?
//        AND attachment = ?`,
//       [id, newCoverUrl],
//     );
//   }

//   /*
//   ---------------------------
//   SECTIONS
//   ---------------------------
//   Unchanged from your version — category upsert, then only upload/insert
//   images whose type is 'new'; existing section images already have a row
//   and are skipped.
//   */
//   for (const section of photoSections || []) {
//     const { id: sectionId, name, description, images = [] } = section;

//     let category: any = await this.dataSource.query(
//       `SELECT id
//        FROM venue_gallery_category
//        WHERE child_id = ?
//        AND name = ?`,
//       [id, name],
//     );

//     let categoryId: any;

//     if (!category.length) {
//       const result = await this.dataSource.query(
//         `INSERT INTO venue_gallery_category
//         (child_id, name, description, created_at, updated_at)
//         VALUES (?, ?, ?, NOW(), NOW())`,
//         [id, name, description],
//       );

//       categoryId = result.insertId;
//     } else {
//       categoryId = category[0].id;

//       await this.dataSource.query(
//         `UPDATE venue_gallery_category
//          SET name = ?,
//              description = ?,
//              updated_at = NOW()
//          WHERE id = ?`,
//         [name, description, categoryId],
//       );
//     }

//     for (const img of images || []) {
//       // Existing section image — already has a DB row, skip entirely.
//       if (img.type === 'existing') continue;

//       // New section image — upload + insert.
//       if (img.type !== 'new') continue;

//       const file = fileMap.get(img.id);

//       if (!file) continue;

//       const finalUrl = await this.storageService.upload(file, 'venue/gallery');

//       if (!finalUrl) continue;

//       const exists = await this.dataSource.query(
//         `SELECT id
//          FROM venue_gallery
//          WHERE child_venue_id = ?
//          AND g_category = ?
//          AND attachment = ?`,
//         [id, categoryId, finalUrl],
//       );

//       if (!exists.length) {
//         await this.dataSource.query(
//           `INSERT INTO venue_gallery
//           (child_venue_id, g_category, attachment, created_at)
//           VALUES (?, ?, ?, NOW())`,
//           [id, categoryId, finalUrl],
//         );
//       }
//     }
//   }

//  /*
// ---------------------------------
// REEL UPLOAD
// ---------------------------------
// Only one reel per venue
// */
// // if (reel) {
// //   const existingReel = await this.dataSource.query(
// //     `
// //     SELECT id, attachment
// //     FROM venue_gallery
// //     WHERE child_venue_id = ?
// //     AND g_category = 999
// //     LIMIT 1
// //     `,
// //     [id],
// //   );

// //   if (existingReel.length) {
// //     try {
// //       await this.storageService.delete(
// //         existingReel[0].attachment,
// //       );
// //     } catch (e) {
// //       console.error('Failed deleting old reel', e);
// //     }

// //     await this.dataSource.query(
// //       `
// //       DELETE FROM venue_gallery
// //       WHERE id = ?
// //       `,
// //       [existingReel[0].id],
// //     );
// //   }

// //   const reelUrl = await this.storageService.upload(
// //     reel,
// //     'venue/reels',
// //   );

// //   await this.dataSource.query(
// //     `
// //     INSERT INTO venue_gallery
// //     (
// //       child_venue_id,
// //       g_category,
// //       attachment,
// //       created_at
// //     )
// //     VALUES (?, 999, ?, NOW())
// //     `,
// //     [id, reelUrl],
// //   );
// // }

//   return {
//     success: true,
//     photos: finalPhotos,
//   };
// }
async updatePhotos(
  id: string,
  body: any,
  files: any[],
  uid: any,
  reel?: any,
) {
  const photoSections = this.safeJson(body.photoSections);
  const existingPhotos = this.safeJson(body.existingPhotos);

  /*
  --------------------------------
  FILE MAP
  --------------------------------
  Frontend UUID -> uploaded file
  */
  const fileMap = new Map<string, any>();

  for (const file of files || []) {
    fileMap.set(file.id, file);
  }

  const finalPhotos: string[] = [];

  /*
  --------------------------------
  MAIN PHOTOS
  --------------------------------
  */

  let newCoverUrl: string | null = null;

  for (const photo of existingPhotos || []) {

    /*
    --------------------------------
    LEGACY STRING
    --------------------------------
    */
    if (typeof photo === 'string') {
      finalPhotos.push(photo);
      continue;
    }

    /*
    --------------------------------
    EXISTING PHOTO
    --------------------------------
    Existing photo was not changed.
    
    DO NOT:
    - upload
    - insert
    - update
    */
    if (photo?.type === 'existing') {

      if (photo?.path) {
        finalPhotos.push(photo.path);
      }

      if (
        photo?.isCover ||
        photo?.category_key === 2
      ) {
        newCoverUrl = photo.path;
      }

      continue;
    }

    /*
    --------------------------------
    NEW / REPLACED PHOTO
    --------------------------------
    */
    if (photo?.type === 'new') {

      const file = fileMap.get(photo.id);

      if (!file) {
        console.warn(
          `Photo file not found: ${photo.id}`,
        );

        continue;
      }

      /*
      --------------------------------
      UPLOAD NEW PHOTO
      --------------------------------
      */
      const url = await this.storageService.upload(
        file,
        'venue/photos',
      );

      if (!url) {
        console.warn(
          `Photo upload failed: ${photo.id}`,
        );

        continue;
      }

      finalPhotos.push(url);

      /*
      --------------------------------
      CATEGORY
      --------------------------------
      2 = Cover
      3 = Additional
      */
      const categoryKey = photo.isCover
        ? 2
        : (photo.category_key || 3);

      /*
      --------------------------------
      REPLACEMENT
      --------------------------------
      gallery_id means this image already
      exists in venue_gallery.

      Therefore UPDATE instead of INSERT.
      */
      if (photo.gallery_id) {

        const existingGallery =
          await this.dataSource.query(
            `
            SELECT
              id,
              attachment,
              g_category
            FROM venue_gallery
            WHERE id = ?
            AND child_venue_id = ?
            LIMIT 1
            `,
            [
              photo.gallery_id,
              id,
            ],
          );

        if (existingGallery.length) {

          const oldAttachment =
            existingGallery[0].attachment;

          /*
          --------------------------------
          UPDATE EXISTING ROW
          --------------------------------
          */
          await this.dataSource.query(
            `
            UPDATE venue_gallery
            SET
              attachment = ?,
              g_category = ?
            WHERE id = ?
            AND child_venue_id = ?
            `,
            [
              url,
              categoryKey,
              photo.gallery_id,
              id,
            ],
          );

          /*
          --------------------------------
          DELETE OLD STORAGE FILE
          --------------------------------
          */
          if (
            oldAttachment &&
            oldAttachment !== url
          ) {
            try {
              await this.storageService.delete(
                oldAttachment,
              );
            } catch (error) {
              console.error(
                'Failed to delete old photo:',
                error,
              );
            }
          }

        } else {

          /*
          --------------------------------
          GALLERY ID DOES NOT EXIST
          --------------------------------
          Treat as new photo.
          --------------------------------
          */
          await this.dataSource.query(
            `
            INSERT INTO venue_gallery
            (
              child_venue_id,
              g_category,
              attachment,
              created_at
            )
            VALUES (?, ?, ?, NOW())
            `,
            [
              id,
              categoryKey,
              url,
            ],
          );
        }

      } else {

        /*
        --------------------------------
        BRAND NEW PHOTO
        --------------------------------
        No gallery_id means this is a
        genuinely new photo.
        --------------------------------
        */
        await this.dataSource.query(
          `
          INSERT INTO venue_gallery
          (
            child_venue_id,
            g_category,
            attachment,
            created_at
          )
          VALUES (?, ?, ?, NOW())
          `,
          [
            id,
            categoryKey,
            url,
          ],
        );
      }

      /*
      --------------------------------
      CURRENT COVER
      --------------------------------
      */
      if (photo.isCover) {
        newCoverUrl = url;
      }
    }
  }

  /*
  ================================================
  COVER PROMOTION / DEMOTION
  ================================================
  */

  if (newCoverUrl) {

    /*
    --------------------------------
    DEMOTE OLD COVER
    --------------------------------
    */
    await this.dataSource.query(
      `
      UPDATE venue_gallery
      SET g_category = 3
      WHERE child_venue_id = ?
      AND g_category = 2
      AND attachment != ?
      `,
      [
        id,
        newCoverUrl,
      ],
    );

    /*
    --------------------------------
    PROMOTE CURRENT COVER
    --------------------------------
    */
    await this.dataSource.query(
      `
      UPDATE venue_gallery
      SET g_category = 2
      WHERE child_venue_id = ?
      AND attachment = ?
      `,
      [
        id,
        newCoverUrl,
      ],
    );
  }

  /*
  ================================================
  PHOTO SECTIONS
  ================================================
  */

  for (const section of photoSections || []) {

    const {
      id: sectionId,
      name,
      description,
      images = [],
    } = section;

    /*
    --------------------------------
    FIND CATEGORY
    --------------------------------
    */
    let category =
      await this.dataSource.query(
        `
        SELECT id
        FROM venue_gallery_category
        WHERE child_id = ?
        AND name = ?
        `,
        [
          id,
          name,
        ],
      );

    let categoryId: any;

    /*
    --------------------------------
    CREATE CATEGORY
    --------------------------------
    */
    if (!category.length) {

      const result =
        await this.dataSource.query(
          `
          INSERT INTO venue_gallery_category
          (
            child_id,
            name,
            description,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, NOW(), NOW())
          `,
          [
            id,
            name,
            description,
          ],
        );

      categoryId = result.insertId;

    } else {

      /*
      --------------------------------
      UPDATE CATEGORY
      --------------------------------
      */
      categoryId = category[0].id;

      await this.dataSource.query(
        `
        UPDATE venue_gallery_category
        SET
          name = ?,
          description = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          name,
          description,
          categoryId,
        ],
      );
    }

    /*
    --------------------------------
    SECTION IMAGES
    --------------------------------
    */

    for (const img of images || []) {

      /*
      --------------------------------
      EXISTING SECTION IMAGE
      --------------------------------
      */
      if (img?.type === 'existing') {
        continue;
      }

      /*
      --------------------------------
      ONLY NEW SECTION IMAGE
      --------------------------------
      */
      if (img?.type !== 'new') {
        continue;
      }

      const file = fileMap.get(img.id);

      if (!file) {
        continue;
      }

      /*
      --------------------------------
      UPLOAD
      --------------------------------
      */
      const finalUrl =
        await this.storageService.upload(
          file,
          'venue/gallery',
        );

      if (!finalUrl) {
        continue;
      }

      /*
      --------------------------------
      CHECK DUPLICATE
      --------------------------------
      */
      const exists =
        await this.dataSource.query(
          `
          SELECT id
          FROM venue_gallery
          WHERE child_venue_id = ?
          AND g_category = ?
          AND attachment = ?
          `,
          [
            id,
            categoryId,
            finalUrl,
          ],
        );

      /*
      --------------------------------
      INSERT ONLY IF NOT EXISTS
      --------------------------------
      */
      if (!exists.length) {

        await this.dataSource.query(
          `
          INSERT INTO venue_gallery
          (
            child_venue_id,
            g_category,
            attachment,
            created_at
          )
          VALUES (?, ?, ?, NOW())
          `,
          [
            id,
            categoryId,
            finalUrl,
          ],
        );
      }
    }
  }

  /*
  ================================================
  REEL
  ================================================
  
  g_category = 999 means Reel.
  
  If a new reel is uploaded:
    1. Find old reel
    2. Delete old storage file
    3. Delete old DB row
    4. Upload new reel
    5. Insert new DB row
  
  If no reel is uploaded:
    Nothing happens.
  ================================================
  */

  if (reel) {

    /*
    --------------------------------
    FIND EXISTING REEL
    --------------------------------
    */
    const existingReel =
      await this.dataSource.query(
        `
        SELECT
          id,
          reel_url
        FROM venue_reels
        WHERE child_venue_id = ?
        LIMIT 1
        `,
        [id],
      );

    /*
    --------------------------------
    DELETE OLD REEL
    --------------------------------
    */
    if (existingReel.length) {

      const oldReel =
        existingReel[0];

      /*
      Delete old storage file
      */
      if (oldReel.attachment) {
        try {
          await this.storageService.delete(
            oldReel.attachment,
          );
        } catch (error) {
          console.error(
            'Failed to delete old reel:',
            error,
          );
        }
      }

      /*
      Delete old DB record
      */
      await this.dataSource.query(
        `
        DELETE FROM venue_reels
        WHERE id = ?
        AND child_venue_id = ?
        `,
        [
          oldReel.id,
          id,
        ],
      );
    }

    /*
    --------------------------------
    UPLOAD NEW REEL
    --------------------------------
    */
    const reelUrl =
      await this.storageService.upload(
        reel,
        'venue/reels',
      );

    if (reelUrl) {

      /*
      --------------------------------
      INSERT NEW REEL
      --------------------------------
      */
      await this.dataSource.query(
        `
        INSERT INTO venue_reels
        (
          child_venue_id,
          reel_url,
          created_at
        )
        VALUES (?, ?, NOW())
        `,
        [
          id,
          reelUrl,
        ],
      );
    }
  }

  /*
  ================================================
  RESPONSE
  ================================================
  */

  return {
    success: true,
    photos: finalPhotos,
  };
}



safeJson(val: any): any[] {
  if (!val) return [];

  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return [];
    }
  }

  return val;
}

//   async SaveVenueSetting(id: any, body: any) {
//     const entries = Object.entries(body.data);

//     let publishStatus: number | null = null;

//     // detect publication status
//     for (const [key, value] of entries) {
//       if (key === 'status') {
//         publishStatus = value === 'live' ? 1 : 0;
//       }
//     }

//     // save settings
//     await Promise.all(
//       entries.map(([key, value]) => {
//         return this.dataSource.query(
//           `
//         INSERT INTO venue_child_settings
//         (
//           child_id,
//           \`group\`,
//           \`key\`,
//           \`value\`
//         )

//         VALUES (?, ?, ?, ?)

//         ON DUPLICATE KEY UPDATE
//         value = VALUES(value)
//         `,
//           [id, body.section, key, String(value)],
//         );
//       }),
//     );

//     // update publish status
//     if (publishStatus !== null) {
//       await this.dataSource.query(
//         `
//       UPDATE venue_child
//       SET publish_status = ?
//       WHERE child_venue_id = ?
//       `,
//         [publishStatus, id],
//       );
//     }

//     //Globally Refresh 
// this.socketService.broadcast(
//   'Setting',
//   `Setting Updated`
// );

//     return {
//       success: true,
//     };
//   }
  //addons
 async SaveVenueSetting(id: any, body: any) {
  const entries = Object.entries(body.data);

  let publishStatus: number | null = null;

  // Detect publication status
  for (const [key, value] of entries) {
    if (key === 'status') {
      publishStatus = value === 'live' ? 1 : 0;
    }
  }

  // Save settings
  await Promise.all(
    entries.map(([key, value]) => {
      let dbValue: string;

      // Convert objects/arrays to JSON
      if (value !== null && typeof value === 'object') {
        dbValue = JSON.stringify(value);
      } else {
        dbValue = String(value);
      }

      return this.dataSource.query(
        `
          INSERT INTO venue_child_settings
          (
            child_id,
            \`group\`,
            \`key\`,
            \`value\`
          )
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            value = VALUES(value)
        `,
        [id, body.section, key, dbValue],
      );
    }),
  );

  // Update publish status
  if (publishStatus !== null) {
    await this.dataSource.query(
      `
        UPDATE venue_child
        SET publish_status = ?
        WHERE child_venue_id = ?
      `,
      [publishStatus, id],
    );
  }

  // Globally Refresh
  this.socketService.broadcast(
    'Setting',
    'Setting Updated',
  );

  return {
    success: true,
  };
}
  async SaveCategory(user_id: number, body: any) {
  const name = body.name?.trim();

  if (!name) {
    throw new BadRequestException('Category name is required');
  }

  const exists = await this.dataSource.query(
    `
    SELECT id
    FROM add_on_categories
    WHERE created_by = ?
      AND LOWER(name) = LOWER(?)
    LIMIT 1
    `,
    [user_id, name],
  );

  if (exists.length) {
    throw new ConflictException('Category already exists');
  }

  const result = await this.dataSource.query(
    `
    INSERT INTO add_on_categories
    (
      created_by,
      name,
      gradient,
      iconKey,
      strip,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `,
    [
      user_id,
      name,
      body.gradient || null,
      body.iconKey || null,
      body.strip || null,
    ],
  );

  return {
    success: true,
    message: 'Category created successfully',
    id: result.insertId,
  };
}
 async LoadaddonCategory(user_id: number) {
 const addonCategory = await this.dataSource.query(
    `
    SELECT *
    FROM add_on_categories
    WHERE created_by = ?
    `,
    [user_id],
  );
  return addonCategory;
 }

async SaveAddon(userId: number, body: any, files: any[]) {
  let categoryId: number;

  // Find category
  const category = await this.dataSource.query(
    `
    SELECT id
    FROM add_on_categories
    WHERE created_by = ?
      AND LOWER(name) = LOWER(?)
    LIMIT 1
    `,
    [userId, body.category],
  );

  // Create category if not exists
  if (category.length === 0) {
    const insertCategory: any = await this.dataSource.query(
      `
      INSERT INTO add_on_categories
      (
        created_by,
        name,
        gradient,
        iconKey,
        strip,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        userId,
        body.cname,
        body.gradient || null,
        body.iconKey || null,
        body.strip || null,
      ],
    );

    categoryId = insertCategory.insertId;
  } else {
    categoryId = category[0].id;
  }

  // Upload image
  let attachment = '';

  if (files?.length) {
    attachment = await this.storageService.upload(
      files[0],
      'venue/addons',
    );
  }

  //form.id
const tags = body.tags
  ? JSON.stringify(
      typeof body.tags === 'string'
        ? JSON.parse(body.tags)
        : body.tags
    )
  : null;

if (body.id) {
  await this.dataSource.query(
    `
    UPDATE add_ons
    SET
      add_on_category_id = ?,
      add_on_name = ?,
      price = ?,
      type = ?,
      stock = ?,
      damagd = ?,
      more_details = ?,
      attachment = COALESCE(?, attachment),
      publish_status = ?,
      tags = ?,
      updated_at = NOW()
    WHERE add_on_id = ?
      AND created_by = ?
    `,
    [
      categoryId,
      body.name,
      body.price || body.pricePerUnit || 0,
      body.pricingType,
      body.totalStock || 0,
      body.damagedUnits || 0,
      body.description || null,
      attachment || null,
      body.status === 'active' ? '1' : '0',
      tags,
      body.id,
      userId,
    ],
  );

  return {
    success: true,
    message: 'Add-on updated successfully',
    add_on_id: body.id,
  };
}

// INSERT
const addonUuid = uuidv4();

await this.dataSource.query(
  `
  INSERT INTO add_ons
  (
    add_on_id,
    child_venue_id,
    add_on_category_id,
    add_on_name,
    price,
    type,
    stock,
    damagd,
    more_details,
    attachment,
    publish_status,
    auto_increment,
    tags,
    created_by,
    created_at,
    updated_at
  )
  VALUES
  (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `,
  [
    addonUuid,
    body.child_venue_id || 2,
    categoryId,
    body.name,
    body.price || body.pricePerUnit || 0,
    body.pricingType,
    body.totalStock || 0,
    body.damagedUnits || 0,
    body.description || null,
    attachment || null,
    body.status === 'active' ? '1' : '0',
    2,
    tags,
    userId,
  ],
);

return {
  success: true,
  message: 'Add-on created successfully',
  add_on_id: addonUuid,
};
}

 async Loadaddon(user_id: number) {
 const addon = await this.dataSource.query(
    `
    SELECT 
      add_on_id as id,
      add_on_name as name,
      name as category,
      type as pricingType,
      price,
      type as unit,
      price as pricePerUnit,
      stock as totalStock,
      damagd as damagedUnits,
      publish_status as status,
      tags,
      attachment as image,
      more_details as description
    FROM add_ons LEFT JOIN add_on_categories ON add_on_categories.id = add_ons.add_on_category_id
    WHERE add_ons.created_by = ?
    `,
    [user_id],
  );
  return addon;
 }
async DeleteAddon(id: any) {
 const addon = await this.dataSource.query( ` DELETE FROM add_ons WHERE add_on_id = ? `,[id]);
}
async ToggleAddon(body: any) {
 const addon = await this.dataSource.query( ` UPDATE add_ons
    SET publish_status = ? WHERE add_on_id = ? `,[body.status , body.id]);
}


  async getAddon(user_id: any,body: any) {
 const addon = await this.dataSource.query(
    `
    SELECT 
      add_on_id as id,
      add_on_name as name,
      name as category,
      type as pricingType,
      price,
      type as unit,
      price as pricePerUnit,
      stock as totalStock,
      damagd as damagedUnits,
      publish_status as status,
      attachment as image,
      more_details as description
    FROM add_ons LEFT JOIN add_on_categories ON add_on_categories.id = add_ons.add_on_category_id
    WHERE add_ons.created_by = ? 
    `,
    [user_id],
  );
  return addon;
 }

 
 async updateAddons(id: any, body: any) {
    const addons = this.safeJson(body.addons);

  await this.dataSource.query(
      `DELETE FROM venue_addon
       WHERE child_venue_id = ?`,
      [id],
    );

    for (const ad of addons) {
      await this.dataSource.query(
        `INSERT INTO venue_addon
        (child_venue_id, addon_id)
        VALUES (?, ?)`,
        [id, ad.addon_id],
      );
    }

    return {
      success: true,
    };
  }
async DeletePhotos(body: any) {
  const imageUrl = body?.image;

  const url = new URL(imageUrl);

  const key = decodeURIComponent(
    url.pathname.startsWith("/")
      ? url.pathname.slice(1)
      : url.pathname
  );

  // Delete from S3 delete
   const urls = await this.storageService.delete(
        key
      );

  // Raw SQL delete
  await this.dataSource.query(
    `DELETE FROM venue_gallery WHERE attachment = ?`,
    [key],
  );

  return {
    key: key,
    success: true,
    message: "Image deleted successfully",
  };
}
async UpdateCoverPhotos(body: any) {
  const imageUrl = body.data.image;
  const baseUrl = process.env.FILE_URL;
 const gallery = imageUrl
  .replace(baseUrl, '')
  .substring(1);
console.log(gallery)
  // Remove existing cover image
await this.dataSource.query(
  `
  UPDATE venue_gallery
  SET image_type = ?
  WHERE image_type = ? AND  child_venue_id = ? 
  `,
  ['3',1 , body.listingId],
);


await this.dataSource.query(
  `UPDATE venue_gallery
  SET image_type = ?
  WHERE attachment = ? AND  child_venue_id = ? 
  `,
  ['1', gallery,body.listingId], 
);

  return {
    success: true,
    message: 'Cover photo updated successfully.',
    gallery,
  };
}

async guest_love_plcae()
{
  // Raw SQL delete
  const guest_love = await this.dataSource.query(
    `SELECT * FROM guest_love_features  `
  );

  return guest_love;
}


// async syncNearbyAttractions(
//   venueId: number,
//   location: string,
// ) {
 

//   const apiKey =
//     process.env.GOOGLE_MAP_API_KEY;

//   if (!apiKey) {
//     throw new BadRequestException(
//       'Google Maps API key is not configured',
//     );
//   }

//   try {
//     // =====================================================
//     // 1. Get location coordinates
//     // =====================================================

//     const locationResponse =
//       await axios.post(
//         'https://places.googleapis.com/v1/places:searchText',
//         {
//           textQuery: location,
//           maxResultCount: 1,
//         },
//         {
//           headers: {
//             'Content-Type':
//               'application/json',
//             'X-Goog-Api-Key': apiKey,
//             'X-Goog-FieldMask':
//               'places.location,places.displayName',
//           },
//         },
//       );

//     const locationPlace =
//       locationResponse.data?.places?.[0];

//     if (!locationPlace?.location) {
//       throw new BadRequestException(
//         `Location not found: ${location}`,
//       );
//     }

//     const latitude =
//       locationPlace.location.latitude;

//     const longitude =
//       locationPlace.location.longitude;

//     // =====================================================
//     // 2. Search attractions
//     // =====================================================

//     const attractionResponse =
//       await axios.post(
//         'https://places.googleapis.com/v1/places:searchNearby',
//         {
//           includedTypes: [
//             'tourist_attraction',
//             'museum',
//             'park',
//             'art_gallery',
//             'historical_landmark',
//           ],

//           maxResultCount: 20,

//           rankPreference: 'POPULARITY',

//           locationRestriction: {
//             circle: {
//               center: {
//                 latitude,
//                 longitude,
//               },
//               radius: 50000,
//             },
//           },

//           regionCode: 'IN',

//           languageCode: 'en',
//         },
//         {
//           headers: {
//             'Content-Type':
//               'application/json',
//             'X-Goog-Api-Key': apiKey,
//             'X-Goog-FieldMask': [
//               'places.id',
//               'places.displayName',
//               'places.primaryType',
//               'places.primaryTypeDisplayName',
//               'places.formattedAddress',
//               'places.location',
//               'places.googleMapsUri',
//               'places.photos',
//               'places.rating',
//               'places.userRatingCount',
//             ].join(','),
//           },
//         },
//       );

//     let places =
//       attractionResponse.data?.places || [];

//     // =====================================================
//     // 3. Sort by rating + review count
//     // =====================================================

//     places = places
//       .filter(
//         (place) =>
//           place.rating &&
//           place.userRatingCount,
//       )
//       .sort((a, b) => {
//         const scoreA =
//           Number(a.rating) *
//           Math.log10(
//             Number(a.userRatingCount) + 1,
//           );

//         const scoreB =
//           Number(b.rating) *
//           Math.log10(
//             Number(b.userRatingCount) + 1,
//           );

//         return scoreB - scoreA;
//       })
//       .slice(0, 10);

//     // =====================================================
//     // 4. Delete old attractions
//     // =====================================================

//     await this.dataSource.query(
//       `
//       DELETE FROM venue_nearby_places
//       WHERE venue_id = ?
//       `,
//       [venueId],
//     );

//     // =====================================================
//     // 5. Insert TOP 10
//     // =====================================================

//     const insertedPlaces = [];

//     for (
//       let index = 0;
//       index < places.length;
//       index++
//     ) {
//       const place = places[index];

//       const photoName =
//         place.photos?.[0]?.name || null;

//       const photoUrl = photoName
//         ? `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&key=${apiKey}`
//         : null;

//       await this.dataSource.query(
//         `
//         INSERT INTO venue_nearby_places
//         (
//           venue_id,
//           google_place_id,
//           place_name,
//           place_type,
//           place_type_label,
//           address,
//           latitude,
//           longitude,
//           google_maps_url,
//           photo_name,
//           photo_url,
//           distance_meters,
//           drive_duration_seconds,
//           drive_duration_text,
//           distance_text,
//           sort_order,
//           is_active,
//           last_google_sync_at,
//           created_at,
//           updated_at
//         )
//         VALUES
//         (
//           ?, ?, ?, ?, ?, ?,
//           ?, ?, ?, ?, ?,
//           ?, ?, ?, ?,
//           ?, 1, NOW(), NOW(), NOW()
//         )
//         `,
//         [
//           venueId,

//           place.id,

//           place.displayName?.text ||
//             null,

//           place.primaryType ||
//             null,

//           place.primaryTypeDisplayName
//             ?.text || null,

//           place.formattedAddress ||
//             null,

//           place.location?.latitude ||
//             null,

//           place.location?.longitude ||
//             null,

//           place.googleMapsUri ||
//             null,

//           photoName,

//           photoUrl,

//           null, // distance_meters

//           null, // drive_duration_seconds

//           null, // drive_duration_text

//           null, // distance_text

//           index + 1,
//         ],
//       );

     
//     }

//     return {
//       success: true,
//       message:
//         'Nearby attractions synced successfully',
//       venue_id: venueId,
//       location,
//       total: insertedPlaces.length,
//       attractions: insertedPlaces,
//     };
//   } catch (error) {
//     console.error(
//       'Nearby attractions sync error:',
//         error,
//     );

//     throw new BadRequestException(
//       error ||
//         'Failed to sync nearby attractions',
//     );
//   }
// }

async syncNearbyAttractions(
  venueId: number,
  location: string,
) {
  const apiKey = process.env.GOOGLE_MAP_API_KEY;

  if (!apiKey) {
    throw new BadRequestException(
      'Google Maps API key is not configured',
    );
  }

  try {
    // =====================================================
    // 1. CHECK DATABASE FIRST
    // =====================================================

    const existingPlaces =
      await this.dataSource.query(
        `
        SELECT
          id,
          venue_id,
          google_place_id,
          place_name,
          place_type,
          place_type_label,
          address,
          latitude,
          longitude,
          google_maps_url,
          photo_name,
          photo_url,
          distance_meters,
          drive_duration_seconds,
          drive_duration_text,
          distance_text,
          sort_order,
          is_active,
          last_google_sync_at,
          created_at,
          updated_at
        FROM venue_nearby_places
        WHERE venue_id = ?
          AND is_active = 1
        ORDER BY sort_order ASC
        LIMIT 10
        `,
        [venueId],
      );

    // =====================================================
    // IMPORTANT:
    // If this venue already has attractions,
    // NEVER call Google again.
    // =====================================================

    if (
      existingPlaces &&
      existingPlaces.length > 0
    ) {
      return {
        success: true,
        message:
          'Nearby attractions already exist for this venue',
        venue_id: venueId,
        location,
        total: existingPlaces.length,
        from_database: true,
        attractions: existingPlaces,
      };
    }

    // =====================================================
    // 2. GET LOCATION COORDINATES
    // =====================================================

    const locationResponse =
      await axios.post(
        'https://places.googleapis.com/v1/places:searchText',
        {
          textQuery: location,
          maxResultCount: 1,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask':
              'places.location,places.displayName',
          },
        },
      );

    const locationPlace =
      locationResponse.data?.places?.[0];

    if (!locationPlace?.location) {
      throw new BadRequestException(
        `Location not found: ${location}`,
      );
    }

    const latitude =
      locationPlace.location.latitude;

    const longitude =
      locationPlace.location.longitude;

    // =====================================================
    // 3. GET NEARBY ATTRACTIONS
    // =====================================================

    const attractionResponse =
      await axios.post(
        'https://places.googleapis.com/v1/places:searchNearby',
        {
          includedTypes: [
            'tourist_attraction',
            'museum',
            'park',
            'art_gallery',
            'historical_landmark',
          ],

          // Google maximum
          maxResultCount: 20,

          rankPreference: 'POPULARITY',

          locationRestriction: {
            circle: {
              center: {
                latitude,
                longitude,
              },
              radius: 10000,
            },
          },

          regionCode: 'IN',
          languageCode: 'en',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': [
              'places.id',
              'places.displayName',
              'places.primaryType',
              'places.primaryTypeDisplayName',
              'places.formattedAddress',
              'places.location',
              'places.googleMapsUri',
              'places.photos',
              'places.rating',
              'places.userRatingCount',
            ].join(','),
          },
        },
      );

    let places =
      attractionResponse.data?.places || [];

    // =====================================================
    // 4. ONLY RATED PLACES
    // =====================================================

    places = places.filter(
      (place) =>
        place.id &&
        Number(place.rating || 0) > 0 &&
        Number(place.userRatingCount || 0) > 0,
    );

    // =====================================================
    // 5. REMOVE DUPLICATES FROM GOOGLE RESPONSE
    // =====================================================

    const uniquePlaces = new Map<
      string,
      any
    >();

    for (const place of places) {
      if (!uniquePlaces.has(place.id)) {
        uniquePlaces.set(place.id, place);
      }
    }

    places = Array.from(
      uniquePlaces.values(),
    );

    // =====================================================
    // 6. SORT BY RATING
    // REVIEW COUNT = TIE BREAKER
    // =====================================================

    places.sort((a, b) => {
      const ratingA =
        Number(a.rating || 0);

      const ratingB =
        Number(b.rating || 0);

      if (ratingB !== ratingA) {
        return ratingB - ratingA;
      }

      const reviewsA =
        Number(a.userRatingCount || 0);

      const reviewsB =
        Number(b.userRatingCount || 0);

      return reviewsB - reviewsA;
    });

    // =====================================================
    // 7. STRICT MAXIMUM 10
    // =====================================================

    places = places.slice(0, 10);

    // =====================================================
    // 8. INSERT PLACES
    // =====================================================

    const insertedPlaces: any[] = [];

    for (
      let index = 0;
      index < places.length;
      index++
    ) {
      const place = places[index];

      // =================================================
      // CHECK DUPLICATE BEFORE INSERT
      // =================================================

      const duplicate =
        await this.dataSource.query(
          `
          SELECT id
          FROM venue_nearby_places
          WHERE venue_id = ?
            AND google_place_id = ?
          LIMIT 1
          `,
          [
            venueId,
            place.id,
          ],
        );

      if (
        duplicate &&
        duplicate.length > 0
      ) {
        continue;
      }

      // =================================================
      // GOOGLE PHOTO
      // =================================================

      const photoName =
        place.photos?.[0]?.name || null;

      let finalUrl: string | null = null;

      if (photoName) {
        try {
          const photoResponse =
            await axios.get(
              `https://places.googleapis.com/v1/${photoName}/media`,
              {
                params: {
                  maxWidthPx: 1200,
                },

                headers: {
                  'X-Goog-Api-Key': apiKey,
                },

                responseType: 'arraybuffer',
              },
            );

          const contentType =
            String(
              photoResponse.headers[
                'content-type'
              ] || 'image/jpeg',
            ).toLowerCase();

          let extension = '.jpg';

          if (
            contentType.includes('png')
          ) {
            extension = '.png';
          } else if (
            contentType.includes('webp')
          ) {
            extension = '.webp';
          }

          const img = {
            buffer: Buffer.from(
              photoResponse.data,
            ),

            originalname:
              `${venueId}-${index}${extension}`,

            mimetype: contentType,
          };

          finalUrl =
            await this.storageService.upload(
              img,
              `venue-attractions/${venueId}`,
            );
        } catch (photoError) {
          console.error(
            'Attraction image upload failed:',
            photoError,
          );

          finalUrl = null;
        }
      }

      // =================================================
      // INSERT
      // =================================================

      try {
        await this.dataSource.query(
          `
          INSERT INTO venue_nearby_places
          (
            venue_id,
            google_place_id,
            place_name,
            place_type,
            place_type_label,
            address,
            latitude,
            longitude,
            google_maps_url,
            photo_name,
            photo_url,
            distance_meters,
            drive_duration_seconds,
            drive_duration_text,
            distance_text,
            sort_order,
            is_active,
            last_google_sync_at,
            created_at,
            updated_at
          )
          VALUES
          (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, 0, NOW(), NOW(), NOW()
          )
          `,
          [
            venueId,

            place.id,

            place.displayName?.text ||
              null,

            place.primaryType ||
              null,

            place.primaryTypeDisplayName
              ?.text || null,

            place.formattedAddress ||
              null,

            place.location?.latitude ||
              null,

            place.location?.longitude ||
              null,

            place.googleMapsUri ||
              null,

            photoName,

            finalUrl,

            null,

            null,

            null,

            null,

            index + 1,
          ],
        );
      } catch (insertError: any) {
        // =================================================
        // UNIQUE KEY PROTECTION
        // If another request inserted the same place,
        // simply skip it.
        // =================================================

        if (
          insertError?.code ===
          'ER_DUP_ENTRY'
        ) {
          console.log(
            `Duplicate attraction skipped: ${place.id}`,
          );

          continue;
        }

        throw insertError;
      }

      // =================================================
      // GET INSERTED RECORD
      // =================================================

      const inserted =
        await this.dataSource.query(
          `
          SELECT
            id,
            venue_id,
            google_place_id,
            place_name,
            place_type,
            place_type_label,
            address,
            latitude,
            longitude,
            google_maps_url,
            photo_name,
            photo_url,
            distance_meters,
            drive_duration_seconds,
            drive_duration_text,
            distance_text,
            sort_order,
            is_active,
            last_google_sync_at,
            created_at,
            updated_at
          FROM venue_nearby_places
          WHERE venue_id = ?
            AND google_place_id = ?
          LIMIT 1
          `,
          [
            venueId,
            place.id,
          ],
        );

      if (
        inserted &&
        inserted.length > 0
      ) {
        insertedPlaces.push(
          inserted[0],
        );
      }
    }

    // =====================================================
    // 9. FINAL DATABASE RESULT
    // =====================================================

    const finalPlaces =
      await this.dataSource.query(
        `
        SELECT
          id,
          venue_id,
          google_place_id,
          place_name,
          place_type,
          place_type_label,
          address,
          latitude,
          longitude,
          google_maps_url,
          photo_name,
          photo_url,
          distance_meters,
          drive_duration_seconds,
          drive_duration_text,
          distance_text,
          sort_order,
          is_active,
          last_google_sync_at,
          created_at,
          updated_at
        FROM venue_nearby_places
        WHERE venue_id = ?
          AND is_active = 1
        ORDER BY sort_order ASC
        LIMIT 10
        `,
        [venueId],
      );

    // =====================================================
    // 10. RETURN
    // =====================================================

    return {
      success: true,

      message:
        finalPlaces.length > 0
          ? 'Top nearby attractions synced successfully'
          : 'No rated nearby attractions found',

      venue_id: venueId,

      location,

      total:
        finalPlaces.length,

      from_database: false,

      attractions: finalPlaces,
    };
  } catch (error) {
    console.error(
      'Nearby attractions sync error:',
      error,
    );

    throw new BadRequestException(
      error ||
        'Failed to sync nearby attractions',
    );
  }
}

private getImageExtension(
  contentType: string,
) {
  switch (contentType) {
    case 'image/jpeg':
      return '.jpg';

    case 'image/png':
      return '.png';

    case 'image/webp':
      return '.webp';

    default:
      return '.jpg';
  }
}
 
}