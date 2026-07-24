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
  BadRequestException,
  UseGuards,
  Headers,
} from '@nestjs/common';

import { ListingService } from './listing.service';
import { CreateListingDto } from './dto/create-listing.dto';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../../common/decorators/user.decorator';

import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';

@Controller('listing')
export class ListingController {
  constructor(private readonly listingService: ListingService) {}
  @UseGuards(JwtAuthGuard)
  @Put('last_parent_id/:id')
  async parent_last_create_id(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Headers('x-country') Country: any,
  ) {
    return this.listingService.parent_last_create_id(user?.id, id, Country);
  }

  @UseGuards(JwtAuthGuard)
  @Put('parent_of_category/:id')
  async parent_of_category(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Headers('x-country') Country: any,
  ) {
    return this.listingService.parent_of_category(user?.id, id, Country);
  }

  @UseGuards(JwtAuthGuard)
  @Put('child_of_category/:id')
  async child_of_category(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Headers('x-country') Country: any,
  ) {
    return this.listingService.child_of_category(user?.id, id, Country);
  }

  @UseGuards(JwtAuthGuard)
  @Put('listing_sub_check/:id')
  async listing_sub_check(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Headers('x-country') Country: any,
  ) {
    return this.listingService.listing_sub_check(user?.id, id, Country);
  }

  @UseGuards(JwtAuthGuard)
  @Post('parent_create')
  async parent_create(
    @Req() req: FastifyRequest,
    @CurrentUser() user: any,
    @Headers('x-country') Country: any,
  ) {
    const parts = req.parts();

    const body: any = {};
    const files: any[] = [];

    for await (const part of parts) {
      if (part.type === 'file') {
        files.push({
          fieldname: part.fieldname,
          originalname: part.filename,
          mimetype: part.mimetype,
          buffer: await part.toBuffer(),
        });
      } else {
        body[part.fieldname] = part.value;
      }
    }

    const logo = files.find((f) => f.fieldname === 'logo');

    return this.listingService.create_parent(user?.id, body, logo, Country);
  }
  @UseGuards(JwtAuthGuard)
  @Post('create')
  async ListingData(@Body() dto: CreateListingDto, @Req() req: FastifyRequest) {
    try {
      const parts = req.parts();

      const body: any = {};

      const images: any[] = [];

      let coverImage: any = null;
      let bannerImage: any = null;

      for await (const part of parts) {
        if (part.type === 'file') {
          const buffer = await part.toBuffer();

          const fileData = {
            fieldname: part.fieldname,
            buffer,
            originalname: part.filename,
            mimetype: part.mimetype,
            size: buffer.length,
          };

          if (part.fieldname === 'cover_image') {
            coverImage = {
              ...fileData,
              type: 'cover',
            };

            continue;
          }
          if (part.fieldname === 'banner_image') {
            bannerImage = {
              ...fileData,
              type: 'banner',
            };

            continue;
          }
          if (part.fieldname === 'images[]') {
            const isCover = coverImage?.originalname === fileData.originalname;

            const isBanner =
              bannerImage?.originalname === fileData.originalname;

            if (!isCover && !isBanner) {
              images.push({
                ...fileData,
                type: 'gallery',
              });
            }

            continue;
          }
        }

        /* ================= FIELD ================= */

        if (part.type === 'field') {
          const field = part.fieldname;

          const value = part.value;

          /* ---------- amenities[] ---------- */

          if (field === 'amenities[]') {
            if (!body.amenities) {
              body.amenities = [];
            }

            body.amenities.push(value);

            continue;
          }

          /* ---------- pricing shifts ---------- */

          const pricingMatch = field.match(
            /^pricing\[shifts\]\[(.*?)\]\[(.*?)\]$/,
          );

          if (pricingMatch) {
            const shiftKey = pricingMatch[1];

            const subKey = pricingMatch[2];

            if (!body.pricing) {
              body.pricing = {};
            }

            if (!body.pricing.shifts) {
              body.pricing.shifts = {};
            }

            if (!body.pricing.shifts[shiftKey]) {
              body.pricing.shifts[shiftKey] = {};
            }

            let parsedValue: any = value;

            /* ---- boolean ---- */

            if (value === 'true') {
              parsedValue = true;
            } else if (value === 'false') {
              parsedValue = false;
            } else if (!isNaN(Number(value))) {
              /* ---- number ---- */
              parsedValue = Number(value);
            }

            body.pricing.shifts[shiftKey][subKey] = parsedValue;

            continue;
          }

          /* ---------- normal fields ---------- */

          body[field] = value;
        }
      }

      return await this.listingService.create({
        body,

        images,

        coverImage,
        bannerImage,
        user: (req as any).user,
      });
    } catch (error) {
      console.log(error);

      throw new BadRequestException(error || 'Upload failed');
    }
  }

 

