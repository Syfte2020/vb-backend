import { Module } from '@nestjs/common';
import { RewardController } from './rewards.controller';
import { RewardService } from './rewards.service';
import { TypeOrmModule } from "@nestjs/typeorm";



import { ZohoModule } from '../integrations/zoho/zoho.module';
@Module({
   imports: [
    ZohoModule,
      TypeOrmModule.forFeature([
       

      ]),
      
    ],
  controllers: [RewardController],
  providers: [RewardService],
   
})
export class RewardModule {}
