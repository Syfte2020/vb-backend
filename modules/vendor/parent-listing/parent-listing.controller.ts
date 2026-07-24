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
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { ParentListingService } from './parent-listing.service';

@Controller('parent-listing')
export class ParentListingController {
  constructor(private readonly parentListingService: ParentListingService) {}

  @UseGuards(JwtAuthGuard)
  @Get('parent/:id')
  getParent(@CurrentUser() user: any, @Param('id') id: string) {
    return this.parentListingService.getParent(user?.id,id);
  }
  // CONTROLLER

  @Put('SaveParent/:id')
async saveParent(
  @Req() req: FastifyRequest,
  @Param('id') parentId: string,
) {

  const parts = req.parts();

  const body: any = {};

  let files: any = null;
  let vfiles: any = null;
  let rfiles: any = null;

  for await (const part of parts) {

    if (part.type === 'file') {

      const buffer = await part.toBuffer();

      const fileData = {
        buffer,
        filename: part.filename,
        mimetype: part.mimetype,
      };

      if (part.fieldname === 'image') {
        files = fileData;
      }

      if (part.fieldname === 'video') {
        vfiles = fileData;
      } 
      if (part.fieldname === 'brand_reel') {
        rfiles = fileData;
      }

    } else {

      body[part.fieldname] = part.value;
    }
  }

  return this.parentListingService.saveParent(
    body,
    files,
    vfiles,
    rfiles,
    parentId,
  );
}
}
