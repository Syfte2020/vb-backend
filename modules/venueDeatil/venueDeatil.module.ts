import { Module } from '@nestjs/common';
import { VenueDetailService } from './venueDeatil.service';
import { VenueDeatilController } from './venueDeatil.controller';
import { VenueChild } from '../../modules/listing/entities/venue-child.entity';
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
  providers: [VenueDetailService],
  controllers: [VenueDeatilController],
  exports: [VenueDetailService],
    imports: [
    TypeOrmModule.forFeature([
      VenueChild,
    ]),
  ],
})
export class VenueDeatilModule {}