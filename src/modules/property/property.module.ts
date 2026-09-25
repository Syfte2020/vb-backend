import { Module } from '@nestjs/common';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';
import { CommonModule } from '../../common/common.module';

@Module({
  controllers: [PropertyController],
  providers: [PropertyService],
   imports: [
    CommonModule
   ]
})
export class PropertyModule {}
