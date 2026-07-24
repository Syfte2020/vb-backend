import { Injectable } from '@nestjs/common';

@Injectable()
export class BookingService {
  createBooking(data: any) {
    return { message: 'booking created', data };
  }
}