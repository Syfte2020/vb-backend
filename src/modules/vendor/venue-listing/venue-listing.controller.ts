// import {
//   Controller,
//   Get,
//   UseGuards,
//   Param,
//   Put,
//   Req,
//   Patch,
//   Post,
//   Body,
//   Query,
//   Delete,
//   Headers
// } from '@nestjs/common';
// import type {
//   FastifyRequest,
// } from "fastify";

// import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
// import { CurrentUser } from '../../../common/decorators/user.decorator';
// import { VenueListingService } from './venue-listing.service';
// import { Category } from 'src/modules/admin/property-tag/entities/property-tag.entity';

// import { PermissionsGuard } from '../../../common/access/permissions.guard';
// import { Permissions } from '../../../common/access/permissions.decorator';
// import { PERMISSIONS, getOwnerId } from '../../../common/access/permissions';

// @Controller('venue-listing')
// @UseGuards(JwtAuthGuard, PermissionsGuard)
// export class VenueListingController {
//   constructor(private readonly venueListingService: VenueListingService) {}

//   @UseGuards(JwtAuthGuard)
//   @Get('venues/:id')
//   getUserRecentViews(
//     @CurrentUser() user: any,@Param('id') id: string, 
//     @Headers('x-country') country:any,
//     @Headers('x-category') category:any ,
//     // @Query('category') category:any 

// ) {
//     const normalizedCategory = id.replace(/s$/, "");
//     return this.venueListingService.getListData(
//       getOwnerId(user) , normalizedCategory,
//       country
//     );
//   }

//   @Get('venue/:id')
//   getList(@CurrentUser() user: any, @Param('id') id: string) {
//     return this.venueListingService.getList(getOwnerId(user), id );
//   }

//   @Get('getGalleryCategory/:id')
//   getGalleryCategory(@Param('id') id: string) {
//     return this.venueListingService.getGalleryCategory(id);
//   }

//  @Put('saveListing/:id')
// async updateListing(
//   @Param('id') id: string,
//   @Req() req: FastifyRequest,
// ) {
//   const parts = req.parts();

//   const body: any = {};
//   const files: any[] = [];

//   for await (const part of parts) {

//     if (part.type === 'file') {

//       files.push({
//         fieldname: part.fieldname,
//         filename: part.filename,
//         mimetype: part.mimetype,
//         buffer: await part.toBuffer(),
//       });

//     } else {

//       // try {
//       //   body[part.fieldname] = JSON.parse(part);
//       // } catch {
//         body[part.fieldname] = part.value;
//       // }

//     }
//   }

//   return this.venueListingService.updateListing(
//     id,
//     body,
//     files,
//   );
// }

// /* ─────────────────────────────
//      BASIC
//   ───────────────────────────── */

//   @Patch(':id/basic')
//   async updateBasic(
//     @Param('id') id: string,
//     @Body() body: any,
//   ) {
//     return this.venueListingService.updateBasic(id, body);
//   }

//   /* ─────────────────────────────
//      PHOTOS (FASTIFY)
//   ───────────────────────────── */
// //  @UseGuards(JwtAuthGuard)
// //  @Patch(':id/photos')
// // async updatePhotos(
// //   @Param('id') id: string,
// //   @Req() req: FastifyRequest,
// //   @CurrentUser() user: any,
// // ) {
// //   const parts = req.parts();

// //   const files: any[] = [];
// //   const body: any = {};
// //    let reel: any = null;

// //   for await (const part of parts) {
// //     if (part.type === 'file') {
// //       const chunks: Buffer[] = [];

// //       for await (const chunk of part.file) {
// //         chunks.push(chunk);
// //       }

// //       files.push({
// //         id: part.filename, // ✅ THIS IS YOUR UUID FROM FRONTEND
// //         buffer: Buffer.concat(chunks),
// //         mimetype: part.mimetype,
// //       });

// //        const fileData = {
// //         id: part.filename,
// //         fieldname: part.fieldname,
// //         originalname: part.filename,
// //         buffer: Buffer.concat(chunks),
// //         mimetype: part.mimetype,
// //       };

// //       if (part.fieldname === 'reel') {
// //         reel = fileData;
// //       } 
// //     } else {
// //       body[part.fieldname] = part.value;
// //     }
// //   }

// //   return this.venueListingService.updatePhotos(id, body, files,getOwnerId(user) , reel);
// // }
// @UseGuards(JwtAuthGuard)
// @Patch(':id/photos')
// async updatePhotos(
//   @Param('id') id: string,
//   @Req() req: FastifyRequest,
//   @CurrentUser() user: any,
// ) {
//   const parts = req.parts();

