import { Module } from '@nestjs/common';
import { VenueService } from './venue.service';
import { VenueController } from './venue.controller';
import { VenueChild } from '../../modules/listing/entities/venue-child.entity';
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
  providers: [VenueService],
  controllers: [VenueController],
  exports: [VenueService],
    imports: [
    TypeOrmModule.forFeature([
      VenueChild,
    ]),
  ],
})
export class VenueModule {}