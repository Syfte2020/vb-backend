import { Module } from "@nestjs/common";

import { TypeOrmModule } from "@nestjs/typeorm";

import { EventTag } from "./entities/event-tag.entity";

import { EventTagsController } from "./event-tag.controller";

import { EventTagsService } from "./event-tag.service";

@Module({

  imports: [
    TypeOrmModule.forFeature([
      EventTag,
    ]),
  ],

  controllers: [
    EventTagsController,
  ],

  providers: [EventTagsService],
})
export class EventTagsModule {}