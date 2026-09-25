import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BecomeAHostPartnerController } from './become_a_host_partner.controller';
import { BecomeAHostPartnerService } from './become_a_host_partner.service';
import { MailModule } from '../../mail/mail.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    MailModule,
    CommonModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secretKey',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [BecomeAHostPartnerController],
  providers: [BecomeAHostPartnerService],
})
export class BecomeAHostPartnerModule {}