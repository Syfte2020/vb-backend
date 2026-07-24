import {
  Controller,
  Get,
  UseGuards,
  Param,
  Put,
  Req,
  Patch,
  Post,
  Body,
  Query,
  Delete,
  Headers,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';


import { JwtAuthGuard } from '../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { PushService } from './push.service';
import { RegisterPushDto } from './dto/register-push.dto';


@Controller('packages')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @UseGuards(JwtAuthGuard)
  @Post('register')
  register(@CurrentUser() user: any, @Body() dto: RegisterPushDto) {
    return this.pushService.register(user?.id, dto);
  }

  @Post('send')
  async send(@Body() body: any) {
    return this.pushService.sendToUser(
      body.userId,
      body.title,
      body.body,
      body.url,
    );
  }
}
