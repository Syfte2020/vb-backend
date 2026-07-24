import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import axios from 'axios';

import { MailService } from '../../mail/mail.service';
import { ActivityLoggerService } from '../../common/activity-logger.service';
import { emailVerifyTemplate } from '../../common/email/templates/email-verify.template';

import { OAuth2Client } from 'google-auth-library';
import { SocketService } from '../socket/socket.service';


const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

@Injectable()
export class AuthService {
  constructor(
    private dataSource: DataSource,
    private readonly jwtService: JwtService,
    private mailService: MailService,
    private activityLogger: ActivityLoggerService,
    private socketService: SocketService
  ) {}

  // ✅ REGISTER
  async register(dto,country_id) {
    if (!dto?.email || !dto?.password) {
      throw new BadRequestException(
        'Username, email and password are required',
      );
    }

    const rows = await this.dataSource.query(
      `SELECT id FROM users WHERE email = ?`,
      [dto.email],
    );

    if (rows?.length) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const result = await this.dataSource.query(
      `INSERT INTO users (name, email, password,country)
     VALUES (?, ?, ? , ?)`,
      [dto.name, dto.email, hashedPassword,country_id],
    );

    // Role Created
    await this.dataSource.query(
      `INSERT INTO user_roles (user_id, role_id)
     VALUES (?, ? )`,
      [result.insertId, 3],
    );
    

    return {
      success: true,
      userId: result.insertId,
    };
  }

