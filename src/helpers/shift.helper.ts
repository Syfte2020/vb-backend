export function buildVenueShifts(
  pricing: any,
  childVenueId: string,
) {

  // ✅ convert string to object
  if (typeof pricing === 'string') {
    pricing = JSON.parse(pricing);
  }

  const pricingShifts = pricing?.shifts || {};

  console.log('pricing', pricing);
  console.log('pricingShifts', pricingShifts);

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
      name: 'Full Day',
      shiftKey: 'full_day',
      shiftType: 4,
      fromTime: '00:00',
      toTime: '23:59',
    },
  ];

  const shiftHeaders: any[] = [];
  const venueTimes: any[] = [];

  for (const shift of masterShifts) {
    const data = pricingShifts[shift.shiftKey];

    if (!data?.enabled) continue;

    const price = Number(data.price) || 0;

    shiftHeaders.push({
      name: shift.name,
      customName: shift.name,
      shiftType: String(shift.shiftType),
      fromTime: shift.fromTime,
      toTime: shift.toTime,
      childId: childVenueId,
      publish: 1,
    });

    venueTimes.push({
      childVenueId,
      shiftType: String(shift.shiftType),
      fromTime: shift.fromTime,
      toTime: shift.toTime,
      price,
      basePrice: 1,
    });
  }

  return {
    shiftHeaders,
    venueTimes,
  };
}