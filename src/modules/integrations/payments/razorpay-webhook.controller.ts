import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { RazorpayService } from './razorpay.service';
import { RazorpayWebhookPayload } from './interfaces/razorpay-webhook-payload.interface';

/**
 * CHANGED in this pass (problems #2 / #3 in the review):
 *
 * This controller was already doing the right *shape* of thing — reading
 * `req.rawBody`, requiring `x-razorpay-signature` / `x-razorpay-event-id`,
 * and refusing to proceed without them. What it did wrong was reimplement
 * signature verification inline: it called `IntegrationService
 * .getIntegrationConfig('razorpay')` directly, re-parsed the JSON itself,
 * and ran `verifyRazorpayWebhookSignature` by hand — completely bypassing
 * `RazorpayApiClient`'s 5-minute credential cache, so it did a fresh DB
 * round trip on every single webhook delivery. It also meant signature
 * verification existed in two unrelated places (this controller, and
 * nowhere else — RazorpayService.handleWebhook never checked anything).
 *
 * Now: the controller only extracts and sanity-checks the raw inputs
 * (rawBody / signature / eventId / parsed body) and hands all four to
 * `RazorpayService.handleWebhook`, which performs the actual signature
 * check via the new `RazorpayApiClient.verifyWebhookSignature()` — see
 * that file and razorpay.service.ts. This makes handleWebhook the single
 * authoritative gate (so it's still safe even if something other than this
 * controller ever calls it directly, e.g. a test or a future admin replay
 * tool), and removes the IntegrationService dependency from this
 * controller entirely.
 */
@Controller('payments/webhooks')
export class RazorpayWebhookController {
  constructor(private readonly razorpayService: RazorpayService) {}

  @Post('razorpay')
  @HttpCode(200)
  async handle(
    @Req() req: FastifyRequest,
    @Headers('x-razorpay-signature') signature: string,
    @Headers('x-razorpay-event-id') eventId: string,
  ) {
    // Fastify + Nest raw body. Requires `rawBody: true` to be passed to
    // NestFactory.create(AppModule, new FastifyAdapter(), { rawBody: true })
    // in main.ts — Fastify does NOT populate this automatically the way
    // Express body-parser does. Confirm that option is set; without it
    // `req.rawBody` is always undefined and every webhook 400s here.
    const rawBody = (req as any).rawBody as Buffer | undefined;

    if (!rawBody) {
      throw new BadRequestException(
        'Raw body unavailable — enable rawBody in main.ts',
      );
    }
    if (!signature) {
      throw new BadRequestException('Missing x-razorpay-signature header');
    }
    if (!eventId) {
      throw new BadRequestException('Missing x-razorpay-event-id header');
    }

    const body = req.body as RazorpayWebhookPayload;

    // Signature verification now happens inside handleWebhook (via
    // RazorpayApiClient.verifyWebhookSignature) BEFORE anything is written
    // to razorpay_webhook_events or dispatched to an event handler — see
    // razorpay.service.ts. If it fails, handleWebhook throws
    // BadRequestException itself.
    return this.razorpayService.handleWebhook(rawBody, signature, eventId, body);
  }
}
