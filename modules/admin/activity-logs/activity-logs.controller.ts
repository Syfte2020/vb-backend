// activity-logs.controller.ts

import {

  Controller,

  Get,

  Param,

  Post,

  Body,

} from "@nestjs/common";

import { ActivityLogsService } from "./activity-logs.service";

@Controller("activity-logs")

export class ActivityLogsController {

  constructor(

    private readonly activityLogsService:
      ActivityLogsService,

  ) {}

  /*
  |--------------------------------------------------------------------------
  | CREATE LOG
  |--------------------------------------------------------------------------
  */

  @Post()

  create(
    @Body() dto: any,
  ) {

    return this.activityLogsService.create(
      dto,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | GET ALL LOGS
  |--------------------------------------------------------------------------
  */

  @Get()

  findAll() {

    return this.activityLogsService.findAll();
  }

  /*
  |--------------------------------------------------------------------------
  | GET SINGLE LOG
  |--------------------------------------------------------------------------
  */

  @Get(":id")

  findOne(
    @Param("id") id: number,
  ) {

    return this.activityLogsService.findOne(
      id,
    );
  }
}