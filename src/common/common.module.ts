import { Module } from '@nestjs/common';
import { ActivityLoggerService } from './activity-logger.service';
import { LogsModule } from '../logs/logs.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [LogsModule, NotificationModule],
  providers: [ActivityLoggerService],
  exports: [ActivityLoggerService],
})
export class CommonModule {}