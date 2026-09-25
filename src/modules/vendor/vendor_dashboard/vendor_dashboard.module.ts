import { Module } from '@nestjs/common';
import { VendorDashboardService } from './vendor_dashboard.service';
import { VendorDashboardController } from './vendor_dashboard.controller';

@Module({
  controllers: [VendorDashboardController],
  providers: [VendorDashboardService],
})
export class VendorDashboardModule {}
