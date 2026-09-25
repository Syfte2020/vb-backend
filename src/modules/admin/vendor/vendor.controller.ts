import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  Get,
  Param,
  Put,
  Delete,
  Headers,
  Query,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { VendorService } from './vendor.service';
// import { JwtAuthGuard } from '../admin_auth/strategies/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/strategies/jwt-auth.guard';

// import { ACTIVITY_MODULE } from "../activity-logs/decorators/activity-module.decorator";
// @ACTIVITY_MODULE("Amenities")

@Controller('admin/vendor')
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  // @Get('amenities')
  // getMe(@Req() req) {
  //   return this.vendorService.GetAmenities();
  // }
  @Get('amenities')
  getAmenities(
    @Query('page') page = 1,

    @Query('limit') limit = 10,

    @Query('search') search = '',

    @Query('category')
    category = '',
    @Headers("x-country") country: string,
  ) {
    return this.vendorService.GetAmenities(
      Number(page),

      Number(limit),

      search,

      category,
    );
  }

  @Get('amenities_category')
  get_category(@Req() req) {
    return this.vendorService.amenities_category();
  }

  // @Post('amenitiesInsert')
  // amenitiesInsert(@Req() req, @Body() dto: any) {
  //   return this.vendorService.amenitiesInsert(dto);
  //   // return req.user; // 🔥 comes from JwtStrategy
  // }
  @UseGuards(JwtAuthGuard)
  @Post('amenitiesInsert')
  create(@Req() req, @Body() dto: any) {
    const userId = req.user?.id;

    const ip = req.ip;

    const userAgent = req?.headers['user-agent'] || null;

    return this.vendorService.amenitiesInsert(dto, userId, ip, userAgent);
  }

  @UseGuards(JwtAuthGuard)
  @Put('updateAmenity/:id')
  updateAmenity(@Req() req, @Param('id') id: string, @Body() dto: any) {
    return this.vendorService.updateAmenity(
      id,
      dto,
      req.user?.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('deleteAmenity/:id')
  deleteAmenity(@Req() req, @Param('id') id: string) {
    return this.vendorService.deleteAmenity(
      id,
      req.user?.id,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
