import { Module } from '@nestjs/common';
import { VendorNotificationService } from './vendor_notification.service';
import { VendorNotificationController } from './vendor_notification.controller';

@Module({
  controllers: [VendorNotificationController],
  providers: [VendorNotificationService],
})
export class VendorNotificationModule {}
