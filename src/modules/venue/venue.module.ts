import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VenueController } from './venue.controller';
import { VenueService } from './venue.service';

import { VenueChild } from '../../modules/listing/entities/venue-child.entity';
import { SocketModule } from '../socket/socket.module';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [
    SocketModule,
    TypeOrmModule.forFeature([
      VenueChild,
    ]),
  ],
  controllers: [VenueController],
  providers: [VenueService,JwtService],
  exports: [VenueService],
})
export class VenueModule {}