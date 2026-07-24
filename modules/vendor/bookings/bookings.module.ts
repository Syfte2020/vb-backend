import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

import { SettingGroup } from './entity/setting-group.entity';
import { Setting } from './entity/setting.entity';
import { VenueSetting } from './entity/venue-setting.entity';
import { PackageCategory } from '../../vendor/packages/entity/package-category.entity'; //entity/package-category.entity
import { TypeOrmModule } from "@nestjs/typeorm";
import { SocketModule } from '../../socket/socket.module'
import { InvoiceModule } from '../../invoice/invoice.module'
import { NotificationModule } from '../../../notifications/notification.module'



@Module({
  controllers: [BookingsController],
  providers: [BookingsService],
    imports: [
      TypeOrmModule.forFeature([
        SettingGroup,
        VenueSetting,
        PackageCategory,
        Setting
      ]),
      SocketModule,
      InvoiceModule,
      NotificationModule
    ]
})
export class BookingsModule {}
