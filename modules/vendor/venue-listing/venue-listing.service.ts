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


export class VenueListingService {
  constructor(
    private dataSource: DataSource,
    private storageService: StorageService,
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
        AND vg.image_type = 1

    WHERE cv.created_by = ? AND propety_category = ? AND  venue_country = ?
    `,
      [userId, id, country],
    );

    return result;
  }

  async getList(userId: any, id: any) {
    const basicDetails = await this.dataSource.query(
      `SELECT  
        child_venue_name as title, more_info as description, venue_category_id as category,
        min_guest as minCapacity, guest_rooms  as maxCapacity, venue_address  as address,
        venue_city  as city, venue_state  as state, venue_pincode  as pincode,
         venue_country  as country,
        propety_category , cv.publish_status,
        cv.banquet_round as totalRooms , cv.cocktail_round as bedsPerRoom 
      FROM venue_child cv
      LEFT JOIN venue_parent pv ON pv.parent_venue_id = cv.parent_venue_id
      WHERE cv.child_venue_id = ?
      `,
      [id],
    );

    const photos = await this.dataSource.query(
      `SELECT attachment
      FROM venue_gallery
      WHERE child_venue_id = ?`,
      [id],
    );

    const selected_amenities = await this.dataSource.query(
      `SELECT amenities_id
      FROM venue_child_amenities
      WHERE child_venue_id = ?`,
      [id],
    );

    const venueEventTags = await this.dataSource.query(
      `SELECT event_id
      FROM venue_event_tags
      WHERE child_venue_id = ?`,
      [id],
    );

    const venue_tags = await this.dataSource.query(
      `SELECT venue_cat_id
      FROM venue_tags
      WHERE child_venue_id = ?`,
      [id],
    );

    const venue_child_settings = await this.dataSource.query(
      `SELECT *
      FROM venue_child_settings
      WHERE child_id = ?`,
      [id],
    );

    const venue_terms = await this.dataSource.query(
      `SELECT *
      FROM venue_terms_condition
      WHERE child_venue_id = ?`,
      [id],
    );

const venue_addon = await this.dataSource.query(
      `SELECT *
      FROM venue_addon
      WHERE child_venue_id = ?`,
      [id],
    );
    
    const property_pricing = await this.dataSource.query(
      `SELECT *
      FROM property_pricing
      WHERE child_venue_id = ?`,
      [id],
    );

 const shifts = await this.dataSource.query(
  `
  SELECT vsh.*, vst.*
  FROM venue_shift_header vsh
  LEFT JOIN venue_shift_timing vst
    ON vst.id = (
      SELECT id
      FROM venue_shift_timing
      WHERE shift_type = vsh.Shift_type
        AND child_venue_id = vsh.child_id
      ORDER BY id ASC
      LIMIT 1
    )
  WHERE vsh.child_id = ?
  `,
  [id],
);
    const pricing = {};

    shifts.forEach((row) => {
      const key = (row.name || '').toLowerCase(); // morning | afternoon | evening

      if (!key) return;

      pricing[key] = {
        start: row.from_time,
        end: row.to_time,
        price: row.price,
        enabled: row.publish == 1 ? true : false,
      };
    });

    const baseUrl = process.env.FILE_URL;

    const photo_ctegory = await this.dataSource.query(
      `SELECT 
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

WHERE vgc.child_id = ? AND  vgc.name !='additonal images'
ORDER BY vgc.id, vg.id
      `,
      [id],
    );

    const grouped = {};

    for (const row of photo_ctegory) {
      const key = row.category_id;

      if (!grouped[key]) {
        grouped[key] = {
          id: row.category_id,
          name: row.category_name,
          child_id: row.child_id,
          images: [],
        };
      }

      if (row.image_id) {
        const cleanBase = baseUrl?.replace(/\/$/, '');

        grouped[key].images.push({
          id: row.image_id,
          images: row.attachment ? `${cleanBase}/${row.attachment}` : null,
          name: row.image_name,
          description: row.description,
          image_type: row.image_type,
          file_extension: row.file_extension,
        });
      }
    }

    const result = Object.values(grouped);

    const Setting_grouped = venue_child_settings.reduce((acc, item) => {
      if (!acc[item.group]) {
        acc[item.group] = {};
      }

      let value: any = item.value;

      // boolean conversion
      if (value === 'true') {
        value = true;
      } else if (value === 'false') {
        value = false;
      }

      acc[item.group][item.key] = value;

      return acc;
    }, {});

    return {
      ...basicDetails[0],
      photos: photos.map((p) => `${baseUrl}/${p.attachment}`),
      amenities: selected_amenities.map((p) => p.amenities_id),
      pricing: pricing,
      photoSections: result,
      event_tags: venueEventTags.map((p) => p.event_id),
      venue_tags: venue_tags.map((p) => p.venue_cat_id),
      cancellationPolicy: venue_terms[0]?.cancellation_policy ?? null,
      termsAccepted: venue_terms[0]?.platform_agreement == 1 ? true : false,
      houseRules: venue_terms[0]?.venue_rule ?? null,
      settings: Setting_grouped,
      addons: venue_addon,
      property_pricing: property_pricing,
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
             updated_at = NOW()
         WHERE child_venue_id = ?`,
          [cancellationPolicy, houseRules, termsAccepted ? 1 : 0, id],
        );
      } else {
        await queryRunner.query(
          `INSERT INTO venue_terms_condition
         (child_venue_id, cancellation_policy, venue_rule, platform_agreement, created_at, updated_at)
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
          [id, cancellationPolicy, houseRules, termsAccepted ? 1 : 0],
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

  async updateBasic(id: any, body: any) {
    const { title, description, category, propety_category } = body;

    await this.dataSource.query(
      `UPDATE venue_child SET
        child_venue_name = ?,
        more_info = ?,
        venue_category_id = ?
      WHERE child_venue_id = ?`,
      [title, description, category, id],
    );

    return {
      success: true,
    };
  }

  /* ─────────────────────────────
     CAPACITY
  ───────────────────────────── */

  async updateCapacity(id: any, body: any) {
    const { minCapacity, maxCapacity , bedsPerRoom , bathrooms , bedrooms, meetingRooms,totalDesks,totalRooms } = body;
// let cocktail_round = null;
// let banquet_round = null;

// 👇 map based on category/type
// switch (category) {
//   case "room_type_1":
//     cocktail_round = bedsPerRoom;
//     banquet_round = bathrooms;
//     break;

//   case "room_type_2":
//     cocktail_round = bedrooms;
//     banquet_round = meetingRooms;
//     break;

//   case "workspace":
//     cocktail_round = totalDesks;
//     banquet_round = totalRooms;
//     break;

//   default:
//     cocktail_round = totalRooms;
//     banquet_round = totalRooms;
//     break;
// }

    await this.dataSource.query(
      `UPDATE venue_child SET
        min_guest = ?,
        guest_rooms = ?,
        cocktail_round= ? ,
        banquet_round= ? 
      WHERE child_venue_id = ?`,
      [minCapacity, maxCapacity, bedsPerRoom,totalRooms, id],
    );

    return {
      success: true,
    };
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

  async updateTerms(id: any, body: any) {
    const { cancellationPolicy, houseRules, termsAccepted } = body;

    const existing = await this.dataSource.query(
      `SELECT id
       FROM venue_terms_condition
       WHERE child_venue_id = ?`,
      [id],
    );

    if (existing.length > 0) {
      await this.dataSource.query(
        `UPDATE venue_terms_condition
         SET cancellation_policy = ?,
             venue_rule = ?,
             platform_agreement = ?,
             updated_at = NOW()
         WHERE child_venue_id = ?`,
        [cancellationPolicy, houseRules, termsAccepted ? 1 : 0, id],
      );
    } else {
      await this.dataSource.query(
        `INSERT INTO venue_terms_condition
        (
          child_venue_id,
          cancellation_policy,
          venue_rule,
          platform_agreement,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [id, cancellationPolicy, houseRules, termsAccepted ? 1 : 0],
      );
    }

    return {
      success: true,
    };
  }

  /* ─────────────────────────────
     PHOTOS
  ───────────────────────────── */
