import { Module } from "@nestjs/common";

import { TypeOrmModule } from "@nestjs/typeorm";

import { VenueTag } from "./entities/venue-tag.entity";

import { VenueTagsController } from "./venue-tag.controller";

import { VenueTagsService } from "./venue-tag.service";

@Module({

  imports: [
    TypeOrmModule.forFeature([
      VenueTag,
    ]),
  ],

  controllers: [
    VenueTagsController,
  ],

  providers: [VenueTagsService],
})
export class VenueTagsModule {}