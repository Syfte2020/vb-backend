import { Injectable, BadRequestException,NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Not, IsNull } from 'typeorm';
import { StorageService } from 'src/common/storage/storage.service';

import { SettingGroup } from './entity/setting-group.entity';
import { Setting } from './entity/setting.entity';
import { VenueSetting } from './entity/venue-setting.entity';

import { PackageCategory } from '../../vendor/packages/entity/package-category.entity'; //entity/package-category.entity

// import { PushService } from '../../push/push.service'

// import { generateCode , total_code_generating } from 'src/common/utils/code-generator';

import { InvoiceService } from '../../invoice/invoice.service'
import { SocketService } from '../../socket/socket.service';
import { NotificationService } from '../../../notifications/notification.service';

import {
  generateCode,
  total_code_generating,
} from '../../../common/utils/code-generator';

import { v4 as uuidv4 } from 'uuid';
//categoryRepository

@Injectable()
export class BookingsService {
  constructor(
    private dataSource: DataSource,
    private storageService: StorageService,
    private socketService: SocketService,
    private invoiceService: InvoiceService,
    //  private readonly pushService: PushService,
    private readonly notificationService: NotificationService,
    @InjectRepository(SettingGroup)
    private readonly settingGroupRepository: Repository<SettingGroup>,

    @InjectRepository(PackageCategory)
    private readonly packageCat: Repository<PackageCategory>,
  ) {}

  async invoice_number(user_id: number, id: any) {
  const settings = await this.dataSource.query(
    `
    SELECT setting_key, setting_value
    FROM venue_booking_setting
    WHERE category_id = ? AND vendor_id = ?
    `,
    [1, user_id],
  );

  const invoice_number_prefix =
    settings.find((item) => item.setting_key === 'invoiceNumber')?.setting_value || 'INV';

  const rows = await this.dataSource.query(
    `
   SELECT invoice_number
FROM bookings
WHERE vendor_id = ?
  AND invoice_number IS NOT NULL
  AND invoice_number <> ''
  AND invoice_number <> '0'
ORDER BY created_at DESC
LIMIT 1;
    `,
    [user_id],
  );

  if (!rows.length) {
    return `${invoice_number_prefix}00001`;
  }

  // Extract only the numeric part
  const lastNumber =
    parseInt(rows[0].invoice_number.replace(/\D/g, ''), 10) || 0;

  return `${invoice_number_prefix}${String(lastNumber + 1).padStart(5, '0')}`;
}



  async load_shift_event(user_id: number, id: any) {
    const rows = await this.dataSource.query(` 
    SELECT *
    FROM booking_event_types
    WHERE status = 0`);
    return rows;
  }

  async globalSetting(user_id: number, id: any) {
    const rows = await this.dataSource.query(
      ` 
    SELECT *
    FROM venue_booking_setting
    WHERE category_id = ? AND vendor_id = ? `,
      [1, user_id],
    );
    return rows;
  }

  async ListVenueSetting(user_id: number, id: any) {
    const rows = await this.dataSource.query(
      ` 
    SELECT *
    FROM venue_child_settings vcs 
    LEFT JOIN venue_child vc ON vc.child_venue_id = vcs.child_id
    WHERE  created_by = ? `,
      [user_id],
    );
    return rows;
  }

async availableVenues(body: any, id: number, country: any) {
  const { selectionMode, startDate, endDate, shifts = [], category } = body;

   const singular = category?.endsWith('s')
    ? category.slice(0, -1)
    : category;

  const noShiftCategories = [
  'farmstay',
  'farm stay',
  'resort',
  'villa',
];

const isDateOnly =
  noShiftCategories.includes(
    singular.toLowerCase(),
  );
  // -----------------------------
  // 1. DATE HANDLING
  // -----------------------------
  const from = startDate;
  const to = selectionMode === 'single' ? startDate : endDate;

  const start = new Date(from);
  const end = new Date(to);

  const totalDays =
    Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // -----------------------------
  // 2. SHIFT MAP
  // -----------------------------
  const shiftMap: Record<string, number> = {
    morning: 1,
    afternoon: 2,
    evening: 3,
    'full day': 4,
  };

  const shiftIds: number[] =
    shifts.includes('full day')
      ? [1, 2, 3, 4]
      : shifts
          .map((s: string) => shiftMap[s?.toLowerCase()])
          .filter(Boolean);

  // ❗ if no shift selected, still show venues
  // const useShiftFilter = shiftIds.length > 0;
  const useShiftFilter =
  !isDateOnly && shiftIds.length > 0;

  const shiftPlaceholders = shiftIds.map(() => '?').join(',');

  // -----------------------------
  // 3. MAIN QUERY (SAFE + NO EMPTY RESULT BUG)
  // -----------------------------

  
//   const sql = `
//     SELECT
//       vc.child_venue_id,
//       vc.parent_venue_id,
//       vc.child_auto_no,
//       vc.guest_rooms,
//       vc.child_venue_name,
//       vc.venue_category_id,
//       vc.min_guest,
//       vc.floating_capacity,

//       GROUP_CONCAT(
//         DISTINCT vsh.name
//         ORDER BY vsh.shift_type
//         SEPARATOR ', '
//       ) AS shift_names,

//       GROUP_CONCAT(
//         DISTINCT CONCAT(vsh.from_time,' - ',vsh.to_time)
//         ORDER BY vsh.shift_type
//         SEPARATOR ', '
//       ) AS shift_timings,

//        /* Child settings as JSON */
// CONCAT(
//   '[',
//   COALESCE(
//     GROUP_CONCAT(
//       DISTINCT JSON_OBJECT(
//         'id', vcs.id,
//         'child_id', vcs.child_id,
//         'key', vcs.key,
//         'value', vcs.value
//       )
//       SEPARATOR ','
//     ),
//     ''
//   ),
//   ']'
// ) AS child_setting,
 

//       CASE
//     WHEN vp.propety_category = 'farmstay'
//     THEN MAX(
//         CASE
//             WHEN pp.pricing_key = 'nightly'
//             THEN pp.amount
//         END
//     )
//     ELSE SUM(DISTINCT cvs.price)
// END AS per_day_price,

//   JSON_ARRAYAGG(
//     JSON_OBJECT(
//         'booking_id', b.id,
//         'status', b.status,
//         'date', bed.event_date,
//         'shift', IFNULL(bs.shift_name,''),
//         'child_id', vc.child_venue_id
//     )
// ) AS booking_conflicts

//     FROM venue_child vc

//     INNER JOIN venue_parent vp
//       ON vp.parent_venue_id = vc.parent_venue_id

//     LEFT JOIN venue_shift_timing cvs
//       ON cvs.child_venue_id = vc.child_venue_id

//     LEFT JOIN venue_shift_header vsh
//       ON vsh.child_id = vc.child_venue_id
//       AND vsh.shift_type = cvs.shift_type
//       AND vsh.publish = 1

//     LEFT JOIN booking_venues bv
//       ON bv.child_venue_id = vc.child_venue_id  
      
//     LEFT JOIN venue_child_settings vcs
//     ON vcs.child_id = vc.child_venue_id

//     LEFT JOIN bookings b
//       ON b.id = bv.booking_id

//     LEFT JOIN booking_event_dates bed
//       ON bed.booking_id = b.id
//       AND bed.event_date BETWEEN ? AND ?

//     LEFT JOIN booking_shifts bs
//       ON bs.booking_id = b.id
//       AND bs.event_date_id = bed.id

//       LEFT JOIN property_pricing pp
//   ON pp.child_venue_id = vc.child_venue_id
//   AND pp.enabled = 1

//     WHERE
//       vc.created_by = ?
//       AND vp.venue_country = ?
//       AND vc.publish_status = 1
//       AND vp.propety_category = ?
//       ${useShiftFilter ? `AND cvs.shift_type IN (${shiftPlaceholders})` : ''}

//     GROUP BY vc.child_venue_id
//     ORDER BY vc.child_venue_id;
//   `;
const sql =`SELECT
    vc.child_venue_id,
    vc.parent_venue_id,
    vc.child_auto_no,
    vc.guest_rooms,
    vc.child_venue_name,
    vc.venue_category_id,
    vc.min_guest,
    vc.floating_capacity,

    GROUP_CONCAT(
        DISTINCT vsh.name
        ORDER BY vsh.shift_type
        SEPARATOR ', '
    ) AS shift_names,

    GROUP_CONCAT(
        DISTINCT CONCAT(vsh.from_time,' - ',vsh.to_time)
        ORDER BY vsh.shift_type
        SEPARATOR ', '
    ) AS shift_timings,

    /* Child settings */
    COALESCE(
        (
            SELECT JSON_ARRAYAGG(
                JSON_OBJECT(
                    'id', vcs.id,
                    'child_id', vcs.child_id,
                    'key', vcs.key,
                    'value', vcs.value
                )
            )
            FROM venue_child_settings vcs
            WHERE vcs.child_id = vc.child_venue_id
        ),
        JSON_ARRAY()
    ) AS child_setting,

    CASE
        WHEN vp.propety_category = 'farmstay'
        THEN MAX(
            CASE
                WHEN pp.pricing_key = 'nightly'
                THEN pp.amount
            END
        )
        ELSE SUM(DISTINCT cvs.price)
    END AS per_day_price,

    JSON_ARRAYAGG(
    JSON_OBJECT(
        'booking_id', b.id,
        'status', b.status,
        'date', bed.event_date,
        'shift', IFNULL(bs.shift_name,''),
        'child_id', vc.child_venue_id
    )
) AS booking_conflicts

FROM venue_child vc

INNER JOIN venue_parent vp
    ON vp.parent_venue_id = vc.parent_venue_id

LEFT JOIN venue_shift_timing cvs
    ON cvs.child_venue_id = vc.child_venue_id

LEFT JOIN venue_shift_header vsh
    ON vsh.child_id = vc.child_venue_id
    AND vsh.shift_type = cvs.shift_type
    AND vsh.publish = 1

LEFT JOIN booking_venues bv
    ON bv.child_venue_id = vc.child_venue_id

LEFT JOIN bookings b
    ON b.id = bv.booking_id

LEFT JOIN booking_event_dates bed
    ON bed.booking_id = b.id
    AND bed.event_date BETWEEN ? AND ?

LEFT JOIN booking_shifts bs
    ON bs.booking_id = b.id
    AND bs.event_date_id = bed.id

LEFT JOIN property_pricing pp
    ON pp.child_venue_id = vc.child_venue_id
    AND pp.enabled = 1

WHERE
    vc.created_by = ?
    AND vp.venue_country = ?
    AND vc.publish_status = 1
    AND vp.propety_category = ?
    ${useShiftFilter ? `AND cvs.shift_type IN (${shiftPlaceholders})` : ''}

GROUP BY
    vc.child_venue_id,
    vc.parent_venue_id,
    vc.child_auto_no,
    vc.guest_rooms,
    vc.child_venue_name,
    vc.venue_category_id,
    vc.min_guest,
    vc.floating_capacity

ORDER BY vc.child_venue_id`;
  // -----------------------------
  // 4. PARAMS (SAFE ORDER)
  // -----------------------------
  const params: any[] = [
    from,
    to,
    id,
    country,
    singular,
    ...(useShiftFilter ? shiftIds : []),
  ];

  const venues = await this.dataSource.query(sql, params);

  // -----------------------------
  // 5. SAFE PARSER (NO NULLS)
  // -----------------------------
const safeParse = (data: any) => {
  if (!data) return [];
  try {
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item: any) => item && item.date);
  } catch {
    return [];
  }
};
  // -----------------------------
  // 6. RESPONSE MAP
  // -----------------------------
  // -----------------------------
