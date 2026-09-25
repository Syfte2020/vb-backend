import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  Get,
  Headers,
} from '@nestjs/common';

import { PermissionsGuard } from '../../common/access/permissions.guard';
import { Permissions } from '../../common/access/permissions.decorator';
import { PERMISSIONS, getOwnerId } from '../../common/access/permissions';



import type { FastifyRequest } from 'fastify';

import { AuthService } from './auth.service';
import { ActivityLoggerService } from '../../common/activity-logger.service';

import { JwtAuthGuard } from './strategies/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  // ============================================================
  // REGISTER
  // ============================================================

  @Post('register')
  async register(
    @Req() req: FastifyRequest,
    @Body() dto: any,
    @Headers('x-country') country_id: number,
  ) {
    const result = await this.authService.register(dto, country_id);

    try {
      await this.activityLogger.log(
        {
          user_id: result?.userId || null,

          action: 'REGISTER',

          module: 'AUTH',

          message: 'User registered',

          description: 'New user registered successfully',
        },
        req,
      );
    } catch (err) {
      console.error('Register logging error:', err);
    }

    return result;
  }

  // ============================================================
  // LOGIN
  // ============================================================

  @Post('login')
  async login(@Req() req: FastifyRequest, @Body() dto: any) {
    // DEBUG
    console.log('========== LOGIN CONTROLLER ==========');

    console.log('IP:', req.ip);

    console.log('X-Forwarded-For:', req.headers?.['x-forwarded-for']);

    console.log('X-Real-IP:', req.headers?.['x-real-ip']);

    console.log('UserAgent:', req.headers?.['user-agent']);

    console.log('=======================================');

    // IMPORTANT:
    // Pass req to AuthService
    const result = await this.authService.login(dto, req);

    try {
      await this.activityLogger.log(
        {
          user_id: result?.user?.id || null,

          action: 'LOGIN',

          module: 'AUTH',

          message: 'User login',

          description: 'User login successful',
        },
        req,
      );
    } catch (err) {
      console.error('Login logging error:', err);
    }

    return result;
  }

  // ============================================================
  // FORGOT PASSWORD
  // ============================================================

  @Post('forgot_password')
  async forgot_password(@Body() dto: any) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    return this.authService.forgot_password(dto, otp);
  }

  // ============================================================
  // UPDATE PASSWORD
  // ============================================================

  @Post('update_password')
  async update_password(@Req() req: FastifyRequest, @Body() dto: any) {
    const result = await this.authService.update_password(dto);

    return result;
  }

  // ============================================================
  // AUTO LOGIN
  // ============================================================

  @Post('auto_login')
  async auto_login(@Req() req: FastifyRequest, @Body() dto: any) {
    console.log('========== AUTO LOGIN ==========');

    console.log('IP:', req.ip);

    console.log('UserAgent:', req.headers?.['user-agent']);

    console.log('================================');

    // IMPORTANT:
    // Pass req
    return this.authService.auto_login(dto, req);
  }

  // ============================================================
  // GOOGLE / SOCIAL LOGIN
  // ============================================================

  @Post('social-login')
  async googleLogin(@Req() req: FastifyRequest, @Body() body: any) {
    console.log('========== GOOGLE LOGIN ==========');

    console.log('IP:', req.ip);

    console.log('UserAgent:', req.headers?.['user-agent']);

    console.log('==================================');

    // IMPORTANT:
    // Pass req
    return this.authService.googleLogin(body, req);
  }

  // ============================================================
  // GET CURRENT USER
  // ============================================================



  @UseGuards(JwtAuthGuard)
  // @Get('me')
  // async getMe(@Req() req: FastifyRequest) {
  //   console.log('AUTH HEADER =>', req.headers.authorization);
  //   const user = (req as any).user;
  //   // return this.authService.findById(user.id);

  //   return this.authService.findById(user.id);
   
  // }
  @UseGuards(JwtAuthGuard)
@Get('me')
async getMe(@Req() req: FastifyRequest) {
  const user = (req as any).user;

  // Team member → return member data (already loaded by jwt.strategy)
  if (user.is_team) {
    const { password, ...member } = user;
    return member; // contains is_team: true, owner_id, permissions
  }

  // Vendor
  return this.authService.findById(user.id);
}

  // ============================================================
  // LOGOUT
  // ============================================================

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: FastifyRequest) {
    console.log('========== LOGOUT ==========');
    const user = (req as any).user;

    console.log('USER ID:', user.id);

    console.log('IP:', req.ip);

    console.log('UserAgent:', req.headers?.['user-agent']);

    console.log('============================');

    return this.authService.logout(user.id);
  }

  // ============================================================
  // SEND OTP
  // ============================================================

  @Post('send-otp')
  async send_otp(
    @Body()
    dto: {
      phone: string;
    },
  ) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await this.authService.send_otp(dto.phone, otp);

    return {
      message: `OTP sent successfully - Your OTP is ${otp}`,
    };
  }

  // ============================================================
  // VERIFY OTP
  // ============================================================

  @Post('verify-otp')
  async verifyOtp(
    @Req() req: FastifyRequest,
    @Body()
    dto: {
      phone: string;
      otp: string;
    },
  ) {
    console.log('========== VERIFY OTP ==========');

    console.log('IP:', req.ip);

    console.log('UserAgent:', req.headers?.['user-agent']);

    console.log('================================');

    // IMPORTANT:
    // Pass req
    return this.authService.verifyOtp(dto.phone, dto.otp, req);
  }

  @Post('email_verify_otp')
  async email_verify_otp(@Req() req: FastifyRequest, @Body() body: any) {
    console.log(body.data);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // IMPORTANT:
    // Pass req
    return this.authService.email_verify_otp(body.data, otp);
  }

  @Post('verify-parent-phone-otp')
  async verifyParentOtp(
    @Req() req: FastifyRequest,
    @Body()
    dto: {
      phone: string;
      otp: string;
    },
  ) {
    console.log('========== VERIFY OTP ==========');

    console.log('IP:', req.ip);

    console.log('UserAgent:', req.headers?.['user-agent']);

    console.log('================================');

    // IMPORTANT:
    // Pass req
    return this.authService.verifyParentOtp(dto.phone, dto.otp, req);
  }

  @Post('verify-parent-email-otp')
  async verifyParentEmailOtp(
    @Req() req: FastifyRequest,
    @Body()
    dto: {
      email: string;
      otp: string;
    },
  ) {
    console.log('========== VERIFY OTP ==========');

    console.log('IP:', req.ip);

    console.log('UserAgent:', req.headers?.['user-agent']);

    console.log('================================');

    // IMPORTANT:
    // Pass req
    return this.authService.verifyParentEmailOtp(dto.email, dto.otp, req);
  }
}
