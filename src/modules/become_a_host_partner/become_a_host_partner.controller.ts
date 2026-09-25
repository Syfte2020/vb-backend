import { Body, Controller, Post, Get, Query, Req } from '@nestjs/common';
import { BecomeAHostPartnerService } from './become_a_host_partner.service';

import type { FastifyRequest } from 'fastify';
import { ActivityLoggerService } from '../../common/activity-logger.service';

@Controller('become-a-host-partner')
export class BecomeAHostPartnerController {
  constructor(
    private readonly hostService: BecomeAHostPartnerService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  // ================= HOSTING =================
  @Post('hosting')
  async register(@Req() req: FastifyRequest, @Body() dto: any) {
    const result = await this.hostService.registerProperty(dto);

    try {
      await this.activityLogger.log(
        {
          user_id: result?.venueId || null,
          action: 'HOSTING',
          module: 'BECOME A VENDOR',
          message: 'New Property',
          description: 'New Property registered successfully',
        },
        req,
      );
    } catch (err) {
      console.log('Hosting logging error:', err);
    }

    return result;
  }

  // ================= EMAIL CHECK =================
  @Post('email_checking')
  async email_checking(@Req() req: FastifyRequest, @Body() dto: any) {
    const result = await this.hostService.emailChecking(dto);

    try {
      await this.activityLogger.log(
        {
          user_id: result?.user?.id || null,
          action: 'EMAIL_CHECK',
          module: 'BECOME A VENDOR',
          message: 'Email checking',
          description: 'Email availability checked',
        },
        req,
      );
    } catch (err) {
      console.log('Email checking logging error:', err);
    }

    return result;
  }

  // ================= EMAIL VERIFY SEND =================
  @Post('email_verify')
  async email_verify(@Req() req: FastifyRequest, @Body() dto: any) {
    const result = await this.hostService.sendEmailVerification(dto);

    try {
      await this.activityLogger.log(
        {
          user_id: result?.user?.id || null,
          action: 'EMAIL_VERIFY_SEND',
          module: 'BECOME A VENDOR',
          message: 'Email verification sent',
          description: 'Verification email sent to user',
        },
        req,
      );
    } catch (err) {
      console.log('Email verify logging error:', err);
    }

    return result;
  }

  // ================= EMAIL VERIFIED =================
  @Get('email-verified')
  async verify_emailed(@Req() req: FastifyRequest, @Query('token') token: string) {
    const result = await this.hostService.verifyEmail(token);

    try {
      await this.activityLogger.log(
        {
          user_id: result?.user?.id || null,
          action: 'EMAIL_VERIFIED',
          module: 'BECOME A VENDOR',
          message: 'Email verified',
          description: 'User email verified successfully',
        },
        req,
      );
    } catch (err) {
      console.log('Email verified logging error:', err);
    }

    return result;
  }

  // ================= PHONE CHECK =================
  @Post('phone_checking')
  async phone_checking(@Req() req: FastifyRequest, @Body() dto: any) {
    const result = await this.hostService.phoneChecking(dto);

    try {
      await this.activityLogger.log(
        {
          user_id: result?.user?.id || null,
          action: 'PHONE_CHECK',
          module: 'BECOME A VENDOR',
          message: 'Phone checking',
          description: 'Phone number availability checked',
        },
        req,
      );
    } catch (err) {
      console.log('Phone checking logging error:', err);
    }

    return result;
  }

  // ================= BECOME VENDOR =================
  @Post('become_a_vendor')
  async become_a_vendor(@Req() req: FastifyRequest, @Body() dto: any) {
    const result = await this.hostService.becomeVendor(dto);

    try {
      await this.activityLogger.log(
        {
          user_id: result?.userId || null,
          action: 'BECOME_VENDOR',
          module: 'BECOME A VENDOR',
          message: 'Vendor registration',
          description: 'User became a vendor successfully',
        },
        req,
      );
    } catch (err) {
      console.log('Become vendor logging error:', err);
    }

    return result;
  }
}