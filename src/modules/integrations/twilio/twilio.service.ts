import { Injectable } from '@nestjs/common';
import { Twilio } from 'twilio';

@Injectable()
export class TwilioService {
  private client: Twilio;

  constructor() {
    this.client = new Twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
  }

  async sendSMS(to: string, otp: string) {
    return await this.client.messages.create({
      from: process.env.TWILIO_PHONE,
      to,
      contentSid: "HXb8f2327ab12b6f64ee654810abdd6856",
    contentVariables: JSON.stringify({
      "1": otp,
    }),
    });
  }

//  async sendWhatsApp({to,body}: {
//   to: any;
//   body: any;
// }) {
//   return this.client.messages.create({
//    from: process.env.TWILIO_WHATSAPP_FROM,
//     to: `whatsapp:${to}`,
//     body,
//   });
// }

async sendWhatsApp(to: string, otp: string) {
  return await this.client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: `whatsapp:${to}`,
    messagingServiceSid: "MG0dd45639d36f5f5dbaa906e31efa8ffe",
    contentSid: "HXe4c8553778e62d46393aa1299cb13a8c",
    contentVariables: JSON.stringify({
      "1": otp,
    }),
  });
}
}

