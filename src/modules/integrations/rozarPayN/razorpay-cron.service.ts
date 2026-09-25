
import {
  Injectable,
  Logger,
} from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { RazorpayService } from './razorpay.service';

@Injectable()
export class RazorpayCronService {
  private readonly logger =
    new Logger(RazorpayCronService.name);

  constructor(
    private readonly razorpayService: RazorpayService,
  ) {}

  /**
   * TEST:
   * Runs every minute.
   *
   * After testing change this to:
   *
   * @Cron('0 1 * * *')
   */
  @Cron('* * * * *')
  async processRecurringPayments() {
    this.logger.log(
      '========== RECURRING PAYMENT CRON START =========='
    );

    try {
      const result =
        await this.razorpayService.processRecurringPayments();

      this.logger.log(
        `Recurring payment result: ${JSON.stringify(result)}`
      );
    } catch (error) {
      this.logger.error(
        'Recurring payment cron failed',
         error,
      );
    }

    this.logger.log(
      '========== RECURRING PAYMENT CRON END =========='
    );
  }

@Cron('0 0 * * *')
handleEveryDay() {
  console.log('Runs every day at 12:00 AM');
}
}