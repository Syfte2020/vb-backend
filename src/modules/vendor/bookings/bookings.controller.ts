import {
  Controller,
  Get,
  UseGuards,
  Param,
  Put,
  Req,
  Patch,
  Post,
  Body,
  Query,
  Delete,
  Headers
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { BookingsService } from './bookings.service';
import { NotificationService } from '../../../notifications/notification.service';

@Controller('booking')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService,
     private readonly notificationService: NotificationService
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('InvoiceNOAPI')
  invoice_number(@CurrentUser() user: any, @Param('id') id: string) {
    return this.bookingsService.invoice_number(user?.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('load_shift_event')
  load_shift_event(@CurrentUser() user: any, @Param('id') id: string) {
    return this.bookingsService.load_shift_event(user?.id, id);
  }
  @UseGuards(JwtAuthGuard)
  @Post('available-venues')
  async availableVenues(@Body() body: any, @CurrentUser() user: any , @Headers('x-country') country: any) {
    return await this.bookingsService.availableVenues(body, user?.id , country);
  }

  @UseGuards(JwtAuthGuard)
  @Get('Load_all_packages')
  async Load_all_packages(@Body() body: any, @CurrentUser() user: any) {
    return await this.bookingsService.Load_all_packages(body, user?.id);
  }
  
  @UseGuards(JwtAuthGuard)
  @Post('loadAllAddons')
  async loadAllAddons(@Body() body: any, @CurrentUser() user: any) {
    return await this.bookingsService.loadAllAddons(body, user?.id);
  } 
  

  
  @UseGuards(JwtAuthGuard)
  @Get('globalSetting')
  async globalSetting(@Body() body: any, @CurrentUser() user: any) {
    return await this.bookingsService.globalSetting( user?.id,body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('ListVenueSetting')
  async ListVenueSetting(@Body() body: any, @CurrentUser() user: any) {
    return await this.bookingsService.ListVenueSetting( user?.id,body);
  }
  
  @UseGuards(JwtAuthGuard)
  @Post('booking_create')
  async booking_create(@Body() body: any, @CurrentUser() user: any,@Headers('x-country') country: any) {
    return await this.bookingsService.booking_create(body, user?.id,country);
  } 
  
  @UseGuards(JwtAuthGuard)
  @Get('all_reservations')
  async all_reservations(@Headers('x-category') category: any, @Headers('x-country') country: any,@CurrentUser() user: any) {
    return await this.bookingsService.all_reservations(category, country, user?.id);
  }
  
  @Get('reservation_invoice/:id')
  async reservation_invoice(@Param('id') id: any) {
    return await this.bookingsService.reservation_invoice(id);
  }
 @Get('reservation_manage/:id')
  async reservation_manage(@Param('id') id: any) {
    return await this.bookingsService.reservation_manage(id);
  }

   @UseGuards(JwtAuthGuard)
  @Get('Load_all_venues')
  async Load_all_venues(@CurrentUser() user: any) {
    return await this.bookingsService.Load_all_venues(user?.id);
  }

     @UseGuards(JwtAuthGuard)
  @Post('leads_create')
  async leads_create(@Body() body: any,@CurrentUser() user: any) {
    return await this.bookingsService.leads_create(body,user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('all_other_reserve')
  async all_other_reserve(@Headers('x-category') category: any, @Headers('x-country') country: any,@CurrentUser() user: any) {
    return await this.bookingsService.all_other_reserve(category, country, user?.id);
  }
  @UseGuards(JwtAuthGuard)
  @Post('historical_reserve')
  async historical_reserve(@Headers('x-category') category: any, @Headers('x-country') country: any,@CurrentUser() user: any) {
    return await this.bookingsService.historical_reserve(category, country, user?.id);
  }  
  @UseGuards(JwtAuthGuard)
  @Post('historical_upload')
  async historical_upload(@Headers('x-category') category: any, @Headers('x-country') country: any,@CurrentUser() user: any,@Body() body: any) {
    return await this.bookingsService.historical_upload(category, country, user?.id,body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('add_payment')
  async add_payment(@Headers('x-category') category: any, @Headers('x-country') country: any,@CurrentUser() user: any,@Body() body: any) {
    return await this.bookingsService.add_payment(category, country, user?.id,body);
  } 
  
  @UseGuards(JwtAuthGuard)
  @Post('refundSecurityDeposit')
  async refundSecurityDeposit(@Headers('x-category') category: any, @Headers('x-country') country: any,@CurrentUser() user: any,@Body() body: any) {
    return await this.bookingsService.refundSecurityDeposit(category, country, user?.id,body);
  }
 @UseGuards(JwtAuthGuard)
  @Post('handlGenerateInvoice')
  async handlGenerateInvoice(@Headers('x-category') category: any, @Headers('x-country') country: any,@CurrentUser() user: any,@Body() body: any) {
    return await this.bookingsService.handlGenerateInvoice(category, country, user?.id,body);
  }

  
 @UseGuards(JwtAuthGuard)
   @Get('all_notification')
  async all_notification(@Headers('x-category') category: any, @Headers('x-country') country: any,@CurrentUser() user: any) {
    return await this.bookingsService.all_notification(category,country,user?.id);
  } 
  
  
  @Get('realtimes')
  async realtimes() {
    return await this.bookingsService.realtimes();
  }

  @Get('getBookingConversations/:bookingId')
async getBookingConversations(
  @Param('bookingId') bookingId: number,
) {
  return this.bookingsService.getBookingConversations(
    Number(bookingId),
  );
}

 @UseGuards(JwtAuthGuard)
  @Post('booking_viewed')
  async booking_viewed(@Headers('x-category') category: any, @Headers('x-country') country: any,@CurrentUser() user: any,@Body() body: any) {
    return await this.bookingsService.booking_viewed(category, country, user?.id);
  }
 @UseGuards(JwtAuthGuard)
  @Patch('bookings/:id')
  async bookingfieldUpdate(@Param('id') id:any , @Body() body: any,@CurrentUser() user: any) {
    return await this.bookingsService.bookingfieldUpdate(id, body , user?.id);
  }
 @UseGuards(JwtAuthGuard)
  @Patch('AddonUpdate/:id')
  async AddonUpdate(@Param('id') id:any , @Body() body: any,@CurrentUser() user: any) {
    return await this.bookingsService.AddonUpdate(id, body , user?.id);
  }
 @UseGuards(JwtAuthGuard)
  @Patch('convertToBooking/:id')
async convertToBooking(
  @Param('id') bookingId: number,
  @CurrentUser() user: any
) {
  return this.bookingsService.convertToBooking(
    Number(bookingId),
    user?.id
  );
}
 @UseGuards(JwtAuthGuard)
  @Post('fetchCustomerSuggestions')
  async fetchCustomerSuggestions(@Headers('x-category') category: any, @Headers('x-country') country: any,@CurrentUser() user: any,@Body() body: any) {
    return await this.bookingsService.fetchCustomerSuggestions(category, country, user?.id);
  }
 @UseGuards(JwtAuthGuard)
  @Put('get_historical_details/:id')
  async get_historical_details(@Param('id') id: any) {
    return await this.bookingsService.get_historical_details(id);
  }



}
