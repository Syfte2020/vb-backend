import { Module } from '@nestjs/common';
import { CompareService } from './compare.service';
import { CompareController } from './compare.controller';

@Module({
  providers: [CompareService],
  exports: [CompareService],
   controllers: [CompareController],
})
export class CompareModule {}