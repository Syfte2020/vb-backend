import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Not, IsNull } from 'typeorm';
import { StorageService } from 'src/common/storage/storage.service';

import { PackageCategory } from './entity/package-category.entity';

//categoryRepository

@Injectable()
export class PackagesService {
  constructor(
    private dataSource: DataSource,
    private storageService: StorageService,
    @InjectRepository(PackageCategory)
    private readonly packageCat: Repository<PackageCategory>,
  ) {}

  async package_category(user_id: any, id: any) {
    const category = await this.dataSource.query(
      `SELECT * FROM package_items_category WHERE created_by = ? AND  types = ? `,
      [user_id, 0],
    );

    const items = await this.packageCat.find({
      where: {
        created_by: user_id,
        types: 0,
      },
      relations: {
        package_item: true,
      },
    });

    const addon_category = await this.packageCat.find({
      where: {
        created_by: user_id,
        types: 1,
      },
      relations: {
        package_item: true,
      },
    });

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
  [user_id],
);
    return {
      category: category,
      addon_category: addon_category,
      items: items,
      package: packageData,
    };
  }

  async create_category(user_id: any, body: any) {
    if (body.id) {
      await this.dataSource.query(
        `
      UPDATE package_items_category
      SET
        item_category = ?,
        updated_at = NOW()
      WHERE id = ?
        AND created_by = ?
      `,
        [body.name, body.id, user_id],
      );

      return { message: 'Category updated' };
    }

    await this.dataSource.query(
      `
    INSERT INTO package_items_category
    (
      item_category,
      created_by,
      types,
      updated_at,
      created_at
    )
    VALUES (?, ?, ?, NOW(), NOW())
    `,
      [body.name, user_id, body.type],
    );

    return { message: 'Category created' };
  }
  async updateCategoryPublish(body: any) {
    await this.dataSource.query(
      `
      UPDATE package_items_category
      SET
        cat_publish = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [body.status, body.id],
    );
  }

  async create_items(body: any, files: any, id: any) {
    let attachment = '';

    if (files?.length) {
      attachment = await this.storageService.upload(files[0], 'venue/package');
    }
    const itemId = Number(body.id);
    if (!itemId) {
      await this.dataSource.query(
        `INSERT INTO package_items_list
      (
        cat_id,
        item_name,
        item_price,
        item_price_1,
        created_by,
        image,
        food_pre,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [body.cat_id, body.name, body.price, 0, id, attachment, body.foodType],
      );
    } else {
      // Keep old image if no new image uploaded
      if (attachment) {
        await this.dataSource.query(
          `UPDATE package_items_list
         SET
           cat_id = ?,
           item_name = ?,
           item_price = ?,
           image = ?,
           food_pre = ?,
           updated_at = NOW()
         WHERE id = ? AND created_by = ?`,
          [
            body.cat_id,
            body.name,
            body.price,
            attachment,
            body.foodType,
            body.id,
            id,
          ],
        );
      } else {
        await this.dataSource.query(
          `UPDATE package_items_list
         SET
           cat_id = ?,
           item_name = ?,
           item_price = ?,
           food_pre = ?,
           updated_at = NOW()
         WHERE id = ? AND created_by = ?`,
          [body.cat_id, body.name, body.price, body.foodType, body.id, id],
        );
      }
    }
  }

  async delete_items(id: any) {
    const [item] = await this.dataSource.query(
      `SELECT image
     FROM package_items_list
     WHERE id = ?`,
      [id],
    );

    if (item?.image) {
      await this.storageService.delete(item.image);
    }

    await this.dataSource.query(
      `DELETE FROM package_items_list
     WHERE id = ?`,
      [id],
    );

    return true;
  }

 async create_packages(user_id: number, body: any) {
  const safeJson = (val: any) => {
    if (!val) return [];

    if (typeof val === "string") {
      try {
        return JSON.parse(val);
      } catch {
        return [];
      }
    }

    return val;
  };

  const CatArr = safeJson(body.category_items);
  const packageItemArr = safeJson(body.package_items);

  if (body.id) {
    // UPDATE PACKAGE

    await this.dataSource.query(
      `
      UPDATE package
      SET
        name = ?,
        price = ?,
        package_status = ?,
        package_type = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        body.name,
        body.price,
        body.package_status,
        body.package_food_type,
        body.id,
      ],
    );

    // Remove old mappings
    await this.dataSource.query(
      `DELETE FROM package_category_config WHERE package_id = ?`,
      [body.id],
    );

    await this.dataSource.query(
      `DELETE FROM package_items WHERE package_id = ?`,
      [body.id],
    );

    // Insert new category mappings
    for (const cat of CatArr) {
      await this.dataSource.query(
        `
        INSERT INTO package_category_config
        (
          package_id,
          category_id,
          count_number
        )
        VALUES (?, ?, ?)
        `,
        [
          body.id,
          cat.category_id,
          cat.count,
        ],
      );
    }

    // Insert new item mappings
    for (const itemId of packageItemArr) {
      await this.dataSource.query(
        `
        INSERT INTO package_items
        (
          package_id,
          item_id,
          created_at
        )
        VALUES (?, ?, NOW())
        `,
        [
          body.id,
          itemId,
        ],
      );
    }

    return {
      message: "Package updated",
    };
  }

  // CREATE PACKAGE
  const result = await this.dataSource.query(
    `
    INSERT INTO package
    (
      name,
      price,
      created_by,
      package_status,
      package_type,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `,
    [
      body.name,
      body.price,
      user_id,
      body.package_status,
      body.package_food_type,
    ],
  );

  const package_id = result.insertId;

  // Insert category mappings
  for (const cat of CatArr) {
    await this.dataSource.query(
      `
      INSERT INTO package_category_config
      (
        package_id,
        category_id,
        count_number
      )
      VALUES (?, ?, ?)
      `,
      [
        package_id,
        cat.category_id,
        cat.count,
      ],
    );
  }

  // Insert item mappings
  for (const itemId of packageItemArr) {
    await this.dataSource.query(
      `
      INSERT INTO package_items
      (
        package_id,
        item_id,
        created_at
      )
      VALUES (?, ?, NOW())
      `,
      [
        package_id,
        itemId,
      ],
    );
  }

  return {
    message: "Package created",
    package_id,
  };
}


  async publish_packages(body: any) {
    await this.dataSource.query(
      `
      UPDATE package
      SET
        package_status = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [body.status, body.id],
    );
  }
  
  async packages_uploads(items: any ,id:any) 
  {
 const rows = items.slice(1); // Skip header row

for (const row of rows) {
  const [, category, itemName, amount, type] = row;

  const categoryType = Number(type) === 1 ? 1 : 0;

  // Check category
  const categoryResult: any = await this.dataSource.query(
    `
    SELECT id
    FROM package_items_category
    WHERE item_category = ?
      AND created_by = ?
      AND types = ?
    LIMIT 1
    `,
    [category, id, categoryType]
  );

  let categoryId;

  if (categoryResult.length > 0) {
    categoryId = categoryResult[0].id;
  } else {
    const insertCategory: any = await this.dataSource.query(
      `
      INSERT INTO package_items_category
      (
        item_category,
        created_by,
        types,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, NOW(), NOW())
      `,
      [category, id, categoryType]
    );

    categoryId = insertCategory.insertId;
  }

  // Check item
  const itemResult: any = await this.dataSource.query(
    `
    SELECT id
    FROM package_items_list
    WHERE cat_id = ?
      AND item_name = ?
      AND created_by = ?
    LIMIT 1
    `,
    [categoryId, itemName, id]
  );

  if (itemResult.length > 0) {
    // Update existing item
    await this.dataSource.query(
      `
      UPDATE package_items_list
      SET
          item_price = ?,
          food_pre = ?,
          updated_at = NOW()
      WHERE id = ?
      `,
      [
        amount,
        1,
        itemResult[0].id,
      ]
    );
  } else {
    // Insert new item
    await this.dataSource.query(
      `
      INSERT INTO package_items_list
      (
          cat_id,
          item_name,
          item_price,
          item_price_1,
          created_by,
          image,
          food_pre,
          created_at,
          updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        categoryId,
        itemName,
        amount,
        0,
        id,
        '',
        1,
      ]
    );
  }
}
    
  }


  
}
