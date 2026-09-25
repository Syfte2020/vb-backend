import { MandateFrequency } from '../enums/frequency.enum';

/**
 * Dynamic recurring-plan pricing, per requirement 7:
 *   1 venue   = ₹100/month
 *   3 venues  = ₹300/month
 *   10 venues = ₹1000/month
 * i.e. linear ₹<PRICE_PER_VENUE_MONTHLY>/venue/month. Yearly billing is the
 * monthly rate × 12 × a configurable multiplier (default 1 — set it below 1,
 * e.g. 0.9, to offer a yearly discount without touching this function).
 *
 * Kept as a pure function (no DI) so it's trivial to unit test and to reuse
 * from a scheduled billing job as well as the HTTP layer.
 */
export function calculateRecurringAmount(params: {
  quantity: number;
  billingCycle: MandateFrequency.MONTHLY | MandateFrequency.YEARLY;
  pricePerVenueMonthly: number;
  yearlyMultiplier?: number;
}): number {
  const {
    quantity,
    billingCycle,
    pricePerVenueMonthly,
    yearlyMultiplier = 1,
  } = params;

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error('quantity must be a positive integer');
  }
  if (!Number.isFinite(pricePerVenueMonthly) || pricePerVenueMonthly <= 0) {
    throw new Error('pricePerVenueMonthly must be a positive number');
  }

  const monthly = pricePerVenueMonthly * quantity;
  const amount =
    billingCycle === MandateFrequency.YEARLY
      ? monthly * 12 * yearlyMultiplier
      : monthly;

  // Round to paise-safe 2 decimals.
  return Math.round(amount * 100) / 100;
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}
