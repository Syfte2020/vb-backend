import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class RewardService {
  constructor(
    private dataSource: DataSource
  ) {}

async total_reward_in_your_account(
  user_id: any,
  category: any,
  plan_id: any,
  country: any,
) {
  try {
    const rewardBalance = await this.dataSource.query(
      `
      SELECT
        rpb.*,
        mt.*
      FROM reward_point_balance rpb
      LEFT JOIN member_tier mt
        ON mt.id = rpb.mem_id
      WHERE rpb.user_id = ?
      LIMIT 1
      `,
      [user_id],
    );

    // Default membership plan for new customers
    const custPlanId = rewardBalance.length
      ? rewardBalance[0].mem_id
      : 1;

    const loyaltyTier = await this.dataSource.query(
      `
      SELECT
        lt.*,
        lp.*
      FROM loyalty_tiers lt
      LEFT JOIN loyalty_point lp
        ON lp.category_id = lt.category_id
       AND lp.country_id = lt.country_id
      WHERE lt.plan_id = ?
        AND lt.cust_plan_id = ?
        AND lt.category_id = ?
        AND lt.country_id = ?
      LIMIT 1
      `,
      [plan_id, custPlanId, 2, country],
    );

    return {
      rewardBalance: rewardBalance.length
        ? rewardBalance
        : {
            user_id,
            mem_id: 1,
            total_points: 0,
            available_points: 0,
            redeemed_points: 0,
            expired_points: 0,
          },

      loyaltyTier: loyaltyTier.length ? loyaltyTier[0] : null,
    };
  } catch (error) {
    console.error(error);
    throw new BadRequestException('Failed to fetch loyalty data');
  }
}


}

