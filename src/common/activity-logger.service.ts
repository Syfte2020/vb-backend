import { Injectable } from '@nestjs/common';
import { LogsService } from '../logs/logs.service';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class ActivityLoggerService {
  constructor(
    private logsService: LogsService,
    private notificationService: NotificationService,
  ) {}

  async log(
    {
      user_id,
      action,
      module,
      message,
      meta = {},
      notify = false,
      title = '',
      type = '',
      description = '',
      reference_type = '',
      reference_id = '',
    }: {
      user_id: string;
      action: string;
      module: string;
      message: string;
      meta?: any;
      notify?: boolean;
      title?: string;
      type?: string;
      description?: string;
      reference_type?: string;
      reference_id?: string;
    },
    req?: any, // ✅ correct position
  ) {
    // ✅ Always log (pass req here)
    await this.logsService.createLog(
      {
        user_id,
        action,
        module,
        description,
        reference_type,
        reference_id,
      },
      req, // 👈 IMPORTANT
    );

    // 🔔 Notify only if required
   
  }
}