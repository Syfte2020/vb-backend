import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Not, IsNull } from 'typeorm';

import { StorageService } from 'src/common/storage/storage.service';
import { Readable } from 'stream';

import {
  generateCode
} from '../../common/utils/code-generator';

import {
  CATEGORY_CONFIG,
  buildPricingArray,
} from '../../helpers/pricing.helper';

import { buildVenueShifts } from '../../helpers/shift.helper';

import axios from 'axios';

import { PackageCategory } from '../vendor/packages/entity/package-category.entity';

@Injectable()
export class PaxService {
  constructor(
    private readonly dataSource: DataSource,
    private storageService: StorageService,
    @InjectRepository(PackageCategory)
    private readonly packageCat: Repository<PackageCategory>,
  ) {}

  /* =========================================================
     MAIN CREATE LISTING API
    ========================================================= */

  async package_details(vendor_id: any) {
    const [rows] = await this.dataSource.query(
      `SELECT created_by FROM venue_child WHERE child_venue_id = ? LIMIT 1`,
      [vendor_id],
    );

    const vid = rows?.created_by ?? null;

    console.log('--------------------------------');
    console.log(vid);

    const category = await this.dataSource.query(
      `SELECT * FROM package_items_category WHERE created_by = ? AND  types = ? `,
      [vid, 0],
    );

    // const items = await this.packageCat.find({
    //   where: {
    //     created_by: vid,
    //     types: 0,
    //   },
    //   relations: {
    //     package_item: true,
    //   },
    // });

    // const addon_category = await this.packageCat.find({
    //   where: {
    //     created_by: vid,
    //     types: 1,
    //   },
    //   relations: {
    //     package_item: true,
    //   },
    // });
    const items = await this.packageCat
      .createQueryBuilder('category')
      .leftJoinAndSelect('category.package_item', 'item')
      .where('category.created_by = :createdBy', { createdBy: vid })
      .andWhere('category.types = :type', { type: 0 })
      .getMany();

    const addon_category = await this.packageCat
      .createQueryBuilder('category')
      .leftJoinAndSelect('category.package_item', 'item')
      .where('category.created_by = :createdBy', { createdBy: vid })
      .andWhere('category.types = :type', { type: 1 })
      .getMany();

    const packageData = await this.dataSource.query(
      `
  SELECT
    p.*,

    (
      SELECT JSON_ARRAYAGG(item_id)
      FROM package_items pi
      WHERE pi.package_id = p.id
    ) AS package_items,

    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'category_id', category_id,
          'count', count_number
        )
      )
      FROM package_category_config pcc
      WHERE pcc.package_id = p.id
    ) AS category_items

  FROM package p
  WHERE p.created_by = ?
  ORDER BY p.id DESC
  `,
      [vid],
    );
    return {
      category: category,
      addon_category: addon_category,
      items: items,
      package: packageData,
    };
  }

