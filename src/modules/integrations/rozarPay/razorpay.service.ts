import { Injectable, BadRequestException, Logger } from '@nestjs/common';

import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IntegrationService } from '../integSettings/integSettings.service';
import { DataSource } from 'typeorm';

import Razorpay from 'razorpay';
import * as crypto from 'crypto';

import dayjs from 'dayjs';
import axios from 'axios';

import { InvoiceService } from '../../invoice/invoice.service';
import { SocketService } from '../../socket/socket.service';
import { NotificationService } from '../../../notifications/notification.service';

import { generateCode } from '../../../common/utils/code-generator';

import { ZohoService } from '../../integrations/zoho/zoho.service';
import { TwilioService } from '../../integrations/twilio/twilio.service';

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);

  constructor(
    private readonly socketService: SocketService,
    private readonly integrationService: IntegrationService,
    private readonly http: HttpService,
    private readonly dataSource: DataSource,
    private readonly zohoService: ZohoService,
    private readonly twilioService: TwilioService,

    private invoiceService: InvoiceService,
    private readonly notificationService: NotificationService,
  ) {}

  async subscription(body: any, userId: number, countryId: number) {
    try {
      // =========================================================
      // 1. Validate quantity
      // =========================================================

      const quantity = Number(body.quantity);

      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new BadRequestException(
          'Quantity must be a valid number greater than 0',
        );
      }

      // =========================================================
      // 2. Get VenueBook plan
      // =========================================================

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

      // =========================================================
      // 3. Get user
      // =========================================================

      const [user] = await this.dataSource.query(
        `
      SELECT id, name, email, phone
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
        [userId],
      );

      if (!user) {
        throw new BadRequestException('User not found');
      }

      //  const [parents] = await this.dataSource.query(
      //   `
      //   SELECT parent_venue_id as id, conatct_person as name, email, phone , child_venue_id
      //   FROM venue_parent
      //   LEFT JOIN  venue_child ON venue_child.parent_venue_id =  venue_parent.parent_venue_id
      //   WHERE parent_venue_id = ?
      //   LIMIT 1
      //   `,
      //   [body.parent_venue_id],
      // );

      const [parents] = await this.dataSource.query(
        `
  SELECT
    vp.parent_venue_id AS id,
    vp.conatct_person AS name,
    vp.email,
    vp.phone,
    vc.child_venue_id
  FROM venue_parent vp
  LEFT JOIN venue_child vc
    ON vc.parent_venue_id = vp.parent_venue_id
  WHERE vp.parent_venue_id = ?
  LIMIT 1
  `,
        [body.parent_venue_id],
      );

      console.log(parents);

      if (!user) {
        throw new BadRequestException('parent not found');
      }

      const modeMapping = {
        reserve: 'reserve',
        book: 'instant',
        enquiry: 'enquire',
      };

      await Promise.all(
        body.selectedModes.map(async (mode) => {
          const settingKey = modeMapping[mode] || mode;

          await Promise.all([
            this.dataSource.query(
              `
        INSERT INTO venue_child_settings
        (
          child_id,
          \`group\`,
          \`key\`,
          value,
          type
        )
        VALUES (?, 'publication', ?, 'true', 'string')
        ON DUPLICATE KEY UPDATE
          value = VALUES(value)
        `,
              [parents.child_venue_id, settingKey],
            ),

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
          ]);
        }),
      );

      // =========================================================
      // 4. Validate user details
      // =========================================================

      const userName = String(parents.name || 'VenueBook User').trim();
      const userEmail = String(parents.email || '').trim();
      const userPhone = String(parents.phone || '').trim();

      if (!userEmail) {
        throw new BadRequestException('parents email is required');
      }
      if (!userPhone) {
        throw new BadRequestException('parents phone is required');
      }

      // =========================================================
      // 5. Calculate pricing
      // =========================================================

      const pricePerVenue = Number(plan.offer_amount);

if (!Number.isFinite(pricePerVenue) || pricePerVenue <= 0) {
  throw new BadRequestException('Invalid plan amount');
}

const gstRate = 18;

// GST-inclusive amount for all venues
const totalAmounts = Number(
  (pricePerVenue * quantity).toFixed(2)
);

const GstAmt = totalAmounts*gstRate/100;

const totalAmount =   Math.round(Number(totalAmounts +GstAmt));
  

// GST-exclusive amount
const baseAmount = Number(
  (totalAmount / (1 + gstRate / 100)).toFixed(2)
);

// GST portion
const gstAmount = Number(
  (totalAmount - baseAmount).toFixed(2)
);

    

      // Razorpay amount = paise
      const razorpayAmount = Math.round(totalAmount * 100);

      // =========================================================
      // 6. Category
      // =========================================================

      const categoryId = Number(
        body.categoryId || body.category || plan.category_id || 1,
      );

      // if (!Number.isInteger(categoryId) || categoryId < 1) {
      //   throw new BadRequestException('Invalid category');
      // }

      // =========================================================
      // 7. Razorpay configuration
      // =========================================================

      const config =
        await this.integrationService.getIntegrationConfig('razorpay');

      const configData =
        typeof config === 'string' ? JSON.parse(config) : config;

      const keyId = String(configData?.key_id || '').trim();
      const keySecret = String(configData?.key_secret || '').trim();

      if (!keyId || !keySecret) {
        throw new BadRequestException('Razorpay configuration is missing');
      }

      // =========================================================
      // 8. Initialize Razorpay
      // =========================================================

      const razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });

      // =========================================================
      // 9. Generate internal subscription code
      // =========================================================

      const subscriptionCode = `SUB_${Date.now()}_${userId}`;

      const interval = 1;

      const today = dayjs();

      const startDate = today.format('YYYY-MM-DD HH:mm:ss');

      const planTitle = Number(plan.plan_title);

      let nextBillingDate: string;
      let endDate: string;

      switch (planTitle) {
        case 1:
          nextBillingDate = today
            .add(interval, 'month')
            .format('YYYY-MM-DD HH:mm:ss');

          endDate = today.add(interval, 'month').format('YYYY-MM-DD HH:mm:ss');
          break;

        case 2:
          nextBillingDate = today
            .add(interval, 'year')
            .format('YYYY-MM-DD HH:mm:ss');

          endDate = today.add(interval, 'year').format('YYYY-MM-DD HH:mm:ss');
          break;

        default:
          throw new Error(`Invalid plan_title: ${plan.plan_title}`);
      }

      console.log({
        startDate,
        nextBillingDate,
        endDate,
      });

      // =========================================================
      // 10. GET OR CREATE RAZORPAY CUSTOMER
      // =========================================================

      let razorpayCustomerId: string | null = null;

      // ---------------------------------------------------------
      // 10.1 First check our database
      // ---------------------------------------------------------

      const [existingCustomer] = await this.dataSource.query(
        `
    SELECT razorpay_customer_id
    FROM user_subscriptions
    WHERE user_id = ?
      AND razorpay_customer_id IS NOT NULL
      AND razorpay_customer_id != ''
    ORDER BY id DESC
    LIMIT 1
    `,
        [userId],
      );

      if (existingCustomer?.razorpay_customer_id) {
        try {
          const existingRazorpayCustomer = await razorpay.customers.fetch(
            existingCustomer.razorpay_customer_id,
          );

          if (existingRazorpayCustomer?.id) {
            razorpayCustomerId = String(existingRazorpayCustomer.id);

            console.log(
              'Existing Razorpay customer reused:',
              razorpayCustomerId,
            );
          }
        } catch (error) {
          console.warn(
            'Stored Razorpay customer ID is invalid:',
            existingCustomer.razorpay_customer_id,
          );

          razorpayCustomerId = null;
        }
      }

      // ---------------------------------------------------------
      // 10.2 If not found locally, create/retrieve using
      //      Razorpay fail_existing = "0"
      // ---------------------------------------------------------

      if (!razorpayCustomerId) {
        try {
          /**
           * IMPORTANT:
           *
           * Razorpay API expects:
           *
           * fail_existing: "0"
           *
           * not:
           *
           * fail_existing: 0
           *
           * Razorpay documentation confirms that "0" returns
           * the existing customer when the same customer exists.
           */

          const customer = await (razorpay.customers.create as any)({
            name: userName,
            email: userEmail,
            contact: userPhone,

            fail_existing: '0',

            notes: {
              user_id: String(userId),
            },
          });

          console.log(
            'Razorpay customer response:',
            JSON.stringify(customer, null, 2),
          );

          if (customer?.id) {
            razorpayCustomerId = String(customer.id);

            console.log(
              'Razorpay customer created/reused:',
              razorpayCustomerId,
            );
          }
        } catch (customerError: any) {
          console.error(
            'Razorpay customer creation failed:',
            JSON.stringify(customerError, null, 2),
          );

          const description = String(
            customerError?.error?.description ||
              customerError?.response?.error?.description ||
              customerError?.message ||
              '',
          ).toLowerCase();

          // -------------------------------------------------------
          // 10.3 If Razorpay says customer already exists,
          //      fetch all customers and find matching email/contact
          // -------------------------------------------------------

          if (
            description.includes('customer already exists') ||
            description.includes('already exists')
          ) {
            try {
              console.log(
                'Searching Razorpay customers for existing customer...',
              );

              let skip = 0;

              const count = 100;

              let foundCustomer: any = null;

              /**
               * Razorpay Fetch All Customers API supports
               * count and skip pagination.
               */
              while (!foundCustomer) {
                const customers = await razorpay.customers.all({
                  count,
                  skip,
                });

                const customerList = customers?.items || [];

                if (!customerList.length) {
                  break;
                }

                foundCustomer = customerList.find((customer: any) => {
                  const razorpayEmail = String(customer?.email || '')
                    .trim()
                    .toLowerCase();

                  const razorpayContact = String(
                    customer?.contact || '',
                  ).replace(/\D/g, '');

                  const localEmail = userEmail.trim().toLowerCase();

                  const localContact = userPhone.replace(/\D/g, '');

                  return (
                    razorpayEmail === localEmail ||
                    razorpayContact === localContact
                  );
                });

                if (customerList.length < count) {
                  break;
                }

                skip += count;
              }

              if (foundCustomer?.id) {
                razorpayCustomerId = String(foundCustomer.id);

                console.log(
                  'Existing Razorpay customer found:',
                  razorpayCustomerId,
                );
              }
            } catch (searchError) {
              console.error(
                'Failed to search Razorpay customers:',
                JSON.stringify(searchError, null, 2),
              );
            }
          }

          // -------------------------------------------------------
          // 10.4 Still not found
          // -------------------------------------------------------

          if (!razorpayCustomerId) {
            throw new BadRequestException(
              description || 'Razorpay customer could not be created or found',
            );
          }
        }
      }

      // ---------------------------------------------------------
      // 10.5 Final validation
      // ---------------------------------------------------------

      if (!razorpayCustomerId) {
        throw new BadRequestException(
          'Razorpay customer could not be created or found',
        );
      }

      console.log('Final Razorpay Customer ID:', razorpayCustomerId);

      // =========================================================
      // 11. Create an Order for THIS charge
      // =========================================================

      // let razorpayOrder: any;

      // try {
      //   razorpayOrder = await razorpay.orders.create({
      //     amount: razorpayAmount,
      //     currency: 'INR',
      //     receipt: subscriptionCode,
      //     payment_capture: true,
      //     notes: {
      //       user_id: String(userId),
      //       venuebook_plan_id: String(plan.id),
      //       category_id: String(1),
      //       country_id: String(countryId),
      //       venue_quantity: String(quantity),
      //       subscription_code: subscriptionCode,
      //       base_amount: String(baseAmount),
      //       gst_rate: String(gstRate),
      //       gst_amount: String(gstAmount),
      //       total_amount: String(totalAmount),
      //       recurring_setup: 'true',
      //     },
      //   });

      //   console.log('Razorpay order created:', razorpayOrder);
      // } catch (orderError) {
      //   console.error(
      //     'Razorpay order creation failed:',
      //     JSON.stringify(orderError, null, 2),
      //   );

      //   throw new BadRequestException(
      //     orderError || 'Unable to create Razorpay order',
      //   );
      // }

      // if (!razorpayOrder?.id) {
      //   throw new BadRequestException('Razorpay order ID missing');
      // }

      // // =========================================================
      // // 12. Save local subscription record.
      // // =========================================================

      // const insertResult = await this.dataSource.query(
      //   `
      // INSERT INTO user_subscriptions
      // (
      //   user_id,
      //   country_id,
      //   category_id,
      //   plan_id,
 
      //   subscription_code,
 
      //   quantity,
      //   price_per_unit,
 
      //   gst_rate,
      //   gst_amount,
 
      //   current_amount,
      //   total_amount,
 
      //   start_date,
      //   next_billing_date,
 
      //   auto_renew,
 
      //   status,
      //   payment_status,
 
      //   razorpay_customer_id,
      //   razorpay_order_id,
      //   razorpay_token_id,
 
      //   created_at,
      //   updated_at
      // )
      // VALUES
      // (
      //   ?, ?, ?, ?,
 
      //   ?,
 
      //   ?, ?,
 
      //   ?, ?,
 
      //   ?, ?,
 
      //   ?,
      //   ?,
 
      //   1,
 
      //   'pending',
      //   'pending',
 
      //   ?,
      //   ?,
      //   NULL,
 
      //   NOW(),
      //   NOW()
      // )
      // `,
      //   [
      //     userId,
      //     countryId,
      //     1,
      //     plan.id,

      //     subscriptionCode,

      //     quantity,
      //     pricePerVenue,

      //     gstRate,
      //     gstAmount,

      //     baseAmount,
      //     totalAmount,

      //     startDate,
      //     nextBillingDate,

      //     razorpayCustomerId,
      //     razorpayOrder.id,
      //   ],
      // );

      // const localSubscriptionId = insertResult?.insertId || null;

      // // =========================================================
      // // 13. Return response.
      // // =========================================================

      // return {
      //   success: true,

      //   message: 'Razorpay order created for recurring (token-based) setup',

      //   key_id: keyId,

      //   customer: {
      //     id: razorpayCustomerId,
      //   },

      //   order: {
      //     id: razorpayOrder.id,
      //     amount: razorpayOrder.amount,
      //     currency: razorpayOrder.currency,
      //   },

      //   subscription: {
      //     id: localSubscriptionId,
      //     subscription_code: subscriptionCode,
      //     razorpay_customer_id: razorpayCustomerId,
      //     razorpay_order_id: razorpayOrder.id,
      //     status: 'created',
      //     payment_status: 'pending',
      //     auto_renew: true,
      //   },

      //   pricing: {
      //     price_per_venue: pricePerVenue,
      //     quantity,
      //     base_amount: baseAmount,
      //     gst_rate: gstRate,
      //     gst_amount: gstAmount,
      //     total_amount: totalAmount,
      //     razorpay_amount: razorpayAmount,
      //     currency: 'INR',
      //     billing: 'monthly',
      //   },
      // };
      // =========================================================
// 11. CREATE FIRST RECURRING AUTHORISATION ORDER
// =========================================================

let razorpayOrder: any;

