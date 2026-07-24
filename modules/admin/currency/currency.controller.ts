import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Put,
  Delete,
  Req,
  UseGuards,
} from "@nestjs/common";

import { CurrencyService } from "./currency.service";
import { CreateCurrencyDto } from "./dto/create-currency.dto";
import { UpdateCurrencyDto } from "./dto/update-currency.dto";


// import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ACTIVITY_MODULE } from "../activity-logs/decorators/activity-module.decorator";
@ACTIVITY_MODULE("Currency")

@Controller("admin/currency")
export class CurrencyController {

  constructor(private readonly currencyService: CurrencyService) {}

  /* CREATE */
  @Post('currencyInsertApi')
  create(@Req() req, @Body() dto: CreateCurrencyDto) {
    return this.currencyService.create(dto, req.user?.id);
  }

  /* GET ALL */
  @Get('currencyApi')
  findAll(@Query() query: any) {
    return this.currencyService.findAll(query);
  }

  /* GET ONE */
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.currencyService.findOne(id);
  }

  /* UPDATE */
  @Put("currencyUpdateApi/:id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateCurrencyDto,
  ) {
    return this.currencyService.update(id, dto);
  }

  /* DELETE */
  @Delete("deleteCurrencyApi/:id")
  remove(@Param("id") id: string) {
    return this.currencyService.remove(id);
  }
}