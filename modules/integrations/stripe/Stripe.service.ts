import { Injectable, BadRequestException } from '@nestjs/common';

import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IntegrationService } from '../integSettings/integSettings.service';
import { DataSource } from 'typeorm';

import Stripe from 'stripe';

import dayjs from 'dayjs';

@Injectable()
export class StripeService {
  constructor(
    private readonly integrationService: IntegrationService,
    private readonly http: HttpService,
    private readonly dataSource: DataSource,
  ) {}

  async subscription(body: any, id: any, Country: any) {
    console.log('welome stripe ');
    try {
      // ==========================
      // Get Plan
      // ==========================
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

      // ==========================
      // Get User
      // ==========================
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

      // ==========================
      // Stripe Config From DB
      // ==========================
      const config =
        await this.integrationService.getIntegrationConfig('stripe');

      const configData =
        typeof config === 'string' ? JSON.parse(config) : config;

      console.log(configData);

      const stripe = new Stripe(configData.secret_key, {
        apiVersion: '2026-06-24.dahlia',
      });

      const subscriptionCode = `SUB_${Date.now()}`;

      // ==========================
      // Create Stripe Customer
      // ==========================
      const customer = await stripe.customers.create({
        name: user.name,
        email: user.email,
        phone: user.phone || undefined,
      });

      // ==========================
      // Create Checkout Session
      // plan.plan_id should contain Stripe Price ID
      // Example: price_1Rxxxxxx
      // ==========================

      const product = await stripe.products.create({
        name: plan.plan_name,
      });

      const price = await stripe.prices.create({
        unit_amount: 300 * 100, // paise/cents
        currency: 'usd',
        recurring: {
          interval: 'month',
        },
        product: product.id,
      });

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',

        customer: customer.id,

        payment_method_types: ['card'],

        line_items: [
          {
            price: price.id,
            quantity: 1,
          },
        ],

        success_url: `${process.env.FRONTEND_URL}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,

        cancel_url: `${process.env.FRONTEND_URL}/subscription-cancel`,

        metadata: {
          user_id: String(id),
          plan_id: String(plan.id),
          subscription_code: subscriptionCode,
        },
      });

      // ==========================
      // Category
      // ==========================
      const [category] = await this.dataSource.query(
        `SELECT id FROM category WHERE name = ? LIMIT 1`,
        [body.category],
      );

      // ==========================
      // Booking Modes
      // ==========================
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

      // ==========================
      // Save Subscription
      // ==========================
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
        ?,?,?,?,?,?,
        NULL,
        NULL,
        NULL,
        1,
        'pending',
        0,
        NULL,
        NOW(),
        NOW()
      )
      `,
        [
          id,
          category?.id || 0,
          Country,
          body.selectedPlan,
          subscriptionCode,
          session.id,
        ],
      );

      return {
        success: true,
        session_id: session.id,
        checkout_url: session.url,
        customer_id: customer.id,
      };
    } catch (error) {
      console.error(error);

      throw new BadRequestException('Subscription creation failed');
    }
  }

async verifyStripeSubscription(sessionId: string) {
  if (!sessionId) {
    throw new BadRequestException('sessionId is required');
  }

  const config =
    await this.integrationService.getIntegrationConfig('stripe');

  const configData =
    typeof config === 'string' ? JSON.parse(config) : config;

  const stripe = new Stripe(configData.secret_key, {
        apiVersion: '2026-06-24.dahlia',
      });

  try {
    // Retrieve Checkout Session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    const subscription = session.subscription as Stripe.Subscription;

    return {
      session_id: session.id,
      payment_status: session.payment_status,
      subscription_id: subscription?.id,
      subscription_status: subscription?.status=='active' ? 'ACTIVE':'INACTIVE',
      customer_id: session.customer,
    };
  } catch (error: any) {
    console.error(
      'Stripe verifySubscription error:',
      error?.raw?.message || error.message,
    );

    throw new BadRequestException(
      error?.raw?.message || 'Failed to verify Stripe subscription',
    );
  }
}

  async cashfree_plans(parentId: string, category: any) {
    const [categorys] = await this.dataSource.query(
      `SELECT id FROM category WHERE name = ? limit 1`,
      [category],
    );
    let rows = '';
    if (category == 'farmstay') {
      rows = await this.dataSource.query(
        `SELECT * FROM plans WHERE  category_id = ? `,
        [categorys.id],
      );
    } else {
      rows = await this.dataSource.query(
        `SELECT * FROM vendor_options vo  LEFT JOIN plans p ON p.id = vo.option_key WHERE vo.parent_id = ? `,
        [parentId],
      );
    }
    return rows;
  }
}
