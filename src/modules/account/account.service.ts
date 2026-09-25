import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationService } from '../../notifications/notification.service';
import { StorageService } from 'src/common/storage/storage.service';
import { MultipartFile } from '@fastify/multipart';

import { TwilioService } from '../integrations/twilio/twilio.service';

import * as bcrypt from 'bcrypt';

import { sendOtpEmail } from '../invoice/email/mail.service';



@Injectable()
export class AccountService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notificationService: NotificationService,
    private readonly storageService: StorageService,
    private readonly twilioService: TwilioService,
  ) {}

  async loadProfileApi(id: number) {
    const [user] = await this.dataSource.query(
      `SELECT * FROM users WHERE id = ?`,
      [id],
    );

    return user;
  }

  // async updateProfile(
  //   id: number,
  //   data: any,
  //   avatar?: MultipartFile | null,
  // ) {
  //   if (avatar) {
  //     const logo = await this.storageService.upload(
  //       avatar,
  //       `uploads/profile/${id}`,
  //     );

  //     data.logo = logo;
  //   }

  //   const fields = Object.keys(data);

  //   if (!fields.length) {
  //     throw new BadRequestException('No data to update');
  //   }

  //   const setClause = fields
  //     .map((field) => `${field} = ?`)
  //     .join(', ');

  //   const values = fields.map((field) => data[field]);

  //   values.push(id);

  //   await this.dataSource.query(
  //     `
  //     UPDATE users
  //     SET
  //       ${setClause},
  //       updated_at = NOW()
  //     WHERE id = ?
  //     `,
  //     values,
  //   );

  //   const [user] = await this.dataSource.query(
  //     `SELECT * FROM users WHERE id = ?`,
  //     [id],
  //   );

  //   return {
  //     success: true,
  //     message: 'Profile updated successfully',
  //     data: user,
  //   };
  // }
