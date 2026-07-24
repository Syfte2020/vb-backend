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
  Query,
  Delete,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { PackagesService } from './packages.service';

@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @UseGuards(JwtAuthGuard)
  @Get('package_category')
  package_category(@CurrentUser() user: any, @Param('id') id: string) {
    return this.packagesService.package_category(user?.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('create_category')
  create_category(@CurrentUser() user: any, @Body() body: any) {
    return this.packagesService.create_category(user?.id, body);
  }

  @Post('updateCategoryPublish')
  updateCategoryPublish(@Body() body: any) {
    return this.packagesService.updateCategoryPublish(body);
  }

  @Put('delete_items/:id')
  delete_items(@Param('id') id: string) {
    return this.packagesService.delete_items(id);
  }
  @UseGuards(JwtAuthGuard)
  @Post('create_items')
  async create_items(@Req() req: FastifyRequest, @CurrentUser() user: any) {
    const parts = req.parts();

    const files: any[] = [];
    const body: any = {};

    for await (const part of parts) {
      if (part.type === 'file') {
        const chunks: Buffer[] = [];

        for await (const chunk of part.file) {
          chunks.push(chunk);
        }

        files.push({
          id: part.filename, // ✅ THIS IS YOUR UUID FROM FRONTEND
          buffer: Buffer.concat(chunks),
          mimetype: part.mimetype,
        });
      } else {
        body[part.fieldname] = part.value;
      }
    }
    return this.packagesService.create_items(body, files, user?.id);
  }
  @UseGuards(JwtAuthGuard)
  @Post('create_packages')
  create_packages(@CurrentUser() user: any, @Body() body: any) {
    return this.packagesService.create_packages(user?.id, body);
  }

  @Post('publish_packages')
  publish_packages(@Body() body: any) {
    return this.packagesService.publish_packages(body);
  } 
  @UseGuards(JwtAuthGuard)
  @Post('packages_uploads')
  packages_uploads(@Body() body: any, @CurrentUser() user: any) {
    return this.packagesService.packages_uploads(body,user?.id);
  }

  //Packages publish_packages
}
