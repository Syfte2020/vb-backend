import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Query,
  Req,
  BadRequestException,
} from "@nestjs/common";

import type {
  FastifyRequest,
} from "fastify";

import { EventTagsService } from "./event-tag.service";

@Controller("admin/eventTag")
export class EventTagsController {
  constructor(
    private readonly eventTagsService: EventTagsService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | CREATE
  |--------------------------------------------------------------------------
  */

  @Post("eventTagsInsertApi")
async create(
  @Req() req: FastifyRequest,
) {
  try {
    const parts = req.parts();

    const body: any = {};

    let icon: any = null;

    let image: any = null;

    for await (const part of parts) {
      /*
      |--------------------------------------------------------------------------
      | FILES
      |--------------------------------------------------------------------------
      */

      if (part.type === "file") {
        const buffer =
          await part.toBuffer();

        const fileData = {
          buffer,
          filename: part.filename,
          mimetype: part.mimetype,
        };

        if (
          part.fieldname === "icon"
        ) {
          icon = fileData;
        }

        if (
          part.fieldname === "image"
        ) {
          image = fileData;
        }
      }

      /*
      |--------------------------------------------------------------------------
      | FIELDS
      |--------------------------------------------------------------------------
      */

      if (part.type === "field") {
        body[part.fieldname] =
          String(part.value);
      }
    }

    return await this.eventTagsService.create(
      body,
      icon,
      image,
    );
  } catch (error) {
    console.error(error);

    throw new BadRequestException(
      error,
    );
  }
}

  /*
  |--------------------------------------------------------------------------
  | FIND ALL
  |--------------------------------------------------------------------------
  */

  @Get("eventTagsApi")
  async findAll(
    @Query() query: any,
  ) {
    return await this.eventTagsService.findAll(
      query,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | FIND ONE
  |--------------------------------------------------------------------------
  */

  @Get(":id")
  async findOne(
    @Param("id") id: string,
  ) {
    return await this.eventTagsService.findOne(
      id,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | UPDATE
  |--------------------------------------------------------------------------
  */

  @Put("eventTagsUpdateApi/:id")
async update(
  @Param("id") id: string,
  @Req() req: FastifyRequest,
) {
  try {
    const parts = req.parts();

    const body: any = {};

    let icon: any = null;

    let image: any = null;

    for await (const part of parts) {
      /*
      |--------------------------------------------------------------------------
      | FILES
      |--------------------------------------------------------------------------
      */

      if (part.type === "file") {
        // Skip empty upload
        if (!part.filename) {
          continue;
        }

        const buffer =
          await part.toBuffer();

        // Skip empty buffer
        if (
          !buffer ||
          buffer.length === 0
        ) {
          continue;
        }

        const fileData = {
          buffer,
          filename: part.filename,
          mimetype: part.mimetype,
        };

        if (
          part.fieldname === "icon"
        ) {
          icon = fileData;
        }

        if (
          part.fieldname === "image"
        ) {
          image = fileData;
        }
      }

      /*
      |--------------------------------------------------------------------------
      | FIELDS
      |--------------------------------------------------------------------------
      */

      if (part.type === "field") {
        body[part.fieldname] =
          String(part.value);
      }
    }

    return await this.eventTagsService.update(
      id,
      body,
      icon,
      image,
    );
  } catch (error) {
    console.error(error);

    throw new BadRequestException(
      'uploaded filed',
    );
  }
}

  /*
  |--------------------------------------------------------------------------
  | DELETE
  |--------------------------------------------------------------------------
  */

  @Delete(
    "deleteEventTagsApi/:id",
  )
  async remove(
    @Param("id") id: string,
  ) {
    return await this.eventTagsService.remove(
      id,
    );
  }
}