  // ✅ LOGIN
  async login(dto) {
    const users = await this.dataSource.query(
      // `SELECT * FROM users WHERE email = ?`,
      `SELECT users.* FROM users LEFT JOIN user_roles ON user_roles.user_id = users.id WHERE email = ? AND user_roles.role_id = 3`,
      [dto.email],
    );

    const user = users[0];

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

  await this.dataSource.query(
    `
    UPDATE users
    SET
      is_online = 1,
      last_login = NOW(),
      last_seen = NOW()
    WHERE id = ?
    `,
    [user.id],
  );
 this.socketService.online(user.id); //socket

    const token = this.jwtService.sign({
      id: user.id,
    });

    return {
      token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

  async forgot_password(dto, otp: string) {
    if (!dto?.email) {
      throw new BadRequestException('Email are required');
    }

    const rows = await this.dataSource.query(
      `SELECT id FROM users WHERE email = ?`,
      [dto.email],
    );

    if (rows?.length == 0) {
      throw new ConflictException('Email Not Registered');
    }
    const hash = await bcrypt.hash(otp, 10);

    //`user_id`, `otp`, `expires_at`, `attempts`, `created_at` FROM `user_otps`
    const expire = new Date(Date.now() + 5 * 60 * 1000);
    const now = new Date();
    const result = await this.dataSource.query(
      `INSERT INTO user_otps (identifier, otp, expires_at, attempts,created_at)
     VALUES (?, ?, ?, ? , ? )`,
      [dto.email, hash, expire, 0, now],
    );
    const verifyLink = otp;
    const html = emailVerifyTemplate(verifyLink, dto.email);

    await this.mailService.sendMail(dto.email, 'Reset Your password', html);

    return {
      success: true,
      message: 'Password link send to mail',
    };
  }

  async update_password(dto) {
    const { email, otp, password } = dto;

    // 1. Get user
    const users = await this.dataSource.query(
      `SELECT * FROM users WHERE email = ?`,
      [email],
    );

    const user = users[0];

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // 2. Validate OTP
    if (!user.otp || user.otp !== otp) {
      throw new BadRequestException('Invalid OTP');
    }

    // 3. Check expiry
    if (new Date() > new Date(user.otp_expiry)) {
      throw new BadRequestException('OTP expired');
    }

    // 4. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Update password + clear OTP
    await this.dataSource.query(
      `UPDATE users 
     SET password = ?, otp = NULL, otp_expiry = NULL 
     WHERE email = ?`,
      [hashedPassword, email],
    );
    const rows = await this.dataSource.query(
      `SELECT id FROM users WHERE email = ?`,
      [email],
    );

    return {
      user: rows[0],
      success: true,
      message: 'Password updated successfully',
    };
  }
  async auto_login(dto) {
    const users = await this.dataSource.query(
      // `SELECT * FROM users WHERE id = ?`,
      `SELECT * FROM users LEFT JOIN user_roles ON user_roles.user_id = users.id WHERE id = ? AND user_roles.role_id = 3`,
      [dto.id],
    );

    const user = users[0];

    if (!user) {
      throw new UnauthorizedException('User not found');
    }
  await this.dataSource.query(
    `
    UPDATE users
    SET
      is_online = 1,
      last_login = NOW(),
      last_seen = NOW()
    WHERE id = ?
    `,
    [user.id],
  );
    const token = this.jwtService.sign({
      id: user.id,
    });

    return {
      token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

  async googleLogin(data: any) {
  try {
    const token = data.token;

    // ==============================
    // 1. VERIFY GOOGLE TOKEN
    // ==============================
    const googleRes = await axios.get(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const googleUser = googleRes.data;

    if (!googleUser?.email) {
      throw new Error('Google email not found');
    }

    // ==============================
    // 2. CHECK USER EXISTS
    // ==============================
    const existingUsers = await this.dataSource.query(
      `
      SELECT users.*, user_roles.role_id
      FROM users
      LEFT JOIN user_roles 
        ON user_roles.user_id = users.id
      WHERE users.email = ?
      LIMIT 1
      `,
      [googleUser.email],
    );

    let user: any;
    let isNewUser = false;

    // ==============================
    // 3. REGISTER NEW USER
    // ==============================
    if (existingUsers.length === 0) {
      isNewUser = true;

      const insertResult = await this.dataSource.query(
        `
        INSERT INTO users (
          name,
          email,
          logo,
          is_online,
          last_login,
          last_seen
        )
        VALUES (?, ?, ?, ?, NOW(), NOW())
        `,
        [
          googleUser.name || '',
          googleUser.email,
          googleUser.picture || '',
          1,
        ],
      );

      const userId = insertResult.insertId;

      // DEFAULT ROLE = CUSTOMER
      await this.dataSource.query(
        `
        INSERT INTO user_roles (user_id, role_id)
        VALUES (?, ?)
        `,
        [userId, 3],
      );

      // FETCH CREATED USER
      const newUser = await this.dataSource.query(
        `
        SELECT users.*, user_roles.role_id
        FROM users
        LEFT JOIN user_roles 
          ON user_roles.user_id = users.id
        WHERE users.id = ?
        LIMIT 1
        `,
        [userId],
      );

      user = newUser[0];
    } else {
      // ==============================
      // 4. EXISTING USER LOGIN
      // ==============================
      user = existingUsers[0];

      await this.dataSource.query(
        `
        UPDATE users
        SET
          is_online = 1,
          last_login = NOW(),
          last_seen = NOW()
        WHERE id = ?
        `,
        [user.id],
      );
    }

    // ==============================
    // 5. SOCKET ONLINE STATUS
    // ==============================
    this.socketService.online(user.id);

    // ==============================
    // 6. GENERATE JWT TOKEN
    // ==============================
    const jwtToken = this.jwtService.sign({
      id: user.id,
      email: user.email,
    });

    // ==============================
    // 7. RETURN RESPONSE
    // ==============================
    return {
      success: true,
      message: isNewUser
        ? 'Registration successful'
        : 'Login successful',

      isNewUser,

      token: jwtToken,

      user,
    };
  } catch (error) {
    console.error('GOOGLE LOGIN ERROR:', error);

    throw new HttpException(
      error || 'Google login failed',
      HttpStatus.BAD_REQUEST,
    );
  }
}

  // async findById(id: string) {
  //   const newUser = await this.dataSource.query(
  //     `SELECT * FROM users WHERE id = ? `,
  //     [id],
  //   );

  //   return newUser[0];
  // }
//  async findById(id: string) {
//   const user = await this.dataSource.query(
//     `
//     SELECT
//       u.id,
//       u.name,
//       u.email,

//       EXISTS (
//         SELECT 1
//         FROM user_roles ur
//         WHERE ur.user_id = u.id
//           AND ur.role_id = 2
//       ) AS is_vendor,

//       EXISTS (
//         SELECT 1
//         FROM venue_parent vp
//         WHERE vp.created_by = u.id
//       ) AS is_parent
       
//       EXISTS (
//         SELECT 1
//         FROM user_subscriptions us
//         WHERE us.user_id = u.id
//       ) AS subscribe_status

//     FROM users u
//     WHERE u.id = ?
//     LIMIT 1
//     `,
//     [id],
//   );

//   return user[0];
// }
async findById(id: string) {
  const [user] = await this.dataSource.query(
    `
    SELECT
      u.id,
      u.name,
      u.email,

      EXISTS (
        SELECT 1
        FROM user_roles ur
        WHERE ur.user_id = u.id
          AND ur.role_id = 2
      ) AS is_vendor,

      EXISTS (
        SELECT 1
        FROM venue_parent vp
        WHERE vp.created_by = u.id
      ) AS is_parent,

      CASE
        WHEN us.id IS NOT NULL THEN 1
        ELSE 0
      END AS subscribe_status,

      us.status,
      us.plan_id,
      us.end_date,
      us.next_billing_date,

      p.plan_name,
      p.plan_title,
      p.min_venue,
      p.max_venue

    FROM users u

    LEFT JOIN (
      SELECT
        user_id,
        id,
        status,
        plan_id,
        end_date,
        next_billing_date
      FROM user_subscriptions
      WHERE status = 1
    ) us ON us.user_id = u.id

    LEFT JOIN plans p ON p.id = us.plan_id

    WHERE u.id = ?
    LIMIT 1
    `,
    [id],
  );

  if (user) {
    if (user.max_venue === 1) {
      user.plan_category = 'starter';
    } else if (user.max_venue >= 2 && user.max_venue <= 4) {
      user.plan_category = 'professional';
    } else if (user.max_venue >= 5) {
      user.plan_category = 'business';
    } else {
      user.plan_category = null;
    }
    if(user.plan_title==1) {
      user.plan_type = 'Monthly';
    }
    else{
      user.plan_type = 'Yearly';
    }
  }

  return user;
}
  async send_otp(identifier: string, otp: string) {
    const hash = await bcrypt.hash(otp, 10);

    //`user_id`, `otp`, `expires_at`, `attempts`, `created_at` FROM `user_otps`
    const expire = new Date(Date.now() + 5 * 60 * 1000);
    const now = new Date();
    const result = await this.dataSource.query(
      `INSERT INTO user_otps (identifier, otp, expires_at, attempts,created_at)
     VALUES (?, ?, ?, ? , ? )`,
      [identifier, hash, expire, 0, now],
    );
  }

  async verifyOtp(identifier: string, otp: string) {
    const records = await this.dataSource.query(
      `SELECT * FROM user_otps WHERE identifier = ? ORDER BY id DESC LIMIT 1`,
      [identifier],
    );

    if (!records || records.length === 0) {
      throw new Error('OTP not found');
    }

    const record = records[0];

    // ✅ Validate input
    if (!otp) {
      throw new Error('OTP is required');
    }

    if (!record.otp) {
      throw new Error('Stored OTP hash missing');
    }

    // ✅ Expiry check
    if (new Date(record.expires_at) < new Date()) {
      throw new Error('OTP expired');
    }

    // ✅ Attempts check
    if (record.attempts >= 5) {
      throw new Error('Too many attempts');
    }

    // ✅ Compare OTP
    const isValid = await bcrypt.compare(String(otp), String(record.otp));

    if (!isValid) {
      await this.dataSource.query(
        `UPDATE user_otps SET attempts = attempts + 1 WHERE id = ?`,
        [record.id],
      );

      throw new Error('Invalid OTP');
    }

    // ✅ Delete OTP after success
    await this.dataSource.query(`DELETE FROM user_otps WHERE id = ?`, [
      record.id,
    ]);

    // ✅ Get user
    let users = await this.dataSource.query(
      //`SELECT id, name, email FROM users WHERE phone = ? LIMIT 1`,
      `SELECT * FROM users LEFT JOIN user_roles ON user_roles.user_id = users.id WHERE phone = ? AND user_roles.role_id = 3`,
      [identifier],
    );

    let user;

    if (!users || users.length === 0) {
      // ✅ Create user
      const insertResult = await this.dataSource.query(
        `INSERT INTO users (name, email, phone)
       VALUES (?, ?, ?)`,
        [null, null, identifier],
      );

      // Role Created
      await this.dataSource.query(
        `INSERT INTO user_roles (user_id, role_id)
     VALUES (?, ? )`,
        [insertResult.insertId, 3],
      );

      user = {
        id: insertResult.insertId,
        name: null,
        email: null,
      };
    } else {
      user = users[0];
    }

    // ✅ JWT (minimal payload recommended)
    const jwtToken = this.jwtService.sign({
      id: user.id,
    });

    return {
      message: 'OTP verified',
      token: jwtToken,
      user,
    };
  }

  async logout(userId: number) {
    console.log(userId)
  await this.dataSource.query(
    `
    UPDATE users
    SET
      is_online = 0,
      last_logout = NOW()
    WHERE id = ?
    `,
    [userId],
  );

  return {
    message: 'Logged out',
  };
}
}
