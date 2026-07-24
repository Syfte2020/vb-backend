import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

@Injectable()
export class PropertyService {
  constructor(private readonly dataSource: DataSource) {}

  async createChildVenue(dto: any) {
    return await this.dataSource.transaction(async (manager) => {
      const row = await this.dataSource.query(
        `SELECT * from users WHERE id = ? `,
        [dto.created_by],
      );

      const childId = dto.id || uuidv4();

      const category = dto.category || [];

      // ============================
      // ✅ INSERT / UPDATE
      // ============================
      if (!dto.id) {
        await manager.query(
          `INSERT INTO venue_child 
          (child_venue_id,parent_venue_id,child_auto_no,venue_category_id,created_by,child_venue_name,guest_rooms,more_info)
          VALUES (?,?,?,?,?,?,?,?)`,
          [
            childId,
            dto.parent_venue_id,
            `C-${Math.floor(1000 + Math.random() * 9000)}`,
            category?.[0] || null,
            dto.created_by,
            dto.name,
            dto.capacity,
            dto.description,
          ],
        );
      } else {
        await manager.query(
          `UPDATE venue_child SET 
          venue_category_id=?, child_venue_name=?, guest_rooms=?, more_info=? 
          WHERE child_venue_id=?`,
          [
            category?.[0] || null,
            dto.name,
            dto.capacity,
            dto.description,
            childId,
          ],
        );
      }

      // ============================
      // ✅ VENUE TAGS
      // ============================
      const tags = dto.venue_tag || [];

      await manager.query(`DELETE FROM venue_tags WHERE child_venue_id=?`, [
        childId,
      ]);

      for (const tag of tags) {
        await manager.query(
          `INSERT INTO venue_tags (child_venue_id, venue_cat_id)
           VALUES (?, ? )`,
          [childId, tag],
        );
      }

      // ============================
      // ✅ EVENT TAGS
      // ============================
      const eventTags = dto.category || [];

      await manager.query(
        `DELETE FROM venue_event_tags WHERE child_venue_id=?`,
        [childId],
      );

      for (const tag of eventTags) {
        await manager.query(
          `INSERT INTO venue_event_tags ( child_venue_id, event_id)
           VALUES (?, ? )`,
          [childId, tag],
        );
      }

      // ============================
      // ✅ AMENITIES (NO JSON.parse)
      // ============================
      const amenities = dto.amenities || [];

      for (const amenity of amenities) {
        await manager.query(
          `INSERT INTO venue_child_amenities ( amenities_id, child_venue_id, created_by)
           VALUES ( ?, ?, ?)
           ON DUPLICATE KEY UPDATE updated_at = NOW()`,
          [amenity, childId, dto.created_by],
        );
      }

      if (amenities.length) {
        await manager.query(
          `DELETE FROM venue_child_amenities 
           WHERE child_venue_id = ? 
           AND amenities_id NOT IN (${amenities.map(() => '?').join(',')})`,
          [childId, ...amenities],
        );
      }

      // ============================
      // ✅ GALLERY CATEGORY
      // ============================
      const [gallery] = await manager.query(
        `SELECT id FROM venue_gallery_category 
         WHERE name='Additional images' AND vendor_id=? AND child_id=?`,
        [dto.created_by, childId],
      );

      let galleryId = gallery?.id;

      if (!galleryId) {
        const result = await manager.query(
          `INSERT INTO venue_gallery_category 
           (name,vendor_id,child_id,created_by,created_at)
           VALUES ('Additional images',?,?,?,NOW())`,
          [dto.created_by, childId, dto.created_by],
        );
        galleryId = result.insertId;
      }

      // ============================
      // ✅ REMOTE PHOTOS
      // ============================
      const photos = dto.photos || [];

      for (const photo of photos) {
        const response = await axios.get(photo, {
          responseType: 'arraybuffer',
        });

        const ext = photo.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}_${Math.random()}.${ext}`;

        const folder = `Gallery/venue_images/parent_${dto.parent_venue_id}/child_${childId}`;
        const savePath = path.join(process.cwd(), 'data', folder);

        if (!fs.existsSync(savePath)) {
          fs.mkdirSync(savePath, { recursive: true });
        }

        fs.writeFileSync(path.join(savePath, fileName), response.data);

        await manager.query(
          `INSERT INTO venue_gallery 
           (child_venue_id,attachment,g_category,image_type,file_extension)
           VALUES (?,?,?,?,?)`,
          [childId, fileName, galleryId, 3, ext],
        );
      }

      // ============================
      // ✅ SHIFTS
      // ============================
      const shiftMap = this.getShiftMap();
      const shifts = dto.shifts || [];

      for (const key of Object.keys(shiftMap)) {
        const shift = shiftMap[key];
        const isSelected = shifts.includes(key);

        await manager.query(
          `INSERT INTO venue_shift_header 
           (name,custom_name,Shift_type,child_id,from_time,to_time,publish)
           VALUES (?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE publish=?`,
          [
            shift.name,
            shift.name + ' Shift',
            shift.name == 'Morning' ? 1 : shift.name == 'Afternoon' ? 2 : 3,
            childId,
            shift.from_time,
            shift.to_time,
            isSelected ? 1 : 0,
            isSelected ? 1 : 0,
          ],
        );
      }

      // ============================
      // ✅ PRICING
      // ============================
      const pricing = dto.pricing || {};

      for (const key of Object.keys(shiftMap)) {
        const shift = shiftMap[key];
        const price = pricing[key] || 0;

        await manager.query(
          `INSERT INTO venue_shift_timing 
           (child_venue_id,shift_type,from_time,to_time,price)
           VALUES (?,?,?,?,?)
           ON DUPLICATE KEY UPDATE price=?`,
          [childId, key, shift.from_time, shift.to_time, price, price],
        );
      }

      return {
        success: true,
        child_venue_id: childId,
        user: row[0],
      };
    });
  }

  private getShiftMap() {
    return {
      1: { name: 'Morning', from_time: '06:00', to_time: '12:00' },
      2: { name: 'Afternoon', from_time: '12:00', to_time: '18:00' },
      3: { name: 'Evening', from_time: '18:00', to_time: '23:59' },
    };
  }

  async list_property(dto: any) {
    const page = dto.page || 1;
    const limit = dto.limit || 10;
    const offset = (page - 1) * limit;

    if (!dto.parent_venue_id) {
      throw new BadRequestException('parent_venue_id is required');
    }

    const rows = await this.dataSource.query(
      `SELECT 
      vc.child_venue_id,
      vc.child_venue_name,
      vc.guest_rooms,
      vc.more_info,
      vc.created_at,

      -- ✅ amenities
      IFNULL((
        SELECT JSON_ARRAYAGG(a.name)
        FROM venue_child_amenities vca
        LEFT JOIN amenities a ON a.id = vca.amenities_id
        WHERE vca.child_venue_id = vc.child_venue_id
      ), JSON_ARRAY()) AS amenities,

      -- ✅ event tags
      IFNULL((
        SELECT JSON_ARRAYAGG(event_id)
        FROM venue_event_tags vet
        WHERE vet.child_venue_id = vc.child_venue_id
      ), JSON_ARRAY()) AS event_tags

    FROM venue_child vc
    WHERE vc.parent_venue_id = ?
    ORDER BY vc.created_at DESC
    LIMIT ? OFFSET ?`,
      [dto.parent_venue_id, limit, offset],
    );

    const count = await this.dataSource.query(
      `SELECT COUNT(*) as total 
     FROM venue_child 
     WHERE parent_venue_id = ?`,
      [dto.parent_venue_id],
    );

    return {
      success: true,
      page,
      limit,
      total: count[0].total,
      data: rows,
    };
  }

  async list_delete(id: string) {
    this.dataSource.query(`DELETE FROM venue_child WHERE child_venue_id = ?`, [
      id,
    ]);
    const row = await this.dataSource.query(
      `SELECT * from users WHERE id = ? `,
      [1],
    );

    return {
      success: true,
      user: row[0],
    };
  }
}
