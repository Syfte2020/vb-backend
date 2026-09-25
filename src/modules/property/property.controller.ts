import {
  Controller,
  Post,
  Req,
  Body,
  Get,
  Query,
  Param,
  Delete,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { PropertyService } from './property.service';
import { CreateChildVenueDto, FastifyFile } from './dto/createChildVenue.dto';
import { ListPropertyDto } from './dto/list_property.dto';

import { ActivityLoggerService } from '../../common/activity-logger.service';

@Controller('property')
export class PropertyController {
  constructor(
    private readonly propertyService: PropertyService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  // ================= CREATE PROPERTY =================
  @Post('new-property')
  async register(@Req() req: FastifyRequest, @Body() body: any) {
    let dto: any = {};
    let result: any;

    // ✅ CASE 1: JSON request
    if (!req.isMultipart()) {
      dto = body;
    }

    // ✅ CASE 2: Multipart request
    else {
      const parts = req.parts();

      const gallery: FastifyFile[] = [];
      let banner: FastifyFile | null = null;
      let thumbnail: FastifyFile | null = null;

      for await (const part of parts) {
        if (part.type === 'file') {
          const file: FastifyFile = {
            filename: part.filename,
            mimetype: part.mimetype,
            buffer: await part.toBuffer(),
          };

          if (part.fieldname === 'gallery_photos') {
            gallery.push(file);
          }

          if (part.fieldname === 'banner_photo') {
            banner = file;
          }

          if (part.fieldname === 'thumbnail_photo') {
            thumbnail = file;
          }
        } else {
          dto[part.fieldname] = part.value;
        }
      }

      dto.gallery_photos = gallery;
      dto.banner_photo = banner;
      dto.thumbnail_photo = thumbnail;
    }

    // ✅ Common service call
    result = await this.propertyService.createChildVenue(dto);

    // ✅ Common logging (always runs)
    try {
      await this.activityLogger.log(
        {
          user_id: result?.user?.id || null,
          action: 'CREATE_PROPERTY',
          module: 'PROPERTY',
          message: 'Property created',
          description: 'New property created successfully',
        },
        req,
      );
    } catch (err) {
      console.log('Property logging error:', err);
    }

    return result;
  }

  // ================= LIST PROPERTY =================
  @Get('list-property')
  listProperty(@Query() dto: ListPropertyDto) {
    return this.propertyService.list_property(dto);
  }

  // ================= DELETE PROPERTY =================
  @Delete('list-delete/:id')
  async list_delete(@Req() req: FastifyRequest, @Param('id') id: string) {
    const result = await this.propertyService.list_delete(id);

    try {
      await this.activityLogger.log(
        {
          user_id: result?.user?.id || null,
          action: 'DELETE_PROPERTY',
          module: 'PROPERTY',
          message: 'Property deleted',
          description: `Property with ID ${id} deleted successfully`,
        },
        req,
      );
    } catch (err) {
      console.log('Delete logging error:', err);
    }

    return result;
  }
}
