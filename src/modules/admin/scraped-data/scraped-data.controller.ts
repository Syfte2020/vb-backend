// ======================================================
// CONTROLLER
// src/modules/unregistered/unregistered.controller.ts
// ======================================================

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
  Headers,
  BadRequestException
} from '@nestjs/common';

import { UnregisteredService } from './scraped-data.service';

import { CreateUnregisteredDto } from './dto/create-unregistered.dto';

import type { FastifyRequest } from 'fastify';

@Controller('admin/scraped')
export class UnregisteredController {
  constructor(private readonly unregisteredService: UnregisteredService) {}

  // ============================================
  // SCRAPE GOOGLE DATA
  // ============================================

  @Post('scrapedInsertApi')
  scrapeGoogleData(@Body() dto: CreateUnregisteredDto,) {
    return this.unregisteredService.scrapeGoogleData(dto);
  }

  // ============================================
  // GET ALL
  // ============================================

  @Get('scrapedApi')
  findAll(@Query() query: any ,  @Headers("x-country") country: string,) {
    return this.unregisteredService.findAll(query,country);
  }

  // ============================================
  // GET ONE
  // ============================================

  @Get('scrapedIdApi/:id')
  findOne(@Param('id') id: number) {
    return this.unregisteredService.findOne(Number(id));
  }

 @Put('ScrapedUpdateApi/:id')
async ScrapedData(
  @Param('id') id: string,
  @Req() req: FastifyRequest,
) {
  try {

    const parts = req.parts();

    const body: any = {};

    // ============================================
    // MULTIPLE IMAGES
    // ============================================

    const images: any[] = [];

    for await (const part of parts) {

      // ============================================
      // FILES
      // ============================================

      if (part.type === 'file') {

  if (!part.filename) {
    continue;
  }

  const buffer = await part.toBuffer();

  if (!buffer?.length) {
    continue;
  }

  const fileData = {
  buffer,
  originalname:
    part.filename ||
    "image.jpg",
  mimetype:
    part.mimetype ||
    "image/jpeg",
};

  if (part.fieldname === 'images') {
    images.push(fileData);
  }
}

      // ============================================
      // FIELDS
      // ============================================

      if (part.type === 'field') {
        body[part.fieldname] =
          String(part.value);
      }
    }

    // ============================================
    // SERVICE
    // ============================================

    return await this.unregisteredService.update(
      id,
      body,
      images,
    );

  } catch (error) {

    console.error(error);

    throw new BadRequestException(
      'Upload failed',
    );
  }
}

  @Get('all_country')
  all_country() {
    return this.unregisteredService.all_country();
  }

  @Get('all_events')
  all_events() {
    return this.unregisteredService.all_country();
  }

  // ============================================
  // DELETE
  // ============================================

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.unregisteredService.remove(Number(id));
  }
}
