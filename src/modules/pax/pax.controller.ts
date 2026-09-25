import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  Patch,
  Query,
  Put,
  Req,
  BadRequestException,
  UseGuards,
  Headers,
} from '@nestjs/common';

import { PaxService } from './pax.service';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../../common/decorators/user.decorator';

import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';

@Controller('pax')
export class PaxController {
  constructor(private readonly paxService: PaxService) {}

  //Auto Detect location / Manual
  @Get('package/:id')
  async package_details(@Param('id') id: any) {
    return await this.paxService.package_details(id);
  }
  @UseGuards(JwtAuthGuard)
  @Post('package_booking')
  async package_booking(
    @Body() body: any,
    @CurrentUser() user: any,
    @Headers('x-country') Country: any
  ) {
    return await this.paxService.package_booking(body,user.id ,Country );
  }
}

//create