try {
  razorpayOrder = await razorpay.orders.create({
    amount: razorpayAmount,
    currency: 'INR',
    receipt: subscriptionCode,

    payment_capture: true,

    notes: {
      user_id: String(userId),
      venuebook_plan_id: String(plan.id),
      category_id: String(categoryId),
      country_id: String(countryId),

      venue_quantity: String(quantity),

      subscription_code: subscriptionCode,

      base_amount: String(baseAmount),
      gst_rate: String(gstRate),
      gst_amount: String(gstAmount),
      total_amount: String(totalAmount),

      recurring_setup: 'true',
    },
  });

  console.log(
    'Razorpay recurring authorisation order:',
    razorpayOrder,
  );
} catch (orderError: any) {
  console.error(
    'Razorpay order creation failed:',
    JSON.stringify(orderError, null, 2),
  );

  throw new BadRequestException(
    orderError?.error?.description ||
      orderError?.message ||
      'Unable to create Razorpay order',
  );
}

if (!razorpayOrder?.id) {
  throw new BadRequestException(
    'Razorpay order ID missing',
  );
}


// =========================================================
// 12. SAVE LOCAL SUBSCRIPTION
// =========================================================

const insertResult = await this.dataSource.query(
  `
  INSERT INTO user_subscriptions
  (
    user_id,
    country_id,
    category_id,
    plan_id,

    subscription_code,

    quantity,
    price_per_unit,

    gst_rate,
    gst_amount,

    current_amount,
    total_amount,

    start_date,
    next_billing_date,

    auto_renew,

    status,
    payment_status,

    razorpay_customer_id,
    razorpay_order_id,
    razorpay_token_id,

    created_at,
    updated_at
  )
  VALUES
  (
    ?, ?, ?, ?,

    ?,

    ?, ?,

    ?, ?,

    ?, ?,

    ?,
    ?,

    1,

    'pending',
    'pending',

    ?,
    ?,
    NULL,

    NOW(),
    NOW()
  )
  `,
  [
    userId,
    countryId,
    1,
    plan.id,

    subscriptionCode,

    quantity,
    pricePerVenue,

    gstRate,
    gstAmount,

    baseAmount,
    totalAmount,

    startDate,
    nextBillingDate,

    razorpayCustomerId,
    razorpayOrder.id,
  ],
);

const localSubscriptionId =
  insertResult?.insertId || null;


// =========================================================
// 13. RETURN CHECKOUT DATA
// =========================================================

return {
  success: true,

  message:
    'Recurring authorisation order created',

  key_id: keyId,

  customer: {
    id: razorpayCustomerId,
    name: userName,
    email: userEmail,
    contact: userPhone,
  },

  order: {
    id: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
  },

  subscription: {
    id: localSubscriptionId,
    subscription_code: subscriptionCode,

    razorpay_customer_id:
      razorpayCustomerId,

    razorpay_order_id:
      razorpayOrder.id,

    razorpay_token_id: null,

    status: 'created',
    payment_status: 'pending',

    auto_renew: true,
  },

  pricing: {
    price_per_venue: pricePerVenue,
    quantity,

    base_amount: baseAmount,

    gst_rate: gstRate,
    gst_amount: gstAmount,

    total_amount: totalAmount,

    razorpay_amount: razorpayAmount,

    currency: 'INR',

    billing:
      planTitle === 1
        ? 'monthly'
        : 'yearly',
  },
};
    } catch (error) {
      // =========================================================
      // GLOBAL ERROR HANDLING
      // =========================================================

      console.error('Razorpay token-based recurring setup failed:', error);

      console.error('Razorpay error details:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        error || 'Unable to create Razorpay recurring (token-based) setup',
      );
    }
  }

// async subscription(
//   body: any,
//   userId: number,
//   countryId: number,
// ) {
//   let localSubscriptionId: number | null = null;

//   try {
//     // =========================================================
//     // 1. VALIDATE
//     // =========================================================

//     const quantity = Number(body.quantity);

//     if (!Number.isInteger(quantity) || quantity < 1) {
//       throw new BadRequestException(
//         'Quantity must be a valid number greater than 0',
//       );
//     }

//     const selectedPlan = Number(body.selectedPlan);

//     if (!Number.isInteger(selectedPlan) || selectedPlan < 1) {
//       throw new BadRequestException(
//         'Invalid selected plan',
//       );
//     }

//     const parentVenueId = body.parent_venue_id;

//     if (!parentVenueId) {
//       throw new BadRequestException(
//         'Parent venue is required',
//       );
//     }

//     const selectedModes = Array.isArray(body.selectedModes)
//       ? body.selectedModes
//       : [];

//     // =========================================================
//     // 2. PLAN
//     // =========================================================

//     const [plan] = await this.dataSource.query(
//       `
//       SELECT
//         id,
//         plan_title,
//         amount,
//         category_id
//       FROM plans
//       WHERE id = ?
//       LIMIT 1
//       `,
//       [selectedPlan],
//     );

//     if (!plan) {
//       throw new BadRequestException(
//         'Plan not found',
//       );
//     }

//     // =========================================================
//     // 3. BILLING
//     // =========================================================

//     const planTitle = Number(plan.plan_title);

//     let billingCycle: 'monthly' | 'yearly';
//     let billingMonths: number;

//     if (planTitle === 1) {
//       billingCycle = 'monthly';
//       billingMonths = 1;
//     } else if (planTitle === 2) {
//       billingCycle = 'yearly';
//       billingMonths = 12;
//     } else {
//       throw new BadRequestException(
//         `Invalid plan_title: ${plan.plan_title}`,
//       );
//     }

//     // =========================================================
//     // 4. USER
//     // =========================================================

//     const [user] = await this.dataSource.query(
//       `
//       SELECT
//         id,
//         name,
//         email,
//         phone
//       FROM users
//       WHERE id = ?
//       LIMIT 1
//       `,
//       [userId],
//     );

//     if (!user) {
//       throw new BadRequestException(
//         'User not found',
//       );
//     }

//     // =========================================================
//     // 5. VENUE
//     // =========================================================

//     const [parentVenue] = await this.dataSource.query(
//       `
//       SELECT
//         vp.parent_venue_id AS id,
//         vp.conatct_person AS name,
//         vp.email,
//         vp.phone,
//         vc.child_venue_id
//       FROM venue_parent vp
//       LEFT JOIN venue_child vc
//         ON vc.parent_venue_id = vp.parent_venue_id
//       WHERE vp.parent_venue_id = ?
//       LIMIT 1
//       `,
//       [parentVenueId],
//     );

//     if (!parentVenue) {
//       throw new BadRequestException(
//         'Parent venue not found',
//       );
//     }

//     // =========================================================
//     // 6. CUSTOMER
//     // =========================================================

//     const userName = String(
//       parentVenue.name ||
//         user.name ||
//         'VenueBook User',
//     ).trim();

//     const userEmail = String(
//       parentVenue.email ||
//         user.email ||
//         '',
//     )
//       .trim()
//       .toLowerCase();

//     let userPhone = String(
//       parentVenue.phone ||
//         user.phone ||
//         '',
//     ).trim();

//     userPhone = userPhone.replace(/\D/g, '');

//     if (
//       userPhone.length === 12 &&
//       userPhone.startsWith('91')
//     ) {
//       userPhone = userPhone.substring(2);
//     }

//     if (!userEmail) {
//       throw new BadRequestException(
//         'Parent venue email is required',
//       );
//     }

//     if (userPhone.length !== 10) {
//       throw new BadRequestException(
//         'Valid 10 digit Indian phone number is required',
//       );
//     }

//     // =========================================================
//     // 7. BOOKING MODES
//     // =========================================================

//     if (
//       selectedModes.length > 0 &&
//       !parentVenue.child_venue_id
//     ) {
//       throw new BadRequestException(
//         'Child venue not found',
//       );
//     }

//     const modeMapping: Record<string, string> = {
//       reserve: 'reserve',
//       book: 'instant',
//       enquiry: 'enquire',
//     };

//     for (const mode of selectedModes) {
//       const settingKey =
//         modeMapping[mode] || mode;

//       await this.dataSource.query(
//         `
//         INSERT INTO venue_child_settings
//         (
//           child_id,
//           \`group\`,
//           \`key\`,
//           value,
//           type
//         )
//         VALUES
//         (
//           ?,
//           'publication',
//           ?,
//           'true',
//           'string'
//         )
//         ON DUPLICATE KEY UPDATE
//           value = VALUES(value)
//         `,
//         [
//           parentVenue.child_venue_id,
//           settingKey,
//         ],
//       );

//       await this.dataSource.query(
//         `
//         INSERT INTO venue_booking_modes
//         (
//           parent_venue_id,
//           mode
//         )
//         SELECT ?, ?
//         WHERE NOT EXISTS (
//           SELECT 1
//           FROM venue_booking_modes
//           WHERE parent_venue_id = ?
//             AND mode = ?
//         )
//         `,
//         [
//           parentVenueId,
//           mode,
//           parentVenueId,
//           mode,
//         ],
//       );
//     }

//     // =========================================================
//     // 8. PRICE
//     // =========================================================

//     const pricePerVenue = Number(plan.amount);

//     if (
//       !Number.isFinite(pricePerVenue) ||
//       pricePerVenue <= 0
//     ) {
//       throw new BadRequestException(
//         'Invalid plan amount',
//       );
//     }

//     const gstRate = 18;

//     const baseAmount = Number(
//       (
//         pricePerVenue * quantity
//       ).toFixed(2),
//     );

//     const gstAmount = Number(
//       (
//         (baseAmount * gstRate) /
//         100
//       ).toFixed(2),
//     );

//     // Your current logic excludes GST
//     const totalAmount = baseAmount;

//     const razorpayAmount = Math.round(
//       totalAmount * 100,
//     );

//     // =========================================================
//     // 9. CATEGORY
//     // =========================================================

//     const categoryId = Number(
//       body.categoryId ||
//         body.category ||
//         plan.category_id ||
//         1,
//     );

//     // =========================================================
//     // 10. RAZORPAY CONFIG
//     // =========================================================

//     const config =
//       await this.integrationService.getIntegrationConfig(
//         'razorpay',
//       );

//     const configData =
//       typeof config === 'string'
//         ? JSON.parse(config)
//         : config;

//     const keyId = String(
//       configData?.key_id || '',
//     ).trim();

//     const keySecret = String(
//       configData?.key_secret || '',
//     ).trim();

//     if (!keyId || !keySecret) {
//       throw new BadRequestException(
//         'Razorpay configuration is missing',
//       );
//     }

//     // =========================================================
//     // 11. RAZORPAY
//     // =========================================================

//     const razorpay = new Razorpay({
//       key_id: keyId,
//       key_secret: keySecret,
//     });

//     // =========================================================
//     // 12. LOCAL SUBSCRIPTION CODE
//     // =========================================================

//     const subscriptionCode =
//       `SUB_${Date.now()}_${userId}`;

//     // =========================================================
//     // 13. DATES
//     // =========================================================

//     const today = dayjs();

//     const startDate = today.format(
//       'YYYY-MM-DD HH:mm:ss',
//     );

//     const nextBillingDate = today
//       .add(billingMonths, 'month')
//       .format('YYYY-MM-DD HH:mm:ss');

//     // =========================================================
//     // 14. RAZORPAY CUSTOMER
//     // =========================================================

//     let razorpayCustomerId: string | null = null;

//     const [existingCustomer] =
//       await this.dataSource.query(
//         `
//         SELECT
//           razorpay_customer_id
//         FROM user_subscriptions
//         WHERE user_id = ?
//           AND razorpay_customer_id IS NOT NULL
//           AND razorpay_customer_id != ''
//         ORDER BY id DESC
//         LIMIT 1
//         `,
//         [userId],
//       );

//     if (
//       existingCustomer?.razorpay_customer_id
//     ) {
//       try {
//         const customer =
//           await razorpay.customers.fetch(
//             existingCustomer.razorpay_customer_id,
//           );

//         if (customer?.id) {
//           razorpayCustomerId =
//             String(customer.id);
//         }
//       } catch {
//         razorpayCustomerId = null;
//       }
//     }

//     // =========================================================
//     // CREATE CUSTOMER
//     // =========================================================

//     if (!razorpayCustomerId) {
//       const customer =
//         await (
//           razorpay.customers.create as any
//         )({
//           name: userName,
//           email: userEmail,
//           contact: userPhone,

//           fail_existing: '0',

//           notes: {
//             user_id: String(userId),
//             parent_venue_id:
//               String(parentVenueId),
//             subscription_code:
//               subscriptionCode,
//           },
//         });

//       razorpayCustomerId =
//         String(customer.id);
//     }

//     // =========================================================
//     // 15. UPI AUTOPAY TOKEN DETAILS
//     // =========================================================

//     const expireAt =
//       Math.floor(Date.now() / 1000) +
//       10 * 365 * 24 * 60 * 60;

//     const frequency =
//       billingCycle === 'monthly'
//         ? 'monthly'
//         : 'yearly';

//     // =========================================================
//     // 16. CREATE RAZORPAY ORDER
//     // =========================================================

//     let razorpayOrder: any;

//     try {
//       razorpayOrder =
//         await (
//           razorpay.orders.create as any
//         )({
//           amount: razorpayAmount,

//           currency: 'INR',

//           customer_id:
//             razorpayCustomerId,

//           token: {
//             max_amount:
//               razorpayAmount,

//             expire_at:
//               expireAt,

//             frequency:
//               frequency,
//           },

//           receipt:
//             subscriptionCode,

//           notes: {
//             user_id:
//               String(userId),

//             parent_venue_id:
//               String(parentVenueId),

//             plan_id:
//               String(plan.id),

//             category_id:
//               String(categoryId),

//             country_id:
//               String(countryId),

//             quantity:
//               String(quantity),

//             subscription_code:
//               subscriptionCode,

//             billing_cycle:
//               billingCycle,

//             base_amount:
//               String(baseAmount),

//             gst_amount:
//               String(gstAmount),

//             total_amount:
//               String(totalAmount),
//           },
//         });
//     } catch (error: any) {
//       console.error(
//         'Razorpay order creation failed:',
//         error?.response?.data ||
//           error,
//       );

//       throw new BadRequestException(
//         error?.response?.data?.error
//           ?.description ||
//           error?.error?.description ||
//           error?.message ||
//           'Unable to create Razorpay order',
//       );
//     }

//     // =========================================================
//     // 17. LOCAL SUBSCRIPTION
//     // =========================================================

//     try {
//       const insertResult =
//         await this.dataSource.query(
//           `
//           INSERT INTO user_subscriptions
//           (
//             user_id,
//             country_id,
//             category_id,
//             plan_id,

//             subscription_code,

//             quantity,
//             price_per_unit,

//             gst_rate,
//             gst_amount,

//             current_amount,
//             total_amount,

//             start_date,
//             next_billing_date,

//             auto_renew,

//             status,
//             payment_status,

//             razorpay_customer_id,
//             razorpay_order_id,
//             razorpay_payment_id,
//             razorpay_token_id,

//             created_at,
//             updated_at
//           )
//           VALUES
//           (
//             ?, ?, ?, ?,

//             ?,

//             ?, ?,

//             ?, ?,

//             ?, ?,

//             ?,
//             ?,

//             1,

//             'pending',
//             'pending',

//             ?,
//             ?,
//             NULL,
//             NULL,

//             NOW(),
//             NOW()
//           )
//           `,
//           [
//             userId,
//             countryId,
//             1,
//             plan.id,

//             subscriptionCode,

//             quantity,
//             pricePerVenue,

//             gstRate,
//             gstAmount,

//             baseAmount,
//             totalAmount,

//             startDate,
//             nextBillingDate,

//             razorpayCustomerId,
//             razorpayOrder.id,
//           ],
//         );