//   const files: any[] = [];
//   const body: any = {};
//   let reel: any = null;

//   for await (const part of parts) {
//     if (part.type === 'file') {
//       const chunks: Buffer[] = [];

//       for await (const chunk of part.file) {
//         chunks.push(chunk);
//       }

//       const fileData = {
//         id: part.filename,
//         fieldname: part.fieldname,
//         originalname: part.filename,
//         buffer: Buffer.concat(chunks),
//         mimetype: part.mimetype,
//       };

//       /*
//       --------------------------------
//       REEL
//       --------------------------------
//       Reel is a separate multipart field.
//       */
//       if (part.fieldname === 'reel') {
//         reel = fileData;
//       } else {
//         /*
//         --------------------------------
//         NORMAL PHOTOS
//         --------------------------------
//         */
//         files.push(fileData);
//       }
//     } else {
//       body[part.fieldname] = part.value;
//     }
//   }

//   return this.venueListingService.updatePhotos(
//     id,
//     body,
//     files,
//     getOwnerId(user),
//     reel,
//   );
// }
//   /* ─────────────────────────────
//      CAPACITY
//   ───────────────────────────── */

//   @Patch(':id/capacity')
//   async updateCapacity(
//     @Param('id') id: string,
//     @Body() body: any,
//   ) {
//     return this.venueListingService.updateCapacity(id, body);
//   }

//   /* ─────────────────────────────
//      AMENITIES
//   ───────────────────────────── */

//   @Patch(':id/amenities')
//   async updateAmenities(
//     @Param('id') id: string,
//     @Body() body: any,
//   ) {
//     return this.venueListingService.updateAmenities(id, body);
//   }

//   /* ─────────────────────────────
//      LOCATION
//   ───────────────────────────── */

//   @Patch(':id/location')
//   async updateLocation(
//     @Param('id') id: string,
//     @Body() body: any,
//   ) {
//     return this.venueListingService.updateLocation(id, body);
//   }

//   /* ─────────────────────────────
//      PRICING
//   ───────────────────────────── */

//   @Patch(':id/pricing')
//   async updatePricing(
//     @Param('id') id: string,
//     @Body() body: any,
//   ) {
//     return this.venueListingService.updatePricing(id, body);
//   }

//   /* ─────────────────────────────
//      TAGS
//   ───────────────────────────── */

//   @Patch(':id/tags')
//   async updateTags(
//     @Param('id') id: string,
//     @Body() body: any,
//   ) {
//     return this.venueListingService.updateTags(id, body);
//   }

//   /* ─────────────────────────────
//      ADDONS
//   ───────────────────────────── */

//   @Patch(':id/addons')
//   async updateAddons(
//     @Param('id') id: string,
//     @Body() body: any,
//   ) {
//      return this.venueListingService.updateAddons(id, body);
//   }

//   /* ─────────────────────────────
//      TERMS
//   ───────────────────────────── */

//   @Patch(':id/terms')
//   async updateTerms(
//     @Param('id') id: string,
//     @Body() body: any,
//   ) {
//     return this.venueListingService.updateTerms(id, body);
//   }  
  
//   @Put('SaveVenueSetting/:id')
//   async SaveVenueSetting(
//     @Param('id') id: string,
//     @Body() body: any,
//   ) {
//     return this.venueListingService.SaveVenueSetting(id, body);
//   }


//    @UseGuards(JwtAuthGuard)
//   @Post('SaveCategory')
//   SaveCategory(@CurrentUser() user: any,@Body() body: any,) {
//     return this.venueListingService.SaveCategory(getOwnerId(user),body);
//   }

//  @UseGuards(JwtAuthGuard)
//   @Get('LoadaddonCategory')
//   LoadaddonCategory(@CurrentUser() user: any) {
//     return this.venueListingService.LoadaddonCategory(getOwnerId(user));
//   } 
  
 

//  @UseGuards(JwtAuthGuard)
//   @Post('SaveAddon')
//  async SaveAddon(@CurrentUser() user: any, @Req() req: FastifyRequest,) {
//      const parts = req.parts();

//   const files: any[] = [];
//   const body: any = {};

//   for await (const part of parts) {
//     if (part.type === 'file') {
//       const chunks: Buffer[] = [];

//       for await (const chunk of part.file) {
//         chunks.push(chunk);
//       }

//       files.push({
//         id: part.filename, // ✅ THIS IS YOUR UUID FROM FRONTEND
//         buffer: Buffer.concat(chunks),
//         mimetype: part.mimetype,
//       });
//     } else {
//       body[part.fieldname] = part.value;
//     }
//   }

//   return this.venueListingService.SaveAddon(getOwnerId(user), body, files);
//   }

