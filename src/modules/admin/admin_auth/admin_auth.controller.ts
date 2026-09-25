import { Body, Controller, Post, Req ,UseGuards, Get} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthService } from './admin_auth.service';
import { JwtAuthGuard } from './strategies/jwt-auth.guard';

// import { JwtAuthGuard } from '../../auth/strategies/jwt-auth.guard';
import { CurrentUser } from "../../../common/decorators/user.decorator";

@Controller('admin/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Req() req: FastifyRequest,
    @Body() dto: any
  ) {
    console.log(req.ip); // example usage

    return await this.authService.login(dto); 
  }

//  @UseGuards(JwtAuthGuard)
//   @Get('me')
//   getMe(@Req() req) {
//     console.log("AUTH HEADER =>", req.user);
//     return this.authService.findById(req.user.id);
//     // return req.user; // 🔥 comes from JwtStrategy
//   }
   @UseGuards(JwtAuthGuard)
    @Get('me')
    // getMe(@Req() req) {
    //   return this.authService.findById(req.user.id);
    //   // return req.user; // 🔥 comes from JwtStrategy
    // }
    getMe(@CurrentUser() user) {
console.log(user)
  return this.authService.findById(
    user.id,
  );
}
}