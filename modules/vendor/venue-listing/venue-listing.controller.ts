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
  Headers
} from '@nestjs/common';
import type {
  FastifyRequest,
} from "fastify";

import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { VenueListingService } from './venue-listing.service';
import { Category } from 'src/modules/admin/property-tag/entities/property-tag.entity';

@Controller('venue-listing')
export class VenueListingController {
  constructor(private readonly venueListingService: VenueListingService) {}

  @UseGuards(JwtAuthGuard)
  @Get('venues/:id')
  getUserRecentViews(
    @CurrentUser() user: any,@Param('id') id: string, 
    @Headers('x-country') country:any,
    @Headers('x-category') category:any ,
    // @Query('category') category:any 

) {
    const normalizedCategory = id.replace(/s$/, "");
    return this.venueListingService.getListData(
      user?.id , normalizedCategory,
      country
    );
  }

  @Get('venue/:id')
  getList(@CurrentUser() user: any, @Param('id') id: string) {
    return this.venueListingService.getList(user?.id, id );
  }

  @Get('getGalleryCategory/:id')
  getGalleryCategory(@Param('id') id: string) {
    return this.venueListingService.getGalleryCategory(id);
  }

 @Put('saveListing/:id')
async updateListing(
  @Param('id') id: string,
  @Req() req: FastifyRequest,
) {
  const parts = req.parts();

  const body: any = {};
  const files: any[] = [];

  for await (const part of parts) {

    if (part.type === 'file') {

      files.push({
        fieldname: part.fieldname,
        filename: part.filename,
        mimetype: part.mimetype,
        buffer: await part.toBuffer(),
      });

    } else {

      // try {
      //   body[part.fieldname] = JSON.parse(part);
      // } catch {
        body[part.fieldname] = part.value;
      // }

    }
  }

  return this.venueListingService.updateListing(
    id,
    body,
    files,
  );
}

/* ─────────────────────────────
     BASIC
  ───────────────────────────── */

  @Patch(':id/basic')
  async updateBasic(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.venueListingService.updateBasic(id, body);
  }

  /* ─────────────────────────────
     PHOTOS (FASTIFY)
  ───────────────────────────── */
 @UseGuards(JwtAuthGuard)
 @Patch(':id/photos')
async updatePhotos(
  @Param('id') id: string,
  @Req() req: FastifyRequest,
  @CurrentUser() user: any,
) {
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

  return this.venueListingService.updatePhotos(id, body, files,user?.id);
}
  /* ─────────────────────────────
     CAPACITY
  ───────────────────────────── */

  @Patch(':id/capacity')
  async updateCapacity(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.venueListingService.updateCapacity(id, body);
  }

  /* ─────────────────────────────
     AMENITIES
  ───────────────────────────── */

  @Patch(':id/amenities')
  async updateAmenities(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.venueListingService.updateAmenities(id, body);
  }

  /* ─────────────────────────────
     LOCATION
  ───────────────────────────── */

  @Patch(':id/location')
  async updateLocation(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.venueListingService.updateLocation(id, body);
  }

  /* ─────────────────────────────
     PRICING
  ───────────────────────────── */

  @Patch(':id/pricing')
  async updatePricing(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.venueListingService.updatePricing(id, body);
  }

  /* ─────────────────────────────
     TAGS
  ───────────────────────────── */

  @Patch(':id/tags')
  async updateTags(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.venueListingService.updateTags(id, body);
  }

  /* ─────────────────────────────
     ADDONS
  ───────────────────────────── */

  @Patch(':id/addons')
  async updateAddons(
    @Param('id') id: string,
    @Body() body: any,
  ) {
     return this.venueListingService.updateAddons(id, body);
  }

  /* ─────────────────────────────
     TERMS
  ───────────────────────────── */

  @Patch(':id/terms')
  async updateTerms(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.venueListingService.updateTerms(id, body);
  }  
  
  @Put('SaveVenueSetting/:id')
  async SaveVenueSetting(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.venueListingService.SaveVenueSetting(id, body);
  }


   @UseGuards(JwtAuthGuard)
  @Post('SaveCategory')
  SaveCategory(@CurrentUser() user: any,@Body() body: any,) {
    return this.venueListingService.SaveCategory(user?.id,body);
  }

 @UseGuards(JwtAuthGuard)
  @Get('LoadaddonCategory')
  LoadaddonCategory(@CurrentUser() user: any) {
    return this.venueListingService.LoadaddonCategory(user?.id);
  } 
  
 

 @UseGuards(JwtAuthGuard)
  @Post('SaveAddon')
 async SaveAddon(@CurrentUser() user: any, @Req() req: FastifyRequest,) {
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

  return this.venueListingService.SaveAddon(user?.id, body, files);
  }

  @UseGuards(JwtAuthGuard)
  @Get('Loadaddon')
  Loadaddon(@CurrentUser() user: any) {
    return this.venueListingService.Loadaddon(user?.id);
  }

  @Delete('DeleteAddon/:id')
  DeleteAddon( @Param('id') id: string,) {
    return this.venueListingService.DeleteAddon(id);
  }
  
  @Post('ToggleAddon')
  ToggleAddon( @Body() body: any) {
    return this.venueListingService.ToggleAddon(body);
  }

   @UseGuards(JwtAuthGuard)
   @Get('getAddon')
  getAddon(@Query() query: any,@CurrentUser() user: any) {
    return this.venueListingService.getAddon(user?.id ,query);
  } 

   @Post('DeletePhotos')
  DeletePhotos(@Body() body: any) {
    return this.venueListingService.DeletePhotos(body);
  } 


  
}