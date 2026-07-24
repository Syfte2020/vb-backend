import { Module } from '@nestjs/common';
import { StripeService } from './Stripe.service';
import { StripeController } from './Stripe.controller';
import { IntegSettingsModule } from '../integSettings/integSettings.module';
import { HttpModule } from '@nestjs/axios';

@Module({
   imports: [
    HttpModule,
    IntegSettingsModule,
  ],
  controllers: [StripeController], // <-- ADD THIS
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}