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
  Headers
} from '@nestjs/common';
import type {
  FastifyRequest,
} from "fastify";

import { JwtAuthGuard } from '../../../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/user.decorator';
import { AgingService } from './aging.service';

@Controller('Report')
export class AgingController {
  constructor(private readonly agingService: AgingService) {}

  
   @UseGuards(JwtAuthGuard)
   @Get('all')
  async all_report(
     @CurrentUser() user: any,
     @Param('id') id: string, 
    @Headers('x-country') country:any,
    @Headers('x-category') category:any 
  ) {
    return await this.agingService.all_report(
      user?.id
    );
  }
  
}