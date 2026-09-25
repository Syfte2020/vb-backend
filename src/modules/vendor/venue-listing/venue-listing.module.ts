import { Module } from '@nestjs/common';
import { VenueListingController } from './venue-listing.controller';
import { VenueListingService } from './venue-listing.service';
import { VenueChild } from '../../../modules/listing/entities/venue-child.entity';
import { TypeOrmModule } from "@nestjs/typeorm";
import { SocketModule } from '../../socket/socket.module'

@Module({
  controllers: [VenueListingController],
  providers: [VenueListingService],
   imports: [
    SocketModule,
    TypeOrmModule.forFeature([
      VenueChild,
    ]),
  ]
})
export class VenueListingModule {}
