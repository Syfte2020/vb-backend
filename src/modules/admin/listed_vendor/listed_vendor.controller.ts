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
  Headers
} from '@nestjs/common';

import { ListedVendorService } from './listed_vendor.service';

@Controller('admin/listed_vendor')
export class ListedVendorController {
  constructor(private readonly listedVendorService: ListedVendorService) {}

  // ✅ GET ALL
  @Get('all_vendor')
  findAll(@Query() query: any, @Headers("x-country") country: string,) {
    return this.listedVendorService.findAll(query,country);
  }
}