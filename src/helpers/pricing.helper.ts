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
    name: 'full_day',
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

// export function buildPricingArray(
//   category: string,
//   pricing: any,
//   childVenueId: string,
// ) {
//   const config = CATEGORY_CONFIG[category];

//   if (!config || config.type !== 'pricing') return [];

//   // ✅ FIX HERE
//   const result: any[] = [];

//   if (typeof pricing === 'string') {
//     pricing = JSON.parse(pricing);
//   }


//   for (const item of config.pricing) {
//   if (item.conditional) {
//     if (!pricing[item.enabledKey]) continue;
//   }

//   let amount = 0;
//   let deposit = 0;

//   // Venue pricing uses shifts
//   if (category === "venue" && pricing.shifts) {
//     const shiftKey = item.pricingKey;

//     const shift = pricing.shifts?.[shiftKey];

//     // Skip if shift doesn't exist or isn't enabled
//     if (!shift?.enabled) continue;

//     amount = Number(shift.price || 0);
//     deposit = Number(shift.deposit || 0);
//   } else {
//     // Other categories use normal pricing fields
//     amount = Number(pricing[item.pricingKey] || 0);

//     // Existing deposit for non-shift pricing
//     deposit = Number(pricing.deposit || 0);
//   }

//   console.log("Pricing Key:", item.pricingKey);
//   console.log("Pricing:", pricing);
//   console.log("Amount:", amount);
//   console.log("Deposit:", deposit);
//   console.log("Child Venue ID:", childVenueId);

//   if (amount <= 0) continue;

//   result.push({
//     name: item.name,
//     category: category,
//     pricingKey: item.pricingKey,
//     amount,
//     deposit: deposit,
//     childVenueId: childVenueId,
//   });
// }

//   return result;
// }
export function buildPricingArray(
  category: string,
  pricing: any,
  childVenueId: string,
) {
  const config = CATEGORY_CONFIG[category];

  if (!config || config.type !== 'pricing') {
    return {
      pricingArray: [],
      securitySettings: [],
    };
  }

  const pricingArray: any[] = [];
  const securitySettings: any[] = [];

  if (typeof pricing === 'string') {
    pricing = JSON.parse(pricing);
  }

  for (const item of config.pricing) {
    if (item.conditional) {
      if (!pricing[item.enabledKey]) continue;
    }

    let amount = 0;
    let deposit = 0;
    let deposits = 0;

    // Venue pricing uses shifts
    if (category === 'venue' && pricing.shifts) {
      const shiftKey = item.pricingKey;
      const shift = pricing.shifts?.[shiftKey];

      // Skip if shift doesn't exist or isn't enabled
      if (!shift?.enabled) continue;

      amount = Number(shift.price || 0);
      deposit = Number(shift.deposit || 0);
      deposits = 0;

      console.log('Pricing Key:', item.pricingKey);
      console.log('Shift:', shift);
      console.log('Amount:', amount);
      console.log('Deposit:', deposit);
      console.log('Child Venue ID:', childVenueId);

      if (amount <= 0) continue;

      // Pricing data
      pricingArray.push({
        name: item.name,
        category: category,
        pricingKey: item.pricingKey,
        amount,
        deposits,
        childVenueId,
      });

      // Shift-wise security amount
      const secAmtKey =
        `secAmtByShift${String(shiftKey).toLowerCase()}`;

      securitySettings.push({
        childId: childVenueId,
        group: 'deposits',
        key: secAmtKey,
        value: String(deposit),
      });
    } else {
      // Other categories use normal pricing fields
      amount = Number(pricing[item.pricingKey] || 0);

      // Existing deposit for non-shift pricing
      deposit = Number(pricing.deposit || 0);

      console.log('Pricing Key:', item.pricingKey);
      console.log('Pricing:', pricing);
      console.log('Amount:', amount);
      console.log('Deposit:', deposit);
      console.log('Child Venue ID:', childVenueId);

      if (amount <= 0) continue;

      pricingArray.push({
        name: item.pricingKey,
       // name: item.name,
        category: category,
        pricingKey: item.pricingKey,
        amount,
        deposit,
        childVenueId,
      });
    }
  }

  return {
    pricingArray,
    securitySettings,
  };
}