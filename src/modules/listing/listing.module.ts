import { Module } from '@nestjs/common';
import { ListingController } from './listing.controller';
import { ListingService } from './listing.service';
import { TypeOrmModule } from "@nestjs/typeorm";

import { VenueParent } from "./entities/venue-parent.entity";
import { VenueChild } from "./entities/venue-child.entity";
import { VenueChildAmenities } from "./entities/venue-child-amenities.entity";

import { VenueGallery } from "./entities/venue-gallery.entity";
import { VenueShiftTiming } from "./entities/venue-shift-timing.entity";
import { VenueShiftHeader } from "./entities/venue-shift-header.entity";
import { VenueGalleryCategory } from "./entities/venue-gallery-category.entity";
import { UserRole } from "./entities/user-role.entity";
 import { UserEntity } from './entities/user.entity';
 import { Pricing } from './entities/property_pricing.entity';

 import { Destination } from './entities/destination.entity';
 import { DestinationPlace } from './entities/destination-place.entity';
 import { VenueSeatingStyle } from './entities/venue_seating_styles.entity';


import { ZohoModule } from '../integrations/zoho/zoho.module';
@Module({
   imports: [
    ZohoModule,
      TypeOrmModule.forFeature([
        VenueParent,
        VenueChild,
        VenueChildAmenities,
        VenueGallery,
        VenueShiftTiming,
        VenueShiftHeader,
        VenueGalleryCategory,
        UserRole,
         UserEntity,
         Pricing,
         Destination,
         DestinationPlace,
         VenueSeatingStyle

      ]),
      
    ],
  controllers: [ListingController],
  providers: [ListingService],
   
})
export class ListingModule {}
