import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

/**
 * Protects endpoints that must be called by an internal caller only (a cron
 * job / billing scheduler), never a browser or an end user — most
 * importantly `POST /payments/charge-token`, which as shipped had NO guard
 * at all: anyone who could guess or enumerate a `mandateId` could trigger a
 * real recurring debit against that customer's saved payment method.
 *
 * Checks a shared-secret header (`x-internal-api-key`) against
 * `INTERNAL_API_KEY` in the environment, using a timing-safe comparison so
 * this can't be brute-forced byte-by-byte. This is a minimal stopgap, not a
 * full internal-auth system — if you already have mTLS between services, an
 * IP allowlist at the load balancer, or a service-to-service JWT scheme,
 * prefer that instead and delete this guard.
 */
@Injectable()
export class InternalServiceGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>('INTERNAL_API_KEY');
    if (!expected) {
      // Fail closed: a missing INTERNAL_API_KEY must never mean "let
      // everyone through" — that would silently reopen the exact hole
      // this guard exists to close.
      throw new UnauthorizedException(
        'INTERNAL_API_KEY is not configured — internal endpoints are disabled until it is set.',
      );
    }

    const req = context.switchToHttp().getRequest();
    const provided = String(req.headers['x-internal-api-key'] ?? '');

    if (!provided || !safeCompare(provided, expected)) {
      throw new UnauthorizedException('Invalid or missing internal API key');
    }

    return true;
  }
}

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
