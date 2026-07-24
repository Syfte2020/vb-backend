import { Module } from '@nestjs/common';
import { AgingController } from './aging.controller';
import { AgingService } from './aging.service';
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
  controllers: [AgingController],
  providers: [AgingService],
   imports: [
    TypeOrmModule.forFeature([
      
    ]),
  ]
})
export class AgingModule {}