//       localSubscriptionId =
//         insertResult?.insertId || null;
//     } catch (error: any) {
//       console.error(
//         'Local subscription creation failed:',
//         error,
//       );

//       throw new BadRequestException(
//         'Failed to create local subscription',
//       );
//     }

//     if (!localSubscriptionId) {
//       throw new BadRequestException(
//         'Failed to create local subscription',
//       );
//     }

//     // =========================================================
//     // 18. RETURN CHECKOUT DATA
//     // =========================================================

//     return {
//       success: true,

//       message:
//         'UPI Autopay authorization ready',

//       key_id:
//         keyId,

//       customer: {
//         id:
//           razorpayCustomerId,

//         name:
//           userName,

//         email:
//           userEmail,

//         contact:
//           userPhone,
//       },

//       order: {
//         id:
//           razorpayOrder.id,

//         amount:
//           razorpayAmount,

//         currency:
//           'INR',
//       },

//       subscription: {
//         id:
//           localSubscriptionId,

//         subscription_code:
//           subscriptionCode,

//         razorpay_customer_id:
//           razorpayCustomerId,

//         razorpay_order_id:
//           razorpayOrder.id,

//         status:
//           'pending',

//         payment_status:
//           'pending',

//         auto_renew:
//           true,

//         billing_cycle:
//           billingCycle,

//         start_date:
//           startDate,

//         next_billing_date:
//           nextBillingDate,
//       },

//       pricing: {
//         price_per_venue:
//           pricePerVenue,

//         quantity,

//         base_amount:
//           baseAmount,

//         gst_rate:
//           gstRate,

//         gst_amount:
//           gstAmount,

//         total_amount:
//           totalAmount,

//         razorpay_amount:
//           razorpayAmount,

//         currency:
//           'INR',
//       },
//     };
//   } catch (error: any) {
//     console.error(
//       'UPI Autopay subscription failed:',
//       error,
//     );

//     if (localSubscriptionId) {
//       try {
//         await this.dataSource.query(
//           `
//           UPDATE user_subscriptions
//           SET
//             status = 'failed',
//             payment_status = 'failed',
//             updated_at = NOW()
//           WHERE id = ?
//           `,
//           [localSubscriptionId],
//         );
//       } catch (dbError) {
//         console.error(
//           'Failed updating subscription:',
//           dbError,
//         );
//       }
//     }

//     if (
//       error instanceof
//       BadRequestException
//     ) {
//       throw error;
//     }

