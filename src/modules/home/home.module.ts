import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { CategoryModule } from '../category/category.module';
import { VenueModule } from '../venue/venue.module';

@Module({
  imports: [CategoryModule, VenueModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}