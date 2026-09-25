import { Module } from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { NotificationModule } from '../../notifications/notification.module'
import { TwilioModule } from '../integrations/twilio/twilio.module';

@Module({
   imports: [
      NotificationModule,
      TwilioModule
    
      ],
  providers: [AccountService],
  exports: [AccountService],
  controllers: [AccountController],
})
export class AccountModule {}