  //   async ListingData(
  //   @Body() dto: CreateListingDto,
  // ) {
  //   try {

  //     // ============================================
  //     // CREATE LISTING WITHOUT IMAGE UPLOAD
  //     // ============================================

  //     return await this.listingService.createListing(dto, []);

  //   } catch (error) {

  //     console.error(error);

  //     throw new BadRequestException('Upload failed');
  //   }
  // }
  //   async ListingData(  @Body() body: any, @Req() req: FastifyRequest) {
  //     try {
  //     //   const parts = req.parts();

  //     //   const body: any = {};

  //     //   // ============================================
  //     //   // MULTIPLE IMAGES
  //     //   // ============================================

  //     //   const images: any[] = [];

  //     //   for await (const part of parts) {
  //     //     // ============================================
  //     //     // FILES
  //     //     // ============================================

  //     //     if (part.type === 'file') {
  //     //       if (!part.filename) {
  //     //         continue;
  //     //       }

  //     //       const buffer = await part.toBuffer();

  //     //       if (!buffer?.length) {
  //     //         continue;
  //     //       }

  //     //       const fileData = {
  //     //         buffer,
  //     //         originalname: part.filename || 'image.jpg',
  //     //         mimetype: part.mimetype || 'image/jpeg',
  //     //       };

  //     //       if (part.fieldname === 'images') {
  //     //         images.push(fileData);
  //     //       }
  //     //     }

  //     //     // ============================================
  //     //     // FIELDS
  //     //     // ============================================

  //     //     if (part.type === 'field') {
  //     //       body[part.fieldname] = String(part.value);
  //     //     }
  //     //   }

  //       // ============================================
  //       // SERVICE
  //       // ============================================

  //     //   return await this.listingService.createListing(dto, images);
  //       return await this.listingService.createListing(body, []);
  //     } catch (error) {
  //       console.error(error);

  //       throw new BadRequestException('Upload failed');
  //     }
  //   }
  private async parseVenueFiles(req: any) {
    const uploadedFiles: any[] = [];

    //
    // READ ALL FILES FIRST
    //
    for await (const part of req.parts()) {
      if (part.type !== 'file') continue;

      const buffer = await part.toBuffer();

      uploadedFiles.push({
        fieldname: part.fieldname,
        buffer,
        originalname: part.filename,
        mimetype: part.mimetype,
        size: buffer.length,
      });
    }

    //
    // FIND COVER IMAGE
    //
    const coverImage = uploadedFiles.find((f) => f.fieldname === 'cover_image');

    //
    // FIND BANNER IMAGE
    //
    const bannerImage = uploadedFiles.find(
      (f) => f.fieldname === 'banner_image',
    );

    //
    // FILTER GALLERY IMAGES
    // REMOVE DUPLICATE COVER/BANNER
    //
    const images = uploadedFiles.filter((f) => {
      if (f.fieldname !== 'images[]') {
        return false;
      }

      const isCover = coverImage && coverImage.originalname === f.originalname;

      const isBanner =
        bannerImage && bannerImage.originalname === f.originalname;

      return !isCover && !isBanner;
    });

    return {
      coverImage: coverImage || null,
      bannerImage: bannerImage || null,
      images,
    };
  }

  //Auto Detect location / Manual
   @Get('syncDestination/:id')
  async syncDestination(@Param('id') id: any) {
    return await this.listingService.syncDestination(id);
  }
}

//create
