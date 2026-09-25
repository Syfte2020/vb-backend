import { Controller, Get, Param, Post, Res , Put , Body} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import  { InvoiceService } from './invoice.service';

@Controller('invoice')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get('download/:id')
  async download(
    @Param('id') id: number,
    @Res() reply: FastifyReply,
  ) {
    const pdfBuffer = await this.invoiceService.downloadPdf(id);

    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename=invoice_${id}.pdf`)
      .send(pdfBuffer);
  }

  @Post('send_invoice')
  async email(@Body() body: any) {
    return this.invoiceService.emailInvoice(body);
  }
}