async updateProfile(
  id: number,
  data: any,
  avatar?: any | null,
) {
  try {
    /*
     * ==============================
     * AVATAR UPLOAD
     * ==============================
     */

    if (avatar) {
      console.log('AVATAR FROM CONTROLLER:', {
        filename: avatar.originalname,
        mimetype: avatar.mimetype,
        size: avatar.size,
        isBuffer: Buffer.isBuffer(
          avatar.buffer,
        ),
      });

      if (
        !avatar.buffer ||
        !Buffer.isBuffer(avatar.buffer) ||
        avatar.buffer.length === 0
      ) {
        throw new BadRequestException(
          'Invalid or empty image',
        );
      }

      /*
       * ==============================
       * S3 UPLOAD
       * ==============================
       */

      console.log(
        'STARTING S3 UPLOAD...',
      );

      const logo =
        await this.storageService.upload(
          avatar,
          `uploads/profile/${id}`,
        );

      console.log(
        'S3 UPLOAD SUCCESS:',
        logo,
      );

      if (!logo) {
        throw new BadRequestException(
          'Image upload failed',
        );
      }

      data.logo = logo;
    }

    /*
     * ==============================
     * DATABASE UPDATE
     * ==============================
     */

    const fields = Object.keys(data);

    if (!fields.length) {
      throw new BadRequestException(
        'No data to update',
      );
    }

    const setClause = fields
      .map(
        (field) => `\`${field}\` = ?`,
      )
      .join(', ');

    const values = fields.map(
      (field) => data[field],
    );

    values.push(id);

    await this.dataSource.query(
      `
      UPDATE users
      SET
        ${setClause},
        updated_at = NOW()
      WHERE id = ?
      `,
      values,
    );

    /*
     * ==============================
     * GET USER
     * ==============================
     */

    const [user] =
      await this.dataSource.query(
        `
        SELECT *
        FROM users
        WHERE id = ?
        `,
        [id],
      );

    return {
      success: true,
      message:
        'Profile updated successfully',
      data: user,
    };
  } catch (error) {
    console.error(
      'PROFILE UPDATE ERROR:',
      error,
    );

    throw error;
  }
}


  async rewardsApi(userId:Number)
  {
    const [user] = await this.dataSource.query(
      `SELECT * FROM reward_point_balance  rpb
      LEFT JOIN member_tier mt ON mt.id = rpb.mem_id
      WHERE user_id = ?`,
      [userId],
    );

    const memTier= await this.dataSource.query(
      `SELECT * FROM member_tier  `
    );

     const reward_history= await this.dataSource.query(
      `SELECT
    rpt.id,
    rpt.user_id,
    rpt.booking_id,
    rpt.points,
    rpt.transaction_type,
    rpt.created_at,

    b.booking_code,
    b.total_amount,

    cv.child_venue_name,

    CASE
        WHEN ed.first_date = ed.last_date THEN
            DATE_FORMAT(ed.first_date, '%e %b')
        ELSE
            CONCAT(
                DATE_FORMAT(ed.first_date, '%e %b'),
                ' - ',
                DATE_FORMAT(ed.last_date, '%e %b')
            )
    END AS event_date

FROM reward_point_transactions rpt

LEFT JOIN bookings b
    ON b.id = rpt.booking_id

LEFT JOIN booking_venues bv
    ON bv.booking_id = b.id

LEFT JOIN venue_child cv
    ON cv.child_venue_id = bv.child_venue_id

LEFT JOIN (
    SELECT
        booking_id,
        MIN(event_date) AS first_date,
        MAX(event_date) AS last_date
    FROM booking_event_dates
    GROUP BY booking_id
) ed
    ON ed.booking_id = b.id

WHERE rpt.user_id = ?

ORDER BY rpt.created_at DESC;`,[userId]
    );

    return {
      rewads : user,
      tier:memTier,
      history:reward_history
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
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        recordId,
        action,
        description,
        JSON.stringify(oldValue ?? null),
        JSON.stringify(newValue ?? null),
        userId,
        new Date(),
      ],
    );
  }


 /**
   * =========================================
   * SEND VERIFICATION OTP
   * =========================================
   */
  async sendVerificationOtp(
    userId: number,
    type: 'email' | 'phone',
    value: string,
  ) {
    const target =
      type === 'email'
        ? value.trim().toLowerCase()
        : this.normalizePhone(value);

    /**
     * Validate target
     */
    if (type === 'email') {
      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(target)) {
        throw new BadRequestException(
          'Invalid email address',
        );
      }
    }

    if (type === 'phone') {
      if (
        !/^\+?[1-9]\d{7,14}$/.test(
          target,
        )
      ) {
        throw new BadRequestException(
          'Invalid phone number',
        );
      }
    }

    /**
     * Check duplicate email/phone
     */
    const column =
      type === 'email'
        ? 'email'
        : 'phone';

    const [existing] =
      await this.dataSource.query(
        `
        SELECT id
        FROM users
        WHERE ${column} = ?
          AND id != ?
        LIMIT 1
        `,
        [target, userId],
      );

    if (existing) {
      throw new BadRequestException(
        `This ${type} is already registered`,
      );
    }

    /**
     * Prevent OTP spam.
     *
     * Don't allow another OTP within 60 seconds.
     */
    const [recent] =
      await this.dataSource.query(
        `
        SELECT id
        FROM user_verifications
        WHERE user_id = ?
          AND type = ?
          AND created_at >= DATE_SUB(
            NOW(),
            INTERVAL 60 SECOND
          )
        ORDER BY id DESC
        LIMIT 1
        `,
        [userId, type],
      );

    if (recent) {
      throw new BadRequestException(
        'Please wait before requesting another OTP',
      );
    }

    /**
     * Generate OTP
     */
    const otp =
      Math.floor(
        100000 +
          Math.random() * 900000,
      ).toString();

    /**
     * Hash OTP
     */
    const otpHash =
      await bcrypt.hash(
        otp,
        10,
      );

    /**
     * OTP expires in 10 minutes
     */
    await this.dataSource.query(
      `
      INSERT INTO user_verifications
      (
        user_id,
        type,
        target,
        otp_hash,
        expires_at
      )
      VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))
      `,
      [
        userId,
        type,
        target,
        otpHash,
      ],
    );

    /**
     * =====================================
     * SEND EMAIL / SMS HERE
     * =====================================
     *
     * Email:
     *
     * await this.mailService.sendOtp(
     *   target,
     *   otp,
     * );
     *
     * SMS:
     *
     * await this.smsService.sendOtp(
     *   target,
     *   otp,
     * );
     */

     if (type === 'phone') {

const phone = String(value).replace(/\D/g, "");

const phoneWithCountryCode = phone.startsWith("91")
  ? `+${phone}`
  : `+91${phone}`;

await this.twilioService.sendWhatsApp(phoneWithCountryCode, otp);

     }
     if (type === 'email') {
await sendOtpEmail({
  email: value,
  otp,
});
     }



    console.log(
      `OTP for ${type}:`,
      otp,
    );

    return {
      success: true,
      message:
        `Verification OTP sent to your ${type}`,
      expiresIn: 600,

      /**
       * NEVER return OTP in production.
       *
       * This is only useful during development.
       */
      ...(process.env.NODE_ENV !==
        'production'
        ? {
            developmentOtp: otp,
          }
        : {}),
    };
  }

  /**
   * =========================================
   * VERIFY OTP
   * =========================================
   */
  async verifyOtp(
    userId: number,
    type: 'email' | 'phone',
    value: string,
    otp: any,
  ) {
    const target =
      type === 'email'
        ? value.trim().toLowerCase()
        : this.normalizePhone(value);

    /**
     * Get latest OTP
     */
    const [verification] =
      await this.dataSource.query(
        `
        SELECT *
        FROM user_verifications
        WHERE user_id = ?
          AND type = ?
          AND target = ?
          AND verified_at IS NULL
        ORDER BY id DESC
        LIMIT 1
        `,
        [
          userId,
          type,
          target,
        ],
      );

    if (!verification) {
      throw new BadRequestException(
        'OTP not found or already used',
      );
    }

    /**
     * Check expiry
     */
    // if (
    //   new Date(
    //     verification.expires_at,
    //   ).getTime() <
    //   Date.now()
    // ) {
    //   throw new BadRequestException(
    //     'OTP has expired',
    //   );
    // }

    /**
     * Max attempts
     */
    if (
      Number(
        verification.attempts,
      ) >= 5
    ) {
      throw new BadRequestException(
        'Too many incorrect attempts. Please request a new OTP',
      );
    }

    /**
     * Verify OTP
     */
    const valid =
      await bcrypt.compare(
        otp,
        verification.otp_hash,
      );

    if (!valid) {
      await this.dataSource.query(
        `
        UPDATE user_verifications
        SET attempts = attempts + 1
        WHERE id = ?
        `,
        [verification.id],
      );

      throw new BadRequestException(
        'Invalid OTP',
      );
    }

    /**
     * Mark OTP verified
     */
    await this.dataSource.query(
      `
      UPDATE user_verifications
      SET verified_at = NOW()
      WHERE id = ?
      `,
      [verification.id],
    );

    /**
     * Update user
     */
    if (type === 'email') {
      await this.dataSource.query(
        `
        UPDATE users
        SET
          email = ?,
          email_verified = 1,
          email_verified_at = NOW(),
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          target,
          userId,
        ],
      );
    }

    if (type === 'phone') {
      await this.dataSource.query(
        `
        UPDATE users
        SET
          phone = ?,
          phone_verified = 1,
          phone_verified_at = NOW(),
          updated_at = NOW()
        WHERE id = ?
        `,
        [
          target,
          userId,
        ],
      );
    }

    const [user] =
      await this.dataSource.query(
        `
        SELECT *
        FROM users
        WHERE id = ?
        `,
        [userId],
      );

    return {
      success: true,
      message:
        type === 'email'
          ? 'Email verified successfully'
          : 'Mobile number verified successfully',
      data: user,
    };
  }

  /**
   * =========================================
   * DATE FORMAT
   * =========================================
   *
   * Accept:
   *
   * 1995-08-17
   * 17-08-1995
   * 17/08/1995
   */
  private normalizeDate(
    value: string,
  ): string {
    if (!value) {
      return value;
    }

    /**
     * YYYY-MM-DD
     */
    if (
      /^\d{4}-\d{2}-\d{2}$/.test(
        value,
      )
    ) {
      return value;
    }

    /**
     * DD-MM-YYYY
     */
    const dash =
      value.match(
        /^(\d{2})-(\d{2})-(\d{4})$/,
      );

    if (dash) {
      return `${dash[3]}-${dash[2]}-${dash[1]}`;
    }

    /**
     * DD/MM/YYYY
     */
    const slash =
      value.match(
        /^(\d{2})\/(\d{2})\/(\d{4})$/,
      );

    if (slash) {
      return `${slash[3]}-${slash[2]}-${slash[1]}`;
    }

    throw new BadRequestException(
      'Invalid date of birth. Use YYYY-MM-DD',
    );
  }

  /**
   * =========================================
   * PHONE NORMALIZATION
   * =========================================
   */
  private normalizePhone(
    phone: string,
  ): string {
    return phone
      .trim()
      .replace(/[\s()-]/g, '');
  }
  async commercial_get(userId: number) 
  {
        const parents =
      await this.dataSource.query(
        `
        SELECT *
        FROM venue_parent
        WHERE created_by = ?
        `,
        [userId],
      );


       const contract =
      await this.dataSource.query(
        `
        SELECT *
        FROM user_subscriptions
        WHERE user_id = ?
        `,
        [userId],
      );



      return {
        parents,
        contract
      };
  }  
  
  async notifications(userId: number) 
  {
       const notifications = await this.dataSource.query(
  `
    SELECT
      id,
      title,
      message,
      type,
      reference_type,
      reference_id,
      is_read,
      read_at,
      created_at
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
  `,
  [userId],
);

return notifications.map((item: any) => ({
  id: item.id,

  type: item.type || 'general',

  title: item.title,

  description: item.message,

  time: this.getTimeAgo(item.created_at),

  read: Boolean(item.is_read),

  priority: this.getPriority(item.type),

  icon: this.getIcon(item.type),

  badge: this.getBadge(item.type),

  reference_type: item.reference_type,

  reference_id: item.reference_id,

  created_at: item.created_at,
}));
  }

  private getIcon(type: string): string {
  switch (type) {
    case 'booking':
      return 'calendar';

    case 'payment':
      return 'rupee';

    case 'security':
      return 'shield';

    case 'team':
      return 'users';

    default:
      return 'bell';
  }
}

private getBadge(type: string): string {
  switch (type) {
    case 'booking':
      return 'Booking';

    case 'payment':
      return 'Payment';

    case 'security':
      return 'Security';

    case 'team':
      return 'Team';

    default:
      return 'Notification';
  }
}

private getPriority(type: string): string {
  switch (type) {
    case 'security':
      return 'critical';

    case 'payment':
      return 'success';

    case 'booking':
      return 'info';

    default:
      return 'info';
  }
}

private getTimeAgo(date: string): string {
  const now = new Date();
  const created = new Date(date);

  const diff =
    Math.floor(
      (now.getTime() - created.getTime()) / 1000,
    );

  if (diff < 60) {
    return `${diff} sec ago`;
  }

  if (diff < 3600) {
    return `${Math.floor(diff / 60)} min ago`;
  }

  if (diff < 86400) {
    return `${Math.floor(diff / 3600)} hr ago`;
  }

  if (diff < 172800) {
    return 'Yesterday';
  }

  return `${Math.floor(diff / 86400)} days ago`;
}

async fiance_settlement(userId: number) 
  {
       const notifications = await this.dataSource.query(
  `SELECT
    b.id,
    b.booking_code,
    b.created_at AS booking_date,
    bed.event_date,
    b.total_amount,
    COALESCE(SUM(bp.amount_paid), 0) AS paid_amount,
    (b.total_amount - COALESCE(SUM(bp.amount_paid), 0)) AS pending_amount,
    CASE
        WHEN (b.total_amount - COALESCE(SUM(bp.amount_paid), 0)) <= 0
        THEN 'RECEIVED'
        ELSE 'PENDING'
    END AS payment_status
FROM bookings b
LEFT JOIN booking_payments bp
    ON bp.booking_id = b.id
    AND bp.payment_status = 'paid'
LEFT JOIN booking_event_dates bed
    ON bed.booking_id = b.id
    WHERE b.created_by = 99
GROUP BY
    b.id,
    b.booking_code,
    b.created_at,
    bed.event_date,
    b.total_amount`,[userId]);
    return notifications;
       }



  
}
