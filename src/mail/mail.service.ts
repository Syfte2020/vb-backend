import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  async sendMail(to: string, subject: string, html: string) {
    return this.transporter.sendMail({
      from: `"Venue Platform" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
  }

   async sendTeamInviteEmail(params: {
    to: string;
    name: string;
    teamName: string;
    token: string;
  }): Promise<void> {
    const { to, name, teamName, token } = params;
    const inviteUrl = `${process.env.APP_URL}/accept-invite?token=${token}`;

    await this.transporter.sendMail({
      from: process.env.EMAIL_USER || 'no-reply@venuebook.in',
      to,
      subject: `You've been added to ${teamName} on venuebook.in`,
      html: `
        <p>Hi ${name},</p>
        <p>You've been invited to join <strong>${teamName}</strong> on venuebook.in.</p>
        <p><a href="${inviteUrl}">Accept the invite and set your password</a></p>
        <p>This link expires in 7 days.</p>
      `,
    });
  }
}