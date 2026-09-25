import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Query,
  Req,
  Body,
  Headers,
  Patch,
  BadRequestException,
} from '@nestjs/common';

import type { FastifyRequest } from 'fastify';
import { LoyaltyPointMasterItemDto } from './dto/loyalty-point-master-item.dto';
import { CreateLoyaltyTierDto } from './dto/create-loyalty-tier.dto';
import { UpdateLoyaltyTierDto } from './dto/update-loyalty-tier.dto';
import { MasterService } from './master.service';

@Controller('admin/master')
export class MasterController {
  constructor(private readonly masterService: MasterService) {}

  // ✅ GET ALL
  // @Get('savePointMasterApi')
  // findAll(@Query() query: any) {
  //   return this.masterService.findAll(query);
  // }
  @Post('savePointMasterApi')
  create(@Body() body: any, @Headers('x-country') country_id: number) {
    return this.masterService.create(body, country_id);
  }

  @Get('getPointMasterApi')
  findAll(@Headers('x-country') country_id: number) {
    return this.masterService.findAll(country_id);
  }

  @Get('LoyaltyPointApi')
  LoyaltyfindAll(@Headers('x-country') country_id: number) {
    return this.masterService.LoyaltyfindAll(country_id);
  }

  @Post('LoyaltyPointSaveApi')
  createLoyalty(
    @Body() data: CreateLoyaltyTierDto,
    @Headers('x-country') country_id: number,
  ) {
    return this.masterService.createLoyalty(data, country_id);
  }

  @Put('LoyaltyPointUpdateApi/:id')
  update(@Param('id') id: string, @Body() dto: UpdateLoyaltyTierDto) {
    return this.masterService.update(id, dto);
  }

  /* DELETE */
  @Delete('deleteLoyaltyPointApi/:id')
  remove(@Param('id') id: string) {
    return this.masterService.remove(id);
  }

  /* plans */
  @Get('plans/:id')
  plans(@Param('id') id: string, @Headers('x-country') country_id: number) {
    return this.masterService.plans(country_id, id);
  }

  @Get('third_party_api')
  getIntegrationConfig(@Headers('x-country') country_id: number) {
    return this.masterService.getIntegrationConfig(country_id);
  }

  @Get('customerTierApi')
  customerTierApi(@Headers('x-country') country_id: number) {
    return this.masterService.customerTierApi(country_id);
  }

  @Post('customerTierInsertApi')
  customerTierInsertApi(@Body() body: any) {
    return this.masterService.createCustomerTier(body);
  }

  @Put('customerTierUpdateApi/:id')
  customerTierUpdateApi(@Param('id') id: number, @Body() body: any) {
    return this.masterService.customerTierUpdateApi(id, body);
  }

  @Delete('deleteCustomerTierApi/:id')
  delete(@Param('id') id: number) {
    return this.masterService.deleteCustomerTierApi(+id);
  }

  @Get('guestApi')
  guestApi(@Headers('x-country') country_id: number) {
    return this.masterService.guestApi(country_id);
  }

  @Post('guestInsertApi')
  guestInsertApi(@Body() body: any) {
    return this.masterService.guestInsertApi(body);
  }

  @Put('guestUpdateApi/:id')
  guestUpdateApi(@Param('id') id: number, @Body() body: any) {
    return this.masterService.guestUpdateApi(id, body);
  }

  @Delete('deleteGuestApi/:id')
  deleteGuestApi(@Param('id') id: number) {
    return this.masterService.deleteGuestApi(id);
  }
  @Get('getPendingVendors')
  getPendingVendors(@Headers('x-country') country_id: number) {
    return this.masterService.getPendingVendors();
  }

  @Patch(':vendorId/documents/:documentId/status')
  async updateVendorDocumentStatus(
    @Param('vendorId') vendorId: number,
    @Param('documentId') documentId: number,
    @Body() body: any,
  ) {

    return this.masterService.updateVendorDocumentStatus(
      vendorId,
      documentId,
      body,
    );
  }

  /**
   * Approve complete vendor KYC
   *
   * PATCH /vendors/:vendorId/approve
   */
  @Patch(':vendorId/approve')
  async approveVendorKyc(@Param('vendorId') vendorId: number) {
    return this.masterService.approveVendorKyc(vendorId);
  }

  /**
   * Reject complete vendor application
   *
   * PATCH /vendors/:vendorId/reject
   */
  @Patch(':vendorId/reject')
  async rejectVendorApplication(@Param('vendorId') vendorId: number) {
    return this.masterService.rejectVendorApplication(vendorId);
  }

   @Get('delete_all')
  async delete_all() {
    return this.masterService.delete_all();
  }
}
