import {
  Injectable,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { MailService } from '../../mail/mail.service';
import { emailVerifyTemplate } from '../../common/email/templates/email-verify.template';
import { v4 as uuidv4 } from 'uuid';
import { JwtService } from '@nestjs/jwt';
import { promises as fs } from 'fs';
import * as path from 'path';

@Injectable()
export class BecomeAHostPartnerService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
  ) {}

  // =========================
  // ✅ REGISTER PROPERTY
  // =========================
  async registerProperty(dto: any) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const venueResult = await manager.query(
          `INSERT INTO unrigistered_venues 
          (name,address,city,district,state,phone_number,country,place_id,map_url,contact_person,rating,user_ratings_total,Status,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
          [
            dto.name,
            dto.address,
            dto.city,
            dto.district,
            dto.state,
            dto.phone_number,
            dto.country,
            dto.place_id,
            dto.map_url ?? null,
            dto.contact_person ?? null,
            dto.rating ?? 0,
            dto.user_ratings_total ?? 0,
            dto.Status ?? 0,
          ],
        );

        const venueId = venueResult.insertId;

        await this.bulkInsert(
          manager,
          'unrigistered_gallery',
          ['unreg_id', 'images'],
          dto.gallery?.map((img) => [venueId, img]),
        );

        await this.bulkInsert(
          manager,
          'unrigistered_types',
          ['unreg_id', 'types_id'],
          dto.types?.map((t) => [venueId, t]),
        );

        await this.bulkInsert(
          manager,
          'unrigistered_event_types',
          ['unreg_id', 'event_id'],
          dto.event_tags?.map((t) => [venueId, t]),
        );

        return { success: true, venueId };
      });
    } catch (error) {
      console.error('REGISTER PROPERTY ERROR:', error);

      throw new InternalServerErrorException('Internal server error');
    }
  }

  // =========================
  // ✅ COMMON BULK INSERT
  // =========================
  private async bulkInsert(manager, table, columns, values) {
    if (!values?.length) return;

    const query = `INSERT INTO ${table} (${columns.join(',')}) VALUES ?`;
    await manager.query(query, [values]);
  }

  // =========================
  // ✅ EMAIL CHECK
  // =========================
  async emailChecking(email: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM users WHERE email = ?`,
      [email],
    );

    if (rows.length) {
      throw new ConflictException('Email already exists');
    }

    return { success: true , user: rows[0]};
  }

  // =========================
  // ✅ EMAIL VERIFY SEND
  // =========================
  async sendEmailVerification(dto: any) {
    if (!dto.email) throw new BadRequestException('Email required');

    const token = this.jwtService.sign(
      { email: dto.email },
      { expiresIn: '15m' },
    );

    const verifyLink = `${process.env.FRONTEND_URL}/email-verified?token=${token}`;

    await this.dataSource.query(
      `UPDATE unrigistered_venues 
       SET email_address=?, email_verified_url=?, email_link_sent=NOW()
       WHERE place_id=?`,
      [dto.email, verifyLink, dto.place_id],
    );

    const rows = await this.dataSource.query(
      `SELECT id FROM users WHERE email = ?`,
      [dto.email],
    );

    const html = emailVerifyTemplate(dto.name, verifyLink);
    await this.mailService.sendMail(dto.email, 'Verify Email', html);

    return { success: true  , user : rows[0] };
  }

  // =========================
  // ✅ VERIFY EMAIL
  // =========================
  async verifyEmail(token: string) {
    try {
      const { email } = this.jwtService.verify(token);

      await this.dataSource.query(
        `UPDATE unrigistered_venues SET email_verified=1 WHERE email_address=?`,
        [email],
      );

       const rows = await this.dataSource.query(
      `SELECT id FROM users WHERE email = ?`,
      [email],
    );

      return { success: true ,user : rows[0] };
    } catch {
      throw new BadRequestException('Invalid or expired token');
    }
  }
  // =========================
  // ✅ PHONE VERIFY
  // =========================
  async phoneChecking(dto) {
    const rows = await this.dataSource.query(
      `SELECT * FROM users WHERE phone = ?`,
      [dto.phone],
    );

    if (rows?.length) {
      throw new ConflictException('Phone already exists');
    } else {
      return {
        success: true,
        status: 200,
        user : rows[0]
      };
    }
  }

  // =========================
  // ✅ BECOME VENDOR
  // =========================
  async becomeVendor(dto: any) {
    const vendorId = await this.generateVendorId();

    const [user] = await this.dataSource.query(
      `SELECT id FROM users WHERE email=?`,
      [dto.email],
    );

    const [venue] = await this.dataSource.query(
      `SELECT * FROM unrigistered_venues WHERE place_id=?`,
      [dto.place_id],
    );

    if (!venue) throw new BadRequestException('Venue not found');

    let userId;

    if (user) {
      userId = user.id;

      await this.dataSource.query(
        `UPDATE users SET vendor_id=?, role_id=1 WHERE id=?`,
        [vendorId, userId],
      );
    } else {
      const password = await bcrypt.hash('Admin@123', 10);

      const result = await this.dataSource.query(
        `INSERT INTO users (name,email,password,vendor_id,role_id)
         VALUES (?,?,?,?,1)`,
        [dto.name, dto.email, password, vendorId],
      );

      userId = result.insertId;
    }

    await this.createVenueParent(userId, venue);
    // await this.loadAmenities(vendorId);

    return { success: true, vendorId ,userId };
  }

  // =========================
  // ✅ CREATE VENUE PARENT
  // =========================
  private async createVenueParent(userId: number, venue: any) {
    const geometry =
      typeof venue.geometry === 'string'
        ? JSON.parse(venue.geometry)
        : venue.geometry;

    await this.dataSource.query(
      `INSERT INTO venue_parent 
      (parent_venue_id, created_by, venue_name, venue_address, venue_city, venue_state, venue_country, lat, lng , )
      VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        uuidv4(),
        userId,
        venue.name,
        venue.address,
        venue.city,
        venue.state,
        venue.country,
        geometry?.lat,
        geometry?.lng,
      ],
    );
  }

  // =========================
  // ✅ LOAD JSON AMENITIES
  // =========================
  // private async loadAmenities(vendorId: string) {
  //   try {
  //     const filePath = path.join(
  //       process.cwd(),
  //       '/data/amenities/fixed_amenities.json', // ✅ PROD SAFE
  //     );

  //     const json = await fs.readFile(filePath, 'utf-8');
  //     const data = JSON.parse(json);

  //     for (const item of data) {
  //       const categoryId = await this.getOrCreateCategory(
  //         item.Category,
  //         vendorId,
  //       );

  //       for (const child of item.children || []) {
  //         await this.createAmenity(child.name, categoryId, vendorId);
  //       }
  //     }
  //   } catch (err) {
  //     throw new InternalServerErrorException('Amenities load failed');
  //   }
  // }

  private async getOrCreateCategory(category: string, vendorId: string) {
    const [row] = await this.dataSource.query(
      `SELECT id FROM amenities_categories WHERE category=? AND vendor_id=?`,
      [category, vendorId],
    );

    if (row) return row.id;

    const id = uuidv4();

    await this.dataSource.query(
      `INSERT INTO amenities_categories (id,category,vendor_id)
       VALUES (?,?,?)`,
      [id, category, vendorId],
    );

    return id;
  }

  private async createAmenity(
    name: string,
    categoryId: string,
    vendorId: string,
  ) {
    const [exists] = await this.dataSource.query(
      `SELECT id FROM amenities WHERE name=? AND created_by=?`,
      [name, vendorId],
    );

    if (!exists) {
      await this.dataSource.query(
        `INSERT INTO amenities (id,amenities_category_id,name,created_by)
         VALUES (?,?,?,?)`,
        [uuidv4(), categoryId, name, vendorId],
      );
    }
  }

  // =========================
  // ✅ GENERATE VENDOR ID
  // =========================
  private async generateVendorId() {
    const [row] = await this.dataSource.query(
      `SELECT vendor_id FROM users WHERE vendor_id IS NOT NULL ORDER BY id DESC LIMIT 1`,
    );

    const next = row ? parseInt(row.vendor_id.replace('V', '')) + 1 : 1;

    return `V${next.toString().padStart(5, '0')}`;
  }
}
