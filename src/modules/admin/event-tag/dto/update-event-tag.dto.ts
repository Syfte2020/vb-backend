import { PartialType } from "@nestjs/mapped-types";

import { CreateEventTagDto } from "./create-event-tag.dto";

export class UpdateEventTagDto
  extends PartialType(
    CreateEventTagDto,
  ) {}