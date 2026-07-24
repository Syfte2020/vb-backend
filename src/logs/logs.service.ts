import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class LogsService {
  constructor(private dataSource: DataSource) {}

async createLog(data: any, req?: any) {
  const ip =
    (req?.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req?.connection?.remoteAddress ||
    req?.socket?.remoteAddress ||
    req?.ip ||
    null;

  const userAgent = req?.headers['user-agent'] || null;

  console.log('IP:', ip);
  console.log('UserAgent:', userAgent);

  await this.dataSource.query(
    `INSERT INTO activity_logs 
    (user_id, module, action, description, reference_type, reference_id, ip_address, user_agent, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.user_id,
      data.module,
      data.action,
      data.description || null,
      data.reference_type || null,
      data.reference_id || null,
      ip,
      userAgent,
      new Date(),
    ],
  );
}
}
