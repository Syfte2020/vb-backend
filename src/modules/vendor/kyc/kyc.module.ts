import { Module } from '@nestjs/common';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { NotificationModule } from '../../../notifications/notification.module'

@Module({
  controllers: [KycController],
  providers: [KycService],
   imports: [
        NotificationModule
      ]
})
export class KycModule {}