//   @UseGuards(JwtAuthGuard)
//   @Get('Loadaddon')
//   Loadaddon(@CurrentUser() user: any) {
//     return this.venueListingService.Loadaddon(getOwnerId(user));
//   }

//   @Delete('DeleteAddon/:id')
//   DeleteAddon( @Param('id') id: string,) {
//     return this.venueListingService.DeleteAddon(id);
//   }
  
//   @Post('ToggleAddon')
//   ToggleAddon( @Body() body: any) {
//     return this.venueListingService.ToggleAddon(body);
//   }

//    @UseGuards(JwtAuthGuard)
//    @Get('getAddon')
//   getAddon(@Query() query: any,@CurrentUser() user: any) {
//     return this.venueListingService.getAddon(getOwnerId(user) ,query);
//   } 

//    @Post('DeletePhotos')
//   DeletePhotos(@Body() body: any) {
//     return this.venueListingService.DeletePhotos(body);
//   } 

//   @Post('UpdateCoverPhotos')
//   UpdateCoverPhotos(@Body() body: any) {
//     return this.venueListingService.UpdateCoverPhotos(body);
//   } 
// @UseGuards(JwtAuthGuard)
//   @Get('guest_love_plcae')
//   guest_love_plcae() {
//     return this.venueListingService.guest_love_plcae();
//   } 


  
// }
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
  Headers,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { VenueListingService } from './venue-listing.service';

import { PermissionsGuard } from '../../../common/access/permissions.guard';
import { Permissions } from '../../../common/access/permissions.decorator';
import { PERMISSIONS, getOwnerId } from '../../../common/access/permissions';

/*
  Each route has its own guards:
  - JwtAuthGuard     → must be logged in (vendor or team)
  - PermissionsGuard → vendor = full access
                       team   = needs the permission in @Permissions(...)
*/
@Controller('venue-listing')
export class VenueListingController {
  constructor(private readonly venueListingService: VenueListingService) {}

