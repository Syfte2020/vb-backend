import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LoyaltyPoint } from "./entities/loyalty_point.entity";
import { LoyaltyTier } from "./entities/loyalty_tiers.entity";
import { MasterController } from './master.controller';
import { MasterService } from './master.service';

@Module({
  imports: [TypeOrmModule.forFeature([LoyaltyPoint,LoyaltyTier])],
  controllers: [MasterController],
  providers: [MasterService]
})
export class MasterModule {}