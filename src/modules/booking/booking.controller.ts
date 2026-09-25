import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Query,
  Req,
  Body,
  Headers,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';

import { BookingService } from './booking.service';

@Controller('booking')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @UseGuards(JwtAuthGuard)
  @Get('profile_main_page')
  profile_main_page(@CurrentUser() user: any) {
    const userId = user?.id;
    return this.bookingService.profile_main_page(userId);
  } 
  
  @UseGuards(JwtAuthGuard)
  @Get('allbookingData')
  allbookingData(@CurrentUser() user: any) {
    const userId = user?.id;
    return this.bookingService.allbookingData(userId);
  }
 @UseGuards(JwtAuthGuard)
  @Post('editBookingRequest')
async editRequest(
  @Body() body: any,
  @Req() req: any,
) {
  return await this.bookingService.editRequest(body, req.user.id);
} 

@UseGuards(JwtAuthGuard)
  @Get('getUnreadMessageCount')
async getUnreadMessageCount(
 @CurrentUser() user: any
) {
  const userId = user?.id;
  return await this.bookingService.getUnreadMessageCount(userId);
}
@UseGuards(JwtAuthGuard)
@Post('sendProsalToCustomer')
async sendProsalToCustomer(
  @Body() body: any,
  @CurrentUser() user: any
) {
  const userId = user?.id;
  try {
    const {
      bookingId,
      conversationId,
      quotation,
    } = body;

    if (!bookingId) {
      return {
        success: false,
        message: 'Booking ID is required',
      };
    }

    if (!conversationId) {
      return {
        success: false,
        message: 'Conversation ID is required',
      };
    }

    if (!quotation) {
      return {
        success: false,
        message: 'Quotation data is required',
      };
    }

    const result =
      await this.bookingService.createQuotationChatMessage(
        Number(bookingId),
        Number(conversationId),
        Number(userId),
        quotation,
      );

    return {
      success: true,
      message: 'Quotation sent successfully',
      data: result,
    };
  } catch (error) {
    console.error(
      'sendProsalToCustomer error:',
      error,
    );

    return {
      success: false,
      message:
        'Failed to send quotation',
    };
  }
}
@UseGuards(JwtAuthGuard)
@Post('cancelpax')
async cancelpax(
  @Body() body: any,
  @CurrentUser() user: any
) {

 const userId = user?.id;
  return await this.bookingService.cancelpax(userId,body);
}

@UseGuards(JwtAuthGuard)
@Post('proposal_status')
async proposal_status(
  @Body() body: any,
  @CurrentUser() user: any
) {

 const userId = user?.id;
  return await this.bookingService.proposal_status(userId,body);
}
}
