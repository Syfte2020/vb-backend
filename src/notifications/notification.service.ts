import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SocketService } from '../modules/socket/socket.service';

@Injectable()
export class NotificationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly socketService: SocketService,
  ) {}

 async createNotification({
  type,
  referenceId,
  title,
  message,
  createdBy,
}: {
  type: string;
  referenceId: number | string | null;
  title: string;
  message: string;
  createdBy: number;
}) {
    // 1. Create notification
    const result: any = await this.dataSource.query(
      `
      INSERT INTO notifications
      (
          type,
          reference_id,
          title,
          message,
          user_id
      )
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        type,
        referenceId,
        title,
        message,
        createdBy,
      ],
    );

    const notificationId = result.insertId;

    // 2. Get users
    const users = await this.dataSource.query(`
        SELECT id
        FROM users
    `);

    if (!users.length) return;

    // 3. Assign notification to users
    const placeholders = users
      .map(() => '(?, ?, 0)')
      .join(',');

    const params = users.flatMap((u) => [
      notificationId,
      u.id,
    ]);

    await this.dataSource.query(
      `
      INSERT INTO notification_users
      (
          notification_id,
          user_id,
          is_read
      )
      VALUES ${placeholders}
      `,
      params,
    );

    // 4. Send realtime notification
    for (const u of users) {
      this.socketService.realtime(
        u.id.toString(),
        type,
        message,
      );
    }
  }

  async all_notifications(userId: any)
  {
    const [counts, notifications] = await Promise.all([
  this.dataSource.query(
    `
    SELECT
      (
        SELECT COUNT(*)
        FROM notification_users
        WHERE user_id = ?
          AND is_read = 0
      ) AS notification_count,

      (
        SELECT COUNT(*)
        FROM bookings
        WHERE vendor_id = ?
          AND is_read = 0
      ) AS booking_count
    `,
    [userId, userId],
  ),

  this.dataSource.query(
    `
    SELECT
      n.id,
      n.title,
      n.message,
      n.type,
      n.reference_id,
      nu.is_read,
      n.created_at
    FROM notification_users nu
    JOIN notifications n
      ON n.id = nu.notification_id
    WHERE nu.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT 5
    `,
    [userId],
  ),
]);

return {
  counts: counts[0],
  notifications,
};
  }

  
}