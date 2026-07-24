import { Injectable, BadRequestException } from '@nestjs/common';

import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IntegrationService } from '../integSettings/integSettings.service';
import { DataSource } from 'typeorm';

import dayjs from 'dayjs';

@Injectable()
export class CashfreeService {
  constructor(
    private readonly integrationService: IntegrationService,
    private readonly http: HttpService,
    private readonly dataSource: DataSource,
  ) {}

  //   async verifyPan(pan: string) {
  // async subscription(body: any,id:any) {

  //   /*
  //   selected: 1,
  //   selectedPlan: 17,
  //   agreed: true,
  //   selectedModes: {},
  //   coupon: '',
  //   billing: '2' //yealy
  //   */
  //   try {
  // const [plans] = await this.dataSource.query(
  //       `SELECT *
  //      FROM plans
  //      WHERE id = ?`,
  //       [body.selectedPlan],
  //     );

  //     const [Users] = await this.dataSource.query(
  //       `SELECT *
  //      FROM users
  //      WHERE id = ?`,
  //       [id],
  //     );

  //     const config = await this.integrationService.getIntegrationConfig(
  //       'cashfree',
  //     );

  //     const configData =
  //       typeof config === 'string'
  //         ? JSON.parse(config)
  //         : config;

  //  const subscription_id =  `SUB_${Date.now()}`;
  //     const response = await firstValueFrom(
  //       this.http.post(
  //         `${configData.base_url}/pg/subscriptions`,
  //           {
  //       subscription_id: subscription_id,
  //       customer_details: {
  //         customer_name: Users?.name,
  //         customer_email: Users?.email,
  //         customer_phone: Users?.phone,
  //       },
  //       plan_details: {
  //         plan_id:plans.plan_id,
  //       },
  //        subscription_meta: {
  //    return_url: `${process.env.FRONTEND_URL}/subscription-success?subscription_id=${subscription_id}`,
  // },

  //     },
  //         {
  //           headers: {
  //             'x-client-id': configData.client_id,
  //             'x-client-secret': configData.client_secret,
  //             'x-api-version': '2025-01-01',
  //             'Content-Type': 'application/json',
  //           },

  //         },

  //       ),
  //     );

  //     const data = response.data;

  //     await this.dataSource.query(
  //       `
  //       INSERT INTO user_subscriptions
  //       (
  //         user_id,
  //         category_id,
  //         subscription_code,
  //         subscription_id,
  //         start_date,
  //         next_billing_date,
  //         end_date,
  //         auto_renew,
  //         status,
  //         cancel_at_period_end,
  //         cancelled_at,
  //         created_at,
  //         updated_at
  //       )
  //       VALUES
  //       (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  //       `,
  //       [
  //         id,
  //         id,
  //         subscription_id,
  //         data.subscription_id,
  //         null,
  //         null,
  //         null,
  //         1,
  //         'pending',
  //         0,
  //         null,
  //       ],
  //     );

  //     return data;
  //   } catch (error) {

