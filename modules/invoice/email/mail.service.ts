import nodemailer from 'nodemailer';
import { generatePdfBuffer } from '../pdf/pdf.generator';

export async function sendInvoiceEmail(data: any) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const pdfBuffer = await generatePdfBuffer(data);

  await transporter.sendMail({
    from: 'Invoice System <no-reply@system.com>',
    to: data.email,
    subject: `Invoice - ${data.refNo}`,
    text: 'Please find attached your invoice.',
    attachments: [
      {
        filename: `invoice_${data.refNo}.pdf`,
        content: pdfBuffer,
      },
    ],
  });
}