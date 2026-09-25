// ======================================================
// MODULE
// src/modules/unregistered/unregistered.module.ts
// ======================================================

import { Module } from "@nestjs/common";

import { TypeOrmModule } from "@nestjs/typeorm";

import { HttpModule } from "@nestjs/axios";

import { UnregisteredController } from "./scraped-data.controller";

import { UnregisteredService } from "./scraped-data.service";

import { UnregisteredVenue } from "./entities/unregistered-venue.entity";

import { UnregisteredGallery } from "./entities/unregistered-gallery.entity";

import { UnregisteredTypes } from "./entities/unregistered-types.entity";

import { UnregisteredEventTypes } from "./entities/unregistered-event-types.entity";


//country

import { Country } from "./entities/country.entiity";

@Module({

  imports: [

    TypeOrmModule.forFeature([

      UnregisteredVenue,
      UnregisteredGallery,
      UnregisteredTypes,
      UnregisteredEventTypes,
      Country

    ]),

    HttpModule,

  ],

  controllers: [UnregisteredController],

  providers: [UnregisteredService],

})

export class UnregisteredModule {}