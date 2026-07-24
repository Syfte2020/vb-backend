import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { VenueChild } from '../../../modules/listing/entities/venue-child.entity';
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
  controllers: [ChatController],
  providers: [ChatService],
   imports: [
    TypeOrmModule.forFeature([
      VenueChild,
    ]),
  ]
})
export class ChatModule {}
