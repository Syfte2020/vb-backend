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


import { JwtAuthGuard } from '../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { NotificationService } from './notification.service';


@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @UseGuards(JwtAuthGuard)
  @Get('list')
  register(@CurrentUser() user: any) {
    return this.notificationService.all_notifications(user?.id);
  }

  
}
