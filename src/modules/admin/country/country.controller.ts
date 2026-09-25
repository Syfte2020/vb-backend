import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";

import { CountryService } from "./country.service";
import { CreateCountryDto } from "./dto/create-country.dto";
import { UpdateCountryDto } from "./dto/update-country.dto";

// import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ACTIVITY_MODULE } from "../activity-logs/decorators/activity-module.decorator";
@ACTIVITY_MODULE("Currency")

@Controller("admin/country")
export class CountryController {

  constructor(private readonly countryService: CountryService) {}

  /* CREATE */
  @Post('countryInsertApi')
  create(@Body() dto: CreateCountryDto, @Req() req) {
    return this.countryService.create(dto, req.user?.id);
  }

  /* LIST */
  @Get('countryApi')
  findAll(@Query() query: any) {
    return this.countryService.findAll(query);
  }

  /* SINGLE */
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.countryService.findOne(id);
  }

  /* UPDATE */
  @Put("countryUpdateApi/:id")
  update(@Param("id") id: string, @Body() dto: UpdateCountryDto) {
    return this.countryService.update(id, dto);
  }

  /* DELETE */
  @Delete("deleteCountryApi/:id")
  remove(@Param("id") id: string) {
    return this.countryService.remove(id);
  }
}