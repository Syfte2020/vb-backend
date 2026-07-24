// pricing.helper.ts

export const VENUE_SHIFTS = [
  {
    name: 'Morning',
    shiftKey: 'morning',
    shiftType: 1,
    fromTime: '06:00',
    toTime: '12:00',
  },
  {
    name: 'Afternoon',
    shiftKey: 'afternoon',
    shiftType: 2,
    fromTime: '12:00',
    toTime: '17:00',
  },
  {
    name: 'Evening',
    shiftKey: 'evening',
    shiftType: 3,
    fromTime: '17:00',
    toTime: '23:00',
  },
  {
    name: 'Full Day',
    shiftKey: 'full_day',
    shiftType: 4,
    fromTime: '00:00',
    toTime: '23:59',
  },
];

export const CATEGORY_CONFIG: Record<string, any> = {
  venue: {
    type: 'shift',
    shifts: VENUE_SHIFTS,
  },

  farmstay: {
    type: 'pricing',
    pricing: [
      {
        name: 'Nightly',
        pricingKey: 'nightly',
      },
      {
        name: 'Deposit',
        pricingKey: 'deposit',
      },
      {
        name: 'Weekend',
        pricingKey: 'weekendPrice',
        enabledKey: 'weekendEnabled',
        conditional: true,
      },
      {
        name: 'Extended Stay Discount',
        pricingKey: 'extendedStayDiscount',
        enabledKey: 'extendedStayEnabled',
        conditional: true,
        extraFields: [
          {
            name: 'Min Nights',
            pricingKey: 'extendedStayMinNights',
          },
        ],
      },
    ],
  },

  studio: {
    type: 'pricing',
    pricing: [
      { name: 'Hourly', pricingKey: 'hourly' },
      { name: 'Half Day', pricingKey: 'halfDay' },
      { name: 'Full Day', pricingKey: 'fullDay' },
    ],
  },

  workspace: {
    type: 'pricing',
    pricing: [
      { name: 'Hourly', pricingKey: 'hourly' },
      { name: 'Daily', pricingKey: 'daily' },
      { name: 'Monthly', pricingKey: 'monthly' },
    ],
  },

  rental: {
    type: 'pricing',
    pricing: [
      { name: 'Daily', pricingKey: 'daily' },
      { name: 'Weekly', pricingKey: 'weekly' },
      { name: 'Monthly', pricingKey: 'monthly' },
    ],
  },

  experience: {
    type: 'pricing',
    pricing: [
      { name: 'Per Person', pricingKey: 'perPerson' },
      { name: 'Group Price', pricingKey: 'groupPrice' },
    ],
  },
};

export function buildPricingArray(
  category: string,
  pricing: any,
  childVenueId: string,
) {
  const config = CATEGORY_CONFIG[category];

  if (!config || config.type !== 'pricing') return [];

  // ✅ FIX HERE
  const result: any[] = [];

  if (typeof pricing === 'string') {
    pricing = JSON.parse(pricing);
  }

  for (const item of config.pricing) {
    if (item.conditional) {
      if (!pricing[item.enabledKey]) continue;
    }

    const amount = Number(pricing[item.pricingKey] || 0);

    console.log(pricing[item.pricingKey]);
    console.log(pricing);
    console.log(item.pricingKey);
    console.log(amount);
    console.log(childVenueId);

    if (amount <= 0) continue;

    result.push({
      name: item.name,
      category: category,
      pricingKey: item.pricingKey,
      amount,
      childVenueId: childVenueId,
    });
  }

  return result;
}
