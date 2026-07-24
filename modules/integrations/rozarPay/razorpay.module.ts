import { Module } from '@nestjs/common';
import { RazorpayService } from './razorpay.service';
import { RazorpayController } from './razorpay.controller';
import { IntegSettingsModule } from '../integSettings/integSettings.module';
import { HttpModule } from '@nestjs/axios';

import { SocketModule } from '../../socket/socket.module'
import { InvoiceModule } from '../../invoice/invoice.module'
import { NotificationModule } from '../../../notifications/notification.module'

@Module({
   imports: [
    HttpModule,
    IntegSettingsModule,
    SocketModule,
    InvoiceModule,
    NotificationModule
  ],
  controllers: [RazorpayController], // <-- ADD THIS
  providers: [RazorpayService],
  exports: [RazorpayService],
})
export class RazorpayModule {}