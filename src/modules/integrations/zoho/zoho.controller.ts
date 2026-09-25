import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query
} from '@nestjs/common';
import { ZohoService } from './zoho.service';

@Controller('zoho')
export class ZohoController {
  constructor(private readonly zohoService: ZohoService) {}
 @Get('callback')
  async callback(@Query('code') code: string) {
    return this.zohoService.generateToken(code);
  }
   // 1. Create Customer
  
  @Post('customers')
  async createCustomer(@Body() body: any) {
    return this.zohoService.createCustomer(body);
  }
 
  @Get('customers')
  async getCustomers() {
    return this.zohoService.getCustomers();
  }
 
  @Get('customers/find')
  async findCustomerByEmail(@Query('email') email: string) {
    return this.zohoService.findCustomerByEmail(email);
  }
 
  //==========================================
  // ITEMS
  //==========================================
 
  @Post('items')
  async createItem(@Body() body: any) {
    return this.zohoService.createItem(body);
  }
 
  @Get('items')
  async getItems() {
    return this.zohoService.getItems();
  }
 
  @Get('items/:id')
  async getItemById(@Param('id') id: string) {
    return this.zohoService.getItemById(id);
  }
 
  //==========================================
  // BOOKINGS (SALES ORDERS)
  //==========================================
 
  @Post('bookings')
  async createBooking(@Body() body: any) {
    return this.zohoService.createBooking(body);
  }
 
  @Get('bookings')
  async getBookings() {
    return this.zohoService.getBookings();
  }
 
  @Get('bookings/:id')
  async getBooking(@Param('id') id: string) {
    return this.zohoService.getBooking(id);
  }
 
  @Post('bookings/:id/status/:status')
  async updateBookingStatus(
    @Param('id') id: string,
    @Param('status') status: string,
  ) {
    return this.zohoService.updateBookingStatus(id, status);
  }
 
  //==========================================
  // INVOICES
  //==========================================
 
  @Post('invoices')
  async createInvoice(@Body() body: any) {
    return this.zohoService.createInvoice(body);
  }
 
  @Get('invoices')
  async getInvoices() {
    return this.zohoService.getInvoices();
  }
 
  @Post('invoices/:id/close')
  async closeInvoice(@Param('id') id: string) {
    return this.zohoService.closeInvoice(id);
  }
 
  @Post('invoices/:id/email')
  async sendInvoiceEmail(
    @Param('id') id: string,
    @Body('email') email: string,
  ) {
    return this.zohoService.sendInvoiceEmail({ email, invoiceId: id });
  }
 
  //==========================================
  // PAYMENTS
  //==========================================
 
  @Post('payments')
  async recordPayment(@Body() body: any) {
    return this.zohoService.recordPayment(body);
  }
 
  @Get('payments')
  async getPayments() {
    return this.zohoService.getPayments();
  }
 
  //==========================================
  // ALL-IN-ONE: complete a booking end-to-end
  // POST /zoho/complete-booking
  // body: { customer, items, booking, payment }
  //==========================================
 
  @Post('complete-booking')
  async completeBookingZoho(@Body() body: any) {
    return this.zohoService.completeBookingZoho(body);
  }
}