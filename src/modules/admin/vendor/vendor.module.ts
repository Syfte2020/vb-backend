import { Module } from '@nestjs/common';
import { TypeOrmModule } from "@nestjs/typeorm";
import { VendorController } from './vendor.controller';
import { VendorService } from './vendor.service';

import { Amenities } from "./amenities/entities/amenities.entity";
import { AmenitiesCategory } from "./amenities/entities/amenities-category.entity";

import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
// import { JwtStrategy } from '../../auth/strategies/jwt.strategy';

import { JwtStrategy } from '../../auth/strategies/jwt.strategy';


@Module({
  controllers: [VendorController],
  providers: [VendorService,JwtStrategy],
    imports: [
    TypeOrmModule.forFeature([
      Amenities,
      AmenitiesCategory,
    ]),
    ActivityLogsModule
  ],
})
export class VendorModule {}
