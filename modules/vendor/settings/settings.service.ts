import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Not, IsNull } from 'typeorm';
import { StorageService } from 'src/common/storage/storage.service';

import { SettingGroup } from './entity/setting-group.entity';
import { Setting } from './entity/setting.entity';
import { VenueSetting } from './entity/venue-setting.entity';

import { SocketService } from '../../socket/socket.service';

//categoryRepository

@Injectable()
export class SettingsService {
  constructor(
    private dataSource: DataSource,
    private storageService: StorageService,
     private socketService: SocketService,
    @InjectRepository(SettingGroup)
      private readonly settingGroupRepository: Repository<SettingGroup>,
  ) {}

  async settings(user_id: any, id: any, category: any) {

    const singular = category.endsWith("s")
  ? category.slice(0, -1)
  : category;

const categories = await this.dataSource.query(
  `SELECT * FROM category WHERE name = ? `,
  [singular],
);

if (!categories.length) {
  return [];
}

const data = await this.settingGroupRepository.find({
  relations: {
    settings: true,
  },
  where: {
    status: true,
      settings: {
    category_id: categories[0].id
      }
  },
  order: {
    sort_order: "ASC",
    settings: {
      sort_order: "ASC",
    },
  },
});


return data;
   
  }
async saveSettingsAPI(user_id: number, body: any) {
  const { category_id, settings } = body;

  await this.dataSource.transaction(async (manager) => {

    // Remove old settings
    await manager.query(
      `
      DELETE FROM venue_booking_setting
      WHERE vendor_id = ?
      AND category_id = ?
      `,
      [user_id, 1],
    );

    if (!settings?.length) return;

    // Prepare values
    const values = settings.map((item) => [
      user_id,
      1,
      item.key,
      item.value, // stores true/false/string/number
    ]);

    // (?, ?, ?, ?), (?, ?, ?, ?)
    const placeholders = values
      .map(() => "(?, ?, ?, ?)")
      .join(",");

    await manager.query(
      `
      INSERT INTO venue_booking_setting
      (
        vendor_id,
        category_id,
        setting_key,
        setting_value
      )
      VALUES ${placeholders}
      `,
      values.flat(),
    );
  });

//Realtime
this.socketService.realtime(
  user_id.toString(),
  'Setting',
  `Setting Updated`
);


  return {
    success: true,
    message: "Settings saved successfully",
  };
}

async loadSettingsAPI(user_id: number, category_id: string) {

  const rows = await this.dataSource.query(
    `
    SELECT
      setting_key,
      setting_value
    FROM venue_booking_setting
    WHERE vendor_id = ?
    AND category_id = ?
    ORDER BY id
    `,
    [user_id, 1]
  );

  return {
    category_id,
    settings: rows.map((row) => ({
      key: row.setting_key,
      value: row.setting_value,
    })),
  };
}


}
