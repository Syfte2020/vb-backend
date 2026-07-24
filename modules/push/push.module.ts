import { Module } from '@nestjs/common';
import { PushController } from './push.controller';
import { PushService } from './push.service';

import { PushSubscription } from './entities/push-subscription.entity';

import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
  controllers: [PushController],
  providers: [PushService],
    imports: [
      TypeOrmModule.forFeature([
        PushSubscription
      ]),
    ]
})
export class PushModule {}
