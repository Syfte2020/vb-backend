import { Module } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { CheckoutController } from './checkout.controller';

@Module({
  providers: [CheckoutService],
  exports: [CheckoutService],
   controllers: [CheckoutController],
})
export class CheckoutModule {}