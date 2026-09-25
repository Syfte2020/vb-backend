import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RecurringMandate } from './entities/recurring-mandate.entity';
import { RecurringMandateTransaction } from './entities/recurring-mandate-transaction.entity';
import { RazorpayWebhookEvent } from './entities/razorpay-webhook-event.entity';

import { RazorpayApiClient } from './razorpay-api.client';
import { RazorpayService } from './razorpay.service';
import { RazorpayController } from './razorpay.controller';
import { RazorpayWebhookController } from './razorpay-webhook.controller';

import { ZohoModule } from '../../integrations/zoho/zoho.module';

// ADJUST THIS IMPORT to wherever your real IntegrationModule/IntegrationService
// lives (it must export IntegrationService — see the matching placeholder
// comment in razorpay-api.client.ts). RazorpayApiClient now injects
// IntegrationService directly to load Razorpay key_id/key_secret/webhook_secret
// from the DB, so this module needs it available in its DI scope one of two
// ways:
//   (a) IntegrationService is provided by a global module (e.g. registered
//       with `@Global()` in AppModule) — in that case you can DELETE this
//       import and the `imports: [IntegrationModule]` line below; Nest will
//       resolve it globally.
//   (b) IntegrationService lives in a regular (non-global) feature module —
//       in that case keep this import and make sure that module `exports`
//       IntegrationService.
import { IntegSettingsModule } from '../integSettings/integSettings.module';

@Module({
  imports: [
    ConfigModule,
    IntegSettingsModule,
    ZohoModule,
    TypeOrmModule.forFeature([
      RecurringMandate,
      RecurringMandateTransaction,
      RazorpayWebhookEvent,
    ]),
  ],
  controllers: [RazorpayController, RazorpayWebhookController],
  providers: [RazorpayApiClient, RazorpayService],
  exports: [RazorpayService],
})
export class PaymentsModule {}
