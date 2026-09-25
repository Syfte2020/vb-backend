import { Module } from '@nestjs/common';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';
import { PackageCategory } from './entity/package-category.entity';
import { PackageItem } from './entity/package-item.entity';
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
  controllers: [PackagesController],
  providers: [PackagesService],
    imports: [
      TypeOrmModule.forFeature([
        PackageCategory,
        PackageItem
      ]),
    ]
})
export class PackagesModule {}
