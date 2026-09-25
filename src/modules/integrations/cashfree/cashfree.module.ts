import { Module } from '@nestjs/common';
import { CashfreeService } from './cashfree.service';
import { CashfreeController } from './cashfree.controller';
import { IntegSettingsModule } from '../integSettings/integSettings.module';
import { HttpModule } from '@nestjs/axios';

@Module({
   imports: [
    HttpModule,
    IntegSettingsModule,
  ],
  controllers: [CashfreeController], // <-- ADD THIS
  providers: [CashfreeService],
  exports: [CashfreeService],
})
export class CashfreeModule {}