// 6. RESPONSE MAP
// -----------------------------
return venues.map((venue: any) => {
  const bookingConflicts = safeParse(venue.booking_conflicts);

  // Remove duplicates
  const uniqueConflicts = Array.from(
    new Map(
      bookingConflicts.map((b: any) => [
        `${b.date}_${b.shift}`,
        b,
      ]),
    ).values(),
  );

  // Filter only selected shifts
  const selectedShiftNames = shifts.map((s: string) =>
    s.toLowerCase(),
  );

let filteredConflicts:any = [];

const fromDate = new Date(from);
const toDate = new Date(to);

if (isDateOnly) {
  // Farmstay -> only date matters
  filteredConflicts = uniqueConflicts.filter((conflict: any) => {
    if (!conflict.date) return false;

    return (
      conflict.date >= fromDate &&
      conflict.date <= toDate
    );
  });
} else {
  // Venue -> date + shift
  const selectedShiftNames = shifts.some(
    (s: string) => s.toLowerCase() === 'full day'
  )
    ? ['morning', 'afternoon', 'evening', 'full day']
    : shifts.map((s: string) => s.toLowerCase());

  // filteredConflicts = uniqueConflicts.filter((conflict: any) => {
  //   if (!conflict.date || !conflict.shift) return false;

  //   return (
  //     conflict.date >= fromDate &&
  //     conflict.date <= toDate &&
  //     (
  //       selectedShiftNames.length === 0 ||
  //       selectedShiftNames.includes(
  //         conflict.shift.toLowerCase()
  //       )
  //     )
  //   );
  // });
  filteredConflicts = uniqueConflicts.filter((conflict: any) => {
  if (!conflict.date || !conflict.shift) return false;

  const conflictDate = new Date(conflict.date);

  return (
    conflictDate >= fromDate &&
    conflictDate <= toDate &&
    (
      selectedShiftNames.length === 0 ||
      selectedShiftNames.includes(
        String(conflict.shift).toLowerCase()
      )
    )
  );
});
}
  // const totalSlots =
  //   Math.max(selectedShiftNames.length, 1) * totalDays;
  const totalSlots = isDateOnly
  ? totalDays
  : Math.max(selectedShiftNames.length, 1) * totalDays;

  let availability_status:
    | 'available'
    | 'partial'
    | 'booked' = 'available';

  if (filteredConflicts.length === 0) {
    availability_status = 'available';
  } else if (filteredConflicts.length >= totalSlots) {
    availability_status = 'booked';
  } else {
    availability_status = 'partial';
  }

  const parseJsonSafely = (value: any, fallback: any = []) => {
  if (!value) return fallback;

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    console.error('Invalid JSON:', value);
    return fallback;
  }
};

  return {
    ...venue,

    total_days: totalDays,

    per_day_price: Number(
      venue.per_day_price || 0,
    ),

    total_price:
      Number(venue.per_day_price || 0) *
      totalDays,

    shift_names: venue.shift_names
      ? venue.shift_names
          .split(',')
          .map((s: string) => s.trim())
      : [],

    shift_timings: venue.shift_timings
      ? venue.shift_timings
          .split(',')
          .map((s: string) => s.trim())
      : [],

    // bookingConflicts: filteredConflicts,
   bookingConflicts: filteredConflicts,


    // child_setting: venue.child_setting
    //       ? JSON.parse(venue.child_setting)
    //       : [],
    child_setting: parseJsonSafely(venue.child_setting, []),

    availability_status,
  };
});
}
  async Load_all_packages(body: any, id: number) {
    const rows = await this.dataSource.query(
      `
    SELECT
        /* Package */
        p.id AS package_id,
        p.name AS package_name,
        p.price AS package_price,
        p.description,
        p.tags,
        p.icon,
        p.package_type,
        p.allow_events,
        p.count_pack_item,
        p.package_status,

        /* Category */
        pc.id AS config_id,
        pc.category_id,
        pc.count_number,

        c.item_category AS category_name,
        c.cat_icon,
        c.cat_amt,
        c.types,

        /* Items */
        pil.id AS item_id,
        pil.item_name,
        pil.item_price,
        pil.item_price_1,
        pil.image,
        pil.food_pre,
        pi.quantity

    FROM package p

    LEFT JOIN package_category_config pc
        ON pc.package_id = p.id

    LEFT JOIN package_items_category c
        ON c.id = pc.category_id

    LEFT JOIN package_items pi
        ON pi.package_id = p.id

    LEFT JOIN package_items_list pil
        ON pil.id = pi.item_id
       AND pil.cat_id = c.id

    WHERE p.package_status = 1
      AND p.created_by = ?

    ORDER BY p.id,c.id,pil.item_name
    `,
      [id],
    );

    const packageMap = new Map();

    rows.forEach((row: any) => {
      // Package
      if (!packageMap.has(row.package_id)) {
        packageMap.set(row.package_id, {
          id: row.package_id,
          name: row.package_name,
          price: Number(row.package_price),
          description: row.description,
          tags: row.tags,
          icon: row.icon,
          package_type: row.package_type,
          allow_events: row.allow_events,
          count_pack_item: row.count_pack_item,
          package_status: row.package_status,
          categories: [],
        });
      }

      const pkg = packageMap.get(row.package_id);

      // Category
      let category = pkg.categories.find((c: any) => c.id == row.category_id);

      if (!category) {
        category = {
          id: row.category_id,
          name: row.category_name,
          icon: row.cat_icon,
          amount: row.cat_amt,
          type: row.types,
          count: row.count_number,
          items: [],
        };

        pkg.categories.push(category);
      }

      // Item
      if (
        row.item_id &&
        !category.items.some((i: any) => i.id == row.item_id)
      ) {
        category.items.push({
          id: row.item_id,
          name: row.item_name,
          price: Number(row.item_price),
          price1: Number(row.item_price_1),
          image: row.image,
          food_pre: row.food_pre,
          quantity: row.quantity,
        });
      }
    });

    return Array.from(packageMap.values());
  }

  async loadAllAddons(body: any, id: number) {
    const venue_ids = body; // if body is an array

    if (!Array.isArray(venue_ids) || venue_ids.length === 0) {
      return [];
    }

    const placeholders = venue_ids.map(() => '?').join(',');

    const data = await this.dataSource.query(
      `
    SELECT *
    FROM venue_addon LEFT JOIN add_ons ON add_ons.add_on_id = venue_addon.addon_id
    WHERE venue_addon.child_venue_id IN (${placeholders})
    `,
      [...venue_ids],
    );

     const venueSettings = await this.dataSource.query(
    `
      SELECT *
      FROM venue_child_settings
      WHERE child_id IN (${placeholders})
    `,
    [...venue_ids],
  );

     const venue_calendar_blocks = await this.dataSource.query(
  `
    SELECT
      id,
      venue_id,
      DATE_FORMAT(block_date, '%Y-%m-%d') AS block_date,
      shift_key,
      reason,
      created_by
    FROM venue_calendar_blocks
    WHERE venue_id IN (${placeholders})
  `,
  [...venue_ids],
);

  
  return {
    addons: data,
    venueSettings,
    venue_calendar_blocks
  };

    
return data;

    
  

}

