import { Module } from '@nestjs/common';
import { ParentListingController } from './parent-listing.controller';
import { ParentListingService } from './parent-listing.service';
import { VenueChild } from '../../../modules/listing/entities/venue-child.entity';
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
  controllers: [ParentListingController],
  providers: [ParentListingService],
   imports: [
    TypeOrmModule.forFeature([
      VenueChild,
    ]),
  ]
})
export class ParentListingModule {}