  /* ─────────────────────────────
     LISTING - VIEW
  ───────────────────────────── */

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.LISTINGS_VIEW)
  @Get('venues/:id')
  getUserRecentViews(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Headers('x-country') country: any,
  ) {
    const normalizedCategory = id.replace(/s$/, '');
    return this.venueListingService.getListData(
      getOwnerId(user),
      normalizedCategory,
      country,
    );
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.LISTINGS_VIEW)
  @Get('venue/:id')
  getList(@CurrentUser() user: any, @Param('id') id: string) {
    return this.venueListingService.getList(getOwnerId(user), id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.LISTINGS_VIEW)
  @Get('getGalleryCategory/:id')
  getGalleryCategory(@Param('id') id: string) {
    return this.venueListingService.getGalleryCategory(id);
  }

  /* ─────────────────────────────
     LISTING - SAVE (multipart)
  ───────────────────────────── */

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.LISTINGS_EDIT)
  @Put('saveListing/:id')
  async updateListing(@Param('id') id: string, @Req() req: FastifyRequest) {
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
        body[part.fieldname] = part.value;
      }
    }

    return this.venueListingService.updateListing(id, body, files);
  }

  /* ─────────────────────────────
     BASIC
  ───────────────────────────── */

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.LISTINGS_EDIT)
  @Patch(':id/basic')
  async updateBasic(@Param('id') id: string, @Body() body: any) {
    return this.venueListingService.updateBasic(id, body);
  }

  /* ─────────────────────────────
     PHOTOS (FASTIFY)
  ───────────────────────────── */

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.LISTINGS_EDIT)
  @Patch(':id/photos')
  async updatePhotos(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
    @CurrentUser() user: any,
  ) {
    const parts = req.parts();

    const files: any[] = [];
    const body: any = {};
    let reel: any = null;

    for await (const part of parts) {
      if (part.type === 'file') {
        const chunks: Buffer[] = [];

        for await (const chunk of part.file) {
          chunks.push(chunk);
        }

        const fileData = {
          id: part.filename,
          fieldname: part.fieldname,
          originalname: part.filename,
          buffer: Buffer.concat(chunks),
          mimetype: part.mimetype,
        };

        // Reel is a separate multipart field, everything else is a photo
        if (part.fieldname === 'reel') {
          reel = fileData;
        } else {
          files.push(fileData);
        }
      } else {
        body[part.fieldname] = part.value;
      }
    }

    return this.venueListingService.updatePhotos(
      id,
      body,
      files,
      getOwnerId(user),
      reel,
    );
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.LISTINGS_EDIT)
  @Post('DeletePhotos')
  DeletePhotos(@Body() body: any) {
    return this.venueListingService.DeletePhotos(body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.LISTINGS_EDIT)
  @Post('UpdateCoverPhotos')
  UpdateCoverPhotos(@Body() body: any) {
    return this.venueListingService.UpdateCoverPhotos(body);
  }

  /* ─────────────────────────────
     CAPACITY
  ───────────────────────────── */

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.LISTINGS_EDIT)
  @Patch(':id/capacity')
  async updateCapacity(@Param('id') id: string, @Body() body: any) {
    return this.venueListingService.updateCapacity(id, body);
  }

  /* ─────────────────────────────
     AMENITIES
  ───────────────────────────── */

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.LISTINGS_EDIT)
  @Patch(':id/amenities')
  async updateAmenities(@Param('id') id: string, @Body() body: any) {
    return this.venueListingService.updateAmenities(id, body);
  }

  /* ─────────────────────────────
     LOCATION
  ───────────────────────────── */

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.LISTINGS_EDIT)
  @Patch(':id/location')
  async updateLocation(@Param('id') id: string, @Body() body: any) {
    return this.venueListingService.updateLocation(id, body);
  }

  /* ─────────────────────────────
     PRICING
  ───────────────────────────── */

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.LISTINGS_EDIT)
  @Patch(':id/pricing')
  async updatePricing(@Param('id') id: string, @Body() body: any) {
    return this.venueListingService.updatePricing(id, body);
  }

  /* ─────────────────────────────
     TAGS
  ───────────────────────────── */

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.LISTINGS_EDIT)
  @Patch(':id/tags')
  async updateTags(@Param('id') id: string, @Body() body: any) {
    return this.venueListingService.updateTags(id, body);
  }

  /* ─────────────────────────────
     ADDONS (on a listing)
  ───────────────────────────── */

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.LISTINGS_EDIT)
  @Patch(':id/addons')
  async updateAddons(@Param('id') id: string, @Body() body: any) {
    return this.venueListingService.updateAddons(id, body);
  }

  /* ─────────────────────────────
     TERMS
  ───────────────────────────── */

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.LISTINGS_EDIT)
  @Patch(':id/terms')
  async updateTerms(@Param('id') id: string, @Body() body: any) {
    return this.venueListingService.updateTerms(id, body);
  }

  /* ─────────────────────────────
     VENUE SETTINGS
  ───────────────────────────── */

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.LISTINGS_EDIT)
  @Put('SaveVenueSetting/:id')
  async SaveVenueSetting(@Param('id') id: string, @Body() body: any) {
    return this.venueListingService.SaveVenueSetting(id, body);
  }

  /* ─────────────────────────────
     ADDON CATEGORIES
  ───────────────────────────── */

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.LISTINGS_EDIT)
  @Post('SaveCategory')
  SaveCategory(@CurrentUser() user: any, @Body() body: any) {
    return this.venueListingService.SaveCategory(getOwnerId(user), body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.LISTINGS_VIEW)
  @Get('LoadaddonCategory')
  LoadaddonCategory(@CurrentUser() user: any) {
    return this.venueListingService.LoadaddonCategory(getOwnerId(user));
  }

  /* ─────────────────────────────
     ADDONS (vendor addon library)
  ───────────────────────────── */

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.LISTINGS_EDIT)
  @Post('SaveAddon')
  async SaveAddon(@CurrentUser() user: any, @Req() req: FastifyRequest) {
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
          id: part.filename, // UUID from frontend
          buffer: Buffer.concat(chunks),
          mimetype: part.mimetype,
        });
      } else {
        body[part.fieldname] = part.value;
      }
    }

    return this.venueListingService.SaveAddon(getOwnerId(user), body, files);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.LISTINGS_VIEW)
  @Get('Loadaddon')
  Loadaddon(@CurrentUser() user: any) {
    return this.venueListingService.Loadaddon(getOwnerId(user));
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.LISTINGS_VIEW)
  @Get('getAddon')
  getAddon(@Query() query: any, @CurrentUser() user: any) {
    return this.venueListingService.getAddon(getOwnerId(user), query);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.LISTINGS_EDIT)
  @Delete('DeleteAddon/:id')
  DeleteAddon(@Param('id') id: string) {
    return this.venueListingService.DeleteAddon(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.LISTINGS_EDIT)
  @Post('ToggleAddon')
  ToggleAddon(@Body() body: any) {
    return this.venueListingService.ToggleAddon(body);
  }

  /* ─────────────────────────────
     OTHER (any logged-in user, no permission needed)
  ───────────────────────────── */

  @Get('guest_love_plcae')
  guest_love_plcae() {
    return this.venueListingService.guest_love_plcae();
  }
}