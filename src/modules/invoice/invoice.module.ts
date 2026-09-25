import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([]), // 👈 IMPORTANT
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService],
  exports: [InvoiceService], // 👈 IMPORTANT
})
export class InvoiceModule {}