//     throw new BadRequestException(
//       error?.message ||
//         'Unable to create UPI Autopay subscription',
//     );
//   }
// }


  async updateSubscriptionQuantity(body: any, userId: number) {
    try {
      const newQuantity = Number(body.quantity);

      if (!Number.isInteger(newQuantity) || newQuantity < 1) {
        throw new BadRequestException('Quantity must be at least 1');
      }

      // =====================================================
      // Get user's active subscription
      // =====================================================
      const [subscription] = await this.dataSource.query(
        `
      SELECT *
      FROM user_subscriptions
      WHERE user_id = ?
        AND status = 'active'
      ORDER BY id DESC
      LIMIT 1
      `,
        [userId],
      );

      if (!subscription) {
        throw new BadRequestException('Active subscription not found');
      }

      if (!subscription.subscription_id) {
        throw new BadRequestException('Razorpay subscription ID not found');
      }

      // =====================================================
      // Get Razorpay configuration
      // =====================================================
      const config =
        await this.integrationService.getIntegrationConfig('razorpay');

      const configData =
        typeof config === 'string' ? JSON.parse(config) : config;

      const razorpay = new Razorpay({
        key_id: configData.key_id,
        key_secret: configData.key_secret,
      });

      // =====================================================
      // Current quantity
      // =====================================================
      const oldQuantity = Number(subscription.quantity || 1);

      // =====================================================
      // Determine upgrade / downgrade
      // =====================================================
      let changeType = 'same';

      if (newQuantity > oldQuantity) {
        changeType = 'upgrade';
      } else if (newQuantity < oldQuantity) {
        changeType = 'downgrade';
      }

      if (changeType === 'same') {
        return {
          success: true,
          message: 'Quantity is already the same',
          quantity: oldQuantity,
        };
      }

      // =====================================================
      // Calculate amounts
      // =====================================================
      const pricePerUnit = Number(subscription.price_per_unit || 199);

      const gstRate = Number(subscription.gst_rate || 18);

      const newBaseAmount = Number((pricePerUnit * newQuantity).toFixed(2));

      const newGstAmount = Number(((newBaseAmount * gstRate) / 100).toFixed(2));

      const newTotalAmount = Number((newBaseAmount + newGstAmount).toFixed(2));

      // =====================================================
      // Update Razorpay subscription
      //
      // cycle_end:
      // New quantity starts from next billing cycle.
      // =====================================================
      const updatedSubscription = await razorpay.subscriptions.update(
        subscription.subscription_id,
        {
          quantity: newQuantity,
          schedule_change_at: 'cycle_end',
          customer_notify: true,
        },
      );

      // =====================================================
      // Update VenueBook database
      // =====================================================
      await this.dataSource.query(
        `
      UPDATE user_subscriptions
      SET
        quantity = ?,
        current_amount = ?,
        gst_amount = ?,
        total_amount = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
        [
          newQuantity,
          newBaseAmount,
          newGstAmount,
          newTotalAmount,
          subscription.id,
        ],
      );

      // =====================================================
      // Return response
      // =====================================================
      return {
        success: true,

        change_type: changeType,

        old_quantity: oldQuantity,
        new_quantity: newQuantity,

        pricing: {
          price_per_unit: pricePerUnit,

          base_amount: newBaseAmount,

          gst_rate: gstRate,

          gst_amount: newGstAmount,

          total_amount: newTotalAmount,

          currency: 'INR',
        },

        razorpay: {
          subscription_id: updatedSubscription.id,

          status: updatedSubscription.status,

          quantity: updatedSubscription.quantity,

          schedule_change_at: updatedSubscription.schedule_change_at,

          has_scheduled_changes: updatedSubscription.has_scheduled_changes,
        },
      };
    } catch (error) {
      console.error('Razorpay quantity update failed:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        error || 'Unable to update subscription quantity',
      );
    }
  }

  async verifySubscription(body: any) {
    console.log('========== VERIFY RAZORPAY PAYMENT ==========');

    console.log('Verify body:', body);

    // =========================================================
    // 1. Validate required fields
    // =========================================================

    if (!body?.payment_id) {
      throw new BadRequestException('Payment ID is required');
    }

    if (!body?.order_id) {
      throw new BadRequestException('Order ID is required');
    }

    if (!body?.signature) {
      throw new BadRequestException('Razorpay signature is required');
    }

    const subscriptionTableId = Number(body?.subscription_table_id);

    if (!Number.isInteger(subscriptionTableId) || subscriptionTableId <= 0) {
      throw new BadRequestException('Valid subscription table ID is required');
    }

    // =========================================================
    // 2. Get Razorpay configuration
    // =========================================================

    const config =
      await this.integrationService.getIntegrationConfig('razorpay');

    const configData = typeof config === 'string' ? JSON.parse(config) : config;

    const keySecret = String(configData?.key_secret || '').trim();

    if (!keySecret) {
      throw new BadRequestException('Razorpay key secret is missing');
    }

    const razorpay = new Razorpay({
      key_id: configData.key_id,
      key_secret: configData.key_secret,
    });

    // =========================================================
    // 3. Verify Razorpay Checkout signature
    //
    // Checkout signature:
    //
    // order_id|payment_id
    // =========================================================

    const signaturePayload = `${body.order_id}|${body.payment_id}`;

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(signaturePayload)
      .digest('hex');

    console.log('Signature payload:', signaturePayload);

    console.log('Expected signature:', expectedSignature);

    console.log('Received signature:', body.signature);

    if (expectedSignature !== String(body.signature).trim()) {
      console.error('Razorpay signature mismatch');

      throw new BadRequestException('Invalid signature');
    }

    console.log('Razorpay signature verified successfully');

    // =========================================================
    // 4. Find subscription
    // =========================================================

    const [subscription] = await this.dataSource.query(
      `
      SELECT
        user_subscriptions.* , u.email,u.phone,u.name
      FROM user_subscriptions
      LEFT JOIN users u ON u.id = user_subscriptions.user_id
      WHERE user_subscriptions.id = ?
      LIMIT 1
      `,
      [subscriptionTableId],
    );

    if (!subscription) {
      throw new BadRequestException('Subscription record not found');
    }

    // =========================================================
    // 5. Verify order belongs to subscription
    // =========================================================

    if (
      subscription.razorpay_order_id &&
      subscription.razorpay_order_id !== body.order_id
    ) {
      throw new BadRequestException(
        'Order does not belong to this subscription',
      );
    }

    // =========================================================
    // 6. Prevent duplicate payment
    // =========================================================

    const [existingPayment] = await this.dataSource.query(
      `
      SELECT
        id
      FROM user_subscription_payments
      WHERE payment_id = ?
      LIMIT 1
      `,
      [body.payment_id],
    );

    if (existingPayment) {
      console.log('Payment already exists:', existingPayment.id);

      return {
        success: true,

        message: 'Payment already verified',

        subscription_id: subscription.id,

        subscription_code: subscription.subscription_code,

        payment_id: body.payment_id,

        order_id: body.order_id,

        status: 'active',

        payment_status: 'paid',
      };
    }

    // =========================================================
    // 7. Token / authorization reference
    //
    // IMPORTANT:
    //
    // Your current Checkout response does NOT contain
    // razorpay_token_id.
    //
    // Therefore this will normally be NULL unless your
    // frontend/webhook/backend sends it.
    // =========================================================

    // const tokenId =
    //   body?.token_id ||
    //   body?.razorpay_token_id ||
    //   null;

    // console.log(
    //   'Razorpay token ID:',
    //   tokenId,
    // );

    const payment = await razorpay.payments.fetch(body.payment_id);

    const tokenId = payment?.token_id || null;

    console.log('Razorpay token:', tokenId);
    // =========================================================
    // 8. Calculate payment values
    // =========================================================

    const amount = Number(
      subscription.current_amount ?? subscription.total_amount ?? 0,
    );

    const totalAmount = Number(subscription.total_amount ?? amount);

    const gstAmount = Number(subscription.gst_amount ?? 0);

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      throw new BadRequestException('Invalid subscription amount');
    }

    // Database amount is normally INR.
    // user_subscription_payments.amount should match
    // your existing table convention.
    const paymentAmount = totalAmount;

    // =========================================================
    // 9. Calculate billing dates
    // =========================================================

    //const startDate = dayjs().format('YYYY-MM-DD HH:mm:ss');;

    //const nextBillingDate = startDate.add(1, 'month').format('YYYY-MM-DD HH:mm:ss');

    //const interval = Number(plan.interval || 1);

    const interval = 1;

    const startDate = dayjs();

    const nextBillingDate = startDate.add(interval, 'month');

    const startDateFormatted = startDate.format('YYYY-MM-DD HH:mm:ss');

    const nextBillingDateFormatted = nextBillingDate.format(
      'YYYY-MM-DD HH:mm:ss',
    );

    console.log({
      startDateFormatted,
      nextBillingDateFormatted,
    });

    // =========================================================
    // 10. Start DB transaction
    // =========================================================

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();

    await queryRunner.startTransaction();

    try {
      // =======================================================
      // 11. Update subscription
      // =======================================================

      await queryRunner.query(
        `
      UPDATE user_subscriptions
      SET
        status = 'active',

        payment_status = 'paid',

        razorpay_payment_id = ?,

        razorpay_order_id = ?,

        

        razorpay_token_id = COALESCE(?, razorpay_token_id),

        token_status =
          CASE
            WHEN ? IS NOT NULL
            THEN 'active'
            ELSE token_status
          END,

        

        start_date = ?,

        next_billing_date = ?,

        auto_renew = 1,

        updated_at = NOW()

      WHERE id = ?
      `,
        [
          body.payment_id,

          body.order_id,

          // body.signature,

          //tokenId,

          tokenId,

          tokenId,

          startDateFormatted,

          nextBillingDateFormatted,

          subscriptionTableId,
        ],
      );

      // =======================================================
      // 12. Insert payment transaction
      // =======================================================

      await queryRunner.query(
        `
      INSERT INTO user_subscription_payments
      (
        subscription_id,

        user_id,

        order_id,

        transaction_id,

        payment_id,

        amount,

        tax_amount,

        total_amount,

        payment_method,

        payment_status,

        paid_at,

        created_at
      )
      VALUES
      (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        NOW(),
        NOW()
      )
      `,
        [
          subscriptionTableId,

          subscription.user_id,

          body.order_id,

          body.payment_id,

          body.payment_id,

          paymentAmount - gstAmount,

          gstAmount,

          totalAmount,

          'razorpay',

          'paid',
        ],
      );

      // =======================================================
      // 13. Commit transaction
      // =======================================================

      await queryRunner.commitTransaction();

      console.log('Subscription activated successfully');

      console.log('Payment transaction inserted successfully');

      // =======================================================
      // 14. ZOHO
      // =======================================================

//         const vbquantity = subscription.quantity || 1;
// const oneSubAmt = amount / vbquantity; 
// const gst = oneSubAmt - oneSubAmt / 1.18;
// const zohoAmount = Math.round(oneSubAmt / 1.18);

  const vbquantity = subscription.quantity || 1;
  const wihour_gst = Math.round(amount);
const oneSubAmt = wihour_gst / vbquantity; 
const gst = oneSubAmt - oneSubAmt / 1.18;
const zohoAmount = Math.round(oneSubAmt);

      try {
        await this.createZohoTransaction({
          customer: subscription.name,
          email: subscription.email,
          phone: subscription.phone,

          bookingId: `SUB-${body.order_id}`,

          total_amount: zohoAmount,

          category: 'subscription',

          convenienceFee: 0,

          charge_amount: 0,
          quantity: vbquantity ,
        });

        this.logger.log(
          `Zoho transaction created for payment: ${body.payment_id}`,
        );
      } catch (zohoError) {
        this.logger.error(
          `Zoho transaction failed for payment ${body.payment_id}`,
          zohoError,
        );
      }

      // =======================================================
      // 14. Return
      // =======================================================

      return {
        success: true,

        message: 'Razorpay payment verified successfully',

        subscription_id: subscription.id,

        subscription_code: subscription.subscription_code,

        payment_id: body.payment_id,

        order_id: body.order_id,

        token_id: tokenId,

        status: 'active',

        payment_status: 'paid',

        auto_renew: true,

        start_date: startDate,

        next_billing_date: nextBillingDate,

        payment: {
          amount: paymentAmount - gstAmount,

          tax_amount: gstAmount,

          total_amount: totalAmount,

          currency: 'INR',

          payment_method: 'razorpay',

          payment_status: 'paid',
        },
      };
    } catch (error) {
      // =======================================================
      // Rollback if anything fails
      // =======================================================

      await queryRunner.rollbackTransaction();

      console.error('Subscription verification DB transaction failed:', error);

      throw error;
    } finally {
      // =======================================================
      // Release connection
      // =======================================================

      await queryRunner.release();
    }
  }

  async verifys(id: any, param: any, payment_id: any) {
    console.log(payment_id);
    const result = await this.dataSource.query(
      `
      SELECT *
      FROM user_subscriptions
      WHERE id = ?
      LIMIT 1
    `,
      [id],
    );

    const subscription = result[0];

    if (!subscription) {
      console.log('Subscription not found');
    }

    // Already active
    if (subscription.status === 'active') {
      return {
        success: true,
        subscription_id: subscription.id,
        status: 'active',
        already_verified: true,
      };
    }

    // You need these values to call verifySubscription()
    if (!subscription.subscription_code) {
      return {
        success: false,
        subscription_id: subscription.id,
        status: subscription.status,
        message: 'Payment verification information is missing',
      };
    }

    // Automatically verify
    // return await this.verifySubscription({
    //   subscription_id:
    //     subscription.subscription_code,
    //     signature:param,
    //     payment_id:payment_id,

    // });

    await this.dataSource.query(
      `
      UPDATE user_subscriptions
      SET
        status='active' ,
        updated_at=NOW()
      WHERE subscription_code=?
    `,
      [subscription.subscription_code],
    );
  }
  async verifyPayment(body: any, id: any) {
    const config =
      await this.integrationService.getIntegrationConfig('razorpay');

    const configData = typeof config === 'string' ? JSON.parse(config) : config;

    const expected = crypto
      .createHmac('sha256', configData.key_secret)
      .update(body.razorpay_payment_id + '|' + body.razorpay_subscription_id)
      .digest('hex');

    if (expected !== body.razorpay_signature) {
      throw new BadRequestException('Invalid Signature');
    }

    await this.dataSource.query(
      `
      UPDATE user_subscriptions
      SET
      status='active',
      updated_at=NOW()
      WHERE subscription_id=?
      `,
      [body.razorpay_subscription_id],
    );

    return {
      success: true,
      message: 'Subscription Activated',
    };
  }

  // payment.service.ts

  async createOrder(body: any) {
    const options = {
      amount: body.amount * 100, // ₹500 => 50000 paise
      currency: 'INR',
      receipt: `RCPT_${Date.now()}`,
      payment_capture: true,
      notes: {
        booking_id: body.booking_id,
      },
    };

    const config =
      await this.integrationService.getIntegrationConfig('razorpay');

    const configData = typeof config === 'string' ? JSON.parse(config) : config;

    const response = await axios.post(
      'https://api.razorpay.com/v1/orders',
      options,
      {
        auth: {
          username: configData.key_id.trim(),
          password: configData.key_secret.trim(),
        },
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    return response?.data;
  }

  async verify(body: any) {
    const config =
      await this.integrationService.getIntegrationConfig('razorpay');
    const configData = typeof config === 'string' ? JSON.parse(config) : config;
    const generatedSignature = crypto
      .createHmac('sha256', configData.key_secret)
      .update(body.razorpay_order_id + '|' + body.razorpay_payment_id)
      .digest('hex');

    if (generatedSignature !== body.razorpay_signature) {
      throw new Error('Payment verification failed');
    }

    // Update booking/payment status

    return {
      success: true,
    };
  }

  async createOnlineBooking(dto: any, id: number, country: any) {
    const booking = dto.booking || {};
    const rawPricing = dto.pricing || {};
    const customer = dto.customer || dto.customer_details || {};
    const rawAddons = dto.addons || [];

    const category = booking.category ?? dto.category;
    const bookingType =
      booking.booking_type ?? dto.booking_type ?? dto.reserveType;
    const guestCapacity = booking.guests ?? dto.event?.guest_capacity ?? 0;
    // const eventType      = booking.event_type ?? dto.event?.event_type ?? null;
    const selectionType =
      booking.selection_type ?? dto.event?.selection_type ?? null;
    const selectionMode =
      booking.selection_mode ?? dto.event?.selection_mode ?? null;
    const reservation_end_date = booking.reservation_end_date ?? null;
    const specialRequest = dto.special_request ?? booking.notes ?? null;

    //wallets

    // Single-venue shape (new) vs. multi-venue array shape (old / farmstay)
    const venueId = booking.venue_id ?? null;
    const venueName = booking.venue_name ?? null;
    const legacyVenues = Array.isArray(dto.venues) ? dto.venues : null;

    // Dates: single `date`, or check_in/check_out range (new) vs. event.date_range /
    // event.event_date (old)
    const singleDate = booking.date ?? null;
    const checkIn = booking.check_in ?? null;
    const checkOut = booking.check_out ?? null;

    // Shift: single string (new) vs. array of strings (old)
    const shiftRaw = booking.shift ?? dto.event?.shift ?? null;
    const shifts: string[] = Array.isArray(shiftRaw)
      ? shiftRaw
      : shiftRaw
        ? [shiftRaw]
        : [];

    // Customer
    const customerName = customer.name ?? null;
    const customerPhone = customer.phone ?? null;
    const customerEmail = customer.email ?? null;

    // Pricing — new payload uses camelCase + a single combined GST figure;
    // legacy payload uses snake_case + separate venue/pax GST figures.
    const pricing = {
      baseAmount: rawPricing.baseAmount ?? rawPricing.base_amount ?? 0,
      cleaningAmount: rawPricing.cleaningAmount ?? 0,
      convenienceFee: rawPricing.convenienceFee ?? 0,
      addonAmount: rawPricing.addon_amount ?? rawPricing.addonAmount ?? 0,
      securityDeposit:
        rawPricing.securityDeposit ?? rawPricing.security_deposit ?? 0,
      advanceAmount: rawPricing.advance_amount ?? 0,
      reservationAmount: rawPricing.reservation_amount ?? 0,
      walletDiscount: rawPricing.wallet_discount ?? 0,
      discountAmount: rawPricing.discount_amount ?? 0,
      discountPercent: rawPricing.discount_percent ?? 0,
      grandTotal: rawPricing.grand_total ?? rawPricing.final_total ?? 0,
      // GST — combined (new) or split venue/pax GST (legacy)
      isCombinedGst: rawPricing.gstAmount != null,
      gstAmount: rawPricing.gstAmount ?? 0,
      gstPercent: rawPricing.gstPercent ?? 18,
      gstTotalLegacy: rawPricing.gst_total ?? 0,
      paxGstLegacy: rawPricing.pax_gst ?? 0,
      estimated_total: rawPricing.estimated_total ?? 0,

      burnPoint: rawPricing.burnPoint ?? 0,
      earnedPoints: rawPricing.earnedPoints ?? 0,
      wallet_discount: rawPricing.wallet_discount ?? 0,
      paid_amount: rawPricing.payableNow ?? 0,
    };

    //Find Which Vendor Under
    const [vendor_detial] = await this.dataSource.query(
      `SELECT created_by FROM venue_child WHERE child_venue_id = ? LIMIT 1`,
      [venueId],
    );

    //Online payment
    const payment = dto.payment || {};

    const taxAmountTotal = pricing.isCombinedGst
      ? pricing.gstAmount
      : pricing.gstTotalLegacy + pricing.paxGstLegacy;

    const discountAmountTotal =
      pricing.discountAmount || pricing.walletDiscount || 0;

    // -----------------------------
    // 1. CATEGORY
    // -----------------------------
    const singular = category?.endsWith('s') ? category.slice(0, -1) : category;

    const [categoryRow] = await this.dataSource.query(
      `SELECT id FROM category WHERE name = ? LIMIT 1`,
      [singular],
    );

    // -----------------------------
    // 2. IDS
    // -----------------------------
    let code = generateCode();

    while (true) {
      const rows = await this.dataSource.query(
        `SELECT 1 FROM bookings WHERE invoice_number = ? LIMIT 1`,
        [code],
      );

      if (rows.length === 0) break;
      code = generateCode();
    }

    // 'book' -> 'booked', 'reserve' -> 'reserve', anything else passes through.
    const reserveType =
      bookingType === 'book' ? 'booked' : bookingType || 'draft';

    // Event Type
    const eventRows: any = await this.dataSource.query(
      `SELECT id FROM booking_event_types WHERE event_name = ? LIMIT 1`,
      [booking.event_type ?? dto.event?.event_type],
    );

    const eventTypeId = eventRows.length ? eventRows[0].id : null;

    // -----------------------------
    // 3. MAIN BOOKING INSERT
    // -----------------------------
    const result: any = await this.dataSource.query(
      `
      INSERT INTO bookings
      (
        booking_code,
        invoice_number,
        booking_type,
        category,
        country_id,
        status,
        total_pax,
        base_amount,
        discount_amount,
        tax_amount,
        total_amount,
        notes,
        vendor_id,
        created_by,
        updated_by,
        created_at,
        updated_at,
        booking_event_type_id,
        selection_mode,
        selection_type,
        estimated_total,
        reservation_end_date

      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `,
      [
        code,
        0,
        reserveType,
        categoryRow?.id || null,
        country,
        'active',

        guestCapacity || 0,
        pricing.baseAmount || 0,
        discountAmountTotal,
        taxAmountTotal,
        pricing.grandTotal || 0,

        specialRequest,

        vendor_detial.created_by, // Venue create by vendor ID
        id,
        id,
        new Date(),
        new Date(),
        eventTypeId,
        'Online',
        'Online',
        pricing.estimated_total || 0,
        booking.reservation_end_date,
      ],
    );

    const bookingId = result.insertId;

    // -----------------------------
    // 4. VENUES
    // -----------------------------
    let venueValues: any[] = [];

    if (legacyVenues?.length) {
      // Old multi-venue / farmstay shape
      venueValues = legacyVenues.map((venue: any) => [
        bookingId,
        venue.parent_venue_id || null,
        venue.child_venue_id || null,
        venue.child_venue_name || null,
      ]);
    } else if (venueId) {
      // New single-venue shape
      venueValues = [[bookingId, null, venueId, venueName]];
    }

    if (venueValues.length) {
      await this.dataSource.query(
        `
        INSERT INTO booking_venues
        (booking_id, parent_venue_id, child_venue_id, venue_name_snapshot)
        VALUES ?
        `,
        [venueValues],
      );
    }

    // -----------------------------
    // 5. EVENT DATES
    // -----------------------------
    let eventDates: string[] = [];

    // Farmstay / multi-venue date range (old shape)
    if (
      legacyVenues?.length &&
      legacyVenues[0]?.start_date &&
      legacyVenues[0]?.end_date
    ) {
      eventDates = getDatesBetween(
        legacyVenues[0].start_date,
        legacyVenues[0].end_date,
      );
    }
    // Single-venue check-in/check-out range (new shape)
    else if (checkIn && checkOut) {
      eventDates = getDatesBetween(checkIn, checkOut);
    }
    // Event date range (old shape)
    else if (
      dto.event?.date_range?.start_date &&
      dto.event?.date_range?.end_date
    ) {
      eventDates = getDatesBetween(
        dto.event.date_range.start_date,
        dto.event.date_range.end_date,
      );
    }
    // Multiple selected dates (old shape)
    else if (Array.isArray(dto.event?.event_date)) {
      eventDates = dto.event.event_date;
    }
    // Single date (new shape)
    else if (singleDate) {
      eventDates = [singleDate];
    }
    // Single date (old shape)
    else if (dto.event?.event_date) {
      eventDates = [dto.event.event_date];
    }

    // Remove duplicates
    eventDates = [...new Set(eventDates)];

    // Insert dates
    const eventDateResult: any[] = [];

    for (const date of eventDates) {
      const res: any = await this.dataSource.query(
        `
          INSERT INTO booking_event_dates
          (booking_id, event_date)
          VALUES (?, ?)
        `,
        [bookingId, date],
      );

      eventDateResult.push({
        id: res.insertId,
        date,
      });
    }

    // -----------------------------
    // 6. SHIFTS
    // -----------------------------
    const SHIFT_MAP: any = {
      morning: 1,
      afternoon: 2,
      evening: 3,
    };

    const shiftValues: any[] = [];

    for (const ed of eventDateResult) {
      for (const shift of shifts) {
        const shiftId = SHIFT_MAP[shift.toLowerCase()];
        if (!shiftId) continue;

        shiftValues.push([bookingId, ed.id, 0, shift, 'active']);
      }
    }

    if (shiftValues.length) {
      await this.dataSource.query(
        `
        INSERT INTO booking_shifts
        (booking_id, event_date_id, venue_id, shift_name, status)
        VALUES ?
        `,
        [shiftValues],
      );
    }

    // -----------------------------
    // 7. CUSTOMER
    // -----------------------------
    await this.dataSource.query(
      `
      INSERT INTO booking_parties
      (
        booking_id,
        party_type,
        party_id,
        name,
        phone,
        email
      )
      VALUES (?,?,?,?,?,?)
      `,
      [bookingId, 'customer', 0, customerName, customerPhone, customerEmail],
    );

    // -----------------------------
    // 8. SERVICE PROVIDERS
    // -----------------------------
    const providers = dto.service_providers || {};

    const providerValues = Object.entries(providers)
      .filter(([, value]) => value)
      .map(([type, value]: any) => [bookingId, type, 0, value]);

    if (providerValues.length) {
      await this.dataSource.query(
        `
        INSERT INTO booking_parties
        (booking_id, party_type, party_id, name)
        VALUES ?
        `,
        [providerValues],
      );
    }

    // -----------------------------
    // 9. CHARGES
    // -----------------------------
    const chargeValues: any[] = [];

    // --------------------
    // 1. BASE AMOUNT
    // --------------------
    chargeValues.push([
      bookingId,
      'base',
      'Base Amount',
      1,
      pricing.baseAmount || 0,
      pricing.baseAmount || 0,
    ]);

    // --------------------
    // 2. ADDONS
    // --------------------
    if (rawAddons.length) {
      // New shape sends { add_on_id, qty, price, total } with no name — look the
      // names up in one batch query so charge rows stay human-readable.
      const addonIds = rawAddons
        .map((a: any) => a.add_on_id)
        .filter((v: any) => v != null);

      let addonNameById: Record<string, string> = {};
      if (addonIds.length) {
        const addonRows = await this.dataSource.query(
          `SELECT add_on_id as id, add_on_name as name FROM add_ons WHERE add_on_id IN (?)`,
          [addonIds],
        );
        addonNameById = Object.fromEntries(
          addonRows.map((r: any) => [r.id, r.name]),
        );
      }

      for (const addon of rawAddons) {
        const name = addon.name || addonNameById[addon.add_on_id] || 'Add-on';
        const qty = addon.qty ?? 1;
        const unitPrice = addon.price ?? addon.unit_price ?? 0;
        const total = addon.total ?? addon.amount ?? qty * unitPrice;

        chargeValues.push([bookingId, 'addon', name, qty, unitPrice, total]);
      }
    }

    // --------------------
    // 3. CONVENIENCE FEE (new)
    // --------------------
    if (pricing.convenienceFee) {
      chargeValues.push([
        bookingId,
        'convenience_fee',
        'Convenience Fee',
        1,
        pricing.convenienceFee,
        pricing.convenienceFee,
      ]);
    }

    // --------------------
    // 4. CLEANING FEE (new)
    // --------------------
    if (pricing.cleaningAmount) {
      chargeValues.push([
        bookingId,
        'cleaning_fee',
        'Cleaning Fee',
        1,
        pricing.cleaningAmount,
        pricing.cleaningAmount,
      ]);
    }

    // --------------------
    // 5. SECURITY DEPOSIT
    // --------------------
    if (pricing.securityDeposit) {
      chargeValues.push([
        bookingId,
        'security_deposit',
        'Security Deposit',
        1,
        pricing.securityDeposit,
        pricing.securityDeposit,
      ]);
    }

    // --------------------
    // 6. ADVANCE PAYMENT
    // --------------------
    if (pricing.advanceAmount) {
      chargeValues.push([
        bookingId,
        'advance',
        'Advance Payment',
        1,
        pricing.advanceAmount,
        pricing.advanceAmount,
      ]);
    }

    // --------------------
    // 7. RESERVATION AMOUNT
    // --------------------
    if (pricing.reservationAmount) {
      chargeValues.push([
        bookingId,
        'reservation',
        'Reservation Amount',
        1,
        pricing.reservationAmount,
        pricing.reservationAmount,
      ]);
    }

    // --------------------
    // 8. DISCOUNT — explicit discount (old) takes priority over wallet discount (new)
    // --------------------
    if (pricing.discountAmount) {
      chargeValues.push([
        bookingId,
        'discount',
        'Discount',
        1,
        -pricing.discountPercent,
        -pricing.discountAmount,
      ]);
    } else if (pricing.walletDiscount) {
      chargeValues.push([
        bookingId,
        'wallet_discount',
        'Wallet Discount',
        1,
        0,
        -pricing.walletDiscount,
      ]);
    }

    // --------------------
    // INSERT ALL
    // --------------------
    await this.dataSource.query(
      `
      INSERT INTO booking_charges
      (booking_id, charge_type, title, quantity, unit_price, total_price)
      VALUES ?
      `,
      [chargeValues],
    );

    // -----------------------------
    // TAXES — combined GST (new) or split venue/pax GST (legacy)
    // -----------------------------
    const taxes: any[] = [];

    if (pricing.isCombinedGst) {
      if (pricing.gstAmount > 0) {
        taxes.push([
          bookingId,
          'GST',
          pricing.gstPercent || 18,
          0,
          pricing.gstAmount,
        ]);
      }
    } else {
      if (pricing.gstTotalLegacy > 0) {
        taxes.push([bookingId, 'Venue GST', 18, 0, pricing.gstTotalLegacy]);
      }

      if (pricing.paxGstLegacy > 0) {
        taxes.push([bookingId, 'PAX GST', 5, 0, pricing.paxGstLegacy]);
      }
    }

    if (taxes.length) {
      await this.dataSource.query(
        `
        INSERT INTO booking_taxes
        (booking_id, tax_name, tax_percent, taxable_amount, tax_amount)
        VALUES ?
        `,
        [taxes],
      );
    }

    // -----------------------------
    // 10. LOGS
    // -----------------------------
    await this.createLog(
      'booking',
      bookingId,
      'created',
      `Booking ${code} created`,
      id,
      null,
      {
        booking_type: reserveType,
        customer: customerName,
        total_amount: pricing.grandTotal,
      },
    );

    // Realtime
    this.socketService.realtime(
      id.toString(),
      'Booking',
      `Booking ${code} created`,
    );

    // Email
    const invoiceData = {
      email: customerEmail,
      id: bookingId,
    };
    this.invoiceService.sendInvoice(invoiceData);

    await this.notificationService.createNotification({
      type: reserveType,
      referenceId: bookingId,
      title: `New ${reserveType}`,
      message: `New ${reserveType} received - ${code}`,
      createdBy: id,
    });

    //twilioService
    //   await this.twilioService.sendWhatsApp({
    //   to: `+91${customerPhone}`,
    //   body: `Your ${reserveType} booking has been received successfully.📌 Booking ID: ${code}`
    // });
    //ZOHO

    //Payment

    //------------------------------------------------------------------
    //Online transaction  AMount
    //------------------------------------------------------------------

    let paid = pricing.paid_amount;

    await this.addPayment(bookingId, paid, id, payment);

    await this.updateMemberTier(id); //check membership

    //------------------------------------------------------------------
    //Online transaction  AMount
    //------------------------------------------------------------------

    const subtotalWithoutExcluded = chargeValues.reduce((total, charge) => {
      const excludedTypes = [
        'convenience_fee',
        'wallet_discount',
        'security_deposit',
        'discount',
        'reservation',
      ];

      if (excludedTypes.includes(charge[1])) {
        return total;
      }

      return total + Number(charge[5] || 0);
    }, 0);

    const commison = (subtotalWithoutExcluded * 5) / 100; // Calculate Commision

    //-------------------------------------------------------//
    //  ZOHO ACTIVATION //
    //-------------------------------------------------------//

    await this.createZohoTransaction({
      customer: customerName,
      email: customerEmail,
      phone: customerPhone,
      bookingId: code,

      total_amount: pricing.grandTotal,
      category: singular,
      convenienceFee: pricing.convenienceFee,
      charge_amount: commison,
      quantity:1
    });

    //wallets

    const rewardCategoryId = categoryRow?.id ?? null;

    // Wrapped in try/catch so a rewards failure (insufficient points, a bad
    // category id, a transient DB error, etc.) never rolls back or crashes an
    // already-successful booking — it just gets logged, and the booking
    // response still returns success.
    if (pricing.earnedPoints > 0) {
      try {
        await this.addRewardPoints(
          id, // user_id
          bookingId, // booking_id
          '', // order_id / invoice number
          rewardCategoryId, // category_id
          Math.round(pricing.earnedPoints), // points — force integer
          pricing.grandTotal, // amount
          'Booking reward earned',
          'reward',
        );
      } catch (err) {
        console.error(
          'Failed to credit reward points for booking',
          bookingId,
          err,
        );
      }
    }

    if (pricing.burnPoint > 0) {
      try {
        await this.addRewardPoints(
          id, // user_id
          bookingId, // booking_id
          '', // order_id / invoice number
          rewardCategoryId, // category_id
          Math.round(pricing.burnPoint), // points — force integer
          pricing.burnPoint, // redeemed amount
          'Reward points redeemed',
          'redeem',
        );
      } catch (err) {
        console.error(
          'Failed to redeem reward points for booking',
          bookingId,
          err,
        );
      }
    }

    return {
      success: true,
      booking_id: bookingId,
      invoice_number: code,
      reserveType: reserveType,
    };
  }

  async createLog(
    module: string,
    recordId: number,
    action: string,
    description: string,
    userId?: number,
    oldValue?: any,
    newValue?: any,
  ) {
    await this.dataSource.query(
      `
  INSERT INTO booking_logs
  (
    booking_id,
    action,
    description,
    old_value,
    new_value,
    created_by,
    created_at
  )
  VALUES (?,?,?,?,?,?,?)
  `,
      [
        recordId,
        module,
        description,
        null,
        JSON.stringify(newValue),
        userId,
        new Date(),
      ],
    );
  }
  //

  //   async webhook(req: any, res: any) {
  //   try {
  //     // Get Razorpay configuration
  //     const config = await this.integrationService.getIntegrationConfig('razorpay');

  //     const configData =
  //       typeof config === 'string' ? JSON.parse(config) : config;

  //     // Get Razorpay Signature
  //     const signature = req.headers['x-razorpay-signature'];

  //     if (!signature) {
  //       return res.status(400).send('Missing Signature');
  //     }

  //     // Verify Webhook Signature
  //     const generatedSignature = crypto
  //       .createHmac('sha256', configData.webhook_secret)
  //       .update(req.rawBody)
  //       .digest('hex');

  //     if (signature !== generatedSignature) {
  //       return res.status(400).send('Invalid Signature');
  //     }

  //     const event = req.body.event;

  //     switch (event) {
  //       case 'payment.captured': {
  //         const payment = req.body.payload.payment.entity;

  //         await this.dataSource.query(
  //           `
  //           INSERT INTO user_subscription_payments (
  //             subscription_id,
  //             user_id,
  //             order_id,
  //             transaction_id,
  //             payment_id,
  //             amount,
  //             tax_amount,
  //             total_amount,
  //             payment_method,
  //             payment_status,
  //             paid_at,
  //             failure_reason,
  //             created_at
  //           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW())
  //           `,
  //           [
  //             null,                           // subscription_id
  //             null,                           // user_id
  //             payment.order_id,
  //             payment.id,
  //             payment.id,
  //             payment.amount / 100,
  //             0,
  //             payment.amount / 100,
  //             payment.method,
  //             payment.status,
  //             null,
  //           ],
  //         );

  //         console.log('Payment Captured:', payment.id);
  //         break;
  //       }

  //       case 'payment.failed': {
  //         const payment = req.body.payload.payment.entity;

  //         await this.dataSource.query(
  //           `
  //           INSERT INTO user_subscription_payments (
  //             subscription_id,
  //             user_id,
  //             order_id,
  //             transaction_id,
  //             payment_id,
  //             amount,
  //             tax_amount,
  //             total_amount,
  //             payment_method,
  //             payment_status,
  //             paid_at,
  //             failure_reason,
  //             created_at
  //           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NOW())
  //           `,
  //           [
  //             null,
  //             null,
  //             payment.order_id,
  //             payment.id,
  //             payment.id,
  //             payment.amount / 100,
  //             0,
  //             payment.amount / 100,
  //             payment.method,
  //             'failed',
  //             payment.error_description || payment.error_reason || null,
  //           ],
  //         );

  //         console.log('Payment Failed:', payment.id);
  //         break;
  //       }

  //       case 'order.paid': {
  //         const order = req.body.payload.order.entity;

  //         console.log('Order Paid:', order.id);

  //         break;
  //       }

  //       default:
  //         console.log('Unhandled Event:', event);
  //     }

  //     return res.status(200).send({
  //       success: true,
  //       message: 'Webhook Processed',
  //     });
  //   } catch (error) {
  //     console.error('Webhook Error:', error);

  //     return res.status(500).send({
  //       success: false,
  //       message: 'Internal Server Error',
  //     });
  //   }
  // }

  //wallets
  async addRewardPoints(
    userId: number,
    bookingId: number,
    orderId: string,
    categoryId: number,
    points: number,
    amount: number,
    remarks: string,
    transactionType: 'reward' | 'redeem',
  ) {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const balance = await queryRunner.query(
        `
      SELECT *
      FROM reward_point_balance
      WHERE user_id = ?
      LIMIT 1
      `,
        [userId],
      );

      if (balance.length > 0) {
        if (transactionType === 'reward') {
          // Add points
          await queryRunner.query(
            `
          UPDATE reward_point_balance
          SET
            total_points = total_points + ?,
            available_points = available_points + ?,
            updated_at = NOW()
          WHERE user_id = ?
          `,
            [points, points, userId],
          );
        } else {
          // Redeem points
          const available = Number(balance[0].available_points);

          if (available < points) {
            throw new BadRequestException('Insufficient reward points.');
          }

          await queryRunner.query(
            `
          UPDATE reward_point_balance
          SET
            available_points = available_points - ?,
            redeemed_points = redeemed_points + ?,
            updated_at = NOW()
          WHERE user_id = ?
          `,
            [points, points, userId],
          );
        }
      } else {
        if (transactionType === 'reward') {
          // First reward entry
          await queryRunner.query(
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
          VALUES (?, ?, ?, ?, 0, 0, NOW())
          `,
            [
              userId,
              1, // Default membership tier
              points,
              points,
            ],
          );
        } else {
          throw new BadRequestException('Reward wallet not found.');
        }
      }

      // Transaction history
      await queryRunner.query(
        `
      INSERT INTO reward_point_transactions
      (
        user_id,
        booking_id,
        order_id,
        category_id,
        transaction_type,
        points,
        amount,
        expiry_date,
        remarks,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 YEAR), ?, NOW())
      `,
        [
          userId,
          bookingId,
          orderId,
          categoryId,
          transactionType, // reward | redeem
          points,
          amount,
          remarks,
        ],
      );

      await queryRunner.commitTransaction();

      return {
        success: true,
        message:
          transactionType === 'reward'
            ? 'Reward points credited successfully.'
            : 'Reward points redeemed successfully.',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
  async onlinepayment(body: any, id: any) {
    const { booking_id, paid_amount } = body.payment;
    return await this.addPayment(booking_id, paid_amount, id, body.payment);
  }

  async addPayment(bookingId: any, paid: any, id: any, payment: any) {
    const transactionId = payment.razorpay_payment_id || null;
    const paymentMethod = payment.payment_method || 'Online';

    // const charges = await this.dataSource.query(
    //   `
    //   SELECT
    //       charge_type,
    //       total_price
    //   FROM booking_charges
    //   WHERE booking_id = ?
    //     AND charge_type IN ('addon','security_deposit','base')
    //   ORDER BY FIELD(charge_type,'addon','security_deposit','base')
    //   `,
    //   [bookingId],
    // );

    const charges = await this.dataSource.query(
      `
 SELECT
    c.charge_type,
    CASE
        WHEN c.charge_type IN ('base', 'addon','convenience_fee')
            THEN ROUND(c.total_price * 1.18, 2)
        ELSE
            c.total_price
    END AS total_price
FROM booking_charges c
WHERE c.booking_id = ?
  AND c.charge_type IN ('addon', 'base', 'security_deposit','convenience_fee')
ORDER BY FIELD(c.charge_type, 'addon', 'security_deposit', 'base','convenience_fee');
  `,
      [bookingId],
    );

    const payments: any[] = [];

    for (const charge of charges) {
      if (paid <= 0) break;

      const amount = Math.min(charge.total_price, paid);

      await this.dataSource.query(
        `
    INSERT INTO booking_payments
    (
      booking_id,
      payment_date,
      payment_type,
      payment_method,
      transaction_id,
      amount_paid,
      payment_status,
      paid_at
    )
    VALUES (?, CURDATE(), ?, ?, ?, ?, 'paid', NOW())
    `,
        [
          bookingId,
          charge.charge_type == 'base' ? 'base_amount' : charge.charge_type,
          paymentMethod,
          transactionId,
          amount,
        ],
      );

      payments.push({
        booking_id: bookingId,
        payment_type:
          charge.charge_type == 'base' ? 'base_amount' : charge.charge_type,
        payment_method: paymentMethod,
        transaction_id: transactionId,
        amount_paid: amount,
        payment_date: new Date(),
      });

      paid -= amount;
    }

    // Create log for each payment
    for (const payment of payments) {
      await this.createLog(
        'booking',
        bookingId,
        'payment_received',
        `Payment received - ${payment.payment_type} ₹${Number(
          payment.amount_paid,
        ).toLocaleString('en-IN')}`,
        id,
        null,
        {
          payment_type: payment.payment_type,
          payment_method: payment.payment_method,
          amount_paid: payment.amount_paid,
          payment_date: payment.payment_date,
          transaction_id: payment.transaction_id,
        },
      );
    }

    // Realtime Notification
    // this.socketService.realtime(
    //   id.toString(),
    //   'Payment',
    //   `Payment of ₹${payments
    //     .reduce((sum, p) => sum + Number(p.amount_paid), 0)
    //     .toLocaleString('en-IN')} received`,
    // );

    // App Notification
    await this.notificationService.createNotification({
      type: 'Payment',
      referenceId: bookingId,
      title: 'New Payment',
      message: `Payment of ₹${payments
        .reduce((sum, p) => sum + Number(p.amount_paid), 0)
        .toLocaleString('en-IN')} received successfully.`,
      createdBy: id,
    });
  }

  async updateMemberTier(userId: number) {
    // Get booking count and amount
    const [booking] = await this.dataSource.query(
      `
    SELECT
      COUNT(*) AS booking_count,
      COALESCE(SUM(total_amount), 0) AS booking_amount
    FROM bookings
    WHERE selection_mode = 'Online'
      AND booking_type = 'booked'
      AND created_by = ?
    `,
      [userId],
    );

    const bookingCount = Number(booking.booking_count);
    const bookingAmount = Number(booking.booking_amount);

    // Get all tiers
    const tiers = await this.dataSource.query(
      `
    SELECT *
    FROM member_tier
    ORDER BY min_booking ASC
    `,
    );

    let currentTier: any = null;

    // Find the correct tier
    for (const tier of tiers) {
      const minBooking = Number(tier.min_booking);
      const maxBooking = Number(tier.max_booking);

      if (bookingCount >= minBooking && bookingCount <= maxBooking) {
        currentTier = tier;
        break;
      }
    }

    // No tier found
    if (!currentTier) {
      return {
        success: false,
        message: 'No tier found',
      };
    }

    // Check reward balance row exists
    const [balance] = await this.dataSource.query(
      `
    SELECT id
    FROM reward_point_balance
    WHERE user_id = ?
    `,
      [userId],
    );

    if (balance) {
      // Update existing record
      await this.dataSource.query(
        `
      UPDATE reward_point_balance
      SET
        mem_id = ?,
        updated_at = NOW()
      WHERE user_id = ?
      `,
        [currentTier.id, userId],
      );
    } else {
      // Create new record
      await this.dataSource.query(
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
      VALUES (?, ?, 0, 0, 0, 0, NOW())
      `,
        [userId, currentTier.id],
      );
    }

    return {
      success: true,
      bookingCount,
      bookingAmount,
      tier: currentTier,
    };
  }

  //ZOHO
  async createZohoTransaction({
    customer,
    email,
    phone,
    bookingId,
    total_amount,
    category,
    convenienceFee,
    charge_amount,
    quantity
  }: {
    customer: string;
    email: string;
    phone: string;
    bookingId: string;
    total_amount: number;
    category: string;
    convenienceFee: any;
    charge_amount: any;
    quantity: any;
  }) {
    const items = [] as any[];

    // Convenience Fee (common for venue & farmstay)
    if (category === 'venue' || category === 'farmstay') {
      items.push({
        itemId: '3975444000000033267', // Convenience Fee
        quantity: 1,
        rate: convenienceFee,
      });
    }

    // Venue Commission
    if (category === 'venue') {
      items.push({
        itemId: '3975444000000033239', // Venue Commission
        quantity: 1,
        rate: charge_amount,
      });
    }

    // Farmstay Commission
    if (category === 'farmstay') {
      items.push({
        itemId: '3975444000000033258', // Farmstay Commission
        quantity: 1,
        rate: charge_amount,
      });
    }

    // // Subscription
    if (category === 'subscription') {
      items.push({
        itemId: '3975444000000033229', // Subscription
        quantity: quantity,
        rate: total_amount,
      });
    }

    return await this.zohoService.completeBookingZoho({
      customer: {
        name: customer,
        email,
        phone,
      },
      items,
      booking: {
        bookingNo: bookingId,
        bookingDate: dayjs().format('YYYY-MM-DD'),
        notes: `Customer ${category} booking`,
      },
      payment: {
        amount: total_amount,
        mode: 'Online',
        date: dayjs().format('YYYY-MM-DD'),
      },
    });
  }

  async cancelBooking(body: any, id: number) {
    const refundAmount = Number(body.refund_amount || 0);

    await this.dataSource.transaction(async (manager) => {
      // Cancel Booking
      await manager.query(
        `
      UPDATE bookings
      SET
        status = ?,
        cancellation_date = NOW(),
        cancellation_reason = ?
      WHERE id = ?
      `,
        ['cancelled', body.reason, body.booking_id],
      );

      // Insert Refund Payment
      if (refundAmount > 0) {
        await manager.query(
          `
        INSERT INTO booking_payments
        (
          booking_id,
          payment_date,
          payment_type,
          payment_method,
          transaction_id,
          amount_paid,
          payment_status,
          paid_at
        )
        VALUES
        (?, CURDATE(), 'refund', 'System', NULL, ?, 'refunded', NOW())
        `,
          [body.booking_id, refundAmount],
        );
      }

      // Booking Log
      await this.createLog(
        'booking',
        body.booking_id,
        'booking_cancelled',
        `Booking cancelled${refundAmount > 0 ? ` - Refund ₹${refundAmount.toLocaleString('en-IN')}` : ''}`,
        id,
        null,
        {
          cancellation_reason: body.reason,
          refund_amount: refundAmount,
        },
      );

      // Notification
      await this.notificationService.createNotification({
        type: 'Booking',
        referenceId: body.booking_id,
        title: 'Booking Cancelled',
        message:
          refundAmount > 0
            ? `Your booking has been cancelled. Refund of ₹${refundAmount} will be processed.`
            : 'Your booking has been cancelled.',
        createdBy: id,
      });

      // Realtime Notification
      // this.socketService.realtime(
      //   id.toString(),
      //   'Booking',
      //   refundAmount > 0
      //     ? `Booking cancelled. Refund ₹${refundAmount.toLocaleString('en-IN')} initiated.`
      //     : 'Booking cancelled successfully.',
      // );
    });

    return {
      success: true,
      message: 'Booking cancelled successfully.',
    };
  }

  // =========================================================
  // RAZORPAY WEBHOOK
  // =========================================================

  // async webhook(req: any, res: any) {
  //   console.log( 'Razorpay webhook Has been Created')
  //   try {
  //     // =====================================================
  //     // 1. GET RAZORPAY CONFIG
  //     // =====================================================

  //     const config =
  //       await this.integrationService.getIntegrationConfig(
  //         'razorpay',
  //       );

  //     const configData =
  //       typeof config === 'string'
  //         ? JSON.parse(config)
  //         : config;

  //     const webhookSecret =
  //       configData?.webhook_secret;

  //     if (!webhookSecret) {
  //       this.logger.error(
  //         'Razorpay webhook secret not configured',
  //       );

  //       return res.status(500).send({
  //         success: false,
  //         message:
  //           'Razorpay webhook secret not configured',
  //       });
  //     }

  //     // =====================================================
  //     // 2. GET HEADERS
  //     // =====================================================

  //     const signature =
  //       req.headers['x-razorpay-signature'];

  //     const eventId =
  //       req.headers['x-razorpay-event-id'];

  //     if (!signature) {
  //       this.logger.error(
  //         'Missing Razorpay signature',
  //       );

  //       return res.status(400).send({
  //         success: false,
  //         message: 'Missing Signature',
  //       });
  //     }

  //     if (!eventId) {
  //       this.logger.error(
  //         'Missing Razorpay event ID',
  //       );

  //       return res.status(400).send({
  //         success: false,
  //         message: 'Missing Event ID',
  //       });
  //     }

  //     // =====================================================
  //     // 3. GET RAW BODY
  //     // =====================================================

  //     const rawBody =
  //       req.rawBody ||
  //       (Buffer.isBuffer(req.body)
  //         ? req.body
  //         : Buffer.from(
  //             JSON.stringify(req.body),
  //           ));

  //     if (!rawBody) {
  //       this.logger.error(
  //         'Razorpay raw body is missing',
  //       );

  //       return res.status(400).send({
  //         success: false,
  //         message: 'Raw body unavailable',
  //       });
  //     }

  //     // =====================================================
  //     // 4. VERIFY RAZORPAY SIGNATURE
  //     // =====================================================

  //     const generatedSignature =
  //       crypto
  //         .createHmac(
  //           'sha256',
  //           webhookSecret,
  //         )
  //         .update(rawBody)
  //         .digest('hex');

  //     if (
  //       signature.length !==
  //       generatedSignature.length
  //     ) {
  //       this.logger.error(
  //         'Invalid Razorpay signature length',
  //       );

  //       return res.status(400).send({
  //         success: false,
  //         message: 'Invalid Signature',
  //       });
  //     }

  //     const isValid =
  //       crypto.timingSafeEqual(
  //         Buffer.from(signature),
  //         Buffer.from(generatedSignature),
  //       );

  //     if (!isValid) {
  //       this.logger.error(
  //         'Invalid Razorpay webhook signature',
  //       );

  //       return res.status(400).send({
  //         success: false,
  //         message: 'Invalid Signature',
  //       });
  //     }

  //     this.logger.log(
  //       'Razorpay signature verified',
  //     );

  //     // =====================================================
  //     // 5. GET EVENT
  //     // =====================================================

  //     const event =
  //       req.body?.event;

  //     if (!event) {
  //       return res.status(400).send({
  //         success: false,
  //         message: 'Event missing',
  //       });
  //     }

  //     this.logger.log(
  //       `Razorpay Event: ${event}`,
  //     );

  //     this.logger.log(
  //       `Razorpay Event ID: ${eventId}`,
  //     );

  //     // =====================================================
  //     // 6. CHECK DUPLICATE WEBHOOK
  //     // =====================================================

  //     const [existingEvent] =
  //       await this.dataSource.query(
  //         `
  //         SELECT id, status
  //         FROM razorpay_webhook_events
  //         WHERE event_id = ?
  //         LIMIT 1
  //         `,
  //         [eventId],
  //       );

  //     if (existingEvent) {
  //       this.logger.warn(
  //         `Duplicate Razorpay webhook: ${eventId}`,
  //       );

  //       return res.status(200).send({
  //         success: true,
  //         message: 'Webhook already processed',
  //       });
  //     }

  //     // =====================================================
  //     // 7. SAVE WEBHOOK EVENT
  //     // =====================================================

  //     await this.dataSource.query(
  //       `
  //       INSERT INTO razorpay_webhook_events
  //       (
  //         event_id,
  //         event_type,
  //         payload,
  //         status,
  //         created_at
  //       )
  //       VALUES (?, ?, ?, 'received', NOW())
  //       `,
  //       [
  //         eventId,
  //         event,
  //         JSON.stringify(req.body),
  //       ],
  //     );

  //     // =====================================================
  //     // 8. PAYMENT CAPTURED
  //     // =====================================================

  //     if (event === 'payment.captured') {
  //       await this.handlePaymentCaptured(
  //         req.body,
  //       );
  //     }

  //     else if (event === 'subscription.authenticated') {
  //       await this.handlePaymentCaptured(
  //         req.body,
  //       );
  //     }
  //     else if (event === 'subscription.activated') {
  //       await this.handlePaymentCaptured(
  //         req.body,
  //       );
  //     }

  //     // =====================================================
  //     // 9. PAYMENT FAILED
  //     // =====================================================

  //     else if (event === 'payment.failed') {
  //       await this.handlePaymentFailed(
  //         req.body,
  //       );
  //     }

  //     // =====================================================
  //     // 10. ORDER PAID
  //     // =====================================================

  //     else if (event === 'order.paid') {
  //       await this.handleOrderPaid(
  //         req.body,
  //       );
  //     }

  //     // =====================================================
  //     // 11. REFUND CREATED
  //     // =====================================================

  //     else if (event === 'refund.created') {
  //       await this.handleRefundCreated(
  //         req.body,
  //       );
  //     }

  //     // =====================================================
  //     // 12. REFUND PROCESSED
  //     // =====================================================

  //     else if (event === 'refund.processed') {
  //       await this.handleRefundProcessed(
  //         req.body,
  //       );
  //     }

  //     // =====================================================
  //     // 13. REFUND FAILED
  //     // =====================================================

  //     else if (event === 'refund.failed') {
  //       await this.handleRefundFailed(
  //         req.body,
  //       );
  //     }

  //     // =====================================================
  //     // 14. UNKNOWN EVENT
  //     // =====================================================

  //     else {
  //       this.logger.warn(
  //         `Unhandled Razorpay event: ${event}`,
  //       );
  //     }

  //     // =====================================================
  //     // 15. MARK WEBHOOK PROCESSED
  //     // =====================================================

  //     await this.dataSource.query(
  //       `
  //       UPDATE razorpay_webhook_events
  //       SET
  //         status = 'processed',
  //         processed_at = NOW()
  //       WHERE event_id = ?
  //       `,
  //       [eventId],
  //     );

  //     // =====================================================
  //     // 16. RESPONSE
  //     // =====================================================

  //     return res.status(200).send({
  //       success: true,
  //       message: 'Webhook Processed',
  //       event,
  //       eventId,
  //     });

  //   } catch (error) {
  //     this.logger.error(
  //       'Razorpay Webhook Error',
  //        error,
  //     );

  //     return res.status(500).send({
  //       success: false,
  //       message: 'Internal Server Error',
  //     });
  //   }
  // }

  async webhook(req: any, res: any) {
    this.logger.log('Razorpay webhook received');

    let eventId: string | undefined;

    try {
      // =====================================================
      // 1. GET RAZORPAY CONFIG
      // =====================================================

      const config =
        await this.integrationService.getIntegrationConfig('razorpay');

      const configData =
        typeof config === 'string' ? JSON.parse(config) : config;

      const webhookSecret = configData?.webhook_secret;

      if (!webhookSecret) {
        this.logger.error('Razorpay webhook secret not configured');

        return res.status(500).send({
          success: false,
          message: 'Razorpay webhook secret not configured',
        });
      }

      // =====================================================
      // 2. GET HEADERS
      // =====================================================

      const signature = req.headers['x-razorpay-signature'];

      eventId = req.headers['x-razorpay-event-id'];

      if (!signature) {
        this.logger.error('Missing Razorpay signature');

        return res.status(400).send({
          success: false,
          message: 'Missing Signature',
        });
      }

      if (!eventId) {
        this.logger.error('Missing Razorpay event ID');

        return res.status(400).send({
          success: false,
          message: 'Missing Event ID',
        });
      }

      // =====================================================
      // 3. GET RAW BODY
      // =====================================================

      const rawBody =
        req.rawBody ||
        (Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(JSON.stringify(req.body)));

      if (!rawBody) {
        this.logger.error('Razorpay raw body is missing');

        return res.status(400).send({
          success: false,
          message: 'Raw body unavailable',
        });
      }

      // =====================================================
      // 4. VERIFY RAZORPAY SIGNATURE
      // =====================================================

      const generatedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (signature.length !== generatedSignature.length) {
        this.logger.error('Invalid Razorpay signature length');

        return res.status(400).send({
          success: false,
          message: 'Invalid Signature',
        });
      }

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(generatedSignature),
      );

      if (!isValid) {
        this.logger.error('Invalid Razorpay webhook signature');

        return res.status(400).send({
          success: false,
          message: 'Invalid Signature',
        });
      }

      this.logger.log('Razorpay signature verified');

      // =====================================================
      // 5. GET EVENT
      // =====================================================

      const event = req.body?.event;

      if (!event) {
        this.logger.error('Razorpay event missing');

        return res.status(400).send({
          success: false,
          message: 'Event missing',
        });
      }

      this.logger.log(`Razorpay Event: ${event}`);

      this.logger.log(`Razorpay Event ID: ${eventId}`);

      // =====================================================
      // 6. CHECK EXISTING WEBHOOK
      // =====================================================

      const [existingEvent] = await this.dataSource.query(
        `
        SELECT
          id,
          status
        FROM razorpay_webhook_events
        WHERE event_id = ?
        LIMIT 1
        `,
        [eventId],
      );

      // -----------------------------------------------------
      // Only skip if it was successfully processed.
      // -----------------------------------------------------

      if (existingEvent && existingEvent.status === 'processed') {
        this.logger.warn(`Duplicate processed Razorpay webhook: ${eventId}`);

        return res.status(200).send({
          success: true,
          message: 'Webhook already processed',
          event,
          eventId,
        });
      }

      // =====================================================
      // 7. INSERT / RESET WEBHOOK EVENT
      // =====================================================

      if (!existingEvent) {
        await this.dataSource.query(
          `
        INSERT INTO razorpay_webhook_events
        (
          event_id,
          event_type,
          payload,
          status,
          created_at
        )
        VALUES
        (
          ?,
          ?,
          ?,
          'received',
          NOW()
        )
        `,
          [eventId, event, JSON.stringify(req.body)],
        );

        this.logger.log(`Webhook event saved: ${eventId}`);
      } else {
        await this.dataSource.query(
          `
        UPDATE razorpay_webhook_events
        SET
          event_type = ?,
          payload = ?,
          status = 'received',
          processed_at = NULL
        WHERE event_id = ?
        `,
          [event, JSON.stringify(req.body), eventId],
        );

        this.logger.log(`Retrying webhook event: ${eventId}`);
      }

      // =====================================================
      // 8. HANDLE EVENT
      // =====================================================

      if (event === 'payment.captured') {
        await this.handlePaymentCaptured(req.body);
      }

      // =====================================================
      // SUBSCRIPTION AUTHENTICATED
      // =====================================================
      else if (event === 'subscription.authenticated') {
        this.logger.log(`Subscription authenticated: ${eventId}`);

        // Do NOT call handlePaymentCaptured here.
        //
        // Add a separate handler if you need to process
        // subscription authentication.
        //
        // await this.handleSubscriptionAuthenticated(req.body);
      }

      // =====================================================
      // SUBSCRIPTION ACTIVATED
      // =====================================================
      else if (event === 'subscription.activated') {
        this.logger.log(`Subscription activated: ${eventId}`);

        // Do NOT call handlePaymentCaptured here.
        //
        // Add a separate handler if required.
        //
        // await this.handleSubscriptionActivated(req.body);
      }

      // =====================================================
      // PAYMENT FAILED
      // =====================================================
      else if (event === 'payment.failed') {
        await this.handlePaymentFailed(req.body);
      }

      // =====================================================
      // ORDER PAID
      // =====================================================
      else if (event === 'order.paid') {
        await this.handleOrderPaid(req.body);
      }

      // =====================================================
      // REFUND CREATED
      // =====================================================
      else if (event === 'refund.created') {
        await this.handleRefundCreated(req.body);
      }

      // =====================================================
      // REFUND PROCESSED
      // =====================================================
      else if (event === 'refund.processed') {
        await this.handleRefundProcessed(req.body);
      }

      // =====================================================
      // REFUND FAILED
      // =====================================================
      else if (event === 'refund.failed') {
        await this.handleRefundFailed(req.body);
      }

      // =====================================================
      // UNKNOWN EVENT
      // =====================================================
      else {
        this.logger.warn(`Unhandled Razorpay event: ${event}`);
      }

      // =====================================================
      // 9. MARK WEBHOOK AS PROCESSED
      // =====================================================

      await this.dataSource.query(
        `
      UPDATE razorpay_webhook_events
      SET
        status = 'processed',
        processed_at = NOW()
      WHERE event_id = ?
      `,
        [eventId],
      );

      this.logger.log(`Razorpay webhook processed successfully: ${eventId}`);

      // =====================================================
      // 10. RESPONSE
      // =====================================================

      return res.status(200).send({
        success: true,
        message: 'Webhook Processed',
        event,
        eventId,
      });
    } catch (error) {
      this.logger.error(`Razorpay Webhook Error: ${error}`, error);

      // =====================================================
      // MARK WEBHOOK FAILED
      // =====================================================

      if (eventId) {
        try {
          await this.dataSource.query(
            `
          UPDATE razorpay_webhook_events
          SET
            status = 'failed',
            processed_at = NULL
          WHERE event_id = ?
          `,
            [eventId],
          );
        } catch (updateError) {
          this.logger.error(`Failed to update webhook status: ${updateError}`);
        }
      }

      return res.status(500).send({
        success: false,
        message: 'Internal Server Error',
      });
    }
  }

  // =========================================================
  // PAYMENT CAPTURED
  // =========================================================
  private async handlePaymentCaptured(body: any) {
    console.log(body);
    const payment = body?.payload?.payment?.entity;

    if (!payment) {
      throw new Error('Payment entity not found');
    }

    const razorpayOrderId = payment.order_id;

    const razorpayPaymentId = payment.id;

    const amount = Number(payment.amount || 0) / 100;

    this.logger.log(`Payment Captured: ${razorpayPaymentId}`);

    this.logger.log(`Razorpay Order: ${razorpayOrderId}`);

    this.logger.log(`Payment Amount: ${amount}`);

    // =====================================================
    // FIND SUBSCRIPTION
    // =====================================================

    const [subscription] = await this.dataSource.query(
      `
      SELECT
        id,
        user_id,
        razorpay_order_id,
        status
      FROM user_subscriptions
      WHERE razorpay_order_id = ?
      LIMIT 1
      `,
      [razorpayOrderId],
    );

    if (!subscription) {
      this.logger.error(
        `Subscription not found for Razorpay order: ${razorpayOrderId}`,
      );

      throw new Error(`Subscription not found: ${razorpayOrderId}`);
    }

    const subscriptionId = subscription.id;

    const userId = subscription.user_id;

    // =====================================================
    // GET USER
    // =====================================================

    const [user] = await this.dataSource.query(
      `
      SELECT
        id,
        name,
        email,
        phone
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [userId],
    );

    if (!user) {
      this.logger.error(`User not found: ${userId}`);

      throw new Error(`User not found: ${userId}`);
    }

    const customerName = user.name || '';

    const customerEmail = user.email || '';

    const customerPhone = user.phone || '';

    // =====================================================
    // FIND EXISTING PAYMENT
    // =====================================================

    const [existingPayment] = await this.dataSource.query(
      `
      SELECT
        id,
        payment_status
      FROM user_subscription_payments
      WHERE subscription_id = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [subscriptionId],
    );

    // =====================================================
    // UPDATE PAYMENT
    // =====================================================

    if (existingPayment) {
      // ---------------------------------------------------
      // Already captured
      // ---------------------------------------------------

      if (existingPayment.payment_status === 'captured') {
        this.logger.log(
          `Payment already captured. Payment record: ${existingPayment.id}`,
        );

        return {
          paymentId: razorpayPaymentId,
          orderId: razorpayOrderId,
          subscriptionId,
          userId,
          amount,
          alreadyProcessed: true,
        };
      }

      // ---------------------------------------------------
      // Update processing payment → captured
      // ---------------------------------------------------

      await this.dataSource.query(
        `
      UPDATE user_subscription_payments
      SET
        amount = ?,
        total_amount = ?,
        payment_status = 'captured',
        payment_method = 'razorpay',
        paid_at = NOW()
      WHERE id = ?
      `,
        [amount, amount, existingPayment.id],
      );

      this.logger.log(`Payment updated to captured: ${existingPayment.id}`);
    }

    // =====================================================
    // CREATE PAYMENT IF NOT FOUND
    // =====================================================
    else {
      await this.dataSource.query(
        `
      INSERT INTO user_subscription_payments
      (
        subscription_id,
        user_id,
        amount,
        total_amount,
        payment_status,
        payment_method,
        paid_at,
        created_at
      )
      VALUES
      (
        ?,
        ?,
        ?,
        ?,
        'captured',
        'razorpay',
        NOW(),
        NOW()
      )
      `,
        [subscriptionId, userId, amount, amount],
      );

      this.logger.log(
        `Payment record created as captured for subscription: ${subscriptionId}`,
      );
    }

    // =====================================================
    // UPDATE SUBSCRIPTION
    // =====================================================

    await this.dataSource.query(
      `
    UPDATE user_subscriptions
    SET
      status = 'active',
      payment_status = 'paid',
      razorpay_payment_id = ?,
      paid_at = NOW(),
      updated_at = NOW()
    WHERE id = ?
    `,
      [razorpayPaymentId, subscriptionId],
    );

    this.logger.log(`Subscription activated: ${subscriptionId}`);

    // =====================================================
    // ZOHO ACTIVATION
    // =====================================================

  const vbquantity = subscription.quantity || 1;
  const wihour_gst = Math.round(amount);
const oneSubAmt = wihour_gst / vbquantity; 
const gst = oneSubAmt - oneSubAmt / 1.18;
const zohoAmount = Math.round(oneSubAmt);

    try {
      await this.createZohoTransaction({
        customer: customerName,
        email: customerEmail,
        phone: customerPhone,

        bookingId: `SUB-${subscriptionId}`,

        total_amount: zohoAmount,

        category: 'subscription',

        convenienceFee: 0,

        charge_amount: 0,
        quantity: vbquantity,
      });

      this.logger.log(
        `Zoho transaction created for payment: ${razorpayPaymentId}`,
      );
    } catch (zohoError) {
      this.logger.error(
        `Zoho transaction failed for payment ${razorpayPaymentId}`,
        zohoError,
      );
    }

    // =====================================================
    // RETURN
    // =====================================================

    return {
      paymentId: razorpayPaymentId,

      orderId: razorpayOrderId,

      subscriptionId,

      userId,

      amount,

      alreadyProcessed: false,
    };
  }

  // =========================================================
  // PAYMENT FAILED
  // =========================================================

  private async handlePaymentFailed(body: any) {
    const payment = body?.payload?.payment?.entity;

    if (!payment) {
      throw new Error('Payment entity not found');
    }

    const razorpayOrderId = payment.order_id;

    const razorpayPaymentId = payment.id;

    const amount = Number(payment.amount || 0) / 100;

    const failureReason =
      payment.error_description ||
      payment.error_reason ||
      payment.error_code ||
      'Payment failed';

    this.logger.warn(`Payment Failed: ${razorpayPaymentId}`);

    // =====================================================
    // FIND SUBSCRIPTION
    // =====================================================

    const [subscription] = await this.dataSource.query(
      `
        SELECT
          id,
          user_id
        FROM user_subscriptions
        WHERE razorpay_order_id = ?
        LIMIT 1
        `,
      [razorpayOrderId],
    );

    if (!subscription) {
      this.logger.warn(`Subscription not found: ${razorpayOrderId}`);

      return;
    }

    // =====================================================
    // CHECK PAYMENT
    // =====================================================

    const [existingPayment] = await this.dataSource.query(
      `
        SELECT id
        FROM user_subscription_payments
        WHERE payment_id = ?
        LIMIT 1
        `,
      [razorpayPaymentId],
    );

    // =====================================================
    // INSERT
    // =====================================================

    if (!existingPayment) {
      await this.dataSource.query(
        `
        INSERT INTO user_subscription_payments
        (
          subscription_id,
          user_id,
          order_id,
          transaction_id,
          payment_id,
          amount,
          tax_amount,
          total_amount,
          payment_method,
          payment_status,
          paid_at,
          failure_reason,
          created_at
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          0,
          ?,
          ?,
          'failed',
          NULL,
          ?,
          NOW()
        )
        `,
        [
          subscription.id,
          subscription.user_id,

          razorpayOrderId,
          razorpayPaymentId,
          razorpayPaymentId,

          amount,
          amount,

          payment.method || null,

          failureReason,
        ],
      );
    }

    // =====================================================
    // UPDATE SUBSCRIPTION
    // =====================================================

    await this.dataSource.query(
      `
      UPDATE user_subscriptions
      SET
        payment_status = 'failed',
        updated_at = NOW()
      WHERE id = ?
      `,
      [subscription.id],
    );

    this.logger.log(`Subscription payment marked failed: ${subscription.id}`);
  }

  // =========================================================
  // ORDER PAID
  // =========================================================

  private async handleOrderPaid(body: any) {
    const order = body?.payload?.order?.entity;

    if (!order) {
      throw new Error('Order entity not found');
    }

    this.logger.log(`Order Paid: ${order.id}`);

    const [subscription] = await this.dataSource.query(
      `
        SELECT id
        FROM user_subscriptions
        WHERE razorpay_order_id = ?
        LIMIT 1
        `,
      [order.id],
    );

    if (!subscription) {
      this.logger.warn(`Local subscription not found for order: ${order.id}`);

      return;
    }

    await this.dataSource.query(
      `
      UPDATE user_subscriptions
      SET
        status = 'active',
        payment_status = 'paid',
        paid_at = COALESCE(paid_at, NOW()),
        updated_at = NOW()
      WHERE id = ?
      `,
      [subscription.id],
    );

    this.logger.log(`Order marked paid: ${order.id}`);
  }

  // =========================================================
  // REFUND CREATED
  // =========================================================

  private async handleRefundCreated(body: any) {
    const refund = body?.payload?.refund?.entity;

    if (!refund) {
      return;
    }

    this.logger.log(`Refund Created: ${refund.id}`);

    // Add refund DB update here if required.
  }

  // =========================================================
  // REFUND PROCESSED
  // =========================================================

  private async handleRefundProcessed(body: any) {
    const refund = body?.payload?.refund?.entity;

    if (!refund) {
      return;
    }

    this.logger.log(`Refund Processed: ${refund.id}`);

    // Add refund DB update here if required.
  }

  // =========================================================
  // REFUND FAILED
  // =========================================================

  private async handleRefundFailed(body: any) {
    const refund = body?.payload?.refund?.entity;

    if (!refund) {
      return;
    }

    this.logger.warn(`Refund Failed: ${refund.id}`);

    // Add refund DB update here if required.
  }

  // =========================================================
  // ZOHO TRANSACTION
  // =========================================================

  // private async createZohoTransaction(
  //   data: {
  //     customer: string;
  //     email: string;
  //     phone: string;
  //     bookingId: string;
  //     total_amount: number;
  //     category: string;
  //     convenienceFee: number;
  //     charge_amount: number;
  //   },
  // ) {
  //   // YOUR EXISTING ZOHO IMPLEMENTATION
  //   //
  //   // Example:
  //   //
  //   return await this.zohoService.completeBookingZoho(data);

  //   // console.log(
  //   //   'Zoho Transaction:',
  //   //   data,
  //   // );
  // }

  async handleCallback(data: any) {
    console.log('Razorpay callback service:', data);

    const {
      razorpay_payment_id,
      razorpay_payment_link_id,
      razorpay_payment_link_reference_id,
      razorpay_payment_link_status,
      razorpay_signature,
    } = data;

    let subscriptionId = null;

    /*
     * Example:
     *
     * razorpay_payment_link_reference_id
     * =
     * SUB_1787557520892_60
     */

    if (razorpay_payment_link_reference_id) {
      const [subscription] = await this.dataSource.query(
        `
        SELECT
          id,
          subscription_code,
          status
        FROM user_subscriptions
        WHERE subscription_code = ?
        LIMIT 1
        `,
        [razorpay_payment_link_reference_id],
      );

      if (subscription) {
        subscriptionId = subscription.id;

        console.log('Subscription found:', subscription);
      }
    }

    return {
      subscription_id: subscriptionId,

      payment_id: razorpay_payment_id,

      payment_link_id: razorpay_payment_link_id,

      status: razorpay_payment_link_status || 'pending',
    };
  }

  async processRecurringPayments() {
    const subscriptions = await this.dataSource.query(`
      SELECT user_subscriptions.*,p.plan_title 
      FROM user_subscriptions
      LEFT JOIN plans p ON p.id = user_subscriptions.plan_id
      WHERE user_subscriptions.status = 'active'
        AND auto_renew = 1
        AND next_billing_date IS NOT NULL
        AND next_billing_date <= NOW()
      ORDER BY id ASC
    `);

    let success = 0;
    let failed = 0;

    for (const subscription of subscriptions) {
      try {
        console.log(`Processing recurring subscription: ${subscription.id}`);

        await this.processSingleRecurringPayment(subscription);

        success++;
      } catch (error) {
        failed++;

        console.error(`Recurring payment failed: ${subscription.id}`, error);
      }
    }

    return {
      total: subscriptions.length,
      success,
      failed,
    };
  }

  // async processSingleRecurringPayment(subscription: any) {
  //   const subscriptionId = Number(subscription.id);

  //   if (!Number.isInteger(subscriptionId) || subscriptionId <= 0) {
  //     throw new BadRequestException('Invalid subscription ID');
  //   }

  //   // =========================================================
  //   // 1. Razorpay customer + token
  //   // =========================================================

  //   const customerId = String(subscription.razorpay_customer_id || '').trim();

  //   const tokenId = String(subscription.razorpay_token_id || '').trim();

  //   if (!customerId) {
  //     throw new BadRequestException('Razorpay customer ID missing');
  //   }

  //   if (!tokenId) {
  //     throw new BadRequestException('Razorpay token ID missing');
  //   }

  //   // =========================================================
  //   // 2. Amount
  //   // =========================================================

  //   const amount = Number(subscription.total_amount);

  //   if (!Number.isFinite(amount) || amount <= 0) {
  //     throw new BadRequestException('Invalid recurring amount');
  //   }

  //   const amountInPaise = Math.round(amount * 100);

  //   // =========================================================
  //   // 3. Customer details
  //   // =========================================================

  //   const email = String(subscription.email || 'vb.develop1@gmail.com').trim();

  //   const contact = String(
  //     subscription.mobile || subscription.phone || '8147484371',
  //   ).trim();

  //   if (!email) {
  //     throw new BadRequestException('Customer email missing');
  //   }

  //   if (!contact) {
  //     throw new BadRequestException('Customer contact missing');
  //   }

  //   // =========================================================
  //   // 4. Razorpay configuration
  //   // =========================================================

  //   const config =
  //     await this.integrationService.getIntegrationConfig('razorpay');

  //   const configData = typeof config === 'string' ? JSON.parse(config) : config;

  //   const keyId = String(configData?.key_id || '').trim();

  //   const keySecret = String(configData?.key_secret || '').trim();

  //   if (!keyId || !keySecret) {
  //     throw new BadRequestException('Razorpay configuration is missing');
  //   }

  //   const razorpay = new Razorpay({
  //     key_id: keyId,
  //     key_secret: keySecret,
  //   });

  //   // =========================================================
  //   // 5. Create a NEW Razorpay order
  //   // =========================================================

  //   const receipt = `REC_${subscriptionId}_${Date.now()}`;

  //   const order = await razorpay.orders.create({
  //     amount: amountInPaise,
  //     currency: 'INR',
  //     receipt,
  //     notes: {
  //       subscription_id: String(subscriptionId),
  //     },
  //   });

  //   console.log('Recurring Razorpay order created:', {
  //     subscriptionId,
  //     orderId: order.id,
  //     amount: amountInPaise,
  //   });

  //   // =========================================================
  //   // 6. Create payment attempt BEFORE debit
  //   // =========================================================

  //   const paymentInsert = await this.dataSource.query(
  //     `
  //     INSERT INTO user_subscription_payments
  //     (
  //       subscription_id,
  //       user_id,
  //       amount,
  //       total_amount,
  //       payment_status,
  //       payment_method,
  //       order_id,
  //       created_at
  //     )
  //     VALUES
  //     (
  //       ?,
  //       ?,
  //       ?,
  //       ?,
  //       'processing',
  //       'razorpay_tokenq',
  //       ?,
  //       NOW()
  //     )
  //     `,
  //     [subscriptionId, subscription.user_id, amount, amount, order.id],
  //   );

  //   const paymentAttemptId = Number(paymentInsert?.insertId);

  //   if (!Number.isInteger(paymentAttemptId) || paymentAttemptId <= 0) {
  //     throw new BadRequestException('Failed to create payment attempt');
  //   }

  //   // =========================================================
  //   // 7. Execute recurring debit
  //   // =========================================================

  //   try {
  //     const payment = await razorpay.payments.createRecurringPayment({
  //       email,
  //       contact,

  //       customer_id: customerId,
  //       token: tokenId,

  //       amount: amountInPaise,
  //       currency: 'INR',

  //       order_id: order.id,

  //       recurring: true,

  //       description: `Recurring payment for subscription ${subscriptionId}`,

  //       notes: {
  //         subscription_id: String(subscriptionId),

  //         payment_attempt_id: String(paymentAttemptId),
  //       },
  //     });

  //     console.log('Razorpay recurring payment response:', payment);

  //     const razorpayPaymentId = String(
  //       payment?.razorpay_payment_id || '',
  //     ).trim();

  //     const razorpayOrderId = String(
  //       payment?.razorpay_order_id || order.id,
  //     ).trim();

  //     // =======================================================
  //     // 8. Update payment attempt
  //     // =======================================================

  //     await this.dataSource.query(
  //       `
  //     UPDATE user_subscription_payments
  //     SET
  //       razorpay_order_id = ?,
  //       payment_id = ?,
  //       payment_status = 'processing',
  //       updated_at = NOW()
  //     WHERE id = ?
  //     `,
  //       [razorpayOrderId, razorpayPaymentId || null, paymentAttemptId],
  //     );

  //     // =======================================================
  //     // 9. IMPORTANT
  //     //
  //     // Do NOT update next_billing_date here.
  //     //
  //     // Wait for Razorpay webhook:
  //     //
  //     // payment.captured
  //     // / relevant recurring payment success event
  //     //
  //     // Then update next_billing_date.
  //     // =======================================================

  //     return {
  //       success: true,

  //       subscription_id: subscriptionId,

  //       payment_attempt_id: paymentAttemptId,

  //       razorpay_order_id: razorpayOrderId,

  //       razorpay_payment_id: razorpayPaymentId || null,

  //       amount,

  //       amount_in_paise: amountInPaise,

  //       status: 'processing',
  //     };
  //   } catch (error) {
  //     console.error('Razorpay recurring payment failed:', error);

  //     // =======================================================
  //     // 10. Mark payment attempt as failed
  //     // =======================================================

  //     const failureReason = error || 'Recurring payment failed';

  //     await this.dataSource.query(
  //       `
  //     UPDATE user_subscription_payments
  //     SET
  //       payment_status = 'failed',
  //       failure_reason = ?,
  //       updated_at = NOW()
  //     WHERE id = ?
  //     `,
  //       [failureReason, paymentAttemptId],
  //     );

  //     throw new BadRequestException(failureReason);
  //   }
  // }
  
async processSingleRecurringPayment(subscription: any) {
  const subscriptionId = Number(subscription.id);
 
  if (!Number.isInteger(subscriptionId) || subscriptionId <= 0) {
    throw new BadRequestException('Invalid subscription ID');
  }
 
  // =========================================================
  // 1. Razorpay customer + token
  // =========================================================
 
  const customerId = String(subscription.razorpay_customer_id || '').trim();
  const tokenId = String(subscription.razorpay_token_id || '').trim();
 
  if (!customerId) {
    throw new BadRequestException('Razorpay customer ID missing');
  }
  if (!tokenId) {
    throw new BadRequestException('Razorpay token ID missing');
  }
 
  // =========================================================
  // 2. Amount
  // =========================================================
 
  const amount = Number(subscription.total_amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new BadRequestException('Invalid recurring amount');
  }
  const amountInPaise = Math.round(amount * 100);
 
  // =========================================================
  // 3. Customer details
  // =========================================================
 
  const email = String(subscription.email || 'vb.develop1@gmail.com').trim();
  const contact = String(subscription.mobile || subscription.phone || '8147484371').trim();
 
  if (!email) {
    throw new BadRequestException('Customer email missing');
  }
  if (!contact) {
    throw new BadRequestException('Customer contact missing');
  }
 
  // =========================================================
  // 4. Razorpay configuration
  // =========================================================
 
  const config = await this.integrationService.getIntegrationConfig('razorpay');
  const configData = typeof config === 'string' ? JSON.parse(config) : config;
  const keyId = String(configData?.key_id || '').trim();
  const keySecret = String(configData?.key_secret || '').trim();
 
  if (!keyId || !keySecret) {
    throw new BadRequestException('Razorpay configuration is missing');
  }
 
  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
 
  // =========================================================
  // 4b. NEW — validate the token is still chargeable BEFORE creating an
  // order or attempting a charge. Stops repeat cron failures on a token
  // that's already dead on Razorpay's side, and gives you a real reason
  // in the logs/DB instead of a generic "id does not exist".
  // =========================================================
 
  let token: any;
  try {
    token = await razorpay.customers.fetchToken(customerId, tokenId);
  } catch (error: any) {
    const reason =
      error?.error?.description || error?.message || 'Token could not be fetched from Razorpay';
    this.logger.error(
      `processSingleRecurringPayment: subscription ${subscriptionId} — token ${tokenId} for customer ` +
      `${customerId} is no longer valid on Razorpay (${reason}). Marking subscription so it stops retrying.`,
    );
    await this.dataSource.query(
      `UPDATE user_subscriptions
          SET token_status = 'invalid', payment_status = 'failed', auto_renew = 0, updated_at = NOW()
        WHERE id = ?`,
      [subscriptionId],
    );
    throw new BadRequestException(`Recurring token invalid for subscription ${subscriptionId}: ${reason}`);
  }
 
  if (token?.recurring === false || (token?.recurring_details && token.recurring_details.status !== 'confirmed')) {
    const reason = token?.recurring_details?.failure_reason || `token status: ${token?.recurring_details?.status ?? 'unknown'}`;
    this.logger.error(
      `processSingleRecurringPayment: subscription ${subscriptionId} — token ${tokenId} is not recurring-active ` +
      `(${reason}). Marking subscription so it stops retrying.`,
    );
    await this.dataSource.query(
      `UPDATE user_subscriptions
          SET token_status = 'invalid', payment_status = 'failed', auto_renew = 0, updated_at = NOW()
        WHERE id = ?`,
      [subscriptionId],
    );
    throw new BadRequestException(`Recurring token not active for subscription ${subscriptionId}: ${reason}`);
  }
 
  // =========================================================
  // 5. Create a NEW Razorpay order — MUST include customer_id so the
  // order is linked to the customer/token being charged. This was the
  // most likely cause of "the id provided does not exist".
  // =========================================================
 
  const receipt = `REC_${subscriptionId}_${Date.now()}`;
 
  const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency: 'INR',
    receipt,
    customer_id: customerId,
    method: token?.method || subscription.payment_method || undefined,
    notes: {
      subscription_id: String(subscriptionId),
    },
  });
 
  console.log('Recurring Razorpay order created:', {
    subscriptionId,
    orderId: order.id,
    amount: amountInPaise,
  });
 
  // =========================================================
  // 6. Create payment attempt BEFORE debit
  // =========================================================
 
  const paymentInsert = await this.dataSource.query(
    `
    INSERT INTO user_subscription_payments
    (
      subscription_id,
      user_id,
      amount,
      total_amount,
      payment_status,
      payment_method,
      order_id,
      created_at
    )
    VALUES
    (
      ?,
      ?,
      ?,
      ?,
      'processing',
      'razorpay_tokenq',
      ?,
      NOW()
    )
    `,
    [subscriptionId, subscription.user_id, amount, amount, order.id],
  );
 
  const paymentAttemptId = Number(paymentInsert?.insertId);
 
  if (!Number.isInteger(paymentAttemptId) || paymentAttemptId <= 0) {
    throw new BadRequestException('Failed to create payment attempt');
  }
 
  // =========================================================
  // 7. Execute recurring debit
  // =========================================================
 
  try {
    const payment = await razorpay.payments.createRecurringPayment({
      email,
      contact,
 
      customer_id: customerId,
      token: tokenId,
 
      amount: amountInPaise,
      currency: 'INR',
 
      order_id: order.id,
 
      recurring: true,
 
      description: `Recurring payment for subscription ${subscriptionId}`,
 
      notes: {
        subscription_id: String(subscriptionId),
        payment_attempt_id: String(paymentAttemptId),
      },
    });
 
    console.log('Razorpay recurring payment response:', payment);
 
    const razorpayPaymentId = String(payment?.razorpay_payment_id || '').trim();
    const razorpayOrderId = String(payment?.razorpay_order_id || order.id).trim();
 
    // =======================================================
    // 8. Update payment attempt
    // =======================================================
 
    await this.dataSource.query(
      `
    UPDATE user_subscription_payments
    SET
      razorpay_order_id = ?,
      payment_id = ?,
      payment_status = 'processing',
      updated_at = NOW()
    WHERE id = ?
    `,
      [razorpayOrderId, razorpayPaymentId || null, paymentAttemptId],
    );
 
    // =======================================================
    // 9. Do NOT update next_billing_date here — wait for the
    // payment.captured (or equivalent) webhook.
    // =======================================================
 
    return {
      success: true,
      subscription_id: subscriptionId,
      payment_attempt_id: paymentAttemptId,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId || null,
      amount,
      amount_in_paise: amountInPaise,
      status: 'processing',
    };
  } catch (error: any) {
    console.error('Razorpay recurring payment failed:', error);
 
    // =======================================================
    // 10. Mark payment attempt as failed — store an actual message
    // string, not the raw Error/response object.
    // =======================================================
 
    const failureReason =
      error?.error?.description || error?.message || String(error) || 'Recurring payment failed';
 
    await this.dataSource.query(
      `
    UPDATE user_subscription_payments
    SET
      payment_status = 'failed',
      failure_reason = ?,
      updated_at = NOW()
    WHERE id = ?
    `,
      [failureReason, paymentAttemptId],
    );
 
    throw new BadRequestException(failureReason);
  }
}


  async accept_terms_condition(body: any, user_id: number) {
    const { parent_id } = body;

    if (!parent_id) {
      throw new BadRequestException('parent_venue_id is required');
    }

    await this.dataSource.query(
      `
      UPDATE venue_parent
      SET
        agreement_accepted = NOW(),
        updated_at = NOW()
      WHERE
        parent_venue_id = ?
    `,
      [parent_id],
    );

    return {
      success: true,
      message: 'Terms and conditions accepted successfully',
    };
  }
  
  async validate_coupon(body: any) {
    const { code } = body;

    if (!code) {
      throw new BadRequestException('code is required');
    }

    const coupan = await this.dataSource.query(
      `
      SELECT * FROM  coupons
      WHERE
        code = ?
    `,
      [code],
    );

    return coupan[0];

   
  }
}

function getDatesBetween(startDate: string, endDate: string) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  const result: string[] = [];

  while (start <= end) {
    const yyyy = start.getFullYear();
    const mm = String(start.getMonth() + 1).padStart(2, '0');
    const dd = String(start.getDate()).padStart(2, '0');

    result.push(`${yyyy}-${mm}-${dd}`);

    start.setDate(start.getDate() + 1);
  }

  return result;
}

function parseDate(dateStr: string): Date {
  if (!dateStr) throw new Error('Invalid date input');

  const parts = dateStr.split('-');

  // if format is DD-MM-YYYY
  if (parts[0].length === 2) {
    const [dd, mm, yyyy] = parts.map(Number);
    return new Date(yyyy, mm - 1, dd);
  }

  // if format is YYYY-MM-DD
  const [yyyy, mm, dd] = parts.map(Number);
  return new Date(yyyy, mm - 1, dd);
}
