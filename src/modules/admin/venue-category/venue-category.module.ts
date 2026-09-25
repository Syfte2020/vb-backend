import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Category } from "./entities/category.entity";
import { VenueCategory } from "./entities/venue-category.entity";
import { VenueCategoryController } from './venue-category.controller';
import { VenueCategoryService } from './venue-category.service';

@Module({
  imports: [TypeOrmModule.forFeature([Category, VenueCategory])],
  controllers: [VenueCategoryController],
  providers: [VenueCategoryService]
})
export class VenueCategoryModule {}