// activity-logs.service.ts

import { Injectable } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { ActivityLog } from './entities/activity-log.entity';

@Injectable()
export class ActivityLogsService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityRepo: Repository<ActivityLog>
  ) {}

  /*
  |--------------------------------------------------------------------------
  | CREATE LOG
  |--------------------------------------------------------------------------
  */

  async create(data: any) {
    const log = this.activityRepo.create({
      action: data.action,

      module: data.module,

      module_id: data.module_id || null,

      user_id: data.user_id || null,

      description: data.description || null,

      ip_address: data.ip_address || null,

      metadata: data.metadata || null,
    });

    return await this.activityRepo.save(log);
  }

  /*
  |--------------------------------------------------------------------------
  | GET LOGS
  |--------------------------------------------------------------------------
  */

  async findAll() {
    return await this.activityRepo.find({
      order: {
        created_at: 'DESC',
      },
    });
  }

  /*
  |--------------------------------------------------------------------------
  | GET SINGLE LOG
  |--------------------------------------------------------------------------
  */

  async findOne(id: number) {
    return await this.activityRepo.findOne({
      where: { id },
    });
  }
}
