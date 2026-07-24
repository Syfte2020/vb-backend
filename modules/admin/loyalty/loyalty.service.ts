import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class LoyaltyService {
  constructor(private dataSource: DataSource) {}

async loyaltyAll(query: any) {

  const alreday_customers = await this.dataSource.query(
    `
    SELECT DISTINCT
        u.id,
        u.name,
        rpb.available_points
    FROM users u
    LEFT JOIN reward_point_balance rpb
        ON rpb.user_id = u.id
    `,
  );


const data = await this.dataSource.query(`
    SELECT
        u.id,
        u.name,
        rpb.total_points,
        rpb.available_points,
        rpb.redeemed_points,
        rpb.expired_points,
        mt.name as tier_name,
         CASE
            WHEN rpb.available_points < 50000 THEN 'Normal'
            WHEN rpb.available_points BETWEEN 50000 AND 99999 THEN 'Watchlist'
            ELSE 'Critical'
        END AS wallet_status,
        CASE
    WHEN rpb.available_points < 50000 THEN 'success'
    WHEN rpb.available_points BETWEEN 50000 AND 99999 THEN 'warning'
    ELSE 'danger'
END AS status_color
    FROM reward_point_balance rpb
    INNER JOIN users u
        ON rpb.user_id = u.id
    INNER JOIN member_tier mt
        ON mt.id = rpb.mem_id
    ORDER BY u.updated_at DESC
    LIMIT 5
`);

  const totalResult = await this.dataSource.query(
    `
    SELECT COUNT(DISTINCT u.id) total
    FROM users u
    LEFT JOIN user_roles ur
        ON ur.user_id = u.id
    WHERE ur.role_id != ?
    `,
    [1],
  );

  const summary = await this.dataSource.query(
    `
    SELECT
        COALESCE(SUM(points),0) AS total_issued,

        COALESCE(SUM(CASE
            WHEN transaction_type='redeem'
            THEN points
        END),0) AS total_redeemed,


        COALESCE(SUM(CASE
            WHEN transaction_type='expired'
            THEN points
        END),0) AS total_expired,

       (
        COALESCE(
            SUM(points),
            0
        )
        -
        COALESCE(
            SUM(CASE WHEN transaction_type = 'redeem' THEN points ELSE 0 END),
            0
        )
             -
        COALESCE(
            SUM(CASE WHEN transaction_type = 'expired' THEN points ELSE 0 END),
            0
        )
    ) AS outstanding_liability
    FROM reward_point_transactions
    `,
  );


const stats = summary[0];

const kpis = [
  {
    key: "issued",
    label: "Total Issued",
    value: Number(stats.total_issued),
    hint: "Total VBCoins issued to customers in the selected period.",
    tone: "primary",
  },
  {
    key: "redeemed",
    label: "Total Redeemed",
    value: Number(stats.total_redeemed),
    hint: "Total VBCoins redeemed against bookings in the selected period.",
    tone: "success",
  },
   {
    key: "expired",
    label: "expired Coin",
    value: Number(stats.total_expired),
    hint: "Estimated cash liability of unredeemed points at current conversion rate.",
    tone: "danger",
  },
  {
    key: "liability",
    label: "Outstanding Liability",
    value: Number(stats.outstanding_liability),
    hint: "Estimated cash liability of unredeemed points at current conversion rate.",
    tone: "warning",
  },
];


  return {
     data,
    total: totalResult[0].total,
    kpis,
    alreday_customers
  };
}
async add_adjustment(body: any) {
  return this.dataSource.transaction(async (manager) => {
    const {
      customerId,
      description,
      linkedBooking,
      points,
      reasonCode,
      type,
    } = body;

    const pointValue = Number(points);

    // Map frontend type to DB enum
    const transactionTypeMap: Record<string, string> = {
      Add: 'reward',//adjustment
      Reward: 'reward',
      Bonus: 'bonus',
      Refund: 'refund',
      Redeem: 'redeem',
      Expire: 'expired',
    };

    const transactionType = transactionTypeMap[type];

    if (!transactionType) {
      throw new BadRequestException('Invalid transaction type.');
    }

    // 1. Insert into reward_point_transactions
    await manager.query(
      `
      INSERT INTO reward_point_transactions
      (
        user_id,
        booking_id,
        transaction_type,
        points,
        remarks,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, NOW())
      `,
      [
        customerId,
        linkedBooking || null,
        transactionType,
        pointValue,
        description || reasonCode || null,
      ],
    );

    // 2. Check if balance exists
    const balance = await manager.query(
      `SELECT id FROM reward_point_balance WHERE user_id = ? LIMIT 1`,
      [customerId],
    );

    // 3. Insert new balance if not exists
    if (balance.length === 0) {
      let total = 0;
      let available = 0;
      let redeemed = 0;
      let expired = 0;

      switch (transactionType) {
        case 'reward':
        case 'bonus':
        case 'refund':
        case 'adjustment':
          total = pointValue;
          available = pointValue;
          break;

        case 'redeem':
          redeemed = pointValue;
          break;

        case 'expired':
          expired = pointValue;
          break;
      }

      await manager.query(
        `
        INSERT INTO reward_point_balance
        (
          user_id,
          mem_id,
          total_points,
          available_points,
          redeemed_points,
          expired_points,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, NOW())
        `,
        [
          customerId,
          1,
          total,
          available,
          redeemed,
          expired,
        ],
      );
    } else {
      // 4. Update existing balance
      switch (transactionType) {
        case 'reward':
        case 'bonus':
        case 'refund':
        case 'adjustment':
          await manager.query(
            `
            UPDATE reward_point_balance
            SET
              total_points = total_points + ?,
              available_points = available_points + ?,
              updated_at = NOW()
            WHERE user_id = ?
            `,
            [pointValue, pointValue, customerId],
          );
          break;

        case 'redeem':
          await manager.query(
            `
            UPDATE reward_point_balance
            SET
              redeemed_points = redeemed_points + ?,
              available_points = available_points - ?,
              updated_at = NOW()
            WHERE user_id = ?
            `,
            [pointValue, pointValue, customerId],
          );
          break;

        case 'expired':
          await manager.query(
            `
            UPDATE reward_point_balance
            SET
              expired_points = expired_points + ?,
              available_points = available_points - ?,
              updated_at = NOW()
            WHERE user_id = ?
            `,
            [pointValue, pointValue, customerId],
          );
          break;
      }
    }

    return {
      success: true,
      message: 'Reward points updated successfully.',
    };
  });
}

}
