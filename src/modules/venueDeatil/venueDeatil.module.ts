import { Module } from '@nestjs/common';
import { VenueDetailService } from './venueDeatil.service';
import { VenueDeatilController } from './venueDeatil.controller';
import { VenueChild } from '../../modules/listing/entities/venue-child.entity';
import { TypeOrmModule } from "@nestjs/typeorm";

import { InvoiceModule } from '../invoice/invoice.module';

@Module({
  imports: [
    InvoiceModule,
    TypeOrmModule.forFeature([VenueChild]),
  ],
  controllers: [VenueDeatilController],
  providers: [VenueDetailService],
  exports: [VenueDetailService],
})
export class VenueDeatilModule {}