  async package_booking(body: any, user_id: number, country: number) {
  try {
    let code = generateCode();

    while (true) {
      const rows = await this.dataSource.query(
        `SELECT 1 FROM bookings WHERE invoice_number = ? LIMIT 1`,
        [code],
      );

      if (rows.length === 0) break;
      code = generateCode();
    }

    // Event Type
    const eventRows: any = await this.dataSource.query(
      `SELECT id FROM booking_event_types WHERE event_name = ? LIMIT 1`,
      [body.event_type || body.event?.event_type],
    );

    const eventTypeId = eventRows.length ? eventRows[0].id : null;

    // Insert Booking
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
        menu_mode,
        package_id,
        estimated_total
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `,
      [
        code,
        0,
        'pax',
        1, // category id
        country,
        'active',

        Number(body.adult_count || 0) + Number(body.child_count || 0),

        Number(body.base_amount || body.pricing?.base_amount || 0),
        Number(body.discount_amount || 0),
        Number(body.tax_amount || body.pricing?.pax_gst || 0),
        Number(body.estimated_total || body.pricing?.final_total || 0),

        body.notes || null,

        user_id,
        user_id,
        user_id,

        new Date(),
        new Date(),

        eventTypeId,

        "pax", // selection_mode
        body.menu_mode, // selection_type

        body.menu_mode,
        body.package_id || null,
        Number(body.estimated_total || 0),
      ],
    );

    const bookingId = result.insertId;

    // Insert Package/Custom Menu
    await this.insertPaxPackages(bookingId, body);

    return {
      success: true,
      booking_id: bookingId,
      booking_code: code,
    };
  } catch (error) {
    console.error("Package Booking Error:", error);
    throw error;
  }
}

  async insertPaxPackages(bookingId: number, dto: any) {
  const paxCount =
    Number(dto.adult_count || 0) + Number(dto.child_count || 0);

  if (paxCount <= 0) {
    return true;
  }

  let bookingPaxId: number;

  // =========================================================
  // PACKAGE MODE
  // =========================================================
  if (dto.menu_mode === "packages") {
    if (!dto.package_id) return true;

    const packages: any = await this.dataSource.query(
      `
      SELECT id, name, price
      FROM package
      WHERE id = ?
      LIMIT 1
      `,
      [dto.package_id]
    );

    if (!packages.length) return true;

    const pkg = packages[0];

    const pricePerPax =
      Number(pkg.price || 0) ||
      Number(dto.estimated_total || 0) / paxCount;

    const paxResult: any = await this.dataSource.query(
      `
      INSERT INTO booking_pax
      (
        booking_id,
        package_id,
        package_name,
        pax_count,
        price_per_pax,
        total
      )
      VALUES (?,?,?,?,?,?)
      `,
      [
        bookingId,
        pkg.id,
        pkg.name,
        paxCount,
        pricePerPax,
        Number(dto.estimated_total || 0),
      ]
    );

    bookingPaxId = paxResult.insertId;

    const categoryRows: any[] = [];
    const itemRows: any[] = [];
    const snapshotRows: any[] = [];

    for (const categoryId of Object.keys(dto.package_selections || {})) {
      const items = dto.package_selections[categoryId] || [];

      if (!items.length) continue;

      categoryRows.push([
        bookingPaxId,
        Number(categoryId),
        items[0].category_name,
      ]);

      for (const item of items) {
        itemRows.push([
          bookingPaxId,
          Number(categoryId),
          item.id,
        ]);

        snapshotRows.push([
          bookingPaxId,
          item.id,
          item.item_name,
          Number(item.price || 0),
        ]);
      }
    }

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

  // =========================================================
  // CUSTOM MENU
  // =========================================================
  else if (dto.menu_mode === "custom") {
    if (!dto.custom_items?.length) return true;

    const paxResult: any = await this.dataSource.query(
      `
      INSERT INTO booking_pax
      (
        booking_id,
        package_id,
        package_name,
        pax_count,
        price_per_pax,
        total
      )
      VALUES (?,?,?,?,?,?)
      `,
      [
        bookingId,
        null,
        "Custom Menu",
        paxCount,
        Number(dto.estimated_total || 0) / paxCount,
        Number(dto.estimated_total || 0),
      ]
    );

    bookingPaxId = paxResult.insertId;

    const placeholders = dto.custom_items.map(() => "?").join(",");

    const items: any = await this.dataSource.query(
      `
      SELECT
        id,
        item_name,
        price,
        category_id
      FROM package_items
      WHERE id IN (${placeholders})
      `,
      dto.custom_items
    );

    if (!items.length) return true;

    const categoryMap = new Map<number, any[]>();

    const itemRows: any[] = [];
    const snapshotRows: any[] = [];

    for (const item of items) {
      if (!categoryMap.has(item.category_id)) {
        categoryMap.set(item.category_id, []);
      }

      categoryMap.get(item.category_id)?.push(item);

      itemRows.push([
        bookingPaxId,
        item.category_id,
        item.id,
      ]);

      snapshotRows.push([
        bookingPaxId,
        item.id,
        item.item_name,
        Number(item.price || 0),
      ]);
    }

    const categoryIds = [...categoryMap.keys()];

    const categoryRows: any[] = [];

    if (categoryIds.length) {
      const placeholders2 = categoryIds.map(() => "?").join(",");

      const categories: any = await this.dataSource.query(
        `
        SELECT id, name
        FROM package_categories
        WHERE id IN (${placeholders2})
        `,
        categoryIds
      );

      const categoryLookup = new Map<number, string>();

      for (const category of categories) {
        categoryLookup.set(Number(category.id), category.name);
      }

      for (const categoryId of categoryIds) {
        categoryRows.push([
          bookingPaxId,
          categoryId,
          categoryLookup.get(categoryId) || "",
        ]);
      }
    }

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
}
