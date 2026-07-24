import { Body, Controller, Post, Req, UseGuards, Get , Headers} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { AuthService } from './auth.service';
import { ActivityLoggerService } from '../../common/activity-logger.service';

import { JwtAuthGuard } from './strategies/jwt-auth.guard';

import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  // ================= REGISTER =================
  @Post('register')
  async register(@Req() req: FastifyRequest, @Body() dto: any, @Headers('x-country') country_id: number) {
    const result = await this.authService.register(dto,country_id);

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
      console.log('Register logging error:', err);
    }

    return result;
  }

  // ================= LOGIN =================
  @Post('login')
  async login(@Req() req: FastifyRequest, @Body() dto: any) {
    const result = await this.authService.login(dto);

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
      console.log('Login logging error:', err);
    }

    return result;
  }

  // ================= FORGOT PASSWORD =================
  @Post('forgot_password')
  async forgot_password(@Body() dto: any) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    return this.authService.forgot_password(dto, otp);
  } 
  


  // ================= UPDATE PASSWORD =================
  @Post('update_password')
  async update_password(@Req() req: FastifyRequest, @Body() dto: any) {
    const result = await this.authService.update_password(dto);

    // try {
    //   await this.activityLogger.log(
    //     {
    //       user_id: result?.userId || null,
    //       action: 'FORGOT_PASSWORD',
    //       module: 'AUTH',
    //       message: 'Password updated',
    //       description: 'Password changed successfully',
    //     },
    //     req,
    //   );
    // } catch (err) {
    //   console.log('Update password logging error:', err);
    // }

    return result;
  }

  // ================= AUTO LOGIN =================
  @Post('auto_login')
  async auto_login(@Body() dto: any) {
    return this.authService.auto_login(dto);
  }
  // ================= GOOGLE LOGIN =================
  @Post('social-login')
  async googleLogin(@Body() body: any) {
    return this.authService.googleLogin(body);
  }
 @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req) {
    console.log("AUTH HEADER =>", req.headers.authorization);
    return this.authService.findById(req.user.id);
    // return req.user; // 🔥 comes from JwtStrategy
  }

    // ================= logout =================
     @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req) {
    return this.authService.logout(req.user.id);
  }

  @Post('send-otp')
  async send_otp(@Body() dto: { phone: string }) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await this.authService.send_otp(dto.phone, otp);

    // await this.smsService.send(dto.phone, `Your OTP is ${otp}`);

    return { message: `OTP sent successfully - Your OTP is ${otp}` };
  }

  @Post('verify-otp')
  async verifyOtp(@Body() dto: { phone: string; otp: string }) {
    return this.authService.verifyOtp(dto.phone, dto.otp);
  }
}
