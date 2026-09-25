import { Module } from '@nestjs/common';
import { MembershipService } from './membership.service';
import { CustomerMembershipController, VendorMembershipController } from './membership.controller';
import { TwilioModule } from '../../integrations/twilio/twilio.module';
// DataSource is injected from your existing TypeOrmModule.forRoot(...) — nothing else to register.
@Module({
  controllers: [VendorMembershipController, CustomerMembershipController],
  providers: [MembershipService],
  exports: [MembershipService],
   imports: [
    TwilioModule
   ]
})
export class MembershipModule {}
