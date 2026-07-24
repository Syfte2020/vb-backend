import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { SocketModule } from '../modules/socket/socket.module';

@Module({
  controllers: [NotificationController],
  imports: [SocketModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}