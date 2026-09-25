import { Module } from '@nestjs/common';
import { ZohoController } from './zoho.controller';
import { ZohoService } from './zoho.service';

@Module({
  controllers: [ZohoController],
  providers: [ZohoService],
  exports: [ZohoService],
})
export class ZohoModule {}