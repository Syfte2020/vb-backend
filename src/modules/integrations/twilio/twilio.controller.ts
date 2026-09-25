import { Body, Controller, Post,Get ,Query} from '@nestjs/common';
import { TwilioService } from './twilio.service';

@Controller('twilio')
export class TwilioController {
  constructor(private readonly twilioService: TwilioService) {}

  @Get('sms')
  async sendSMS(@Body() body: any) {
    return await this.twilioService.sendSMS(
     // body.to,
     // body.message,
     "+917760384559",
     "409173"
    );
  }

@Get("whatsapp")
async sendWhatsApp() {
  return this.twilioService.sendWhatsApp(
    "+918147484371",
    "409173",
  );
}
}