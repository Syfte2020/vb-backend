import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Query,
  Req,
  BadRequestException,
  Body,
} from '@nestjs/common';

import { LoyaltyService } from './loyalty.service';

@Controller('admin/loyalty')
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  // ✅ GET ALL
  @Get()
  loyaltyAll(@Query() query: any) {
    return this.loyaltyService.loyaltyAll(query);
  } 
  @Post('add_adjustment')
  add_adjustment(@Body() Body: any) {
    return this.loyaltyService.add_adjustment(Body);
  }
}