async loadAllSetting(body: any, id: number) {
    const venue_ids = body; 

    if (!Array.isArray(venue_ids) || venue_ids.length === 0) {
      return [];
    }

   const placeholders = venue_ids.map(() => '?').join(',');

     const settings = await this.dataSource.query(
    `
    SELECT 
      id,
      child_id,
      \`group\`,
      \`key\`,
      value,
      type,
      created_at,
      updated_at
    FROM venue_child_settings
    WHERE child_id IN (${placeholders})
    `,
    [...venue_ids],
  );
return settings;

    
  }
  // async booking_create(dto: any, id: number) {
  //   //
  //   const singular = dto.category.endsWith('s')
  //     ? dto.category.slice(0, -1)
  //     : dto.category;
  //   const [categorys] = await this.dataSource.query(
  //     `SELECT id FROM category WHERE name = ? limit 1`,
  //     [singular],
  //   );
  //   const bookingUuid = uuidv4();
  //   //const code = generateCode();

  //   let code = generateCode();
  //   let code_total = total_code_generating();

  //   while (true) {
  //     const rows = await this.dataSource.query(
  //       `SELECT 1 FROM bookings WHERE invoice_number = ? LIMIT 1`,
  //       [code],
  //     );

  //     if (rows.length === 0) {
  //       break; // Unique code found
  //     }

  //     code = generateCode(); // Generate another code
  //   }

  //   const crows = await this.dataSource.query(
  //     `SELECT COUNT(*) AS total FROM bookings`,
  //   );

  //   const generated_code = Number(crows[0].total);

  //   const result: any = await this.dataSource.query(
  //     `
  //   INSERT INTO bookings
  //   (
  //     invoice_number,
  //     booking_code,
  //     booking_type,
  //     category,
  //     status,
  //     total_pax,
  //     base_amount,
  //     discount_amount,
  //     tax_amount,
  //     total_amount,
  //     notes,
  //     vendor_id,
  //     created_by,
  //     updated_by,
  //     created_at,
  //     updated_at
  //   )
  //   VALUES (?,?,?, ?, ?,?,?,?,?,?,?,?,?,? ,NOW(),NOW())
  //   `,
  //     [
  //       code,
  //       dto.invoice_no,
  //       dto.reserveType,
  //       categorys.id,
  //       0,
  //       dto.event?.guest_capacity || 0,
  //       dto.pricing?.base_amount || 0,
  //       0,
  //       dto.pricing?.pax_gst || 0,
  //       dto.special_request || null,
  //       id,
  //       id,
  //       0,

  //       // dto.event?.event_type || null, // FIX 1

  //       // dto.venues?.[0]?.child_venue_id || null,

  //       // dto.event?.selection_mode === 'single'
  //       //   ? dto.event?.event_date
  //       //   : dto.event?.date_range?.start_date || null,

  //       // dto.event?.selection_mode === 'single'
  //       //   ? dto.event?.event_date
  //       //   : dto.event?.date_range?.end_date || null,

  //       // 0,

  //       // dto.pricing?.total_guests || 0,
  //       // dto.event?.guest_capacity || 0,

  //       // dto.pricing?.grand_total || 0,
  //       // dto.pricing?.base_amount || 0,
  //       // dto.pricing?.security_deposit || 0,
  //       // dto.pricing?.pax_gst || 0,

  //       // dto.special_request || null,

  //       // dto.customer?.name || null,
  //       // dto.customer?.phone || null,
  //       // dto.customer?.email || null,
  //       // new Date(),
  //       // new Date(),
  //       // id,
  //       // id,
  //       // categorys.id,
  //       // dto.reserveType,
  //     ],
  //   );

  //   const bookingId = result.insertId;

  //   // =========================
  //   // VENUES
  //   // =========================
  //   await this.dataSource.query(
  //     `
  //       INSERT INTO booking_venues
  //       (booking_id, parent_venue_id,child_venue_id,venue_name_snapshot)
  //       VALUES (?,? ,?,?)
  //       `,
  //     [
  //       bookingId,
  //       dto.venues?.[0]?.child_venue_id || null,
  //       dto.venues?.[0]?.child_venue_id || null,
  //       dto.venues?.[0]?.child_venue_name || null,
  //     ],
  //   );

  //   // =========================
  //   // EVENT DATE
  //   // =========================

  //   const event_date = await this.dataSource.query(
  //     `
  //       INSERT INTO booking_event_dates
  //       (booking_id, event_date)
  //       VALUES (?,?)
  //       `,
  //     [bookingId, dto.event?.event_date],
  //   );

  //   const event_date_id = event_date.insertId;

  //   // =========================
  //   // SHIFTS
  //   // =========================

  //   if (dto.event?.shift?.length) {
  //     for (const shift of dto.event.shift) {
  //       const SHIFT_MAP = {
  //         morning: 1,
  //         afternoon: 2,
  //         evening: 3,
  //       };

  //       const shiftId = SHIFT_MAP[shift.toLowerCase()];

  //       if (!shiftId) continue; // skip invalid values

  //       await this.dataSource.query(
  //         `
  //       INSERT INTO booking_shifts
  //       (booking_id, event_date_id,venue_id,shift_name , start_time,	end_time,	pax,	price,	status)
  //       VALUES (?,? ,?,?, ? , ?,? ,?,?)
  //       `,
  //         [
  //           bookingId,
  //           event_date_id,
  //           dto.venues?.[0]?.child_venue_id || null,
  //           shift.toLowerCase(),
  //           '0',
  //           '0',
  //           '0',
  //           '0',
  //           'active',
  //         ],
  //       );
  //     }
  //   }

  //   // =========================
  //   // CUSTOMERS & EVENT MANAGEMENT
  //   // =========================

  //   await this.dataSource.query(
  //     `
  //       INSERT INTO booking_parties
  //       (booking_id, party_type,party_id,name , phone,	email,	role_note)
  //       VALUES (?,? ,?,?, ? , ?,? )
  //       `,
  //     [
  //       bookingId,
  //       'Customer',
  //       0,
  //       dto.customer?.name || null,
  //       dto.customer?.phone || null,
  //       dto.customer?.email || null,
  //       '0',
  //     ],
  //   );

  //   if (dto.service_providers?.caterer) {
  //     await this.dataSource.query(
  //       `
  //           INSERT INTO booking_parties
  //           (booking_id, party_type,party_id,name , phone,	email,	role_note)
  //           VALUES (?,? ,?,?, ? , ?,? )
  //       `,
  //       [
  //         bookingId,
  //         'Caterer',
  //         0,
  //         dto.service_providers?.caterer || null,
  //         0,
  //         0,
  //         '0',
  //       ],
  //     );
  //   }

  //   if (dto.service_providers?.decorator) {
  //     await this.dataSource.query(
  //       `
  //           INSERT INTO booking_parties
  //           (booking_id, party_type,party_id,name , phone,	email,	role_note)
  //           VALUES (?,? ,?,?, ? , ?,? )
  //       `,
  //       [
  //         bookingId,
  //         'Decorator',
  //         0,
  //         dto.service_providers?.decorator || null,
  //         0,
  //         0,
  //         '0',
  //       ],
  //     );
  //   }

  //   if (dto.service_providers?.music_troupe) {
  //     await this.dataSource.query(
  //       `
  //           INSERT INTO booking_parties
  //           (booking_id, party_type,party_id,name , phone,	email,	role_note)
  //           VALUES (?,? ,?,?, ? , ?,? )
  //       `,
  //       [
  //         bookingId,
  //         'Music troupe',
  //         0,
  //         dto.service_providers?.music_troupe || null,
  //         0,
  //         0,
  //         '0',
  //       ],
  //     );
  //   }

  //   if (dto.service_providers?.sound_system) {
  //     await this.dataSource.query(
  //       `
  //           INSERT INTO booking_parties
  //           (booking_id, party_type,party_id,name , phone,	email,	role_note)
  //           VALUES (?,? ,?,?, ? , ?,? )
  //       `,
  //       [
  //         bookingId,
  //         'sound system',
  //         0,
  //         dto.service_providers?.sound_system || null,
  //         0,
  //         0,
  //         '0',
  //       ],
  //     );
  //   }

  //   //BASE PRICE

  //   await this.dataSource.query(
  //     `
  //       INSERT INTO booking_charges
  //       (booking_id, charge_type , title, quantity, unit_price,total_price)
  //       VALUES (?,?,?,? ,? , ?)
  //       `,
  //     [
  //       bookingId,
  //       'base',
  //       'Base Amount',
  //       1,
  //       dto.pricing?.base_amount,
  //       dto.pricing?.base_amount,
  //     ],
  //   );

  //   if (dto.venues?.[0]?.security_amount != 0) {
  //     await this.dataSource.query(
  //       `
  //       INSERT INTO booking_charges
  //       (booking_id, charge_type , title, quantity, unit_price,total_price)
  //       VALUES (?,?,?,? ,? , ?)
  //       `,
  //       [
  //         bookingId,
  //         'security',
  //         'Security Amount',
  //         1,
  //         dto.venues?.[0]?.security_amount,
  //         dto.venues?.[0]?.security_amount,
  //       ],
  //     );
  //   }

  //   if (dto.addons?.length) {
  //     for (const addon of dto.addons) {
  //       await this.dataSource.query(
  //         `
  //       INSERT INTO booking_charges
  //       (booking_id, charge_type , title, quantity, unit_price,total_price)
  //       VALUES (?,?,?,? ,? , ?)
  //       `,
  //         [
  //           bookingId,
  //           'addon',
  //           addon.addon_name,
  //           addon.qty,
  //           addon.unit_price,
  //           addon.amount,
  //         ],
  //       );
  //     }
  //   }

  //   // =========================
  //   // VENUES
  //   // =========================
  //   // if (dto.venues?.length) {
  //   //   for (const venue of dto.venues) {
  //   //     await this.dataSource.query(
  //   //       `
  //   //     INSERT INTO booking_event_dates
  //   //     (booking_id, event_date)
  //   //     VALUES (?,?)
  //   //     `,
  //   //       [bookingId, venue.child_venue_id],
  //   //     );
  //   //   }
  //   // }

  //   // =========================
  //   // SHIFTS (FIXED STRING SAFE)
  //   // =========================
  //   // if (dto.event?.shift?.length) {
  //   //   for (const shift of dto.event.shift) {
  //   //     const SHIFT_MAP = {
  //   //       morning: 1,
  //   //       afternoon: 2,
  //   //       evening: 3,
  //   //     };

  //   //     const shiftId = SHIFT_MAP[shift.toLowerCase()];

  //   //     if (!shiftId) continue; // skip invalid values

  //   //     await this.dataSource.query(
  //   //       `
  //   //     INSERT INTO booking_shift
  //   //     (booking_id, shift_id)
  //   //     VALUES (?,?)
  //   //     `,
  //   //       [bookingUuid, shiftId],
  //   //     );
  //   //   }
  //   // }

  //   // =========================
  //   // ADDONS
  //   // =========================
  //   // if (dto.addons?.length) {
  //   //   for (const addon of dto.addons) {
  //   //     await this.dataSource.query(
  //   //       `
  //   //     INSERT INTO booking_addon
  //   //     (booking_id, addon_id , qty, price, total)
  //   //     VALUES (?,?,?,? ,?)
  //   //     `,
  //   //       [bookingUuid, addon.addon_id,addon.qty, addon.unit_price, addon.amount],
  //   //     );
  //   //   }
  //   // }

  //   // =========================
  //   // SERVICE PROVIDERS
  //   // =========================
  //   // if (dto.service_providers) {
  //   //   for (const [type, value] of Object.entries(dto.service_providers)) {
  //   //     if (!value) continue;

  //   //     await this.dataSource.query(
  //   //       `
  //   //     INSERT INTO booking_service_provider
  //   //     (booking_id, provider_type, provider_name)
  //   //     VALUES (?,?,?)
  //   //     `,
  //   //       [bookingUuid, type, value],
  //   //     );
  //   //   }
  //   // }

  //   //   await this.pushService.sendToUser(
  //   //     id,
  //   //     'Booking Confirmed',
  //   //     'Your booking has been confirmed.',
  //   //     '/bookings/' + id,
  //   // );

  //   return {
  //     success: true,
  //     booking_id: bookingId,
  //     code_total: code_total,
  //     code_completed: generated_code,
  //     code_pending: code_total - generated_code,
  //   };
  // }


  async booking_create(dto: any, id: number , country:any) {

  // -----------------------------
  // 1. CATEGORY
  // -----------------------------
  const singular = dto.category?.endsWith('s')
    ? dto.category.slice(0, -1)
    : dto.category;

  const [category] = await this.dataSource.query(
    `SELECT id FROM category WHERE name = ? LIMIT 1`,
    [singular],
  );

  // -----------------------------
  // 2. IDS
  // -----------------------------
  const bookingUuid = uuidv4();

  let code = generateCode();

  while (true) {
    const rows = await this.dataSource.query(
      `SELECT 1 FROM bookings WHERE invoice_number = ? LIMIT 1`,
      [code],
    );

    if (rows.length === 0) break;
    code = generateCode();
  }
//book
  const reserveType = dto.reserveType ==  "book" ? ( dto.booking_type == 'book' ? 'booked':'reserve'):dto.reserveType;


   //Find Which Vendor Under
 
  // -----------------------------
  // 3. MAIN BOOKING INSERT (FIXED)
  // -----------------------------
  const result: any = await this.dataSource.query(
    `
    INSERT INTO bookings
    (
    booking_code,
      invoice_number,
      
      booking_type,
      category,
      country_id,
      status,
      total_pax,
      base_amount,
      discount_amount,
      tax_amount,
      total_amount,
      notes,
      vendor_id,
      created_by,
      updated_by,
      created_at,
      updated_at,
      booking_event_type_id,
      selection_mode,
      selection_type,
      estimated_total,
      reservation_end_date
    )
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `,
    [
      code,
      dto.invoice_no || null,
      reserveType || 'draft',
      category?.id || null,
      country,
      'active',

      dto.event?.guest_capacity || 0,
      dto.pricing?.base_amount || 0,
      
      0,
      dto.pricing?.pax_gst || 0,
      dto.pricing?.final_total || 0,

      dto.special_request || null,

      id,
      id,
      id,
              new Date(),
        new Date(),
         dto.event?.event_type || null,
         dto.event?.selection_type || null,
         dto.event?.selection_mode || null,
         dto.pricing?.reserve_amount || null,
         dto.pricing?.reserve_expires_at || null,
    ],
  );

  const bookingId = result.insertId;

if(dto.event?.selection_type ==='pax')
{
    await this.insertPaxPackages(bookingId,dto);
}

 

  // -----------------------------
  // 4. VENUES
  // -----------------------------
 if (dto.venues?.length) {
  const venueValues = dto.venues.map((venue: any) => [
    bookingId,
    venue.parent_venue_id || null,
    venue.child_venue_id || null,
    venue.child_venue_name || null,
  ]);

  await this.dataSource.query(
    `
    INSERT INTO booking_venues
    (booking_id, parent_venue_id, child_venue_id, venue_name_snapshot)
    VALUES ?
    `,
    [venueValues],
  );
}

 // -----------------------------
// 5. EVENT DATES
// -----------------------------
let eventDates: string[] = [];

// Farmstay / Multiple booking
if (
  dto.venues?.length &&
  dto.venues[0]?.start_date &&
  dto.venues[0]?.end_date
) {
  eventDates = getDatesBetween(
    dto.venues[0].start_date,
    dto.venues[0].end_date,
  );
}

// Event date range
else if (
  dto.event?.date_range?.start_date &&
  dto.event?.date_range?.end_date
) {
  eventDates = getDatesBetween(
    dto.event.date_range.start_date,
    dto.event.date_range.end_date,
  );
}

// Multiple selected dates
else if (Array.isArray(dto.event?.event_date)) {
  eventDates = dto.event.event_date;
}

// Single date
else if (dto.event?.event_date) {
  eventDates = [dto.event.event_date];
}

// Remove duplicates
eventDates = [...new Set(eventDates)];

// Insert dates
const eventDateResult: any[] = [];

for (const date of eventDates) {
  const res: any = await this.dataSource.query(
    `
      INSERT INTO booking_event_dates
      (booking_id, event_date)
      VALUES (?, ?)
    `,
    [bookingId, date],
  );

  eventDateResult.push({
    id: res.insertId,
    date,
  });
}

  // const eventDateId = event.insertId;

  // -----------------------------
  // 6. SHIFTS (FIXED)
  // -----------------------------
  const SHIFT_MAP: any = {
  morning: 1,
  afternoon: 2,
  evening: 3,
};

const shifts = dto.event?.shift || [];
const shiftValues: any[] = [];

for (const ed of eventDateResult) {
  for (const shift of shifts) {
    const shiftId = SHIFT_MAP[shift.toLowerCase()];
    if (!shiftId) continue;

    shiftValues.push([
      bookingId,
      ed.id,
      0,
      shift,
      'active',
    ]);
  }
}

if (shiftValues.length) {
  await this.dataSource.query(
    `
    INSERT INTO booking_shifts
    (booking_id, event_date_id, venue_id, shift_name, status)
    VALUES ?
    `,
    [shiftValues],
  );
}

  // -----------------------------
  // 7. CUSTOMER
  // -----------------------------
  // await this.dataSource.query(
  //   `
  //   INSERT INTO booking_parties
  //   (
  //     booking_id,
  //     party_type,
  //     party_id,
  //     name,
  //     phone,
  //     email
  //   )
  //   VALUES (?,?,?,?,?,?)
  //   `,
  //   [
  //     bookingId,
  //     'customer',
  //     0,
  //     dto.customer?.name || null,
  //     dto.customer?.phone || null,
  //     dto.customer?.email || null,
  //   ],
  // );
  await this.dataSource.query(
  `
  INSERT INTO booking_parties
  (
    booking_id,
    party_type,
    party_id,
    name,
    phone,
    email,
    gst_applicable,
    gst_number
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  [
    bookingId,
    'customer',
    0,
    dto.customer.name,
    dto.customer.phone,
    dto.customer.email,
    dto.customer.gst_applicable ? 1 : 0,
    dto.customer.gst_number || null,
  ],
);

// -----------------------------
  // 7.1 . CUSTOMER
  // -----------------------------

if (dto.customer?.booked_by) {
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
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      bookingId,
      'guest',
      0,
      dto.customer.booked_by.name || null,
      dto.customer.booked_by.phone || null,
      dto.customer.booked_by.email || null,
    ],
  );
}

  // -----------------------------
  // 8. SERVICE PROVIDERS
  // -----------------------------
const providers = dto.service_providers || {};

const providerValues = Object.entries(providers)
  .filter(([_, value]) => value)
  .map(([type, value]: any) => [
    bookingId,
    type,
    0,
    value,
  ]);

if (providerValues.length) {
  await this.dataSource.query(
    `
    INSERT INTO booking_parties
    (booking_id, party_type, party_id, name)
    VALUES ?
    `,
    [providerValues],
  );
}

  // -----------------------------
  // 9. CHARGES
  // -----------------------------
  const chargeValues: any[] = [];

// --------------------
// 1. BASE AMOUNT
// --------------------
chargeValues.push([
  bookingId,
  'base',
  'Base Amount',
  1,
  dto.pricing?.base_amount || 0,
  dto.pricing?.base_amount || 0,
]);

// --------------------
// 2. ADDONS
// --------------------
if (dto.addons?.length) {
  for (const addon of dto.addons) {
    chargeValues.push([
      bookingId,
      'addon',
      addon.name,
      addon.qty,
      addon.unit_price,
      addon.amount,
    ]);
  }
}
/* 
 venue_gst: summary.venueGST,
    pax_gst: summary.paxGST, 

    dto.pricing?.venue_gst
    dto.pricing?.paxGST
    
    */
// --------------------
// 3. SECURITY DEPOSIT
// --------------------
if (dto.pricing?.security_deposit) {
  chargeValues.push([
    bookingId,
    'security_deposit',
    'Security Deposit',
    1,
    dto.pricing.security_deposit,
    dto.pricing.security_deposit,
  ]);
}

// --------------------
// 3.1 Peak value
// --------------------
if (dto.pricing?.peak_surcharge) {
  chargeValues.push([
    bookingId,
    'peak_surcharge',
    'Peak surcharge',
    1,
    dto.pricing.peak_surcharge,
    dto.pricing.peak_surcharge,
  ]);
}

// --------------------
// 3.2 Peak value
// --------------------
if (dto.pricing?.weekend_surcharge) {
  chargeValues.push([
    bookingId,
    'weekend_surcharge',
    'Weekend surcharge',
    1,
    dto.pricing.weekend_surcharge,
    dto.pricing.weekend_surcharge,
  ]);
}
// --------------------
// 3.3 Peak value
// --------------------
if (dto.pricing?.extra_guest_charge) {
  chargeValues.push([
    bookingId,
    'extra_guest_charge',
    'Extra guest charge',
    1,
    dto.pricing.extra_guest_charge,
    dto.pricing.extra_guest_charge,
  ]);
}// --------------------
// 3.4 Peak value
// --------------------
if (dto.pricing?.below_min_charge) {
  chargeValues.push([
    bookingId,
    'below_min_charge',
    'Below min charge',
    1,
    dto.pricing.below_min_charge,
    dto.pricing.below_min_charge,
  ]);
}


// --------------------
// 4. ADVANCE PAYMENT
// --------------------
if (dto.pricing?.advance_amount) {
  chargeValues.push([
    bookingId,
    'advance',
    'Advance Payment',
    1,
    dto.pricing.advance_amount,
    dto.pricing.advance_amount,
  ]);
}

// --------------------
// 5. RESERVATION AMOUNT
// --------------------
if (dto.pricing?.reservation_amount) {
  chargeValues.push([
    bookingId,
    'reservation',
    'Reservation Amount',
    1,
    dto.pricing.reservation_amount,
    dto.pricing.reservation_amount,
  ]);
}

// --------------------
// 6. DISCOUNT (optional but important)
// --------------------
if (dto.pricing?.discount_amount) {
  chargeValues.push([
    bookingId,
    'discount',
    'Discount',
    1,
    -dto.pricing.discount_percent,
    -dto.pricing.discount_amount,
  ]);
}

// --------------------
// INSERT ALL
// --------------------
await this.dataSource.query(
  `
  INSERT INTO booking_charges
  (booking_id, charge_type, title, quantity, unit_price, total_price)
  VALUES ?
  `,
  [chargeValues],
);


const taxes : any[] = [];

if (dto.pricing?.gst_total > 0) {
  taxes.push([
    bookingId,
    'Venue GST',
    18,
    0,
    dto.pricing.gst_total,
  ]);
}

if (dto.pricing?.pax_gst > 0) {
  taxes.push([
    bookingId,
    'PAX GST',
    5,
    0,
    dto.pricing.pax_gst,
  ]);
}

if (taxes.length) {
  await this.dataSource.query(
    `
    INSERT INTO booking_taxes
    (booking_id, tax_name, tax_percent, taxable_amount, tax_amount)
    VALUES ?
    `,
    [taxes]
  );
}


  // -----------------------------
  // 10. RESPONSE
  // ----------------------------- 
  // 
   // -----------------------------
  // 11. LOGS
  // -----------------------------

  await this.createLog(
  'booking',
  bookingId,
  'created',
  `Booking ${code} created`,
  id,
  null,
  {
    booking_type: reserveType,
    customer: dto.customer?.name,
    total_amount: dto.pricing?.grand_total,
  }
);

//Realtime
this.socketService.realtime(
  id.toString(),
  'Booking',
  `Booking ${code} created`
);


//email
const data = {
  email:dto.customer?.email,
  id:bookingId
}
this.invoiceService.sendInvoice(data);

await this.notificationService.createNotification({
  type: reserveType,
  referenceId: bookingId,
  title: `New ${reserveType}`,
  message: `New ${reserveType} received - ${code}`,
  createdBy: id,
});


  return {
    success: true,
    booking_id: bookingId,
    invoice_number: code,
  };
}

//only if package
async insertPaxPackages(bookingId: number, dto: any) {

  for (const pkg of dto.pax_packages || []) {

    const paxCount = dto.event?.guest_capacity || 0;

    // =========================
    // 1. booking_pax
    // =========================
    const paxResult: any = await this.dataSource.query(
      `
      INSERT INTO booking_pax
      (booking_id, package_id, package_name, pax_count, price_per_pax, total)
      VALUES (?,?,?,?,?,?)
      `,
      [
        bookingId,
        pkg.package_id,
        pkg.package_name,
        paxCount,
        pkg.price_per_pax,
        paxCount * pkg.price_per_pax
      ]
    );

    const bookingPaxId = paxResult.insertId;

    // =========================
    // TEMP ARRAYS
    // =========================
    const categoryRows: any[] = [];
    const itemRows: any[] = [];
    const snapshotRows: any[] = [];

    // =========================
    // LOOP SELECTIONS
    // =========================
    for (const sel of pkg.selections || []) {

      // CATEGORY
      categoryRows.push([
        bookingPaxId,
        sel.category_id,
        sel.category_name
      ]);

      // ITEMS (FIX HERE)
      for (const item of sel.item_ids || []) {

        itemRows.push([
          bookingPaxId,
          sel.category_id,
          item.id   // ✅ FIXED
        ]);

        snapshotRows.push([
          bookingPaxId,
          item.id,
          item.name,   // ✅ FIXED
          0            // price (or item.price if available)
        ]);
      }
    }

    // =========================
    // INSERT CATEGORIES
    // =========================
    if (categoryRows.length) {
      await this.dataSource.query(
        `
        INSERT INTO booking_pax_categories
        (booking_pax_id, category_id, category_name)
        VALUES ?
        `,
        [categoryRows]
      );
    }

    // =========================
    // INSERT ITEMS
    // =========================
    if (itemRows.length) {
      await this.dataSource.query(
        `
        INSERT INTO booking_pax_items
        (booking_pax_id, category_id, item_id)
        VALUES ?
        `,
        [itemRows]
      );
    }

    // =========================
    // INSERT SNAPSHOT
    // =========================
    if (snapshotRows.length) {
      await this.dataSource.query(
        `
        INSERT INTO booking_pax_item_snapshot
        (booking_pax_id, item_id, item_name, price)
        VALUES ?
        `,
        [snapshotRows]
      );
    }
  }

  return true;
}
 async all_reservations(category: any, country: any, id: number) {
  const singular = category.endsWith('s')
    ? category.slice(0, -1)
    : category;

  const [categoryRow] = await this.dataSource.query(
    `
      SELECT id
      FROM category
      WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
      LIMIT 1
    `,
    [singular],
  );

  if (!categoryRow) {
    return [];
  }

  const rows = await this.dataSource.query(
    `
    SELECT
        b.id,

        b.selection_mode,
        b.selection_type,
        b.reservation_end_date,
        b.is_read AS isRead,

        MAX(b.booking_code) AS refNo,
        MAX(b.invoice_number) AS invoice_number,

        MAX(b.booking_type) AS type,

        /* =====================================================
           WORKFLOW STATE
           ===================================================== */
        CASE
            WHEN LOWER(TRIM(MAX(b.status))) = 'cancelled'
                THEN 'CANCELLED'

            WHEN LOWER(TRIM(MAX(b.booking_type))) IN ('lead', 'pax')
                THEN 'NEW'

            WHEN LOWER(TRIM(MAX(b.booking_type))) = 'reserve'
                THEN 'RESERVED'

            WHEN LOWER(TRIM(MAX(b.booking_type))) = 'expired'
                THEN 'EXPIRED'

            WHEN LOWER(TRIM(MAX(b.booking_type))) = 'draft'
                THEN 'DRAFT'

            WHEN LOWER(TRIM(MAX(b.booking_type))) = 'booked'
                THEN 'CONFIRMED'
                
            WHEN LOWER(TRIM(MAX(b.booking_type))) = 'quotation'
                THEN 'QUOTATION'

            ELSE 'NEW'
        END AS workflowState,

        /* =====================================================
           CUSTOMER
           ===================================================== */
        MAX(bp.name) AS name,
        MAX(bp.email) AS email,
        MAX(bp.phone) AS phone,

        /* =====================================================
           VENUE
           ===================================================== */
        GROUP_CONCAT(
            DISTINCT bv.venue_name_snapshot
            ORDER BY bv.venue_name_snapshot
            SEPARATOR ', '
        ) AS venue,

        /* =====================================================
           GUESTS
           ===================================================== */
        MAX(b.total_pax) AS guests,

        /* =====================================================
           AMOUNT
           ===================================================== */
        MAX(b.total_amount) AS amountNum,
        MAX(b.total_amount) AS amount,

        /* =====================================================
           EVENT DATE
           ===================================================== */
        CASE
            WHEN MIN(bed.event_date) IS NULL
                THEN NULL

            WHEN DATE(MIN(bed.event_date))
                 = DATE(MAX(bed.event_date))
                THEN DATE_FORMAT(
                    MIN(bed.event_date),
                    '%Y-%m-%d'
                )

            ELSE CONCAT(
                DATE_FORMAT(
                    MIN(bed.event_date),
                    '%Y-%m-%d'
                ),
                ' - ',
                DATE_FORMAT(
                    MAX(bed.event_date),
                    '%Y-%m-%d'
                )
            )
        END AS eventDate,

        /* =====================================================
           ORDER DATE
           ===================================================== */
        MAX(b.created_at) AS orderDate,

        /* =====================================================
           SHIFTS
           ===================================================== */
        GROUP_CONCAT(
            DISTINCT bs.shift_name
            ORDER BY bs.shift_name
            SEPARATOR ', '
        ) AS shift,

        /* =====================================================
           EXISTING PLACEHOLDER FIELDS
           ===================================================== */
        MAX(b.invoice_number) AS source,
        MAX(b.invoice_number) AS caterer,
        MAX(b.invoice_number) AS decorator,
        MAX(b.invoice_number) AS paymentStatus,
        MAX(b.invoice_number) AS assignedStaff,

        /* =====================================================
           BASE AMOUNT
           ===================================================== */
        MAX(b.base_amount) AS base_amt,

        /* =====================================================
           EVENT TYPE
           ===================================================== */
        MAX(bet.event_name) AS eventType,

        /* =====================================================
           AVATAR COLOR
           ===================================================== */
        CASE
            WHEN LOWER(TRIM(MAX(b.status))) = 'cancelled'
                THEN 'bg-red-500'

            WHEN LOWER(TRIM(MAX(b.booking_type))) IN ('lead', 'pax')
                THEN 'bg-green-500'

            WHEN LOWER(TRIM(MAX(b.booking_type))) = 'reserve'
                THEN 'bg-pink-500'

            WHEN LOWER(TRIM(MAX(b.booking_type))) = 'expired'
                THEN 'bg-blue-500'

            WHEN LOWER(TRIM(MAX(b.booking_type))) = 'draft'
                THEN 'bg-emerald-500'

            WHEN LOWER(TRIM(MAX(b.booking_type))) = 'booked'
                THEN 'bg-amber-500'
                
            WHEN LOWER(TRIM(MAX(b.booking_type))) = 'quotation'
                THEN 'bg-yellow-500'

            ELSE 'bg-violet-500'
        END AS avatarColor,

        MAX(b.invoice_number) AS tag,

        /* =====================================================
           PAX DETAILS
           ===================================================== */
        COALESCE(
            (
                SELECT JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'id', pax.id,
                        'bookingId', pax.booking_id,
                        'packageId', pax.package_id,
                        'packageName', pax.package_name,
                        'paxCount', pax.pax_count,
                        'pricePerPax', pax.price_per_pax,
                        'total', pax.total,
                        'createdAt', pax.created_at,
                        'updatedAt', pax.updated_at,

                        'items',
                        COALESCE(
                            (
                                SELECT JSON_ARRAYAGG(
                                    JSON_OBJECT(
                                        'id', ppi.id,
                                        'categoryId', ppi.category_id,
                                        'itemId', ppi.item_id,

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
       CUSTOMER
       ===================================================== */
    LEFT JOIN booking_parties bp
        ON bp.booking_id = b.id
        AND LOWER(TRIM(bp.party_type)) = 'customer'

    /* =====================================================
       VENUE
       ===================================================== */
    LEFT JOIN booking_venues bv
        ON bv.booking_id = b.id

    /* =====================================================
       EVENT DATES
       ===================================================== */
    LEFT JOIN booking_event_dates bed
        ON bed.booking_id = b.id

    /* =====================================================
       EVENT TYPE
       ===================================================== */
    LEFT JOIN booking_event_types bet
        ON bet.id = b.booking_event_type_id

    /* =====================================================
       SHIFTS
       ===================================================== */
    LEFT JOIN booking_shifts bs
        ON bs.booking_id = b.id

    /* =====================================================
       FILTER
       ===================================================== */
    WHERE
        b.vendor_id = ?

        AND b.category = ?

        AND b.country_id = ?

        AND LOWER(TRIM(b.booking_type)) IN (
            'lead',
            'pax',
            'reserve',
            'draft',
            'booked',
            'quotation',
            'expired'
        )

    GROUP BY
        b.id,
        b.selection_mode,
        b.selection_type

    ORDER BY
        MAX(b.created_at) DESC
    `,
    [
      id,
      categoryRow.id,
      country,
    ],
  );

  return rows;
}

  async all_other_reserve(category: any, country: any, id: number) {
    const singular = category.endsWith('s') ? category.slice(0, -1) : category;
    const [categorys] = await this.dataSource.query(
      `SELECT id FROM category WHERE name = ? limit 1`,
      [singular],
    );

    const rows = await this.dataSource.query(
      `
SELECT
    b.booking_id AS id,
    b.booking_auto_id AS refNo,
    b.booking_type AS type,

CASE
    WHEN  b.booking_types = 0 THEN 'DRAFT'
    WHEN  b.booking_types = 2 THEN 'QUOTATION'

    ELSE 'NEW'
END AS workflowState,

    b.billing_first_name AS name,
    b.billing_email AS email,
    b.billing_phone AS phone,

    GROUP_CONCAT(
        DISTINCT vc.child_venue_name
        ORDER BY vc.child_venue_name
        SEPARATOR ', '
    ) AS venue,

    b.booked_no_of_people AS guests,
    b.total_booking_price AS amountNum,
    b.total_booking_price AS amount,
    b.from_date AS eventDate,
    b.created_at AS orderDate,

    GROUP_CONCAT(
        DISTINCT CASE
            WHEN s.shift_id = 1 THEN 'Morning'
            WHEN s.shift_id = 2 THEN 'Afternoon'
            WHEN s.shift_id = 3 THEN 'Evening'
            WHEN s.shift_id = 4 THEN 'Full Day'
        END
        ORDER BY s.shift_id
        SEPARATOR ', '
    ) AS shift,

    b.booking_auto_id AS source,
    b.booking_auto_id AS caterer,
    b.booking_auto_id AS decorator,
    b.booking_auto_id AS paymentStatus,
    b.booking_auto_id AS assignedStaff,
    b.base_amount_of_hall AS base_amt,

    bet.event_name AS eventType,


    CASE

    WHEN  b.booking_types = 0 THEN 'bg-red-500'
    WHEN  b.booking_types = 2 THEN 'bg-green-500'

    ELSE 'bg-violet-500'

END AS avatarColor,

    b.booking_auto_id AS tag

FROM bookings b

LEFT JOIN booking_event_types bet
    ON bet.id = b.booking_event_type_id

LEFT JOIN booking_child_venue bcv
    ON bcv.booking_id = b.booking_id

LEFT JOIN venue_child vc
    ON vc.child_venue_id = bcv.child_venue_id

LEFT JOIN booking_shift s
    ON s.booking_id = b.booking_id

WHERE b.created_under_by = ?
  AND b.category_id = ? AND b.booking_types in (0,2)

GROUP BY
    b.booking_id,
    b.booking_auto_id,
    b.booking_type,
    b.status,
    b.billing_first_name,
    b.billing_email,
    b.billing_phone,
    b.booked_no_of_people,
    b.total_booking_price,
    b.from_date,
    b.created_at,
    bet.event_name

ORDER BY b.created_at DESC
`,
      [id, categorys.id],
    );

    return rows;
  }

async reservation_invoice(id: number) {
 const [row] = await this.dataSource.query(
  `
SELECT
    b.id,
    b.booking_code AS refNo,
    b.invoice_g_id,
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
            'phone', bp.phone,
            'gst_applicable', bp.gst_applicable,
            'venue_gst_number', bp.gst_number
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
  async reservation_manage(id: number) {
  const [booking] = await this.dataSource.query(
    `
    SELECT
        b.id,
       b.booking_code AS refNo,
    b.invoice_number,
    b.invoice_g_id,
        b.booking_type,
        b.status,
        b.category,
        b.estimated_total,
         DATE_FORMAT(
  b.reservation_end_date,
  '%Y-%m-%d %H:%i:%s'
) AS reservation_end_date,

DATE_FORMAT(
  b.reservation_end_date,
  '%Y-%m-%d %H:%i:%s'
) AS reservation_date,

        MAX(bp.name) AS customer_name,
        MAX(bp.email) AS customer_email,
        MAX(bp.phone) AS customer_phone,

        GROUP_CONCAT(
            DISTINCT bv.venue_name_snapshot
            ORDER BY bv.venue_name_snapshot
            SEPARATOR ', '
        ) AS venues,

        MAX(bed.event_date) AS end_date,
         GROUP_CONCAT(
    DISTINCT DATE_FORMAT(bed.event_date, '%Y-%m-%d')
    ORDER BY bed.event_date
    SEPARATOR ', '
) AS event_date,

        GROUP_CONCAT(
            DISTINCT bs.shift_name
            ORDER BY bs.shift_name
            SEPARATOR ', '
        ) AS shifts,

        COALESCE(bl.logs, JSON_ARRAY()) AS logs,
         
        b.total_pax,
        b.base_amount,
        b.discount_amount,
        b.tax_amount,
        b.total_amount,
        b.notes,

        b.created_at,
        b.updated_at,

          MAX(bet.event_name) AS eventType
        

    FROM bookings b

    LEFT JOIN booking_parties bp
        ON bp.booking_id = b.id
        AND bp.party_type = 'Customer'

    LEFT JOIN booking_venues bv
        ON bv.booking_id = b.id

    LEFT JOIN booking_event_dates bed
        ON bed.booking_id = b.id

    LEFT JOIN booking_shifts bs
        ON bs.booking_id = b.id

       LEFT JOIN booking_event_types bet
      ON bet.id = b.booking_event_type_id
        
    LEFT JOIN (
    SELECT
        booking_id,
        JSON_ARRAYAGG(
            JSON_OBJECT(
                'action', action,
                'description', description,
                'old_value', old_value,
                'new_value', new_value,
                'created_by', created_by,
                'created_by_name', created_by_name,
                'created_at', created_at
            )
        ) AS logs
    FROM booking_logs
    GROUP BY booking_id
) bl ON bl.booking_id = b.id

    WHERE b.id = ?

    GROUP BY b.id

    LIMIT 1
    `,
    [id],
  );

  if (!booking) {
    return null;
  }

  // ----------------------------------
  // Parties
  // ----------------------------------
  booking.parties = await this.dataSource.query(
    `
    SELECT
        id,
        party_type,
        party_id,
        name,
        phone,
        email,
        role_note
    FROM booking_parties
    WHERE booking_id = ?
    ORDER BY id
    `,
    [id],
  );

  // ----------------------------------
  // Venues
  // ----------------------------------
  booking.venues = await this.dataSource.query(
    `
    SELECT
        id,
        parent_venue_id,
        child_venue_id,
        venue_name_snapshot
    FROM booking_venues
    WHERE booking_id = ?
    `,
    [id],
  );

  // ----------------------------------
  // Event Dates
  // ----------------------------------
  booking.event_dates = await this.dataSource.query(
    `
    SELECT
        id,
        event_date
    FROM booking_event_dates
    WHERE booking_id = ?
    ORDER BY event_date
    `,
    [id],
  );  
  
  // ----------------------------------
  // Event Dates
  // ----------------------------------
  booking.pax_status = await this.dataSource.query(
    `
    SELECT
        status
    FROM booking_status_logs
    WHERE booking_id = ?
    ORDER BY id DESC
    `,
    [id],
  );

  // ----------------------------------
  // Shifts
  // ----------------------------------
  booking.shifts = await this.dataSource.query(
    `
    SELECT
        id,
        event_date_id,
        venue_id,
        shift_name,
        start_time,
        end_time,
        pax,
        price,
        status
    FROM booking_shifts
    WHERE booking_id = ?
    ORDER BY id
    `,
    [id],
  );

  // ----------------------------------
  // Charges
  // ----------------------------------
  booking.charges = await this.dataSource.query(
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

  // ----------------------------------
  // Discounts
  // ----------------------------------
  booking.discounts = await this.dataSource.query(
    `
    SELECT *
    FROM booking_discounts
    WHERE booking_id = ?
    `,
    [id],
  );

  // ----------------------------------
  // Taxes
  // ----------------------------------
  booking.taxes = await this.dataSource.query(
    `
    SELECT *
    FROM booking_taxes
    WHERE booking_id = ?
    `,
    [id],
  );

  // ----------------------------------
  // Payments
  // ----------------------------------
  booking.payments = await this.dataSource.query(
    `
    SELECT *
    FROM booking_payments
    WHERE booking_id = ?
    ORDER BY payment_date DESC
    `,
    [id],
  );

  // ----------------------------------
  // PAX PACKAGES
  // ----------------------------------
  booking.pax_packages = await this.dataSource.query(
    `
    SELECT
      bp.id,
      bp.package_id,
      bp.package_name,
      bp.pax_count,
      bp.price_per_pax,
      bp.total
    FROM booking_pax bp
    WHERE bp.booking_id = ?
    `,
    [id],
  );

  // ----------------------------------
  // PAX CATEGORIES
  // ----------------------------------
  booking.pax_categories = await this.dataSource.query(
    `
    SELECT
      bpc.id,
      bpc.booking_pax_id,
      bpc.category_id,
      bpc.category_name
    FROM booking_pax_categories bpc
    INNER JOIN booking_pax bp ON bp.id = bpc.booking_pax_id
    WHERE bp.booking_id = ?
    `,
    [id],
  );

  // ----------------------------------
  // PAX ITEMS
  // ----------------------------------
  booking.pax_items = await this.dataSource.query(
    `
    SELECT
      bpi.id,
      bpi.booking_pax_id,
      bpi.category_id,
      bpi.item_id
    FROM booking_pax_items bpi
    INNER JOIN booking_pax bp ON bp.id = bpi.booking_pax_id
    WHERE bp.booking_id = ?
    `,
    [id],
  );

  // ----------------------------------
  // PAX ITEM SNAPSHOT
  // ----------------------------------
  booking.pax_item_snapshot = await this.dataSource.query(
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

  // ----------------------------------
  // Totals
  // ----------------------------------
  booking.total_charges = booking.charges.reduce(
    (sum: number, item: any) =>
      sum + Number(item.total_price || 0),
    0,
  );

  booking.total_discount = booking.discounts.reduce(
    (sum: number, item: any) =>
      sum + Number(item.discount_amount || 0),
    0,
  );

  booking.total_tax = booking.taxes.reduce(
    (sum: number, item: any) =>
      sum + Number(item.tax_amount || 0),
    0,
  );

  booking.total_paid = booking.payments.reduce(
    (sum: number, item: any) =>
      sum + Number(item.amount || 0),
    0,
  );

  booking.balance_amount =
    Number(booking.total_amount || 0) -
    Number(booking.total_paid || 0);

  return booking;
}

  async Load_all_venues(id: any) {
    const rows = await this.dataSource.query(
      `
    SELECT *
    FROM venue_child vc
    LEFT JOIN venue_parent vp ON vp.parent_venue_id = vc.parent_venue_id
    WHERE vc.created_by = ?  AND vp.propety_category = ? AND vc.publish_status = 1
    `,
      [id, 'venue'],
    );
    return rows;
  }

  async leads_create(dto: any, id: any) {
    //const singular = dto.category.endsWith("s") ? dto.category.slice(0, -1) : dto.category;
    //const [categorys] = await this.dataSource.query(`SELECT id FROM category WHERE name = ? limit 1`,[singular]);
    const bookingUuid = uuidv4();
    //const code = generateCode();

    let code = generateCode();
    let code_total = total_code_generating();

    while (true) {
      const rows = await this.dataSource.query(
        `SELECT 1 FROM bookings WHERE invoice_number = ? LIMIT 1`,
        [code],
      );

      if (rows.length === 0) {
        break; // Unique code found
      }

      code = generateCode(); // Generate another code
    }

    const crows = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM bookings`,
    );

    const generated_code = Number(crows[0].total);

    const child_rows = await this.dataSource.query(
        `SELECT * FROM venue_child WHERE child_venue_id = ? LIMIT 1`,
        [dto.venue],
      );

    const result: any = await this.dataSource.query(
  `
  INSERT INTO bookings (
    invoice_number,
    booking_code,
    booking_type,
    category,
    country_id,
    booking_event_type_id,
    status,
    total_amount,
    notes,
    total_pax,
    vendor_id,
    created_by,
    created_at,
    updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  [
    0,                   
    code,                      
    "lead", 
    1,
    2,                
    dto.eventType || null,   
    0,                       
    dto.budget || 0,         
    dto.notes || null,       
    dto.guestCount || 0,     
    id,                      
    id,                      
    new Date(),              
    new Date(),              
  ]
);
 const bookingId = result.insertId;
   // -----------------------------
// 4. VENUE
// -----------------------------
await this.dataSource.query(
  `
  INSERT INTO booking_venues
  (
    booking_id,
    parent_venue_id,
    child_venue_id,
    venue_name_snapshot
  )
  VALUES (?,?,?,?)
  `,
  [
    bookingId,
    null,
    dto.venue || null,
    child_rows[0].child_venue_name,
  ],
);

   // -----------------------------
// 5. EVENT DATE
// -----------------------------
const eventDateResult: any = await this.dataSource.query(
  `
  INSERT INTO booking_event_dates
  (
    booking_id,
    event_date
  )
  VALUES (?,?)
  `,
  [
    bookingId,
    dto.eventDate || null,
  ],
);

const eventDateId = eventDateResult.insertId;

// -----------------------------
// 6. SHIFT
// -----------------------------
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
  VALUES (?,?,?,?,?)
  `,
  [
    bookingId,
    eventDateId,
     0,
    dto.shift || null,
    "active",
  ],
);

// -----------------------------
// 7. CUSTOMER
// -----------------------------
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
  VALUES (?,?,?,?,?,?)
  `,
  [
    bookingId,
    "customer",
    0,
    dto.name || null,
    dto.phone || null,
    dto.email || null,
  ],
);

// -----------------------------
// 7. Leads Deatls
// -----------------------------
await this.dataSource.query(
  `
  INSERT INTO venue_leads_details
  (
    venue_lead_id,
    lead_source,
    referred_by,
    guest_count,
    customer_type,
    estimated_budget,
    event_type,
    priority,
    quick_tags,
    address,
    created_at,
    updated_at
  )
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `,
  [
    bookingId,
    dto.source || null,            // Phone Call
    dto.referredBy || null,        // sss
    Number(dto.guestCount || 0),   // 2500
    dto.customerType || null,      // returning
    Number(dto.budget || 0),       // 25000
    dto.eventType || null,         // 18
    dto.priority || 'medium',      // low
    dto.tags ? JSON.stringify(dto.tags) : null, // ["vip"]
    dto.address || null,           // Centre point building mangalore
    new Date(),
    new Date(),
  ],
);
 

await this.notificationService.createNotification({
  type: 'Lead',
  referenceId: bookingId,
  title: `New Lead`,
  message: `New Lead received - ${code}`,
  createdBy: id,
});
  }

  async historical_reserve(category: any, country: any, id: number) {
    const singular = category.endsWith('s') ? category.slice(0, -1) : category;
    const [categorys] = await this.dataSource.query(
      `SELECT id FROM category WHERE name = ? limit 1`,
      [singular],
    );
    const rows = await this.dataSource.query(
      `
SELECT
    h.id,
    CONCAT('HIS-', LPAD(h.id, 6, '0')) AS refNo,

    h.book_type AS type,

    'HISTORICAL' AS workflowState,

    h.cust_name AS name,
    h.email,
    h.phone,

    CONCAT_WS(
        ' / ',
        vp.venue_name,
        vc.child_venue_name
    ) AS venue,

    h.capacity AS guests,

    h.total AS amountNum,
    h.total AS amount,

    h.book_date AS eventDate,
    h.order_date AS orderDate,

    bet.event_name AS shift,

    h.invoice_no AS source,
    h.invoice_no AS caterer,
    h.invoice_no AS decorator,

    CASE
        WHEN h.total <= (
            IFNULL(h.a_amount,0) +
            IFNULL(h.f_amount,0) +
            IFNULL(h.s_amount,0)
        )
        THEN 'PAID'
        ELSE 'PENDING'
    END AS paymentStatus,

    NULL AS assignedStaff,

    h.base_price AS base_amt,

    h.book_type AS eventType,

    'bg-blue-500' AS avatarColor,

    h.form_no AS tag

FROM historical h

LEFT JOIN venue_parent vp
    ON vp.parent_venue_id = h.parent_id

LEFT JOIN venue_child vc
    ON vc.child_venue_id = h.child_id

LEFT JOIN booking_event_types bet
    ON bet.id = h.event_id

WHERE h.vendor_id = ?

ORDER BY h.created_at DESC
`,
      [id],
    );

    return rows;
  }

  // async historical_upload(category: any, country: any, id: number, body: any) {
  //   const raw = Object.keys(body)[0];
  //   const payload = JSON.parse(raw);
  //   const records = payload.data;

  //   if (!Array.isArray(records) || records.length === 0) {
  //     throw new BadRequestException('No data found.');
  //   }

  //   const queryRunner = this.dataSource.createQueryRunner();
  //   await queryRunner.connect();
  //   await queryRunner.startTransaction();

  //   try {
  //     for (const item of records) { 

  //       console.log(item.book_date)
  //       const [parent] = await queryRunner.query(
  //         `SELECT parent_venue_id
  //        FROM venue_parent
  //        WHERE venue_name = ?
  //        LIMIT 1`,
  //         [item.parent],
  //       );

  //       const [child] = await queryRunner.query(
  //         `SELECT child_venue_id
  //        FROM venue_child
  //        WHERE child_venue_name = ?
  //        LIMIT 1`,
  //         [item.child],
  //       );

  //       let eventId = item.event_id;

  //       // If event_id contains an event name instead of an ID
  //       if (isNaN(Number(item.event_id))) {
  //         const [eventType] = await queryRunner.query(
  //           `SELECT id
  //          FROM booking_event_types
  //          WHERE event_name = ?
  //          LIMIT 1`,
  //           [item.event_id],
  //         );

  //         eventId = eventType?.id ?? null;
  //       }

  //       const SHIFT_MAP = {
  //         morning: 1,
  //         afternoon: 2,
  //         evening: 3,
  //       };

  //       const shiftId = SHIFT_MAP[item.shift];

  //       await queryRunner.query(
  //         `
  //       INSERT INTO historical (
  //         vendor_id,
  //         last_uploaded,
  //         order_date,
  //         parent_id,
  //         child_id,
  //         book_date,
  //         shift,
  //         from_time,
  //         to_time,
  //         event_id,
  //         capacity,
  //         form_no,
  //         cust_name,
  //         cust_address,
  //         phone,
  //         email,
  //         invoice_no,
  //         base_price,
  //         add_on,
  //         discount,
  //         gst,
  //         total,
  //         book_type,
  //         paymode,
  //         areceipt_no,
  //         a_amount,
  //         a_pay_mode,
  //         a_pay_date,
  //         freceipt_no,
  //         f_amount,
  //         f_pay_mode,
  //         f_pay_date,
  //         sreceipt_no,
  //         s_amount,
  //         s_pay_mode,
  //         s_pay_date,
  //         refund_sd,
  //         refund_date,
  //         others,
  //         created_at,
  //         updated_at
  //       )
  //       VALUES (
  //         ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
  //       )
  //       `,
  //         [
  //           id,
  //           0,
  //           item.book_date,
  //           parent?.parent_venue_id ?? null,
  //           child?.child_venue_id ?? null,
  //           item.book_date,
  //           shiftId,
  //           item.from_time,
  //           item.to_time,
  //           eventId,
  //           item.capacity,
  //           item.form_no,
  //           item.cust_name,
  //           item.cust_address,
  //           item.phone,
  //           item.email,
  //           item.invoice_no,
  //           item.base_price,
  //           item.add_on,
  //           item.discount,
  //           item.gst,
  //           item.total,
  //           item.book_type == 'book' ? 1 : 2,
  //           item.paymode,
  //           item.areceipt_no,
  //           item.a_amount,
  //           item.a_pay_mode,
  //           item.a_pay_date,
  //           item.freceipt_no,
  //           item.f_amount,
  //           item.f_pay_mode,
  //           item.f_pay_date,
  //           item.sreceipt_no,
  //           item.s_amount,
  //           item.s_pay_mode,
  //           item.s_pay_date,
  //           item.refund_sd,
  //           item.refund_date || null,
  //           item.others,
  //         ],
  //       );
  //     }

  //     await queryRunner.commitTransaction();

  //     return {
  //       success: true,
  //       message: `${records.length} historical records uploaded successfully.`,
  //     };
  //   } catch (error) {
  //     await queryRunner.rollbackTransaction();
  //     console.error(error);
  //     throw new BadRequestException(error);
  //   } finally {
  //     await queryRunner.release();
  //   }
  // }

async  historical_upload(
  this: any,
  category: any,
  country: any,
  id: number,
  body: any,
) {
  /* ---------------------------------------------------------------------
   * Local helpers (scoped to this function only)
   * --------------------------------------------------------------------- */
  const nn = (v: any): any =>
    v === '' || v === undefined || v === null ? null : v;

  const num = (v: any): number | null => {
    if (v === '' || v === undefined || v === null) return null;
    const n = Number(String(v).replace(/[,\s₹]/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  /** Excel serial / DD-MM-YYYY / DD/MM/YYYY / YYYY-MM-DD  ->  'YYYY-MM-DD' */
  const toDate = (v: any): string | null => {
    if (v === '' || v === undefined || v === null) return null;

    const asNum = Number(v);
    if (Number.isFinite(asNum) && asNum > 20000 && asNum < 60000) {
      // Excel serial: days since 1899-12-30
      const ms = Math.round((asNum - 25569) * 86400 * 1000);
      return new Date(ms).toISOString().slice(0, 10);
    }

    const s = String(v).trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) {
      const [, d, mo, y] = m;
      return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    const parsed = new Date(s);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  };

  const key = (v: any) => String(v ?? '').trim().toLowerCase();

  /** Loose header lookup: ignores case, spaces, dots, hyphens, underscores */
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  function pick(row: Record<string, any>, ...aliases: string[]): any {
    if (!row) return undefined;
    const index: Record<string, any> = {};
    for (const k of Object.keys(row)) index[slug(k)] = row[k];
    for (const a of aliases) {
      const hit = index[slug(a)];
      if (hit !== undefined) return hit;
    }
    return undefined;
  }

  const SHIFT_MAP: Record<string, number> = {
    morning: 1,
    afternoon: 2,
    evening: 3,
    '1': 1,
    '2': 2,
    '3': 3,
  };

  /** Source sheet has no times — derive sensible defaults from the shift. */
  const SHIFT_TIMES: Record<number, { from: string; to: string }> = {
    1: { from: '08:00:00', to: '12:00:00' },
    2: { from: '12:00:00', to: '17:00:00' },
    3: { from: '18:00:00', to: '23:00:00' },
  };

  /** Values in "Booking Type" that are really payment modes, not book/block. */
  const PAYMODES = new Set([
    'cash', 'upi', 'card', 'cheque', 'check', 'bank', 'banktransfer',
    'neft', 'rtgs', 'imps', 'online',
  ]);

  /** Converts one spreadsheet row into canonical fields */
  function mapRow(raw: Record<string, any>) {
    const bookingType = key(pick(raw, 'Booking Type', 'book_type'));
    const isPaymode = PAYMODES.has(bookingType.replace(/\s/g, ''));

    return {
      parent: pick(raw, 'Parent Venue Name', 'parent', 'Parent Venue'),
      child: pick(raw, 'Child Venue Name', 'child', 'Child Venue'),

      orderDate: toDate(pick(raw, 'Booking Date', 'book_date', 'Order Date')),
      eventDate: toDate(
        pick(raw, 'Function Date', 'Event Date', 'event_date'),
      ),

      shift: pick(raw, 'Shift', 'shift'),
      eventType: pick(raw, 'Event Type', 'Event', 'event_id'),
      capacity: num(pick(raw, 'Guest Capacity', 'Capacity', 'capacity')),
      formNo: nn(pick(raw, 'Form No', 'Form No.', 'form_no')),

      custName: nn(pick(raw, 'Customer Name', 'cust_name')),
      custAddress: nn(pick(raw, 'Customer Address', 'cust_address')),
      phone: nn(pick(raw, 'Customer Phone number', 'Phone', 'phone')),
      email: nn(pick(raw, 'Customer E-Mail', 'Email', 'email')),
      invoiceNo: nn(pick(raw, 'Invoice No.', 'Invoice No', 'invoice_no')),

      basePrice: num(pick(raw, 'Base Price', 'base_price')),
      addOn: num(pick(raw, 'Add-Ons', 'Add On', 'add_on')),
      discount: num(pick(raw, 'Discount', 'discount')),
      gst: num(pick(raw, 'GST', 'gst')),
      total: num(pick(raw, 'Total', 'total')),

      paymode: isPaymode ? bookingType : nn(pick(raw, 'Payment Mode', 'paymode')),
      bookType: isPaymode || bookingType === 'book' || bookingType === '1' ? 1 : 2,

      advanceAmount: num(pick(raw, 'Advance recived', 'Advance Received', 'a_amount')),
      advanceDate: toDate(pick(raw, 'Advance Payment Date', 'a_pay_date')),
      advanceReceipt: nn(pick(raw, 'Advance Receipt No', 'areceipt_no')),

      fullAmount: num(pick(raw, 'Full Payment', 'Final Amount', 'f_amount')),
      fullDate: toDate(pick(raw, 'Full Payment Date', 'Final Payment Date', 'f_pay_date')),
      fullReceipt: nn(pick(raw, 'Final Receipt No', 'freceipt_no')),

      secondAmount: num(pick(raw, 'Second Amount', 's_amount')),
      secondDate: toDate(pick(raw, 'Second Payment Date', 's_pay_date')),
      secondReceipt: nn(pick(raw, 'Second Receipt No', 'sreceipt_no')),

      securityDeposit: num(pick(raw, 'Security Deposite', 'Security Deposit')),
      securityDepositDate: toDate(
        pick(raw, 'Security Deposite date', 'Security Deposit Date'),
      ),
      refundDeducted: num(pick(raw, 'Refund deducted', 'Refund Deducted')),
      refundSd: num(
        pick(raw, 'Refund of security Deposite', 'Refund SD', 'refund_sd'),
      ),
      refundDate: toDate(
        pick(raw, 'Refund of security Deposite Date', 'Refund Date', 'refund_date'),
      ),

      others: nn(pick(raw, 'Others', 'others', 'Remarks')),
    };
  }

  /** A row with no customer, no invoice and no dates is spreadsheet padding. */
  function isBlankRow(m: ReturnType<typeof mapRow>): boolean {
    return !m.custName && !m.invoiceNo && !m.eventDate && !m.fullAmount;
  }

  /* -----------------------------------------------------------------------
   * 1. Resolve payload
   * --------------------------------------------------------------------- */
  let payload: any = body;

  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      throw new BadRequestException('Request body is not valid JSON.');
    }
  } else if (
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload.data) &&
    Object.keys(payload).length > 0
  ) {
    // Legacy: JSON arrived as urlencoded keys and got split on '&' / '='
    const joined = Object.keys(payload)
      .map((k) => (payload[k] === '' ? k : `${k}=${payload[k]}`))
      .join('&');
    try {
      payload = JSON.parse(joined);
    } catch {
      throw new BadRequestException(
        'Malformed payload. Send with Content-Type: application/json and body { "data": [...] }.',
      );
    }
  }

  const records: any[] = payload?.data;
  if (!Array.isArray(records) || records.length === 0) {
    throw new BadRequestException('No data found.');
  }

  /* -----------------------------------------------------------------------
   * 2. Pre-load lookups (3 queries total, not 3 per row)
   * --------------------------------------------------------------------- */
  const [parentRows, childRows, eventRows] = await Promise.all([
    this.dataSource.query(`SELECT parent_venue_id, venue_name FROM venue_parent`),
    this.dataSource.query(`SELECT child_venue_id, child_venue_name FROM venue_child`),
    this.dataSource.query(`SELECT id, event_name FROM booking_event_types`),
  ]);

  const parentMap = new Map<string, number>(
    parentRows.map((r: any) => [key(r.venue_name), r.parent_venue_id]),
  );
  const childMap = new Map<string, number>(
    childRows.map((r: any) => [key(r.child_venue_name), r.child_venue_id]),
  );
  const eventMap = new Map<string, number>(
    eventRows.map((r: any) => [key(r.event_name), r.id]),
  );

  /* -----------------------------------------------------------------------
   * 3. Map + validate every row BEFORE touching the DB
   * --------------------------------------------------------------------- */
  const errors: string[] = [];
  const warnings: string[] = [];
  const skipped: number[] = [];
  const rows: any[][] = [];

  records.forEach((raw: any, index: number) => {
    const rowNo = index + 2; // +2 = header offset in the spreadsheet
    const m = mapRow(raw);

    if (isBlankRow(m)) {
      skipped.push(rowNo);
      return;
    }

    const parentId = parentMap.get(key(m.parent)) ?? null;
    const childId = childMap.get(key(m.child)) ?? null;

    let eventId: number | null = null;
    if (m.eventType !== '' && m.eventType != null) {
      eventId = isNaN(Number(m.eventType))
        ? eventMap.get(key(m.eventType)) ?? null
        : Number(m.eventType);
    }

    const shiftId = SHIFT_MAP[key(m.shift)] ?? null;
    const times = shiftId ? SHIFT_TIMES[shiftId] : null;

    /* -- hard errors: block the upload -- */
    if (!m.parent) errors.push(`Row ${rowNo}: parent venue is missing.`);
    else if (!parentId)
      errors.push(`Row ${rowNo}: unknown parent venue "${m.parent}".`);

    if (m.child && !childId)
      errors.push(`Row ${rowNo}: unknown child venue "${m.child}".`);

    if (m.eventType && !eventId)
      errors.push(`Row ${rowNo}: unknown event type "${m.eventType}".`);

    if (m.shift && !shiftId)
      errors.push(`Row ${rowNo}: unknown shift "${m.shift}".`);

    if (!m.eventDate && !m.orderDate)
      errors.push(`Row ${rowNo}: no usable booking or function date.`);

    /* -- soft warnings: data-entry issues in the source sheet -- */
    const expectedTotal =
      (m.basePrice ?? 0) + (m.addOn ?? 0) - (m.discount ?? 0) + (m.gst ?? 0);
    if (m.total != null && Math.abs(expectedTotal - m.total) > 1) {
      warnings.push(
        `Row ${rowNo} (${m.custName || 'no name'}): Total ${m.total} does not match ` +
        `Base+AddOn-Discount+GST = ${expectedTotal}.`,
      );
    }

    const paid = (m.advanceAmount ?? 0) + (m.fullAmount ?? 0) + (m.secondAmount ?? 0);
    if (m.total != null && paid > 0 && Math.abs(paid - m.total) > 1) {
      warnings.push(
        `Row ${rowNo} (${m.custName || 'no name'}): payments total ${paid} ` +
        `but invoice total is ${m.total}.`,
      );
    }

    if (m.eventDate && m.orderDate && m.eventDate < m.orderDate) {
      warnings.push(
        `Row ${rowNo}: function date ${m.eventDate} is before booking date ${m.orderDate}.`,
      );
    }

    if (m.refundDate && m.eventDate && m.refundDate < m.eventDate) {
      warnings.push(
        `Row ${rowNo}: refund date ${m.refundDate} is before the function date ${m.eventDate}.`,
      );
    }

    /* -- security deposit has no dedicated column; preserve it in `others` -- */
    const notes: string[] = [];
    if (m.securityDeposit != null)
      notes.push(`Security Deposit: ${m.securityDeposit}`);
    if (m.securityDepositDate)
      notes.push(`SD Date: ${m.securityDepositDate}`);
    if (m.refundDeducted != null && m.refundDeducted !== 0)
      notes.push(`Refund Deducted: ${m.refundDeducted}`);
    if (m.others) notes.push(String(m.others));

    rows.push([
      id,                                  // vendor_id
      0,                                   // last_uploaded
      m.orderDate,                         // order_date  (booking taken on)
      parentId,                            // parent_id
      childId,                             // child_id
      m.eventDate ?? m.orderDate,          // book_date   (event happens on)
      shiftId,                             // shift
      times?.from ?? null,                 // from_time
      times?.to ?? null,                   // to_time
      eventId,                             // event_id
      m.capacity,
      m.formNo,
      m.custName,
      m.custAddress,
      m.phone,
      m.email,
      m.invoiceNo,
      m.basePrice,
      m.addOn,
      m.discount,
      m.gst,
      m.total,
      m.bookType,
      m.paymode,
      m.advanceReceipt,
      m.advanceAmount,
      m.advanceAmount != null ? m.paymode : null,  // a_pay_mode
      m.advanceDate,
      m.fullReceipt,
      m.fullAmount,
      m.fullAmount != null ? m.paymode : null,     // f_pay_mode
      m.fullDate,
      m.secondReceipt,
      m.secondAmount,
      m.secondAmount != null ? m.paymode : null,   // s_pay_mode
      m.secondDate,
      m.refundSd,
      m.refundDate,
      notes.length ? notes.join(' | ') : null,
    ]);
  });

  if (errors.length) {
    throw new BadRequestException({
      success: false,
      message: 'Upload rejected. Fix the rows listed below and re-upload.',
      errors: errors.slice(0, 50),
      totalErrors: errors.length,
      warnings: warnings.slice(0, 50),
    });
  }

  if (rows.length === 0) {
    throw new BadRequestException(
      'Every row in the file was blank. Nothing to import.',
    );
  }

  /* -----------------------------------------------------------------------
   * 4. Batched insert inside one transaction
   * --------------------------------------------------------------------- */
  const COLUMNS = [
    'vendor_id', 'last_uploaded', 'order_date', 'parent_id', 'child_id',
    'book_date', 'shift', 'from_time', 'to_time', 'event_id',
    'capacity', 'form_no', 'cust_name', 'cust_address', 'phone',
    'email', 'invoice_no', 'base_price', 'add_on', 'discount',
    'gst', 'total', 'book_type', 'paymode', 'areceipt_no',
    'a_amount', 'a_pay_mode', 'a_pay_date', 'freceipt_no', 'f_amount',
    'f_pay_mode', 'f_pay_date', 'sreceipt_no', 's_amount', 's_pay_mode',
    's_pay_date', 'refund_sd', 'refund_date', 'others',
  ];

  const BATCH_SIZE = 200;
  const placeholder = `(${COLUMNS.map(() => '?').join(', ')}, NOW(), NOW())`;

  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const sql = `
        INSERT INTO historical (
          ${COLUMNS.join(',\n          ')},
          created_at,
          updated_at
        )
        VALUES
        ${batch.map(() => placeholder).join(',\n        ')}
      `;
      await queryRunner.query(sql, batch.flat());
    }

    await queryRunner.commitTransaction();

    return {
      success: true,
      message: `${rows.length} historical records uploaded successfully.`,
      inserted: rows.length,
      skippedBlankRows: skipped,
      warnings,
    };
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('historical_upload failed:', error);
    throw new BadRequestException(
      error || 'Upload failed.',
    );
  } finally {
    await queryRunner.release();
  }
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
  //

async add_payment(category: any, country: any, id: number, body: any) {
  const { booking_id, payments } = body;

  const rows = payments.map((payment) => [
    booking_id,
    payment.payment_date,
    payment.payment_type,
    payment.payment_method,
    payment.transaction_id || null,
    payment.amount_paid,
    'paid',
    new Date(),
    JSON.stringify({
      notes: payment.notes || '',
    }),
  ]);

  const sql = `
    INSERT INTO booking_payments (
      booking_id,
      payment_date,
      payment_type,
      payment_method,
      transaction_id,
      amount_paid,
      payment_status,
      paid_at,
      meta
    )
    VALUES ?
  `;

  await this.dataSource.query(sql, [rows]);

  // Create log for each payment
  for (const payment of payments) {
    await this.createLog(
      'booking',
      booking_id,
      'payment_received',
      `Payment received - ${payment.payment_type} ₹${Number(
        payment.amount_paid,
      ).toLocaleString('en-IN')}`,
      id,
      null,
      {
        payment_type: payment.payment_type,
        payment_method: payment.payment_method,
        amount_paid: payment.amount_paid,
        payment_date: payment.payment_date,
        transaction_id: payment.transaction_id || null,
      },
    );
  }



this.socketService.realtime(
  id.toString(),
  'Payment',
  `Payment received `
);

await this.notificationService.createNotification({
  type: 'Payment',
  referenceId: booking_id,
  title: `New Payment`,
  message: `New Payment received`,
  createdBy: id,
});

  return {
    success: true,
    message: 'Payments added successfully',
  };
}
  
async all_notification(category: any, country: any, id: any) {

    const singular = category?.endsWith('s')
    ? category.slice(0, -1)
    : category;

  const [categorys] = await this.dataSource.query(
    `SELECT id FROM category WHERE name = ? LIMIT 1`,
    [singular],
  );
  const rows = await this.dataSource.query(
    `
    SELECT COUNT(*) AS notification_count
    FROM bookings
    WHERE category = ?
      AND country_id = ?
      AND vendor_id = ?
    `,
    [categorys.id, country, id],
  );

  return {
    notification_count: Number(rows[0].notification_count),
  };
}

async realtimes() {
 this.socketService.realtime(
      '60',
      'Booking',
      'Booking Viewed',
    );
    return 'sucess'
// const data = {
//   email:'vb.develop1@gmail.com',
//   id:60
// }

// this.invoiceService.sendInvoice(data)



}

async refundSecurityDeposit(
  category: any,
  country: any,
  id: number,
  body: any,
) {
  const { booking_id, payments } = body;

  if (!booking_id) {
    throw new Error("Booking ID is required");
  }

  if (!payments || !Array.isArray(payments) || payments.length === 0) {
    throw new Error("Payments are required");
  }

  const rows = payments.map((payment: any) => [
    booking_id,
    payment.payment_date,
    "refund",
    payment.payment_method,
    payment.transaction_id || null,
    payment.amount_paid,
    "paid",
    new Date(),
    JSON.stringify({
      notes: payment.notes || "",
    }),
  ]);

  await this.dataSource.query(
    `
      INSERT INTO booking_payments (
        booking_id,
        payment_date,
        payment_type,
        payment_method,
        transaction_id,
        amount_paid,
        payment_status,
        paid_at,
        meta
      )
      VALUES ?
    `,
    [rows],
  );

  // Create log for each refund
  for (const payment of payments) {
    await this.createLog(
      "booking",
      booking_id,
      "security_deposit_refund",
      `Security deposit refunded ₹${Number(
        payment.amount_paid,
      ).toLocaleString("en-IN")}`,
      id,
      null,
      {
        payment_type: payment.payment_type || "security_deposit_refund",
        payment_method: payment.payment_method,
        amount_paid: payment.amount_paid,
        payment_date: payment.payment_date,
        transaction_id: payment.transaction_id || null,
        notes: payment.notes || "",
      },
    );
  }

  return {
    success: true,
    message: "Security deposit refunded successfully",
  };
}
async handlGenerateInvoice(
  category: any,
  country: any,
  id: number,
  body: any,
) {


const invoiceId = `INV-${Date.now()}`;
const invoiceDate = new Date();

await this.dataSource.query(
  `
  UPDATE bookings
  SET invoice_g_id = ?, invoice_date = ?
  WHERE id = ?
  `,
  [invoiceId, invoiceDate, body.booking_id],
);

await this.createLog(
  "booking",
  body.booking_id,
  "invoice_generated",
  `Invoice generated for booking #${body.booking_id}`,
  id,
  null,
  {
    invoice_id: invoiceId,
    invoice_date: invoiceDate,
  },
);

  return {
    success: true,
    message: "Invoice Generated successfully",
  };
}

async getBookingConversations(bookingId: number) {
  try {
    const conversations = await this.dataSource.query(
      `
      SELECT
        id,
        category,
        subject,
        venue_id,
        reference_type,
        reference_id,
        customer_id,
        vendor_id,
        is_pinned,
        last_message,
        last_message_at,
        unread_count,
        created_by,
        created_at,
        updated_at
      FROM conversations
      WHERE reference_type = 'booking'
        AND reference_id = ?
      ORDER BY updated_at DESC
      `,
      [bookingId],
    );

    for (const conversation of conversations) {
      conversation.messages = await this.dataSource.query(
        `
        SELECT
          id,
          conversation_id,
          sender_type,
          sender_id,
          message,
          role,
          attachment_url,
          reply_to,
          is_read,
          read_at,
          sent_at,
          created_at
        FROM messages
        WHERE conversation_id = ?
        ORDER BY sent_at ASC
        `,
        [conversation.id],
      );
    }

    return {
      success: true,
      booking_id: bookingId,
      conversations,
    };
  } catch (error) {
    console.error("getBookingConversations error:", error);

    throw error;
  }
}


async booking_viewed(
  category: any,
  country: any,
  user_id: any,
): Promise<boolean> {
  try {

       const singular = category?.endsWith('s')
    ? category.slice(0, -1)
    : category;

  const [categorys] = await this.dataSource.query(
    `SELECT id FROM category WHERE name = ? LIMIT 1`,
    [singular],
  );
    await this.dataSource.query(
      `
        UPDATE bookings
        SET is_read = 1
        WHERE category = ?
          AND country_id = ?
          AND vendor_id = ?
      `,
      [categorys.id, country, user_id],
    );

    // Realtime notification
    this.socketService.realtime(
      user_id.toString(),
      'Booking',
      'Booking Viewed',
    );

    return true;
  } catch (error) {
    console.error('Error while marking bookings as viewed:', error);
    return false;
  }
}


async bookingfieldUpdate(bookingId: number, dto: any, userId: number) {
  try {
    // --------------------------------
    // 1. UPDATE BOOKING
    // --------------------------------

    if (dto.total_pax !== undefined) {
      await this.dataSource.query(
        `
        UPDATE bookings
        SET total_pax = ?,
            updated_by = ?,
            updated_at = ?
        WHERE id = ?
        `,
        [
          Number(dto.total_pax) || 0,
          userId,
          new Date(),
          bookingId,
        ],
      );
    }

    // --------------------------------
    // 2. CUSTOMER
    // --------------------------------

    if (dto.customer) {
      await this.dataSource.query(
        `
        UPDATE booking_parties
        SET
          name = ?,
          phone = ?,
          email = ?
        WHERE booking_id = ?
          AND party_type = 'customer'
        `,
        [
          dto.customer.name || null,
          dto.customer.phone || null,
          dto.customer.email || null,
          bookingId,
        ],
      );
    }

    // --------------------------------
    // 3. SERVICE PROVIDERS
    // --------------------------------

    const providers = {
      caterer: dto.caterer,
      decorator: dto.decorator,
      sound_system: dto.sound_system,
      music_troupe: dto.music_troupe,
    };

    for (const [type, name] of Object.entries(providers)) {
      // Empty value = don't update
      if (!name) {
        continue;
      }

      const existing = await this.dataSource.query(
        `
        SELECT id
        FROM booking_parties
        WHERE booking_id = ?
          AND party_type = ?
        LIMIT 1
        `,
        [bookingId, type],
      );

      if (existing.length) {
        await this.dataSource.query(
          `
          UPDATE booking_parties
          SET name = ?
          WHERE booking_id = ?
            AND party_type = ?
          `,
          [name, bookingId, type],
        );
      } else {
        await this.dataSource.query(
          `
          INSERT INTO booking_parties
          (
            booking_id,
            party_type,
            party_id,
            name
          )
          VALUES (?, ?, ?, ?)
          `,
          [
            bookingId,
            type,
            0,
            name,
          ],
        );
      }
    }

    // --------------------------------
    // 4. LOG
    // --------------------------------

    await this.createLog(
      'booking',
      bookingId,
      'updated',
      `Booking ${bookingId} updated`,
      userId,
      null,
      {
        total_pax: dto.total_pax,
        customer: dto.customer?.name,
        caterer: dto.caterer,
        decorator: dto.decorator,
        sound_system: dto.sound_system,
        music_troupe: dto.music_troupe,
      },
    );

    // --------------------------------
    // 5. REALTIME
    // --------------------------------

    this.socketService.realtime(
      userId.toString(),
      'Booking',
      `Booking ${bookingId} updated`,
    );

    return {
      success: true,
      booking_id: bookingId,
      message: 'Booking updated successfully',
    };
  } catch (error) {
    console.error('Booking update error:', error);

    throw error;
  }
}

// async AddonUpdate(bookingId: number, dto: any, userId: number) {

// }

async AddonUpdate(
  bookingId: number,
  addons: any[],
  userId: number,
) {
  // Get booking
  const [booking] = await this.dataSource.query(
    `
    SELECT *
    FROM bookings
    WHERE id = ?
    `,
    [bookingId],
  );

  if (!booking) {
    throw new BadRequestException('Booking not found');
  }

  // Base amount from booking
  const baseAmount = Number(booking.base_amount || 0);

  // Remove old addons
  await this.dataSource.query(
    `
    DELETE FROM booking_charges
    WHERE booking_id = ?
    AND charge_type = 'addon'
    `,
    [bookingId],
  );

  let addonTotal = 0;
  const chargeValues:any = [];

  for (const addon of addons) {
    const qty = Number(addon.quantity || 1);
    const price = Number(addon.unit_price || 0);
    const total = qty * price;

    addonTotal += total;

    chargeValues.push([
      bookingId,
      'addon',
      addon.title,
      qty,
      price,
      total,
    ]);
  }

  if (chargeValues.length) {
    await this.dataSource.query(
      `
      INSERT INTO booking_charges
      (
        booking_id,
        charge_type,
        title,
        quantity,
        unit_price,
        total_price
      )
      VALUES ?
      `,
      [chargeValues],
    );
  }

  // GST Calculation
  const venueGST = addonTotal * 0.18;

  const [paxTax] = await this.dataSource.query(
    `
    SELECT COALESCE(SUM(tax_amount),0) pax_gst
    FROM booking_taxes
    WHERE booking_id = ?
    AND tax_name = 'PAX GST'
    `,
    [bookingId],
  );

  const paxGST = Number(paxTax?.pax_gst || 0);

  const grandTotal =
    baseAmount +
    addonTotal +
    venueGST +
    paxGST;

  // Update booking
  await this.dataSource.query(
    `
    UPDATE bookings
    SET
      tax_amount = ?,
      total_amount = ?,
      updated_at = NOW(),
      updated_by = ?
    WHERE id = ?
    `,
    [
      venueGST + paxGST,
      grandTotal,
      userId,
      bookingId,
    ],
  );

  // Update Venue GST
  await this.dataSource.query(
    `
    DELETE FROM booking_taxes
    WHERE booking_id = ?
    AND tax_name = 'Venue GST'
    `,
    [bookingId],
  );

  await this.dataSource.query(
    `
    INSERT INTO booking_taxes
    (
      booking_id,
      tax_name,
      tax_percent,
      taxable_amount,
      tax_amount
    )
    VALUES (?,?,?,?,?)
    `,
    [
      bookingId,
      'Venue GST',
      18,
      addonTotal,
      venueGST,
    ],
  );

  await this.createLog(
    'booking',
    bookingId,
    'updated',
    'Booking addons updated',
    userId,
    null,
    {
      addon_total: addonTotal,
      venue_gst: venueGST,
      grand_total: grandTotal,
    },
  );

    this.socketService.realtime(
      userId.toString(),
      'Booking ',
      `Booking ${bookingId} Addon updated`,
    );


  return {
    success: true,
    booking_id: bookingId,
    addon_total: addonTotal,
    venue_gst: venueGST,
    grand_total: grandTotal,
  };
}

async convertToBooking(
  bookingId: number,
  userId: number,
) {
  const [booking] = await this.dataSource.query(
    `
    SELECT *
    FROM bookings
    WHERE id = ?
    LIMIT 1
    `,
    [bookingId],
  );

  if (!booking) {
    throw new NotFoundException('Booking not found');
  }

  if (booking.booking_type === 'booked') {
    throw new BadRequestException('Booking already converted');
  }

  // Calculate total charges
  const [chargeSummary] = await this.dataSource.query(
    `
    SELECT
      COALESCE(SUM(total_price), 0) total_charge
    FROM booking_charges
    WHERE booking_id = ?
    `,
    [bookingId],
  );

  // Calculate total taxes
  const [taxSummary] = await this.dataSource.query(
    `
    SELECT
      COALESCE(SUM(tax_amount), 0) total_tax
    FROM booking_taxes
    WHERE booking_id = ?
    `,
    [bookingId],
  );

  const totalCharge = Number(chargeSummary?.total_charge || 0);
  const totalTax = Number(taxSummary?.total_tax || 0);
  const grandTotal = totalCharge + totalTax;

  await this.dataSource.query(
    `
    UPDATE bookings
    SET
      booking_type = 'booked',
      base_amount = ?,
      tax_amount = ?,
      total_amount = ?,
      updated_by = ?,
      updated_at = NOW()
    WHERE id = ?
    `,
    [
      totalCharge,
      totalTax,
      grandTotal,
      userId,
      bookingId,
    ],
  );

  await this.createLog(
    'booking',
    bookingId,
    'converted',
    `Booking converted to booked`,
    userId,
    null,
    {
      booking_id: bookingId,
      total_amount: grandTotal,
    },
  );

  await this.notificationService.createNotification({
    type: 'booking',
    referenceId: bookingId,
    title: 'Booking Confirmed',
    message: `Booking #${booking.booking_code} converted to booked`,
    createdBy: userId,
  });

  return {
    success: true,
    message: 'Booking converted successfully',
    booking_id: bookingId,
    total_amount: grandTotal,
  };
}
async fetchCustomerSuggestions(
  category: number,
  country: number,
  userId: number,
) {
 const resp = await this.dataSource.query(
    ` SELECT * FROM booking_parties bp LEFT JOIN bookings b ON b.id =  bp.booking_id 
    WHERE vendor_id = ? AND selection_mode !='Online' AND bp.party_type ='customer'
    `,[userId]);

    return resp;

}

async get_historical_details(id:any)
{
  const resp = await this.dataSource.query(
    ` SELECT * FROM historical WHERE id = ?
    `,[id]);

    return resp[0];
}

}



function getDatesBetween(startDate: string, endDate: string) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  const result: string[] = [];

  while (start <= end) {
    const yyyy = start.getFullYear();
    const mm = String(start.getMonth() + 1).padStart(2, '0');
    const dd = String(start.getDate()).padStart(2, '0');

    result.push(`${yyyy}-${mm}-${dd}`);

    start.setDate(start.getDate() + 1);
  }

  return result;
}

function parseDate(dateStr: string): Date {
  if (!dateStr) throw new Error('Invalid date input');

  const parts = dateStr.split('-');

  // if format is DD-MM-YYYY
  if (parts[0].length === 2) {
    const [dd, mm, yyyy] = parts.map(Number);
    return new Date(yyyy, mm - 1, dd);
  }

  // if format is YYYY-MM-DD
  const [yyyy, mm, dd] = parts.map(Number);
  return new Date(yyyy, mm - 1, dd);
}
