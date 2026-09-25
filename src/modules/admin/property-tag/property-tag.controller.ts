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
import { PropertyTagService } from "./property-tag.service";

@Controller('admin/property')
export class PropertyTagController {
     constructor(
        private readonly propertyTagService: PropertyTagService,
      ) {}

       @Get("PropertyTagsApi")
  async findAll(
    @Query() query: any,
  ) {
    return await this.propertyTagService.findAll(
      query,
    );
  }

   @Post("PropertyTagsInsertApi")
async create(@Req() req: FastifyRequest) {
  try {
    const parts = req.parts();

    const body: any = {};

    let image: any = null;
    let video: any = null; // ✅ ADD VIDEO

    for await (const part of parts) {

      /*
      |--------------------------------------------------------------------------
      | FILES
      |--------------------------------------------------------------------------
      */

      if (part.type === "file") {
        const buffer = await part.toBuffer();

        const fileData = {
          buffer,
          filename: part.filename,
          mimetype: part.mimetype,
        };

        if (part.fieldname === "image") {
          image = fileData;
        }

        // ✅ VIDEO HANDLING
        if (part.fieldname === "video") {
          video = fileData;
        }
      }

      /*
      |--------------------------------------------------------------------------
      | FIELDS
      |--------------------------------------------------------------------------
      */

      if (part.type === "field") {
        body[part.fieldname] = String(part.value);
      }
    }

    return await this.propertyTagService.create(
      body,
      image,
      video // ✅ PASS VIDEO
    );

  } catch (error) {
    console.error(error);

    throw new BadRequestException(error);
  }
}
@Put("PropertyTagsUpdateApi/:id")
async update(
  @Param("id") id: number,
  @Req() req: FastifyRequest,
) {
  try {
    const parts = req.parts();

    const body: any = {};

    let video: any = null;

    let image: any = null;

    for await (const part of parts) {
      /*
      |--------------------------------------------------------------------------
      | FILES
      |--------------------------------------------------------------------------
      */
if (part.type === "file") {
        const buffer = await part.toBuffer();

        const fileData = {
          buffer,
          filename: part.filename,
          mimetype: part.mimetype,
        };

        if (part.fieldname === "image") {
          image = fileData;
        }

        // ✅ VIDEO HANDLING
        if (part.fieldname === "video") {
          video = fileData;
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

   return await this.propertyTagService.update(
    id,
      body,
      image,
      video // ✅ PASS VIDEO
    );
  } catch (error) {
    console.error(error);

    throw new BadRequestException(
      'uploaded filed',
    );
  }
}
//deletePropertyTagsApi
/*
  |--------------------------------------------------------------------------
  | DELETE
  |--------------------------------------------------------------------------
  */

  @Delete(
    "deletePropertyTagsApi/:id",
  )
  async remove(
    @Param("id") id: number,
  ) {
    return await this.propertyTagService.remove(
      id,
    );
  }
}
