import { Module } from '@nestjs/common';
import { PaxController } from './pax.controller';
import { PaxService } from './pax.service';
import { TypeOrmModule } from "@nestjs/typeorm";

import { PackageCategory } from '../vendor/packages/entity/package-category.entity';

@Module({
  controllers: [PaxController],
  providers: [PaxService],
  imports: [
        TypeOrmModule.forFeature([
          PackageCategory
        ]),
      ]
})
export class PaxModule {}
