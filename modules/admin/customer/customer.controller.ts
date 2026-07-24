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
} from '@nestjs/common';

import { CustomerService } from './customer.service';

@Controller('admin/customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  // ✅ GET ALL
  @Get('all_customer')
  findAll(@Query() query: any) {
    return this.customerService.findAll(query);
  }
}