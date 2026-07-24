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

import { CompareService } from './compare.service';

@Controller('compare')
export class CompareController {
  constructor(private readonly compareService: CompareService) {}
  @Post('availability')
  Availability(@Body() body:any) {
    return this.compareService.Availability(body);
  }

 
  
}
