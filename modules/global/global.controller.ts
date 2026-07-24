import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  Patch,
  Query,
  Put,
  Headers
} from '@nestjs/common';

import { GlobalService } from './global.service';

@Controller('global')
export class GlobalController {
  constructor(private readonly globalService: GlobalService) {}
  @Get('events')
  findEvent() {
    return this.globalService.findEvent();
  }

  @Get('property')
  findProperty(@Query() query: any) {
    return this.globalService.findProperty(query);
  } 
  @Get('getPropertyName')
  findNameProperty(@Query() query: any) {
    return this.globalService.findNameProperty(query);
  }  
  
  @Get('findPropertyname')
  findPropertyname(@Query() query: any) {
    return this.globalService.findPropertyname(query);
  } 
  @Get('Category')
  LoadAllCategory() {
    return this.globalService.LoadAllCategory();
  }
  @Get('country')
  LoadAllCountry() {
    return this.globalService.LoadAllCountry();
  } 
  @Get('getAmenties')
  LoadGetAmenties(@Query() query: any) {
    return this.globalService.LoadGetAmenties(query);
  }   
  
 

  @Get('country_of_category')
  country_of_category(@Headers('x-country') country_id: number) {
    return this.globalService.countryOfCategory(country_id);
  } 
  
  // @Put('general_settings/:id')
  // general_settings(@Headers('x-country') country_id: number,@Param('id') id: string) {
  //   return this.globalService.general_settings(id);
  // } 
  @Get('getAllCurrencies')
  getAllCurrencies(@Query() query: any) {
    return this.globalService.getAllCurrencies();
  }
  
}
