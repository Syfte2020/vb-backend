// export function buildVenueShifts(
//   pricing: any,
//   childVenueId: string,
// ) {
//   if (typeof pricing === 'string') {
//     pricing = JSON.parse(pricing);
//   }

//   const pricingShifts = pricing?.shifts || {};

//   const masterShifts = [
//     {
//       name: 'Morning',
//       shiftKey: 'morning',
//       shiftType: 1,
//       fromTime: '06:00',
//       toTime: '12:00',
//     },
//     {
//       name: 'Afternoon',
//       shiftKey: 'afternoon',
//       shiftType: 2,
//       fromTime: '12:00',
//       toTime: '17:00',
//     },
//     {
//       name: 'Evening',
//       shiftKey: 'evening',
//       shiftType: 3,
//       fromTime: '17:00',
//       toTime: '23:00',
//     },
//     {
//       name: 'Full Day',
//       shiftKey: 'full_day',
//       shiftType: 4,
//       fromTime: '00:00',
//       toTime: '23:59',
//     },
//   ];

//   const shiftHeaders: any[] = [];
//   const venueTimes: any[] = [];

// for (const shift of masterShifts) {
//   const data = pricingShifts[shift.shiftKey] || {};

//   const price = Number(data.price || 0);
//   const deposit = Number(data.deposit || 0);

//   shiftHeaders.push({
//     name: shift.name,
//     customName: shift.name,
//     shiftType: String(shift.shiftType),
//     fromTime: shift.fromTime,
//     toTime: shift.toTime,
//     childId: childVenueId,
//     publish: price > 0 ? 1 : 0,
//   });

//   venueTimes.push({
//     childVenueId,
//     shiftType: String(shift.shiftType),
//     fromTime: shift.fromTime,
//     toTime: shift.toTime,
//     price,
//     deposit,
//     basePrice: 1,
//   });
// }

//   return {
//     shiftHeaders,
//     venueTimes,
//   };
// }

export function buildVenueShifts(
  pricing: any,
  childVenueId: string,
) {
  if (typeof pricing === 'string') {
    pricing = JSON.parse(pricing);
  }

  const pricingShifts = pricing?.shifts || {};

  const masterShifts = [
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

  const shiftHeaders: any[] = [];
  const venueTimes: any[] = [];
  const securitySettings: any[] = [];

  for (const shift of masterShifts) {
    const data = pricingShifts[shift.shiftKey] || {};

    const price = Number(data.price || 0);
    const deposit = Number(data.deposit || 0);

    shiftHeaders.push({
      name: shift.name,
      customName: shift.name,
      shiftType: String(shift.shiftType),
      fromTime: shift.fromTime,
      toTime: shift.toTime,
      childId: childVenueId,
      publish: price > 0 ? 1 : 0,
    });

    venueTimes.push({
      childVenueId,
      shiftType: String(shift.shiftType),
      fromTime: shift.fromTime,
      toTime: shift.toTime,
      price,
      deposit,
      basePrice: 1,
    });

    // Security amount setting
    securitySettings.push({
      childId: childVenueId,
      group: 'deposits',
      key: `secAmtByShift${shift.shiftKey.toLowerCase()}`,
      value: String(deposit),
    });
  }

  return {
    shiftHeaders,
    venueTimes,
    securitySettings,
  };
}