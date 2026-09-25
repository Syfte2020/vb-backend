// kyc.service.ts

import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { StorageService } from 'src/common/storage/storage.service';
import { NotificationService } from '../../../notifications/notification.service';

@Injectable()
export class KycService {
  constructor(
    private readonly dataSource: DataSource,
    private storageService: StorageService,
    private readonly notificationService: NotificationService,
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
//  async kyc_status(userId: number, category: string, country: number) {
//   const singular = category
//     .trim()
//     .toLowerCase()
//     .endsWith('s')
//     ? category.trim().toLowerCase().slice(0, -1)
//     : category.trim().toLowerCase();

//   const categoryRows = await this.dataSource.query(
//     `
//     SELECT id
//     FROM category
//     WHERE LOWER(name) = ?
//     LIMIT 1
//     `,
//     [singular],
//   );

//   const categoryData = categoryRows[0];

//   if (!categoryData) {
//     return {
//       kyc_status: 'pending',
//     };
//   }

//   const result = await this.dataSource.query(
//     `
//     SELECT
//       CASE

//         /* Any rejected document or bank = rejected */
//         WHEN COALESCE(d.rejected_count, 0) > 0
//           OR b.verification_status = 'rejected'
//         THEN 'rejected'

//         /* Nothing submitted */
//         WHEN COALESCE(d.total_docs, 0) = 0
//           AND b.id IS NULL
//         THEN 'pending'

//         /* All documents approved and bank approved */
//         WHEN COALESCE(d.total_docs, 0) > 0
//           AND COALESCE(d.total_docs, 0) = COALESCE(d.approved_count, 0)
//           AND b.id IS NOT NULL
//           AND b.verification_status = 'approved'
//         THEN 'approved'

//         /* Documents or bank are still pending */
//         WHEN COALESCE(d.pending_count, 0) > 0
//           OR b.id IS NULL
//           OR b.verification_status IS NULL
//           OR b.verification_status = 'pending'
//         THEN 'verification_in_progress'

//         ELSE 'verification_in_progress'

//       END AS kyc_status,

//       COALESCE(d.total_docs, 0) AS total_documents,
//       COALESCE(d.approved_count, 0) AS approved_documents,
//       COALESCE(d.pending_count, 0) AS pending_documents,
//       COALESCE(d.rejected_count, 0) AS rejected_documents,

//       b.id AS bank_id,
//       b.verification_status AS bank_verification_status

//     FROM
//     (
//       SELECT
//         COUNT(*) AS total_docs,

//         COALESCE(
//           SUM(
//             CASE
//               WHEN verification_status = 'approved'
//               THEN 1
//               ELSE 0
//             END
//           ),
//           0
//         ) AS approved_count,

//         COALESCE(
//           SUM(
//             CASE
//               WHEN verification_status = 'pending'
//               THEN 1
//               ELSE 0
//             END
//           ),
//           0
//         ) AS pending_count,

//         COALESCE(
//           SUM(
//             CASE
//               WHEN verification_status = 'rejected'
//               THEN 1
//               ELSE 0
//             END
//           ),
//           0
//         ) AS rejected_count

//       FROM user_kyc_documents

//       WHERE user_id = ?
//         AND category_id = ?
//         AND country_id = ?
//     ) d

//     LEFT JOIN
//     (
//       SELECT
//         id,
//         user_id,
//         category_id,
//         country_id,
//         verification_status

//       FROM user_kyc_bank_details

//       WHERE user_id = ?
//         AND category_id = ?
//         AND country_id = ?

//       ORDER BY id DESC
//       LIMIT 1
//     ) b
//       ON b.user_id = ?
//       AND b.category_id = ?
//       AND b.country_id = ?

//     LIMIT 1
//     `,
//     [
//       userId,
//       categoryData.id,
//       country,

//       userId,
//       categoryData.id,
//       country,

//       userId,
//       categoryData.id,
//       country,
//     ],
//   );

//   return (
//     result[0] || {
//       kyc_status: 'pending',
//       total_documents: 0,
//       approved_documents: 0,
//       pending_documents: 0,
//       rejected_documents: 0,
//       bank_id: null,
//       bank_verification_status: null,
//     }
//   );
// }
// async kyc_status(
//   userId: number,
//   category: string,
//   country: number,
// ) {
//   // Normalize category
//   const normalizedCategory = category
//     ?.trim()
//     ?.toLowerCase();

//   const singular = normalizedCategory?.endsWith('s')
//     ? normalizedCategory.slice(0, -1)
//     : normalizedCategory;

//   // Get category ID
//   const categoryRows = await this.dataSource.query(
//     `
//     SELECT id
//     FROM category
//     WHERE LOWER(name) = ?
//     LIMIT 1
//     `,
//     [singular],
//   );

//   const categoryData = categoryRows?.[0];

//   if (!categoryData) {
//     return {
//       kyc_status: 'pending',
//     };
//   }

//   // Get KYC document status
//   const rows = await this.dataSource.query(
//     `
//     SELECT

//       COUNT(*) AS total_documents,

//       SUM(
//         CASE
//           WHEN LOWER(document_type) = 'pan'
//           THEN 1
//           ELSE 0
//         END
//       ) AS pan_count,

//       SUM(
//         CASE
//           WHEN LOWER(document_type) IN ('aadhaar', 'aadhar')
//           THEN 1
//           ELSE 0
//         END
//       ) AS aadhaar_count,

//       SUM(
//         CASE
//           WHEN LOWER(document_type) = 'gst'
//           THEN 1
//           ELSE 0
//         END
//       ) AS gst_count,

//       SUM(
//         CASE
//           WHEN LOWER(document_type) = 'pan'
//             AND LOWER(verification_status) = 'approved'
//           THEN 1
//           ELSE 0
//         END
//       ) AS pan_approved,

//       SUM(
//         CASE
//           WHEN LOWER(document_type) IN ('aadhaar', 'aadhar')
//             AND LOWER(verification_status) = 'approved'
//           THEN 1
//           ELSE 0
//         END
//       ) AS aadhaar_approved,

//       SUM(
//         CASE
//           WHEN LOWER(document_type) = 'gst'
//             AND LOWER(verification_status) = 'approved'
//           THEN 1
//           ELSE 0
//         END
//       ) AS gst_approved,

//       SUM(
//         CASE
//           WHEN LOWER(verification_status) = 'pending'
//           THEN 1
//           ELSE 0
//         END
//       ) AS pending_count,

//       SUM(
//         CASE
//           WHEN LOWER(verification_status) = 'rejected'
//           THEN 1
//           ELSE 0
//         END
//       ) AS rejected_count

//     FROM user_kyc_documents

//     WHERE user_id = ?
//       AND category_id = ?
//       AND country_id = ?
//     `,
//     [
//       userId,
//       categoryData.id,
//       country,
//     ],
//   );

//   const data = rows?.[0] || {};

//   // Counts
//   const totalDocuments = Number(
//     data.total_documents || 0,
//   );

//   const panCount = Number(
//     data.pan_count || 0,
//   );

//   const aadhaarCount = Number(
//     data.aadhaar_count || 0,
//   );

//   const gstCount = Number(
//     data.gst_count || 0,
//   );

//   const panApproved =
//     Number(data.pan_approved || 0) > 0;

//   const aadhaarApproved =
//     Number(data.aadhaar_approved || 0) > 0;

//   const gstApproved =
//     Number(data.gst_approved || 0) > 0;

//   const pendingCount = Number(
//     data.pending_count || 0,
//   );

//   const rejectedCount = Number(
//     data.rejected_count || 0,
//   );

//   // Debug
//   console.log('========== KYC STATUS ==========');
//   console.log('User ID:', userId);
//   console.log('Category:', singular);
//   console.log('Country:', country);

//   console.log('Total Documents:', totalDocuments);

//   console.log('PAN Count:', panCount);
//   console.log('PAN Approved:', panApproved);

//   console.log('Aadhaar Count:', aadhaarCount);
//   console.log('Aadhaar Approved:', aadhaarApproved);

//   console.log('GST Count:', gstCount);
//   console.log('GST Approved:', gstApproved);

//   console.log('Pending:', pendingCount);
//   console.log('Rejected:', rejectedCount);

//   console.log('================================');


//   /*
//    * 1. No documents uploaded
//    */
//   if (totalDocuments === 0) {
//     return {
//       kyc_status: 'pending',
//     };
//   }


//   /*
//    * 2. Any document rejected
//    */
//   if (rejectedCount > 0) {
//     return {
//       kyc_status: 'rejected',
//     };
//   }


//   /*
//    * 3. Any document pending
//    */
//   if (pendingCount > 0) {
//     return {
//       kyc_status: 'verification_in_progress',
//     };
//   }


//   /*
//    * 4. KYC approval rule
//    *
//    * PAN is mandatory
//    *
//    * AND
//    *
//    * Aadhaar OR GST
//    *
//    * Valid:
//    *
//    * PAN + Aadhaar
//    * PAN + GST
//    * PAN + Aadhaar + GST
//    */

//   const hasPan = panCount > 0;

//   const hasAadhaar = aadhaarCount > 0;

//   const hasGst = gstCount > 0;

//   const panValid =
//     hasPan && panApproved;

//   const aadhaarValid =
//     hasAadhaar && aadhaarApproved;

//   const gstValid =
//     hasGst && gstApproved;


//   /*
//    * PAN + Aadhaar
//    * OR
//    * PAN + GST
//    */
//   if (
//     panValid &&
//     (aadhaarValid || gstValid)
//   ) {
//     return {
//       kyc_status: 'approved',
//     };
//   }


//   /*
//    * Everything else
//    */
//   return {
//     kyc_status: 'verification_in_progress',
//   };
// }
// async kyc_status(
//   userId: number,
//   category: string,
//   country: number,
// ) {
//   // ============================================================
//   // 1. NORMALIZE CATEGORY
//   // ============================================================

//   const normalizedCategory = category
//     ?.trim()
//     ?.toLowerCase();

//   const singular = normalizedCategory?.endsWith('s')
//     ? normalizedCategory.slice(0, -1)
//     : normalizedCategory;

//   // ============================================================
//   // 2. GET CATEGORY ID
//   // ============================================================

//   const categoryRows = await this.dataSource.query(
//     `
//     SELECT id
//     FROM category
//     WHERE LOWER(name) = ?
//     LIMIT 1
//     `,
//     [singular],
//   );

//   const categoryData = categoryRows?.[0];

//   if (!categoryData) {
//     return {
//       kyc_status: 'pending',
//     };
//   }

//   const categoryId = Number(categoryData.id);

//   // ============================================================
//   // 3. GET KYC DOCUMENT STATUS
//   // ============================================================

//   const documentRows = await this.dataSource.query(
//     `
//     SELECT

//       COUNT(*) AS total_documents,

//       /* PAN COUNT */
//       SUM(
//         CASE
//           WHEN LOWER(document_type) = 'pan'
//           THEN 1
//           ELSE 0
//         END
//       ) AS pan_count,

//       /* AADHAAR COUNT */
//       SUM(
//         CASE
//           WHEN LOWER(document_type) IN ('aadhaar', 'aadhar')
//           THEN 1
//           ELSE 0
//         END
//       ) AS aadhaar_count,

//       /* GST COUNT */
//       SUM(
//         CASE
//           WHEN LOWER(document_type) = 'gst'
//           THEN 1
//           ELSE 0
//         END
//       ) AS gst_count,

//       /* PAN APPROVED */
//       SUM(
//         CASE
//           WHEN LOWER(document_type) = 'pan'
//             AND LOWER(verification_status) = 'approved'
//           THEN 1
//           ELSE 0
//         END
//       ) AS pan_approved,

//       /* AADHAAR APPROVED */
//       SUM(
//         CASE
//           WHEN LOWER(document_type) IN ('aadhaar', 'aadhar')
//             AND LOWER(verification_status) = 'approved'
//           THEN 1
//           ELSE 0
//         END
//       ) AS aadhaar_approved,

//       /* GST APPROVED */
//       SUM(
//         CASE
//           WHEN LOWER(document_type) = 'gst'
//             AND LOWER(verification_status) = 'approved'
//           THEN 1
//           ELSE 0
//         END
//       ) AS gst_approved,

//       /* PENDING DOCUMENTS */
//       SUM(
//         CASE
//           WHEN LOWER(verification_status) = 'pending'
//           THEN 1
//           ELSE 0
//         END
//       ) AS pending_count,

//       /* REJECTED DOCUMENTS */
//       SUM(
//         CASE
//           WHEN LOWER(verification_status) = 'rejected'
//           THEN 1
//           ELSE 0
//         END
//       ) AS rejected_count

//     FROM user_kyc_documents

//     WHERE user_id = ?
//       AND category_id = ?
//       AND country_id = ?
//     `,
//     [
//       userId,
//       categoryId,
//       country,
//     ],
//   );

//   const documentData = documentRows?.[0] || {};

//   // ============================================================
//   // 4. DOCUMENT COUNTS
//   // ============================================================

//   const totalDocuments = Number(
//     documentData.total_documents || 0,
//   );

//   const panCount = Number(
//     documentData.pan_count || 0,
//   );

//   const aadhaarCount = Number(
//     documentData.aadhaar_count || 0,
//   );

//   const gstCount = Number(
//     documentData.gst_count || 0,
//   );

//   const panApproved =
//     Number(documentData.pan_approved || 0) > 0;

//   const aadhaarApproved =
//     Number(documentData.aadhaar_approved || 0) > 0;

//   const gstApproved =
//     Number(documentData.gst_approved || 0) > 0;

//   const pendingCount = Number(
//     documentData.pending_count || 0,
//   );

//   const rejectedCount = Number(
//     documentData.rejected_count || 0,
//   );

//   // ============================================================
//   // 5. GET LATEST BANK DETAILS
//   // ============================================================

//   const bankRows = await this.dataSource.query(
//     `
//     SELECT
//       id,
//       user_id,
//       category_id,
//       country_id,
//       verification_status
//     FROM user_kyc_bank_details
//     WHERE user_id = ?
//       AND category_id = ?
//       AND country_id = ?
//     ORDER BY id DESC
//     LIMIT 1
//     `,
//     [
//       userId,
//       categoryId,
//       country,
//     ],
//   );

//   const bankData = bankRows?.[0] || null;

//   // ============================================================
//   // 6. BANK STATUS
//   // ============================================================

//   const bankId = bankData?.id
//     ? Number(bankData.id)
//     : null;

//   const bankStatus = bankData?.verification_status
//     ? String(bankData.verification_status)
//         .trim()
//         .toLowerCase()
//     : null;

//   const bankExists = !!bankId;

//   const bankApproved =
//     bankExists &&
//     bankStatus === 'approved';

//   const bankPending =
//     bankExists &&
//     bankStatus === 'pending';

//   const bankRejected =
//     bankExists &&
//     bankStatus === 'rejected';

//   // ============================================================
//   // 7. DEBUG
//   // ============================================================

//   console.log('========== KYC STATUS ==========');

//   console.log('User ID:', userId);
//   console.log('Category:', singular);
//   console.log('Category ID:', categoryId);
//   console.log('Country:', country);

//   console.log('-------------------------------');

//   console.log('Total Documents:', totalDocuments);

//   console.log('PAN Count:', panCount);
//   console.log('PAN Approved:', panApproved);

//   console.log('Aadhaar Count:', aadhaarCount);
//   console.log('Aadhaar Approved:', aadhaarApproved);

//   console.log('GST Count:', gstCount);
//   console.log('GST Approved:', gstApproved);

//   console.log('Pending Documents:', pendingCount);
//   console.log('Rejected Documents:', rejectedCount);

//   console.log('-------------------------------');

//   console.log('Bank ID:', bankId);
//   console.log('Bank Status:', bankStatus);
//   console.log('Bank Exists:', bankExists);
//   console.log('Bank Approved:', bankApproved);
//   console.log('Bank Pending:', bankPending);
//   console.log('Bank Rejected:', bankRejected);

//   console.log('================================');

//   // ============================================================
//   // 8. NO DOCUMENTS
//   // ============================================================

//   if (totalDocuments === 0) {
//     return {
//       kyc_status: 'pending',
//     };
//   }

//   // ============================================================
//   // 9. NO BANK DETAILS
//   //
//   // No bank record OR bank status NULL/EMPTY
//   // => PENDING
//   // ============================================================

//   if (
//     !bankExists ||
//     !bankStatus
//   ) {
//     return {
//       kyc_status: 'pending',
//     };
//   }

//   // ============================================================
//   // 10. ANYTHING REJECTED
//   // ============================================================

//   if (
//     rejectedCount > 0 ||
//     bankRejected
//   ) {
//     return {
//       kyc_status: 'rejected',
//     };
//   }

//   // ============================================================
//   // 11. ANYTHING PENDING
//   // ============================================================

//   if (
//     pendingCount > 0 ||
//     bankPending
//   ) {
//     return {
//       kyc_status: 'verification_in_progress',
//     };
//   }

//   // ============================================================
//   // 12. DOCUMENT VALIDATION
//   // ============================================================

//   const hasPan =
//     panCount > 0;

//   const hasAadhaar =
//     aadhaarCount > 0;

//   const hasGst =
//     gstCount > 0;

//   const panValid =
//     hasPan &&
//     panApproved;

//   const aadhaarValid =
//     hasAadhaar &&
//     aadhaarApproved;

//   const gstValid =
//     hasGst &&
//     gstApproved;

//   // ============================================================
//   // 13. FINAL APPROVAL
//   //
//   // PAN APPROVED
//   // AND
//   // Aadhaar OR GST APPROVED
//   // AND
//   // BANK APPROVED
//   // ============================================================

//   if (
//     panValid &&
//     (aadhaarValid || gstValid) &&
//     bankApproved
//   ) {
//     return {
//       kyc_status: 'approved',
//     };
//   }

//   // ============================================================
//   // 14. EVERYTHING ELSE
//   // ============================================================

//   return {
//     kyc_status: 'verification_in_progress',
//   };
// }

async kyc_status(
  userId: number,
  category: string,
  country: number,
) {
  // ============================================================
  // 1. NORMALIZE CATEGORY
  // ============================================================

  const normalizedCategory = category
    ?.trim()
    ?.toLowerCase();

  const singular = normalizedCategory?.endsWith('s')
    ? normalizedCategory.slice(0, -1)
    : normalizedCategory;

  // ============================================================
  // 2. GET CATEGORY ID
  // ============================================================

  const categoryRows = await this.dataSource.query(
    `
    SELECT id
    FROM category
    WHERE LOWER(name) = ?
    LIMIT 1
    `,
    [singular],
  );

  const categoryData = categoryRows?.[0];

  if (!categoryData) {
    return {
      kyc_status: 'pending',
    };
  }

  const categoryId = Number(categoryData.id);

  // ============================================================
  // 3. GET KYC DOCUMENT STATUS
  //
  // COMPULSORY:
  // - PAN
  // - DOCUMENT
  // - AADHAAR OR GST
  //
  // OPTIONAL:
  // - The other one between Aadhaar/GST
  // ============================================================

  const documentRows = await this.dataSource.query(
    `
    SELECT

      COUNT(*) AS total_documents,

      /* ========================================================
         PAN COUNT
         ======================================================== */

      SUM(
        CASE
          WHEN LOWER(TRIM(document_type)) = 'pan'
          THEN 1
          ELSE 0
        END
      ) AS pan_count,

      /* ========================================================
         DOCUMENT COUNT
         ======================================================== */

      SUM(
        CASE
          WHEN LOWER(TRIM(document_type)) = 'document'
          THEN 1
          ELSE 0
        END
      ) AS document_count,

      /* ========================================================
         AADHAAR COUNT
         ======================================================== */

      SUM(
        CASE
          WHEN LOWER(TRIM(document_type)) IN ('aadhaar', 'aadhar')
          THEN 1
          ELSE 0
        END
      ) AS aadhaar_count,

      /* ========================================================
         GST COUNT
         ======================================================== */

      SUM(
        CASE
          WHEN LOWER(TRIM(document_type)) = 'gst'
          THEN 1
          ELSE 0
        END
      ) AS gst_count,

      /* ========================================================
         PAN APPROVED
         ======================================================== */

      SUM(
        CASE
          WHEN LOWER(TRIM(document_type)) = 'pan'
            AND LOWER(TRIM(verification_status)) = 'approved'
          THEN 1
          ELSE 0
        END
      ) AS pan_approved,

      /* ========================================================
         DOCUMENT APPROVED
         ======================================================== */

      SUM(
        CASE
          WHEN LOWER(TRIM(document_type)) = 'document'
            AND LOWER(TRIM(verification_status)) = 'approved'
          THEN 1
          ELSE 0
        END
      ) AS document_approved,

      /* ========================================================
         AADHAAR APPROVED
         ======================================================== */

      SUM(
        CASE
          WHEN LOWER(TRIM(document_type)) IN ('aadhaar', 'aadhar')
            AND LOWER(TRIM(verification_status)) = 'approved'
          THEN 1
          ELSE 0
        END
      ) AS aadhaar_approved,

      /* ========================================================
         GST APPROVED
         ======================================================== */

      SUM(
        CASE
          WHEN LOWER(TRIM(document_type)) = 'gst'
            AND LOWER(TRIM(verification_status)) = 'approved'
          THEN 1
          ELSE 0
        END
      ) AS gst_approved,

      /* ========================================================
         PAN PENDING
         ======================================================== */

      SUM(
        CASE
          WHEN LOWER(TRIM(document_type)) = 'pan'
            AND LOWER(TRIM(verification_status)) = 'pending'
          THEN 1
          ELSE 0
        END
      ) AS pan_pending,

      /* ========================================================
         DOCUMENT PENDING
         ======================================================== */

      SUM(
        CASE
          WHEN LOWER(TRIM(document_type)) = 'document'
            AND LOWER(TRIM(verification_status)) = 'pending'
          THEN 1
          ELSE 0
        END
      ) AS document_pending,

      /* ========================================================
         AADHAAR PENDING
         ======================================================== */

      SUM(
        CASE
          WHEN LOWER(TRIM(document_type)) IN ('aadhaar', 'aadhar')
            AND LOWER(TRIM(verification_status)) = 'pending'
          THEN 1
          ELSE 0
        END
      ) AS aadhaar_pending,

      /* ========================================================
         GST PENDING
         ======================================================== */

      SUM(
        CASE
          WHEN LOWER(TRIM(document_type)) = 'gst'
            AND LOWER(TRIM(verification_status)) = 'pending'
          THEN 1
          ELSE 0
        END
      ) AS gst_pending,

      /* ========================================================
         PAN REJECTED
         ======================================================== */

      SUM(
        CASE
          WHEN LOWER(TRIM(document_type)) = 'pan'
            AND LOWER(TRIM(verification_status)) = 'rejected'
          THEN 1
          ELSE 0
        END
      ) AS pan_rejected,

      /* ========================================================
         DOCUMENT REJECTED
         ======================================================== */

      SUM(
        CASE
          WHEN LOWER(TRIM(document_type)) = 'document'
            AND LOWER(TRIM(verification_status)) = 'rejected'
          THEN 1
          ELSE 0
        END
      ) AS document_rejected,

      /* ========================================================
         AADHAAR REJECTED
         ======================================================== */

      SUM(
        CASE
          WHEN LOWER(TRIM(document_type)) IN ('aadhaar', 'aadhar')
            AND LOWER(TRIM(verification_status)) = 'rejected'
          THEN 1
          ELSE 0
        END
      ) AS aadhaar_rejected,

      /* ========================================================
         GST REJECTED
         ======================================================== */

      SUM(
        CASE
          WHEN LOWER(TRIM(document_type)) = 'gst'
            AND LOWER(TRIM(verification_status)) = 'rejected'
          THEN 1
          ELSE 0
        END
      ) AS gst_rejected

    FROM user_kyc_documents

    WHERE user_id = ?
      AND category_id = ?
      AND country_id = ?
    `,
    [
      userId,
      categoryId,
      country,
    ],
  );

  const documentData = documentRows?.[0] || {};

  // ============================================================
  // 4. DOCUMENT COUNTS
  // ============================================================

  const totalDocuments = Number(
    documentData.total_documents || 0,
  );

  const panCount = Number(
    documentData.pan_count || 0,
  );

  const documentCount = Number(
    documentData.document_count || 0,
  );

  const aadhaarCount = Number(
    documentData.aadhaar_count || 0,
  );

  const gstCount = Number(
    documentData.gst_count || 0,
  );

  // ============================================================
  // 5. APPROVED STATUS
  // ============================================================

  const panApproved =
    Number(documentData.pan_approved || 0) > 0;

  const documentApproved =
    Number(documentData.document_approved || 0) > 0;

  const aadhaarApproved =
    Number(documentData.aadhaar_approved || 0) > 0;

  const gstApproved =
    Number(documentData.gst_approved || 0) > 0;

  // ============================================================
  // 6. PENDING STATUS
  // ============================================================

  const panPending =
    Number(documentData.pan_pending || 0) > 0;

  const documentPending =
    Number(documentData.document_pending || 0) > 0;

  const aadhaarPending =
    Number(documentData.aadhaar_pending || 0) > 0;

  const gstPending =
    Number(documentData.gst_pending || 0) > 0;

  // ============================================================
  // 7. REJECTED STATUS
  // ============================================================

  const panRejected =
    Number(documentData.pan_rejected || 0) > 0;

  const documentRejected =
    Number(documentData.document_rejected || 0) > 0;

  const aadhaarRejected =
    Number(documentData.aadhaar_rejected || 0) > 0;

  const gstRejected =
    Number(documentData.gst_rejected || 0) > 0;

  // ============================================================
  // 8. GET LATEST BANK DETAILS
  // ============================================================

  const bankRows = await this.dataSource.query(
    `
    SELECT
      id,
      user_id,
      category_id,
      country_id,
      verification_status
    FROM user_kyc_bank_details
    WHERE user_id = ?
      AND category_id = ?
      AND country_id = ?
    ORDER BY id DESC
    LIMIT 1
    `,
    [
      userId,
      categoryId,
      country,
    ],
  );

  const bankData = bankRows?.[0] || null;

  // ============================================================
  // 9. BANK STATUS
  // ============================================================

  const bankId = bankData?.id
    ? Number(bankData.id)
    : null;

  const bankStatus = bankData?.verification_status
    ? String(bankData.verification_status)
        .trim()
        .toLowerCase()
    : null;

  const bankExists = !!bankId;

  const bankApproved =
    bankExists &&
    bankStatus === 'approved';

  const bankPending =
    bankExists &&
    bankStatus === 'pending';

  const bankRejected =
    bankExists &&
    bankStatus === 'rejected';

  // ============================================================
  // 10. DEBUG
  // ============================================================

  console.log('========== KYC STATUS ==========');

  console.log('User ID:', userId);
  console.log('Category:', singular);
  console.log('Category ID:', categoryId);
  console.log('Country:', country);

  console.log('-------------------------------');

  console.log('Total Documents:', totalDocuments);

  console.log('PAN Count:', panCount);
  console.log('PAN Approved:', panApproved);
  console.log('PAN Pending:', panPending);
  console.log('PAN Rejected:', panRejected);

  console.log('Document Count:', documentCount);
  console.log('Document Approved:', documentApproved);
  console.log('Document Pending:', documentPending);
  console.log('Document Rejected:', documentRejected);

  console.log('Aadhaar Count:', aadhaarCount);
  console.log('Aadhaar Approved:', aadhaarApproved);
  console.log('Aadhaar Pending:', aadhaarPending);
  console.log('Aadhaar Rejected:', aadhaarRejected);

  console.log('GST Count:', gstCount);
  console.log('GST Approved:', gstApproved);
  console.log('GST Pending:', gstPending);
  console.log('GST Rejected:', gstRejected);

  console.log('-------------------------------');

  console.log('Bank ID:', bankId);
  console.log('Bank Status:', bankStatus);
  console.log('Bank Exists:', bankExists);
  console.log('Bank Approved:', bankApproved);
  console.log('Bank Pending:', bankPending);
  console.log('Bank Rejected:', bankRejected);

  console.log('================================');

  // ============================================================
  // 11. NO DOCUMENTS
  // ============================================================

  if (totalDocuments === 0) {
    return {
      kyc_status: 'pending',
    };
  }

  // ============================================================
  // 12. PAN IS COMPULSORY
  // ============================================================

  if (!panCount) {
    return {
      kyc_status: 'pending',
    };
  }

  // ============================================================
  // 13. DOCUMENT IS COMPULSORY
  // ============================================================

  if (!documentCount) {
    return {
      kyc_status: 'pending',
    };
  }

  // ============================================================
  // 14. AADHAAR OR GST IS COMPULSORY
  //
  // At least one must exist.
  // ============================================================

  const hasAadhaar =
    aadhaarCount > 0;

  const hasGst =
    gstCount > 0;

  if (
    !hasAadhaar &&
    !hasGst
  ) {
    return {
      kyc_status: 'pending',
    };
  }

  // ============================================================
  // 15. BANK IS COMPULSORY
  // ============================================================

  if (
    !bankExists ||
    !bankStatus
  ) {
    return {
      kyc_status: 'pending',
    };
  }

  // ============================================================
  // 16. PAN / DOCUMENT REJECTED
  //
  // These are compulsory, so rejection means KYC rejected.
  // ============================================================

  if (
    panRejected ||
    documentRejected
  ) {
    return {
      kyc_status: 'rejected',
    };
  }

  // ============================================================
  // 17. BANK REJECTED
  // ============================================================

  if (bankRejected) {
    return {
      kyc_status: 'rejected',
    };
  }

  // ============================================================
  // 18. AADHAAR / GST VALIDATION
  //
  // At least ONE must be approved.
  //
  // Example:
  //
  // Aadhaar APPROVED + GST missing
  // => valid
  //
  // Aadhaar missing + GST APPROVED
  // => valid
  //
  // Aadhaar PENDING + GST APPROVED
  // => valid
  //
  // Aadhaar REJECTED + GST APPROVED
  // => valid
  // ============================================================

  const identityApproved =
    aadhaarApproved ||
    gstApproved;

  // ============================================================
  // 19. CHECK COMPULSORY DOCUMENT PENDING
  // ============================================================

  if (
    panPending ||
    documentPending
  ) {
    return {
      kyc_status: 'verification_in_progress',
    };
  }

  // ============================================================
  // 20. CHECK BANK PENDING
  // ============================================================

  if (bankPending) {
    return {
      kyc_status: 'verification_in_progress',
    };
  }

  // ============================================================
  // 21. AADHAAR OR GST NOT APPROVED
  //
  // One exists, but neither is approved.
  //
  // Examples:
  //
  // Aadhaar pending + GST missing
  // Aadhaar rejected + GST missing
  // Aadhaar pending + GST pending
  // Aadhaar rejected + GST pending
  // ============================================================

  if (!identityApproved) {
    // If either Aadhaar or GST is still under verification,
    // return verification_in_progress.

    if (
      aadhaarPending ||
      gstPending
    ) {
      return {
        kyc_status: 'verification_in_progress',
      };
    }

    // If available identity documents are rejected
    // and none is approved.
    if (
      (hasAadhaar && aadhaarRejected) &&
      (!hasGst || gstRejected)
    ) {
      return {
        kyc_status: 'rejected',
      };
    }

    if (
      (hasGst && gstRejected) &&
      (!hasAadhaar || aadhaarRejected)
    ) {
      return {
        kyc_status: 'rejected',
      };
    }

    return {
      kyc_status: 'verification_in_progress',
    };
  }

  // ============================================================
  // 22. FINAL VALIDATION
  //
  // REQUIRED:
  //
  // PAN APPROVED
  // AND
  // DOCUMENT APPROVED
  // AND
  // (AADHAAR APPROVED OR GST APPROVED)
  // AND
  // BANK APPROVED
  // ============================================================

  const panValid =
    panCount > 0 &&
    panApproved;

  const documentValid =
    documentCount > 0 &&
    documentApproved;

  const identityValid =
    aadhaarApproved ||
    gstApproved;

  // ============================================================
  // 23. FINAL APPROVED
  // ============================================================

  if (
    panValid &&
    documentValid &&
    identityValid &&
    bankApproved
  ) {
    return {
      kyc_status: 'approved',
    };
  }

  // ============================================================
  // 24. EVERYTHING ELSE
  // ============================================================

  return {
    kyc_status: 'verification_in_progress',
  };
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
   AND document_type = 'aadhaar'
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


// async suscription_detail(userId: any,category: any,country: any) {

//    const singular = category.endsWith("s")
//   ? category.slice(0, -1)
//   : category;

//   const [categories] = await this.dataSource.query(
//     `SELECT * FROM category WHERE name = ? `,
//     [singular],
//   );

//  const subscription = await this.dataSource.query(
//       `SELECT * FROM user_subscriptions us
//       LEFT JOIN plans ON plans.id = us.plan_id
//    WHERE user_id = ? AND us.country_id = ? AND us.category_id = ?
//    ORDER BY us.id DESC
//    LIMIT 1`,
//       [userId,country,categories.id],
//     );

//     return subscription;
// }

async suscription_detail(
  userId: any,
  category: any,
  country: any,
) {
  const singular = category.endsWith("s")
    ? category.slice(0, -1)
    : category;

  const [categories] = await this.dataSource.query(
    `SELECT * FROM category WHERE name = ?`,
    [singular],
  );

  if (!categories) {
    return [];
  }

  // 1. Get latest subscription
  // const subscriptionResult = await this.dataSource.query(
  //   `SELECT 
  //       us.*,
  //       plans.*
  //    FROM user_subscriptions us
  //    LEFT JOIN plans ON plans.id = us.plan_id
  //    WHERE us.user_id = ?
  //      AND us.country_id = ?
  //      AND us.category_id = ?
  //    ORDER BY us.id DESC
  //    LIMIT 1`,
  //   [userId, country, categories.id],
  // );  
  
const subscriptionResult = await this.dataSource.query(
  `SELECT 
      us.id AS subscription_db_id,
      us.user_id,
      us.country_id,
      us.category_id,
      us.plan_id,

      us.razorpay_plan_id,
      us.subscription_code,
      us.subscription_id,

      us.quantity,
      us.gst_rate,
      us.gst_amount,
      us.total_amount,
      us.price_per_unit,
      us.current_amount,

      us.total_count,
      us.paid_count,

      us.start_date,
      us.next_billing_date,
      us.end_date,

      us.auto_renew,
      us.status AS subscription_status,
      us.razorpay_status,
      us.payment_method,

      us.last_payment_id,
      us.last_payment_date,
      us.webhook_status,

      us.metadata,
      us.cancel_at_period_end,
      us.cancelled_at,

      us.created_at AS subscription_created_at,
      us.updated_at AS subscription_updated_at,

      us.pending_quantity,
      us.quantity_change_type,
      us.quantity_change_at,

      us.payment_link_id,
      us.payment_link_url,
      us.payment_status,

      us.razorpay_customer_id,
      us.razorpay_token_id,
      us.token_status,
      us.razorpay_order_id,
      us.razorpay_payment_id,

      us.token_expiry,
      us.token_type,
      us.token_max_amount,
      us.token_frequency,

      plans.id ,
      plans.plan_name,
      plans.plan_title,
      plans.description AS plan_description,
      plans.country_id AS plan_country_id,
      plans.category_id AS plan_category_id,
      plans.percentage,
      plans.amount AS plan_amount,
      plans.discount,
      plans.offer_amount,
      plans.min_venue,
      plans.max_venue,
      plans.modules,
      plans.status AS plan_status,
      plans.recommended,
      plans.created_at AS plan_created_at,
      plans.updated_at AS plan_updated_at

   FROM user_subscriptions us
   LEFT JOIN plans 
      ON plans.id = us.plan_id
   WHERE us.user_id = ?
     AND us.country_id = ?
     AND us.category_id = ?
   ORDER BY us.id DESC
   LIMIT 1`,
  [userId, country, categories.id],
);

  if (!subscriptionResult.length) {
    return [];
  }

  const subscription = subscriptionResult[0];

  // 2. Calculate actual child quantity
  const [childCountResult] = await this.dataSource.query(
    `SELECT COUNT(*) AS total
     FROM venue_child vc
     LEFT JOIN venue_parent vp ON vp.parent_venue_id= vc.parent_venue_id
     WHERE vc.created_by = ?
       AND vp.venue_country = ?
       AND vp.propety_category = ?`,
    [userId, country, singular],
  );

  const childQuantity = Number(childCountResult?.total || 0);

  // 3. Check whether quantity changed
  const oldQuantity = Number(subscription.quantity || 0);

  if (childQuantity !== oldQuantity) {

    // 4. Calculate new amount
    const pricePerUnit = Number(subscription.price_per_unit || 0);

    const currentAmount = childQuantity * pricePerUnit;

    const gstRate = Number(subscription.gst_rate || 0);

    const gstAmount =
      currentAmount * gstRate / 100;

    const totalAmount =
      currentAmount + gstAmount;

    // 5. Update subscription
    await this.dataSource.query(
      `UPDATE user_subscriptions
       SET
         quantity = ?,
         current_amount = ?,
         gst_amount = ?,
         total_amount = ?,
         updated_at = NOW()
       WHERE id = ?`,
      [
        childQuantity,
        currentAmount,
        gstAmount,
        totalAmount,
        subscription.id,
      ],
    );

    // 6. Notification ONLY when quantity changed
    await this.notificationService.createNotification({
      type: "subscription_quantity_updated",
      referenceId: subscription.subscription_db_id,
      title: "Subscription Quantity Updated",
      message: `Your subscription quantity has been updated from ${oldQuantity} to ${childQuantity}.`,
      createdBy: userId,
    });

    // Update returned object as well
    // subscription.quantity = childQuantity;
    // subscription.current_amount = currentAmount;
    // subscription.gst_amount = gstAmount;
    // subscription.total_amount = totalAmount;
  }

  return subscriptionResult;
}


  
}
