import nodemailer from 'nodemailer';
import { generatePdfBuffer } from '../pdf/pdf.generator';
import { invoiceTemplate } from "./templates/invoice.template";

//Enquire
import { enquiryTemplate } from "./templates/enquiry.template";


export async function sendInvoiceEmail(data: any) {

    const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const pdf = await generatePdfBuffer(data);

  await transporter.sendMail({

    from: 'Invoice System <no-reply@system.com>',

    to: data.email,

    subject: `Invoice - ${data.refNo}`,

    text: `Invoice ${data.refNo}`,

    html: invoiceTemplate(data),

    attachments: [
      {
        filename: `Invoice-${data.refNo}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      },
    ],

  });
}


export async function sentEnquireEmail(data:any)
{
   const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

await transporter.sendMail({
  from: `"venuebook.in" <no-reply@system.com>`,
  to: data.email,
  subject: `Enquiry Received - ${data.enquiryId}`,
  html: enquiryTemplate({
    customerName: data.customerName,
    venueName: data.venueName,
    enquiryId: data.enquiryId,
    enquiryDate: data.enquiryDate,
    eventDate: data.eventDate,
    eventType: data.eventType,
    guests: data.guests,
    message: data.message,
  }),
});
}

export async function sendOtpEmail(data: {
  email: string;
  otp: string;
}) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"venuebook.in" <${process.env.EMAIL_USER}>`,
    to: data.email,
    subject: 'Venuebook.in - Email Verification OTP',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>

      <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
        <div style="max-width:600px;margin:40px auto;background:#ffffff;padding:30px;border-radius:10px;">
          
          <h2 style="text-align:center;color:#222;">
            Venuebook.in
          </h2>

          <p>Hello,</p>

          <p>
            Use the following OTP to verify your email address:
          </p>

          <div style="
            text-align:center;
            margin:30px 0;
          ">
            <span style="
              display:inline-block;
              background:#f3f3f3;
              padding:15px 30px;
              font-size:30px;
              font-weight:bold;
              letter-spacing:8px;
              border-radius:8px;
            ">
              ${data.otp}
            </span>
          </div>

          <p>
            This OTP is valid for <strong>10 minutes</strong>.
          </p>

          <p>
            Please do not share this OTP with anyone.
          </p>

          <br />

          <p>
            Regards,<br />
            <strong>Venuebook.in Team</strong>
          </p>

        </div>
      </body>
      </html>
    `,
  });
}