  //     throw new BadRequestException(
  //      // error.response?.data || error.message,
  //      'error'
  //     );
  //   }
  // }
  async subscription(body: any, id: any, Country: any) {
    try {
      // Get Plan
      const [plan] = await this.dataSource.query(
        `
      SELECT *
      FROM plans
      WHERE id = ?
      LIMIT 1
      `,
        [body.selectedPlan],
      );

      if (!plan) {
        throw new BadRequestException('Plan not found');
      }

      // Get User
      const [user] = await this.dataSource.query(
        `
      SELECT *
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
        [id],
      );

      if (!user) {
        throw new BadRequestException('User not found');
      }

      //body.selectedModes

      // Cashfree Config
      const config =
        await this.integrationService.getIntegrationConfig('cashfree');

      const configData =
        typeof config === 'string' ? JSON.parse(config) : config;

      const subscriptionCode = `SUB_${Date.now()}`;

      console.log('Plan:', plan);
      console.log('User:', user);

      let startDate = dayjs().add(1, 'day').format('YYYY-MM-DD HH:mm:ss');

      let endDate = dayjs().add(10, 'year').format('YYYY-MM-DD HH:mm:ss');

      let subscription_first_charge_time = '';
      let subscription_expiry_time = dayjs().add(10, 'year').toISOString();

      let nextBillingDate = '';

      // selected = 0 => charge tomorrow
      // selected = 1 => first charge after one billing cycle
      if (body.selected == 1) {
        subscription_first_charge_time = dayjs().add(1, 'day').toISOString(); // imediatly
      } else {
        subscription_first_charge_time = dayjs().add(1, 'month').toISOString(); // one month from 
          // body.billing == 1
          //   ? dayjs().add(1, 'month').toISOString()
          //   : dayjs().add(1, 'year').toISOString();
      }

      // billing = 1 => monthly
      // billing = 2 => yearly
      if (body.billing == 1) {
        nextBillingDate = dayjs().add(1, 'month').format('YYYY-MM-DD HH:mm:ss');
      } else {
        nextBillingDate = dayjs().add(1, 'year').format('YYYY-MM-DD HH:mm:ss');
      }
let  data = null;
      if(body.category ==='venue'){

      // Create Subscription in Cashfree
      const response = await firstValueFrom(
        this.http.post(
          `${configData.base_url}/pg/subscriptions`,
          {
            subscription_id: subscriptionCode,
            customer_details: {
              customer_name: user.name,
              customer_email: user.email,
              customer_phone: user.phone ?? '8147484371',
            },
            plan_details: {
              plan_id: plan.plan_id,
            },
            subscription_meta: {
              return_url: `${process.env.FRONTEND_URL}/subscription-success?subscription_id=${subscriptionCode}`,
            },
            subscription_first_charge_time: subscription_first_charge_time,
            subscription_expiry_time: subscription_expiry_time,
          },
          {
            headers: {
              'x-client-id': configData.client_id,
              'x-client-secret': configData.client_secret,
              'x-api-version': '2025-01-01',
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      data = response.data;

      console.log(
        'Cashfree Subscription Response:',
        JSON.stringify(data, null, 2),
      );
    }

      //Booking type

        const [categorys] = await this.dataSource.query(
  `SELECT id FROM category WHERE name = ? limit 1`,
  [body.category],
); 

await this.dataSource.query(
  `DELETE FROM venue_booking_modes WHERE parent_venue_id = ?`,
  [body.parent_venue_id],
);

await Promise.all(
  body.selectedModes.map((mode) =>
    this.dataSource.query(
      `
      INSERT INTO venue_booking_modes
      (
        parent_venue_id,
        mode
      )
      VALUES (?, ?)
      `,
      [body.parent_venue_id, mode],
    ),
  ),
);

      // Save Subscription
      await this.dataSource.query(
        `
      INSERT INTO user_subscriptions
      (
        user_id,
        category_id,
        country_id,
        plan_id,
        subscription_code,
        subscription_id,
        start_date,
        next_billing_date,
        end_date,
        auto_renew,
        status,
        cancel_at_period_end,
        cancelled_at,
        created_at,
        updated_at
      )
      VALUES
      (
        ?, ?, ?,?,?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
      )
      `,
        [
          id, // user_id
          categorys.id || 0, // category_id
          Country,
          body.selectedPlan, // category_id
          
          subscriptionCode, // local subscription code
          subscriptionCode,
          startDate, // start_date
          nextBillingDate, // next_billing_date
          endDate, // end_date
          1, // auto_renew
          'pending', // status
          0, // cancel_at_period_end
          null, // cancelled_at
        ],
      );

      return data;

      // return {
      //   success: true,
      //   subscription_id: data.subscription_id,
      //   checkout_url: data.auth_link || data.subscription_link,
      //   data,
      // };
    } catch (error) {
      console.error('Subscription Error:');
      console.error(error);

      throw new BadRequestException( 'Subscription creation failed',
      );
    }
  }

  async verifySubscription(subscriptionId: string) {
    if (!subscriptionId) {
      throw new BadRequestException('subscriptionId is required');
    }

    const config =
      await this.integrationService.getIntegrationConfig('cashfree');

    const configData = typeof config === 'string' ? JSON.parse(config) : config;

    try {
      const url = `${configData.base_url}/pg/subscriptions/${subscriptionId}`;

      const response = await firstValueFrom(
        this.http.get(url, {
          headers: {
            'x-client-id': configData.client_id,
            'x-client-secret': configData.client_secret,
            'x-api-version': '2025-01-01',
          },
        }),
      );

      return response.data;
    } catch (error: any) {
      // better debugging
      console.error(
        'Cashfree verifySubscription error:',
        error?.response?.data || error.message,
      );

      throw new BadRequestException(
        error?.response?.data?.message || 'Failed to verify subscription',
      );
    }
  }
  async cashfree_plans(parentId: string , category :any ) {

    
     const [categorys] = await this.dataSource.query(
  `SELECT id FROM category WHERE name = ? limit 1`,
  [category],
); 
let rows = '';
if(category=='farmstay')
{
 rows = await this.dataSource.query(
      `SELECT * FROM plans WHERE  category_id = ? `,
      [categorys.id],
    );
}
else{
     rows = await this.dataSource.query(
      `SELECT * FROM vendor_options vo  LEFT JOIN plans p ON p.id = vo.option_key WHERE vo.parent_id = ? `,
      [parentId],
    );
  }
    return rows;
  }

  async cashfree_order( data: {
    orderId: string;
    amount: number;
    url: string;
    customer: {
      id: string;
      name: string;
      email: string;
      phone: string;
    };
  },id:any,Country:any) {
  const request = {
  order_id: data.orderId,
  order_amount: Number(data.amount),
  order_currency: "INR",

   customer_details: {
      customer_id: data.customer.id,
      customer_name: data.customer.name,
      customer_email: data.customer.email,
      customer_phone: data.customer.phone,
    },

  order_meta: {
    return_url: `${process.env.FRONTEND_URLS}/${data.url}?order_id={order_id}`,
  },
};

const config =
  await this.integrationService.getIntegrationConfig("cashfree");

const configData =
  typeof config === "string" ? JSON.parse(config) : config;

const url = `${configData.base_url}/pg/orders`;

const response = await firstValueFrom(
  this.http.post(url, request, {
    headers: {
      "x-client-id": configData.client_id,
      "x-client-secret": configData.client_secret,
      "x-api-version": "2025-01-01",
      "Content-Type": "application/json",
    },
  }),
);

return response.data;
   
  }

  
}
