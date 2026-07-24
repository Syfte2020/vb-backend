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
import type {
  FastifyRequest,
} from "fastify";

import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { ChatService } from './chat.service';
import { Category } from 'src/modules/admin/property-tag/entities/property-tag.entity';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @UseGuards(JwtAuthGuard)
  @Post('startConversation')
  startConversation(
    @CurrentUser() user: any,@Param('id') id: string, 
    @Headers('x-country') country:any,
    @Headers('x-category') category:any ,
    @Body() body: { booking_id: number; customer_id: number }

) {
    const normalizedCategory = category.replace(/s$/, "");
    return this.chatService.startConversation(
      user?.id , 
      normalizedCategory,
      country,
      body.booking_id,
    body.customer_id,
    );
  }
 @Get('messages/:conversationId')
  async getMessages(
    @Param('conversationId') conversationId: number,
    @Query('userId') userId: number,
  ) {
    return await this.chatService.getConversationMessages(
      Number(conversationId),
      Number(userId),
    );
  }
   @UseGuards(JwtAuthGuard)
   @Post('send_messages')
  async send_messages(
     @Body() body: any,
     @CurrentUser() user: any
  ) {
    return await this.chatService.send_messages(
      body,
      user?.id
    );
  }
  
  @UseGuards(JwtAuthGuard)
   @Get('all_messages')
  async all_messages(
     @Body() body: any,
     @CurrentUser() user: any
  ) {
    return await this.chatService.all_messages(
      body,
      user?.id
    );
  }
  
}