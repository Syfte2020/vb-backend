import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';

@Module({
  //imports: [TypeOrmModule.forFeature([User])],
  controllers: [LoyaltyController],
  providers: [LoyaltyService]
})
export class LoyaltyModule {}