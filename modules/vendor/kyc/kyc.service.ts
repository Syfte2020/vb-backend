// kyc.service.ts

import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { StorageService } from 'src/common/storage/storage.service';

@Injectable()
export class KycService {
  constructor(
    private readonly dataSource: DataSource,
    private storageService: StorageService,
  ) {}

  async updateKyc(userId: any, body: any, files: any) {


    await this.dataSource.query(
      `
    UPDATE user_kyc_documents
    SET
      verification_status = 'review'
    WHERE user_id = ?
    `,
      [userId],
    );

     await this.dataSource.query(
      `
    UPDATE user_kyc_bank_details
    SET
      verification_status = 'review'
    WHERE user_id = ?
    `,
      [userId],
    );


    // const {
    //   pan,
    //   bankName,
    //   accountNo,
    //   ifsc,
    //   accountType,
    //   bizName,
    //   bizType,
    //   gst,
    //   bizAddress,
    // } = body;

    // upload files
    // const panFileUrl = files?.panFile
    //   ? await this.storageService.upload(files.panFile, 'uploads/kyc/pan')
    //   : null;

    // const aadhaarFileUrl = files?.aadhaarFile
    //   ? await this.storageService.upload(
    //       files.aadhaarFile,
    //       'uploads/kyc/aadhaar',
    //     )
    //   : null;

    // const bizRegFileUrl = files?.bizRegFile
    //   ? await this.storageService.upload(
    //       files.bizRegFile,
    //       'uploads/kyc/business',
    //     )
    //   : null;

    // const chequeFileUrl = files?.chequeFile
    //   ? await this.storageService.upload(files.chequeFile, 'uploads/kyc/cheque')
    //   : null;

    // // PAN
    // if (panFileUrl) {
    //   await this.dataSource.query(
    //     `
    //     INSERT INTO user_kyc_documents
    //     (
    //       user_id,
    //       document_type,
    //       document_number,
    //       file_url,
    //       verification_status,
    //       created_at
    //     )
    //     VALUES (?, ?, ?, ?, ?, NOW())
    //   `,
    //     [userId, 'pan', pan, panFileUrl, 'pending'],
    //   );
    // }
    // //ABCDE1234F 'pan','aadhar','bank_proof','gst','other'
    // // Aadhaar
    // if (aadhaarFileUrl) {
    //   await this.dataSource.query(
    //     `
    //     INSERT INTO user_kyc_documents
    //     (
    //       user_id,
    //       document_type,
    //       document_number,
    //       file_url,
    //       verification_status,
    //       created_at
    //     )
    //     VALUES (?, ?, ?, ?, ?, NOW())
    //   `,
    //     [userId, 'aadhar', '', aadhaarFileUrl, 'pending'],
    //   );
    // }

    // // Business Doc
    // if (bizRegFileUrl) {
    //   await this.dataSource.query(
    //     `
    //     INSERT INTO user_kyc_documents
    //     (
    //       user_id,
    //       document_type,
    //       document_number,
    //       file_url,
    //       verification_status,
    //       created_at
    //     )
    //     VALUES (?, ?, ?, ?, ?, NOW())
    //   `,
    //     [userId, 'other', gst || '', bizRegFileUrl, 'pending'],
    //   );
    // }

    // // Cheque
    // if (chequeFileUrl) {
    //   await this.dataSource.query(
    //     `
    //     INSERT INTO user_kyc_documents
    //     (
    //       user_id,
    //       document_type,
    //       document_number,
    //       file_url,
    //       verification_status,
    //       created_at
    //     )
    //     VALUES (?, ?, ?, ?, ?, NOW())
    //   `,
    //     [userId, 'bank_proof', accountNo, chequeFileUrl, 'pending'],
    //   );
    // }

    // // optional bank/business table save
    // await this.dataSource.query(
    //   `
    //   INSERT INTO user_kyc_bank_details
    //   (
    //     user_id,
    //     bank_name,
    //     account_number,
    //     ifsc,
    //     account_type,
    //     business_name,
    //     business_type,
    //     gst_number,
    //     business_address,
    //     created_at
    //   )
    //   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    // `,
    //   [
    //     userId,
    //     bankName,
    //     accountNo,
    //     ifsc,
    //     accountType,
    //     bizName,
    //     bizType,
    //     gst,
    //     bizAddress,
    //   ],
    // );

    return {
      success: true,
      message: 'KYC submitted successfully',
    };
  }
  async kyc_status(userId: any, category: any, country: any) {
  const singular = category.endsWith("s")
    ? category.slice(0, -1)
    : category;

  const [categoryData] = await this.dataSource.query(
    `SELECT * FROM category WHERE name = ?`,
    [singular],
  );

  if (!categoryData) {
    return { kyc_status: "pending" };
  }

  const result = await this.dataSource.query(
    `
    SELECT
      CASE
          WHEN d.rejected_count > 0
            OR b.verification_status = 'rejected'
          THEN 'rejected'

          WHEN d.total_docs = 0
            AND b.id IS NULL
          THEN 'pending'

          WHEN d.pending_count > 0
            OR b.verification_status = 'pending'
          THEN 'verification_in_progress'

          WHEN d.total_docs > 0
            AND d.total_docs = d.approved_count
            AND b.verification_status = 'approved'
          THEN 'approved'

          ELSE 'verification_in_progress'
      END AS kyc_status

    FROM
    (
        SELECT
            COUNT(*) AS total_docs,
            SUM(CASE WHEN verification_status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
            SUM(CASE WHEN verification_status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
            SUM(CASE WHEN verification_status = 'rejected' THEN 1 ELSE 0 END) AS rejected_count
        FROM user_kyc_documents
        WHERE user_id = ?
          AND category_id = ?
          AND country_id = ?
    ) d

    LEFT JOIN user_kyc_bank_details b
      ON b.user_id = ?
      AND b.category_id = ?
      AND b.country_id = ?

    LIMIT 1
    `,
    [
      userId,
      categoryData.id,
      country,
      userId,
      categoryData.id,
      country,
    ],
  );

  return result[0];
}

async each_kyc_status(userId: any,category: any,country: any) {


  const singular = category.endsWith("s")
  ? category.slice(0, -1)
  : category;

  const [categories] = await this.dataSource.query(
    `SELECT * FROM category WHERE name = ? `,
    [singular],
  );

  const pan = await this.dataSource.query(
      `SELECT * FROM user_kyc_documents
   WHERE user_id = ?
   AND document_type = 'pan'
   AND category_id = ?
   AND country_id = ?
   ORDER BY id DESC
   LIMIT 1`,
      [userId,categories.id,country],
    );

     const GST = await this.dataSource.query(
      `SELECT * FROM user_kyc_documents
   WHERE user_id = ?
   AND document_type = 'gst'
   AND category_id = ?
   AND country_id = ?
   ORDER BY id DESC
   LIMIT 1`,
      [userId,categories.id,country],
    );

    const aadhaar = await this.dataSource.query(
      `SELECT * FROM user_kyc_documents
   WHERE user_id = ?
   AND document_type = 'aadhar'
   AND category_id = ?
   AND country_id = ?
   ORDER BY id DESC
   LIMIT 1`,
      [userId,categories.id,country],
    );

    const business = await this.dataSource.query(
      `SELECT * FROM user_kyc_documents
   WHERE user_id = ?
   AND document_type = 'other'
    AND category_id = ?
   AND country_id = ?
   ORDER BY id DESC
   LIMIT 1`,
       [userId,categories.id,country],
    );

    const cheque = await this.dataSource.query(
      `SELECT * FROM user_kyc_documents
   WHERE user_id = ?
   AND document_type = 'bank_proof'
    AND category_id = ?
   AND country_id = ?
   ORDER BY id DESC
   LIMIT 1`,
       [userId,categories.id,country],
    );

    const bank = await this.dataSource.query(
      `SELECT * FROM user_kyc_bank_details
   WHERE user_id = ?
   ORDER BY id DESC
   LIMIT 1`,
      [userId],
    );

    return {
      pan: pan[0] || null,
      gst: GST[0] || null,
      aadhaar: aadhaar[0] || null,
      business: business[0] || null,
      cheque: cheque[0] || null,
      bank: bank[0] || null,
    };
  }


async suscription_detail(userId: any,category: any,country: any) {

   const singular = category.endsWith("s")
  ? category.slice(0, -1)
  : category;

  const [categories] = await this.dataSource.query(
    `SELECT * FROM category WHERE name = ? `,
    [singular],
  );

 const subscription = await this.dataSource.query(
      `SELECT * FROM user_subscriptions us
      LEFT JOIN plans ON plans.id = us.plan_id
   WHERE user_id = ? AND country_id = ? AND us.category_id = ?
   ORDER BY us.id DESC
   LIMIT 1`,
      [userId,country,categories.id],
    );

    return subscription;
}


  
}
