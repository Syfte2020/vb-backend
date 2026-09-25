import * as webpush from 'web-push';
import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource, Repository, Not, IsNull } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PushSubscription } from './entities/push-subscription.entity';
import { RegisterPushDto } from './dto/register-push.dto'

@Injectable()
export class PushService {
  constructor(

     @InjectRepository(PushSubscription)
          private readonly repo: Repository<PushSubscription>,

  ) {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL,

      process.env.VAPID_PUBLIC_KEY,

      process.env.VAPID_PRIVATE_KEY,
    );
  }

  async register(userId: number, dto: RegisterPushDto) {
    const existing = await this.repo.findOne({
      where: {
        endpoint: dto.endpoint,
      },
    });

    if (existing) {
      existing.user_id = userId;

      existing.browser = dto.browser;

      existing.browser_version = dto.browserVersion;

      existing.platform = dto.platform;

      existing.device_type = dto.deviceType;

      existing.device_name = dto.deviceName;

      existing.user_agent = dto.userAgent;

      existing.last_used_at = new Date();

      return this.repo.save(existing);
    }

    const subscription = this.repo.create({
      user_id: userId,

      endpoint: dto.endpoint,

      p256dh: dto.p256dh,

      auth: dto.auth,

      browser: dto.browser,

      browser_version: dto.browserVersion,

      platform: dto.platform,

      device_type: dto.deviceType,

      device_name: dto.deviceName,

      user_agent: dto.userAgent,

      last_used_at: new Date(),
    });

    return this.repo.save(subscription);
  }
  async sendToUser(
    userId: number,
    title: string,
    body: string,
    url?: string,
  ) {
    const subscriptions = await this.repo.find({
      where: {
        user_id: userId,
        is_active: true,
      },
    });

    const payload = JSON.stringify({
      title,
      body,
      url,
    });

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload,
        );
      } catch (error: any) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await this.repo.delete({ id: sub.id });
        }
      }
    }
  }
}
