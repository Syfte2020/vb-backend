import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LoyaltyPoint } from './entities/loyalty_point.entity';
import { LoyaltyTier } from './entities/loyalty_tiers.entity';

import { LoyaltyPointMasterItemDto } from './dto/loyalty-point-master-item.dto';
import { CreateLoyaltyTierDto } from './dto/create-loyalty-tier.dto';
import { UpdateLoyaltyTierDto } from './dto/update-loyalty-tier.dto';

@Injectable()
export class MasterService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(LoyaltyPoint)
    private loyaltyPointRepo: Repository<LoyaltyPoint>,

    @InjectRepository(LoyaltyTier)
    private loyaltyTiertRepo: Repository<LoyaltyTier>,
  ) {}

  async findAll(country_id: number) {
    try {
      const data = await this.loyaltyPointRepo.find({
        where: { country_id },
        order: { category_id: 'ASC' },
      });

      return {
        success: true,
        message: 'Loyalty data fetched successfully',
        data,
      };
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Failed to fetch loyalty data');
    }
  }

  // async create(data: LoyaltyPointMasterItemDto[], country_id: number) {
  //   try {
  //     const payload = data.map((item) => ({
  //       country_id: Number(country_id),

  //       category_id: Number(item.category_id),

  //       point_value: Number(item.points),

  //       max_point: Number(item.max_points),
  //     }));

  //     // const result = await this.loyaltyPointRepo.save(payload);
  //     const result = await this.loyaltyPointRepo.upsert(payload, {
  //       conflictPaths: ['country_id', 'category_id'],
  //     });

  //     return {
  //       success: true,
  //       message: 'Point settings saved successfully',
  //       data: result,
  //     };
  //   } catch (error) {
  //     console.log(error);

  //     throw new BadRequestException('Failed to save point settings');
  //   }
  // }

  async create(body: any, country_id: number) {
    const sql = `
    INSERT INTO loyalty_point (
      country_id,
      category_id,
      point_value,
      max_point,
      status,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      point_value = VALUES(point_value),
      max_point = VALUES(max_point),
      status = VALUES(status),
      updated_at = NOW();
  `;

    await this.dataSource.query(sql, [
      Number(country_id),
      Number(body.category_id),
      Number(body.rate),
      0,
      body.active == true ? 1 : 0,
    ]);

    return {
      success: true,
      message: 'Loyalty point saved successfully.',
    };
  }

 async createLoyalty(data: any, country_id: number) {
  try {
    const result = await this.dataSource.query(
      `
      INSERT INTO loyalty_tiers (
        country_id,
        tier_name,
        plan_id,
        category_id,
        cust_plan_id,
        color,
        icon,
        burn_coin,
        earn_point,
        discount_percentage,
        bonus_percentage,
        validity_days,
        status,
        created_at,
        updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
      )
      `,
      [
        Number(country_id),                        // country_id
        data.tname,                               // tier_name
        Number(data.plan_id),                     // plan_id
        Number(data.category_id),                 // category_id
        data.customers_plan,                      // cust_plan_id (Bronze/Gold/Platinum/Diamond)
        data.color,                               // color
        data.icon,                                // icon
        Number(data.min_spend),           // burn_coin
        Number(data.max_spend),          // max_points
        Number(data.discount_percent || 0),       // discount_percentage
        Number(data.bonus_percent || 0),          // bonus_percentage
        Number(data.validity_days),               // validity_days
        data.status === "Active" ? 1 : 0,         // status
      ]
    );

    return {
      success: true,
      message: "Loyalty tier created successfully",
      data: result,
    };
  } catch (error) {
    console.error(error);
    throw new BadRequestException("Failed to save loyalty tier");
  }
}
  // async LoyaltyfindAll(country_id: number) {
  //   try {
  //     const data = await this.loyaltyTiertRepo.find({
  //       where: { country_id },
  //     });

  //     return {
  //       success: true,
  //       message: 'Loyalty data fetched successfully',
  //       data,
  //     };
  //   } catch (error) {
  //     console.log(error);
  //     throw new BadRequestException('Failed to fetch loyalty data');
  //   }
  // }
  async LoyaltyfindAll(country_id: number) {
  try {
    const result = await this.dataSource.query(
      `
      SELECT
          lt.id,
          lt.country_id,
          lt.tier_name,
          lt.plan_id,
          p.plan_name,
          lt.category_id,
          c.name AS category_name,
          lt.cust_plan_id,
          lt.color,
          lt.icon,
          lt.burn_coin,
          lt.earn_point,
          lt.discount_percentage,
          lt.bonus_percentage,
          lt.validity_days,
          lt.status,
          lt.created_at,
          lt.updated_at
      FROM loyalty_tiers lt
      LEFT JOIN plans p
          ON p.id = lt.plan_id
      LEFT JOIN category c
          ON c.id = lt.category_id
      WHERE lt.country_id = ?
      ORDER BY lt.id DESC
      `,
      [country_id],
    );

    return result;
  } catch (error) {
    throw error;
  }
}

  /* UPDATE */
  // async update(id: string, dto: UpdateLoyaltyTierDto) {
  //   const country = await this.loyaltyTiertRepo.findOne({
  //     where: { id: Number(id) },
  //   });

  //   if (!country) {
  //     throw new BadRequestException('Country not found');
  //   }

  //   Object.assign(country, dto);

  //   return await this.loyaltyTiertRepo.save(country);
  // }
  async update(id: string, data: any) {
  try {
    const result = await this.dataSource.query(
      `
      UPDATE loyalty_tiers
      SET
        tier_name = ?,
        plan_id = ?,
        category_id = ?,
        cust_plan_id = ?,
        color = ?,
        icon = ?,
        burn_coin = ?,
        earn_point = ?,
        discount_percentage = ?,
        bonus_percentage = ?,
        validity_days = ?,
        status = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        data.tier_name,                                  // tier_name
        Number(data.plan_id),                        // plan_id
        Number(data.category_id),                    // category_id
        data.customers_plan,                         // cust_plan_id
        data.color,                                  // color
        data.icon,                                   // icon
        Number(data.min_spend),              // burn_coin
        Number(data.max_spend),                      // earn_point
        Number(data.discount_percent || 0),          // discount_percentage
        Number(data.bonus_percent || 0),             // bonus_percentage
        Number(data.validity_days),                  // validity_days
        data.status === 'Active' ? 1 : 0,            // status
        Number(id),                                  // WHERE id
      ],
    );

    return {
      success: true,
      message: 'Loyalty tier updated successfully.',
      data: result,
    };
  } catch (error) {
    console.log(error);
    throw new BadRequestException('Failed to update loyalty tier');
  }
}

  /* DELETE */
  // async remove(id: string) {
  //   const country = await this.loyaltyTiertRepo.findOne({
  //     where: { id: Number(id) },
  //   });

  //   if (!country) {
  //     throw new BadRequestException('Country not found');
  //   }

  //   return await this.loyaltyTiertRepo.remove(country);
  // }

  async remove(id: string) {
  try {
    // Check if record exists
    const [tier] = await this.dataSource.query(
      `
      SELECT id
      FROM loyalty_tiers
      WHERE id = ?
      LIMIT 1
      `,
      [Number(id)],
    );

    if (!tier) {
      throw new BadRequestException('Loyalty tier not found');
    }

    // Delete record
    await this.dataSource.query(
      `
      DELETE FROM loyalty_tiers
      WHERE id = ?
      `,
      [Number(id)],
    );

    return {
      success: true,
      message: 'Loyalty tier deleted successfully.',
    };
  } catch (error) {
    console.log(error);
    throw new BadRequestException('Failed to delete loyalty tier');
  }
}

  /* plans */
  async plans(country_id: number, category_id: any) {
    const sql = `SELECT * FROM plans WHERE country_id = ?  AND category_id = ? `;

    const plans = await this.dataSource.query(sql, [country_id, category_id]);

    return plans;
  }

  // ✅ FIND ONE
  // async findOne(id: number) {
  //   const category = await this.categoryRepo.findOne({
  //     where: { id },
  //     relations: ["venueCategories"],
  //   });

  //   if (!category) {
  //     throw new NotFoundException("Category not found");
  //   }

  //   return category;
  // }

async getIntegrationConfig(countryId?: number) {
  const rows = await this.dataSource.query(
    `
    SELECT
      i.id,
      i.name,
      i.name AS title,
      i.name AS description,
      i.name AS icon,

      ic.country_id,
      ic.environment,
      ic.is_active,
      ic.config_key,
      ic.config_value

    FROM integrations i

    LEFT JOIN integration_configs ic
      ON ic.integration_id = i.id
      AND (
            ic.country_id = ?
            OR (
                ic.country_id IS NULL
                AND NOT EXISTS (
                    SELECT 1
                    FROM integration_configs x
                    WHERE x.integration_id=i.id
                    AND x.country_id=?
                )
            )
      )

    ORDER BY
      i.id,
      ic.country_id,
      ic.environment
    `,
    [countryId, countryId],
  );

  const integrations = {};

  for (const row of rows) {
    if (!integrations[row.id]) {
      integrations[row.id] = {
        id: row.id,
        key: row.name,
        title: row.title,
        description: row.description,
        icon: row.icon,
        fields: [],
        country_configs: {},
      };
    }

    if (row.config_key && !integrations[row.id].fields.includes(row.config_key)) {
      integrations[row.id].fields.push(row.config_key);
    }

    const countryKey = row.country_id ?? "ALL";

    if (!integrations[row.id].country_configs[countryKey]) {
      integrations[row.id].country_configs[countryKey] = {
        country_id: row.country_id,
        enabled: false,
        mode: "TEST",
        test: {},
        live: {},
      };
    }

    const cfg = integrations[row.id].country_configs[countryKey];

    // Active environment
    if (row.is_active == 1) {
      cfg.enabled = true;
      cfg.mode = row.environment;
    }

    if (row.environment === "TEST") {
      cfg.test[row.config_key] = row.config_value;
    } else if (row.environment === "LIVE") {
      cfg.live[row.config_key] = row.config_value;
    }
  }

  return Object.values(integrations).map((item: any) => ({
    ...item,
    country_configs: Object.values(item.country_configs),
  }));
}

// async customerTierApi(page = 1, limit = 10, search = "" , countryId) {
// {
//     try {
//     const result = await this.dataSource.query(
//       `
//       SELECT
//           *
//       FROM member_tier mt
//       ORDER BY mt.id DESC
//       `,
//       [countryId],
//     );

//     return {
//       data:result,
//       pagination:10
//     };
//   } catch (error) {
//     throw error;
//   } 
// }
// }

async customerTierApi(page = 1, limit = 10, search = "") {
  try {
    const offset = (page - 1) * limit;

    const where = search
      ? `WHERE mt.name LIKE ?`
      : "";

    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
    }

    const totalResult = await this.dataSource.query(
      `
      SELECT COUNT(*) AS total
      FROM member_tier mt
      ${where}
      `,
      params,
    );

    const total = Number(totalResult[0].total);

    const data = await this.dataSource.query(
      `
      SELECT *
      FROM member_tier mt
      ORDER BY mt.id DESC
      `,
      [...params, limit, offset],
    );

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    throw error;
  }
}

async createCustomerTier(data: {
  tier_name: string;
  icon: string;
  color: string;
  min_booking: number;
  max_booking: number;
  total_booking_amount: number;
}) {
  try {
    const result = await this.dataSource.query(
      `
      INSERT INTO member_tier
      (
        name,
        icon,
        color,
        min_booking,
        max_booking,
        book_amount,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        data.tier_name,
        data.icon,
        data.color,
        data.min_booking,
        data.max_booking,
        data.total_booking_amount,
      ],
    );

    return {
      success: true,
      message: 'Customer tier created successfully',
      id: result.insertId,
    };
  } catch (error) {
    throw error;
  }
}

async customerTierUpdateApi(
  id: number,
  data: {
    tier_name: string;
    icon: string;
    color: string;
    min_booking: number;
    max_booking: number;
    total_booking_amount: number;
  },
) {
  try {
    const exists = await this.dataSource.query(
      `SELECT id FROM member_tier WHERE id = ?`,
      [id],
    );

    if (!exists.length) {
      throw new NotFoundException('Customer tier not found');
    }

    await this.dataSource.query(
      `
      UPDATE member_tier
      SET
        name = ?,
        icon = ?,
        color = ?,
        min_booking = ?,
        max_booking = ?,
        book_amount = ?
      WHERE id = ?
      `,
      [
        data.tier_name,
        data.icon,
        data.color,
        data.min_booking,
        data.max_booking,
        data.total_booking_amount,
        id,
      ],
    );

    return {
      success: true,
      message: 'Customer tier updated successfully',
    };
  } catch (error) {
    throw error;
  }
}

async deleteCustomerTierApi(id: number) {
  try {
    const exists = await this.dataSource.query(
      `SELECT id FROM member_tier WHERE id = ?`,
      [id],
    );

    if (!exists.length) {
      throw new NotFoundException('Customer tier not found');
    }

    await this.dataSource.query(
      `DELETE FROM member_tier WHERE id = ?`,
      [id],
    );

    return {
      success: true,
      message: 'Customer tier deleted successfully',
    };
  } catch (error) {
    throw error;
  }
}



async guestApi(page = 1, limit = 10, search = "") {
  try {
    const offset = (page - 1) * limit;

    const where = search
      ? `WHERE glf.name LIKE ?`
      : "";

    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
    }

    const totalResult = await this.dataSource.query(
      `
      SELECT COUNT(*) AS total
      FROM guest_love_features glf
      ${where}
      `,
      params,
    );

    const total = Number(totalResult[0].total);

    const data = await this.dataSource.query(
      `
      SELECT *
      FROM guest_love_features glf
      ORDER BY glf.id DESC
      `,
      [...params, limit, offset],
    );

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    throw error;
  }
}

async guestInsertApi(data: {
  title: string;
  description: string;
  icon: string;
  sort_order: number;
  is_active: number;
}) {
  try {
    const result = await this.dataSource.query(
      `
      INSERT INTO guest_love_features
      (
        title,
        description,
        icon,
        sort_order,
        is_active,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        data.title,
        data.description,
        data.icon,
        data.sort_order || 0,
        data.is_active ?? 1,
      ],
    );

    return {
      success: true,
      message: 'Guest love feature created successfully',
      id: result.insertId,
    };
  } catch (error) {
    throw error;
  }
}

async guestUpdateApi(
  id: number,
  data: {
    title: string;
    description: string;
    icon: string;
    sort_order: number;
    is_active: number;
  },
) {
  try {
    const exists = await this.dataSource.query(
      `SELECT id FROM guest_love_features WHERE id = ?`,
      [id],
    );

    if (!exists.length) {
      throw new NotFoundException('Guest love feature not found');
    }

    await this.dataSource.query(
      `
      UPDATE guest_love_features
      SET
        title = ?,
        description = ?,
        icon = ?,
        sort_order = ?,
        is_active = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        data.title,
        data.description,
        data.icon,
        data.sort_order,
        data.is_active,
        id,
      ],
    );

    return {
      success: true,
      message: 'Guest love feature updated successfully',
    };
  } catch (error) {
    throw error;
  }
}

async deleteGuestApi(id: number) {
  try {
    const exists = await this.dataSource.query(
      `SELECT id FROM guest_love_features WHERE id = ?`,
      [id],
    );

    if (!exists.length) {
      throw new NotFoundException('Guest love feature not found');
    }

    await this.dataSource.query(
      `DELETE FROM guest_love_features WHERE id = ?`,
      [id],
    );

    return {
      success: true,
      message: 'Guest love feature deleted successfully',
    };
  } catch (error) {
    throw error;
  }
}

async getPendingVendors() {
  const query = `
    SELECT
      u.id,
      u.name,
      u.email,
      u.phone,
      u.city,
      u.address,
      u.state,
      u.country,
      u.status,
      u.created_at,

      /* =========================
         DOCUMENTS
         ========================= */

      COALESCE(
        JSON_ARRAYAGG(
          CASE
            WHEN d.id IS NOT NULL THEN
              JSON_OBJECT(
                'id', d.id,
                'type', d.document_type,
                'number', d.document_number,
                'file', d.file_url,
                'status', d.verification_status,
                'details', d.doc_details,
                'verified_by', d.verified_by,
                'verified_at', d.verified_at
              )
            ELSE NULL
          END
        ),
        JSON_ARRAY()
      ) AS documents,

      /* =========================
         BANK DETAILS
         ========================= */

      MAX(
        CASE
          WHEN b.id IS NOT NULL THEN
            JSON_OBJECT(
              'id', b.id,
              'bank_name', b.bank_name,
              'account_number', b.account_number,
              'ifsc', b.ifsc,
              'account_type', b.account_type,
              'business_name', b.business_name,
              'branch_name', b.branch_name,
              'business_type', b.business_type,
              'gst_number', b.gst_number,
              'business_address', b.business_address,
              'status', b.verification_status,
              'verified_by', b.verified_by,
              'verified_at', b.verified_at
            )
        END
      ) AS bank_details

    FROM users u

    LEFT JOIN user_kyc_documents d
      ON d.user_id = u.id

    LEFT JOIN user_kyc_bank_details b
      ON b.user_id = u.id

    WHERE
      (
        d.verification_status = 'review'
        OR
        b.verification_status = 'review'
      )

    GROUP BY
      u.id,
      u.name,
      u.email,
      u.phone,
      u.city,
      u.address,
      u.state,
      u.country,
      u.status,
      u.created_at

    ORDER BY u.created_at DESC
  `;

  const result = await this.dataSource.query(query);

  return result;
}

  async updateVendorDocumentStatus(
    vendorId: number,
    documentId: number,
    body: any,
  ) {
    if (!['approved', 'rejected'].includes(body.status)) {
      throw new BadRequestException(
        'Status must be either verified or rejected',
      );
    }


    // -------------------------------------------------------
    // Check document exists and belongs to this vendor/user
    // -------------------------------------------------------
if(body.key !=='bank')
{
    const documents = await this.dataSource.query(
      `
      SELECT
        id,
        user_id,
        document_type,
        document_number,
        file_url,
        verification_status
      FROM user_kyc_documents
      WHERE id = ?
        AND user_id = ?
      LIMIT 1
      `,
      [documentId, vendorId],
    );

    if (!documents.length) {
      throw new NotFoundException(
        'KYC document not found',
      );
    }
   

    // -------------------------------------------------------
    // Update document
    // -------------------------------------------------------

    await this.dataSource.query(
      `
      UPDATE user_kyc_documents
      SET
        verification_status = ?,
        verified_at = CASE
          WHEN ? = 'approved' THEN NOW()
          ELSE NULL
        END,
        updated_at = NOW()
      WHERE id = ?
        AND user_id = ?
      `,
      [
        body.status,
        body.status,
        documentId,
        vendorId,
      ],
    );
  }
  else
  {
    await this.dataSource.query(
    `
    UPDATE user_kyc_bank_details
    SET
      verification_status = ?,
      verified_at = CASE
        WHEN ? = 'approved' THEN NOW()
        ELSE NULL
      END,
      updated_at = NOW()
    WHERE id = ?
      AND user_id = ?
    `,
    [body.status, body.status, documentId, vendorId],
  );
  }

    // -------------------------------------------------------
    // Get updated document
    // -------------------------------------------------------

    const updated = await this.dataSource.query(
      `
      SELECT
        id,
        user_id,
        document_type,
        document_number,
        file_url,
        verification_status,
        verified_at
      FROM user_kyc_documents
      WHERE id = ?
        AND user_id = ?
      LIMIT 1
      `,
      [documentId, vendorId],
    );

    return {
      success: true,

      message:
        body.status === 'approved'
          ? 'Document approved successfully'
          : 'Document rejected successfully',

      document: updated[0],
    };
  }

  // =========================================================
  // APPROVE COMPLETE VENDOR KYC
  //
  // PAN
  // AADHAAR
  // GST
  // BANK
  //
  // PATCH /vendors/:vendorId/approve
  // =========================================================

  async approveVendorKyc(vendorId: number) {
    // -------------------------------------------------------
    // Check documents
    // -------------------------------------------------------

    const documents = await this.dataSource.query(
      `
      SELECT
        id,
        document_type,
        verification_status
      FROM user_kyc_documents
      WHERE user_id = ?
      `,
      [vendorId],
    );

    // -------------------------------------------------------
    // Check bank/GST
    // -------------------------------------------------------

    const bankDetails = await this.dataSource.query(
      `
      SELECT
        id,
        bank_name,
        account_number,
        ifsc,
        gst_number,
        verification_status
      FROM user_kyc_bank_details
      WHERE user_id = ?
      `,
      [vendorId],
    );

    if (
      !documents.length &&
      !bankDetails.length
    ) {
      throw new NotFoundException(
        'No KYC details found for this vendor',
      );
    }

    // -------------------------------------------------------
    // Approve PAN / Aadhaar / other KYC documents
    // -------------------------------------------------------

    if (documents.length) {
      await this.dataSource.query(
        `
        UPDATE user_kyc_documents
        SET
          verification_status = 'verified',
          verified_at = NOW(),
          updated_at = NOW()
        WHERE user_id = ?
        `,
        [vendorId],
      );
    }

    // -------------------------------------------------------
    // Approve Bank + GST
    // -------------------------------------------------------

    if (bankDetails.length) {
      await this.dataSource.query(
        `
        UPDATE user_kyc_bank_details
        SET
          verification_status = 'verified',
          verified_at = NOW(),
          updated_at = NOW()
        WHERE user_id = ?
        `,
        [vendorId],
      );
    }

    // -------------------------------------------------------
    // Return updated KYC
    // -------------------------------------------------------

    const updatedDocuments =
      await this.dataSource.query(
        `
        SELECT
          id,
          user_id,
          document_type,
          document_number,
          file_url,
          verification_status,
          verified_at
        FROM user_kyc_documents
        WHERE user_id = ?
        ORDER BY id ASC
        `,
        [vendorId],
      );

    const updatedBankDetails =
      await this.dataSource.query(
        `
        SELECT
          id,
          user_id,
          bank_name,
          account_number,
          ifsc,
          gst_number,
          business_name,
          verification_status,
          verified_at
        FROM user_kyc_bank_details
        WHERE user_id = ?
        ORDER BY id DESC
        `,
        [vendorId],
      );

    return {
      success: true,
      message: 'Vendor KYC approved successfully',

      documents: updatedDocuments,
      bankDetails: updatedBankDetails,
    };
  }

  // =========================================================
  // REJECT COMPLETE VENDOR APPLICATION
  //
  // PAN
  // AADHAAR
  // GST
  // BANK
  //
  // PATCH /vendors/:vendorId/reject
  // =========================================================

  async rejectVendorApplication(vendorId: number) {
    // -------------------------------------------------------
    // Check KYC exists
    // -------------------------------------------------------

    const documents = await this.dataSource.query(
      `
      SELECT id
      FROM user_kyc_documents
      WHERE user_id = ?
      `,
      [vendorId],
    );

    const bankDetails = await this.dataSource.query(
      `
      SELECT id
      FROM user_kyc_bank_details
      WHERE user_id = ?
      `,
      [vendorId],
    );

    if (
      !documents.length &&
      !bankDetails.length
    ) {
      throw new NotFoundException(
        'No KYC details found for this vendor',
      );
    }

    // -------------------------------------------------------
    // Reject all documents
    // -------------------------------------------------------

    if (documents.length) {
      await this.dataSource.query(
        `
        UPDATE user_kyc_documents
        SET
          verification_status = 'rejected',
          verified_at = NULL,
          updated_at = NOW()
        WHERE user_id = ?
        `,
        [vendorId],
      );
    }

    // -------------------------------------------------------
    // Reject bank + GST
    // -------------------------------------------------------

    if (bankDetails.length) {
      await this.dataSource.query(
        `
        UPDATE user_kyc_bank_details
        SET
          verification_status = 'rejected',
          verified_at = NULL,
          updated_at = NOW()
        WHERE user_id = ?
        `,
        [vendorId],
      );
    }

    // -------------------------------------------------------
    // Return updated records
    // -------------------------------------------------------

    const updatedDocuments =
      await this.dataSource.query(
        `
        SELECT
          id,
          document_type,
          verification_status,
          verified_at
        FROM user_kyc_documents
        WHERE user_id = ?
        ORDER BY id ASC
        `,
        [vendorId],
      );

    const updatedBankDetails =
      await this.dataSource.query(
        `
        SELECT
          id,
          bank_name,
          account_number,
          ifsc,
          gst_number,
          verification_status,
          verified_at
        FROM user_kyc_bank_details
        WHERE user_id = ?
        ORDER BY id DESC
        `,
        [vendorId],
      );

    return {
      success: true,
      message:
        'Vendor application rejected successfully',

      documents: updatedDocuments,
      bankDetails: updatedBankDetails,
    };
  }

 
async delete_all() {
  // Get users except protected users
  const users = await this.dataSource.query(`
    SELECT id
    FROM users
    WHERE id NOT IN (3, 60)
  `);

  const userIds = users.map((u) => u.id);

  if (!userIds.length) {
    return {
      success: true,
      message: 'No users found to delete',
    };
  }

  // Get bookings belonging to those users
  const bookings = await this.dataSource.query(
    `
    SELECT id
    FROM bookings
    WHERE created_by IN (?)
    `,
    [userIds],
  );

  const bookingIds = bookings.map((b) => b.id);

  // Delete booking-related child data FIRST
  if (bookingIds.length) {

    await this.dataSource.query(
      `
      DELETE FROM booking_charges
      WHERE booking_id IN (?)
      `,
      [bookingIds],
    );

    await this.dataSource.query(
      `
      DELETE FROM booking_event_dates
      WHERE booking_id IN (?)
      `,
      [bookingIds],
    );

    await this.dataSource.query(
      `
      DELETE FROM booking_logs
      WHERE booking_id IN (?)
      `,
      [bookingIds],
    );

    await this.dataSource.query(
      `
      DELETE FROM booking_parties
      WHERE booking_id IN (?)
      `,
      [bookingIds],
    );
    
    await this.dataSource.query(
      `
      DELETE FROM booking_payments
      WHERE booking_id IN (?)
      `,
      [bookingIds],
    ); 
    
    await this.dataSource.query(
      `
      DELETE FROM booking_taxes
      WHERE booking_id IN (?)
      `,
      [bookingIds],
    ); 
    
    await this.dataSource.query(
      `
      DELETE FROM booking_shifts
      WHERE booking_id IN (?)
      `,
      [bookingIds],
    );

    // Add other booking child tables here
  }

  // Delete bookings
  if (bookingIds.length) {
    await this.dataSource.query(
      `
      DELETE FROM bookings
      WHERE id IN (?)
      `,
      [bookingIds],
    );
  }

  // Delete other user-related tables
  await this.dataSource.query(
    `
    DELETE FROM venue_parent
    WHERE created_by IN (?)
    `,
    [userIds],
  );

  await this.dataSource.query(
    `
    DELETE FROM venue_child
    WHERE created_by IN (?)
    `,
    [userIds],
  );

  // Finally delete users
  await this.dataSource.query(
    `
    DELETE FROM users
    WHERE user_id IN (?)
    `,
    [userIds],
  );

  return {
    success: true,
    message: 'All user-related data deleted successfully',
    deletedUsers: userIds.length,
  };
}
}
