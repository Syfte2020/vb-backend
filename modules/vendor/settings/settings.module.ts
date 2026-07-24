import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

import { SettingGroup } from './entity/setting-group.entity';
import { Setting } from './entity/setting.entity';
import { VenueSetting } from './entity/venue-setting.entity';

import { SocketModule } from '../../socket/socket.module'

import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
    imports: [
      TypeOrmModule.forFeature([
        SettingGroup,
        VenueSetting,
        Setting
      ]),
      SocketModule
    ]
})
export class SettingsModule {}
