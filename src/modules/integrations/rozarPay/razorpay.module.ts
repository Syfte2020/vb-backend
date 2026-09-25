import { Module } from '@nestjs/common';
import { RazorpayService } from './razorpay.service';
import { RazorpayController } from './razorpay.controller';
import { IntegSettingsModule } from '../integSettings/integSettings.module';
import { HttpModule } from '@nestjs/axios';

import { SocketModule } from '../../socket/socket.module'
import { InvoiceModule } from '../../invoice/invoice.module'
import { NotificationModule } from '../../../notifications/notification.module'
import { ZohoModule } from '../../integrations/zoho/zoho.module';
import { TwilioModule } from '../../integrations/twilio/twilio.module';
import { RazorpayCronService } from './razorpay-cron.service';

@Module({
   imports: [
    TwilioModule,
    ZohoModule,
    HttpModule,
    IntegSettingsModule,
    SocketModule,
    InvoiceModule,
    NotificationModule
  ],
  controllers: [RazorpayController], // <-- ADD THIS
  // providers: [RazorpayService],
  providers: [
    RazorpayService,
    RazorpayCronService,
  ],
  exports: [RazorpayService],
})
export class RazorpayModule {}