import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "./entities/users.entity";
import { ListedVendorController } from './listed_vendor.controller';
import { ListedVendorService } from './listed_vendor.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [ListedVendorController],
  providers: [ListedVendorService]
})
export class ListedVendorModule {}