async updatePhotos(id: string, body: any, files: any[],uid:any) {
  const photoSections = this.safeJson(body.photoSections);
  const existingPhotos = this.safeJson(body.existingPhotos);

  const fileMap = new Map<string, any>();

  for (const file of files || []) {
    fileMap.set(file.id, file);
  }

  const finalPhotos: string[] = [];

  /*
  ---------------------------
  MAIN PHOTOS (UNCHANGED)
  ---------------------------
  */
  for (const photo of existingPhotos) {
    if (typeof photo === 'string') {
      finalPhotos.push(photo);
      continue;
    }

    if (photo?.type === 'new') {
      const file = fileMap.get(photo.id);

      if (!file) continue;

      const url = await this.storageService.upload(
        file,
        'venue/photos',
      );

      finalPhotos.push(url);
    }

    if (photo?.path) {
      finalPhotos.push(photo.path);
    }
  }

  /*
-----------------------------------
MAIN PHOTOS DB UPDATE
-----------------------------------
*/

for (const photo of finalPhotos) {
  const exists = await this.dataSource.query(
    `SELECT id 
     FROM venue_gallery
     WHERE child_venue_id = ?
     AND attachment = ?`,
    [id, photo],
  );

  if (!exists.length) {
    await this.dataSource.query(
      `INSERT INTO venue_gallery
      (child_venue_id, g_category, attachment, created_at) 
      VALUES (?, ?, ?, NOW())`,
      [id,exists.g_category, photo],
    );
  }
}

  /*
  ---------------------------
  SECTIONS + DB FIXED
  ---------------------------
  */
  for (const section of photoSections || []) {
    const { id: sectionId, name, description, images = [] } = section;

    // ✅ 1. CATEGORY UPSERT (FIXED POSITION)
    let category: any = await this.dataSource.query(
      `SELECT id
       FROM venue_gallery_category
       WHERE child_id = ?
       AND name = ?`,
      [id, name],
    );

    let categoryId: any;

    if (!category.length) {
      const result = await this.dataSource.query(
        `INSERT INTO venue_gallery_category
        (child_id, name, description, created_at, updated_at)
        VALUES (?, ?, ?, NOW(), NOW())`,
        [id, name, description],
      );

      categoryId = result.insertId;
    } else {
      categoryId = category[0].id;

      await this.dataSource.query(
        `UPDATE venue_gallery_category
         SET name = ?,
             description = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [name, description, categoryId],
      );
    }

    /*
    ---------------------------
    2. IMAGE PROCESSING + INSERT
    ---------------------------
    */
    for (const img of images || []) {
      let finalUrl = '';

      // EXISTING
      if (img.type === 'existing') {
        finalUrl = img.path;
      }

      // NEW UPLOAD
      if (img.type === 'new') {
        const file = fileMap.get(img.id);

        if (!file) continue;

        finalUrl = await this.storageService.upload(
          file,
          'venue/gallery',
        );
      }

      if (!finalUrl) continue;

      // CHECK EXIST
      const exists = await this.dataSource.query(
        `SELECT id
         FROM venue_gallery
         WHERE child_venue_id = ?
         AND g_category = ?
         AND attachment = ?`,
        [id, categoryId, finalUrl],
      );

      // INSERT IF NOT EXISTS
      if (!exists.length) {
        await this.dataSource.query(
          `INSERT INTO venue_gallery
          (child_venue_id, g_category, attachment, created_at)
          VALUES (?, ?, ?, NOW())`,
          [id, categoryId, finalUrl],
        );
      }
    }
  }

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

  async SaveVenueSetting(id: any, body: any) {
    const entries = Object.entries(body.data);

    let publishStatus: number | null = null;

    // detect publication status
    for (const [key, value] of entries) {
      if (key === 'status') {
        publishStatus = value === 'live' ? 1 : 0;
      }
    }

    // save settings
    await Promise.all(
      entries.map(([key, value]) => {
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
          [id, body.section, key, String(value)],
        );
      }),
    );

    // update publish status
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

    return {
      success: true,
    };
  }
  //addons
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
 
}