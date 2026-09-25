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
  Headers
} from '@nestjs/common';

import { CheckoutService } from './checkout.service';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly CheckoutService: CheckoutService) {}
  @Get('checkoutSuccess/:id')
  Availability(@Param('id') id:any) {
    return this.CheckoutService.checkoutSuccess(id);
  }

 
  
}
