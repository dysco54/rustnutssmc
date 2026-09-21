export const SHIPPING_RATES = {
  VIC: { standard: 2000, express: 2250 },
  TAS: { standard: 3000, express: 3500 },
  NSW: { standard: 2500, express: 2750 },
  QLD: { standard: 2500, express: 2750 },
  WA: { standard: 3200, express: 3550 },
  SA: { standard: 2500, express: 2750 },
  ACT: { standard: 2500, express: 2750 },
  NT: { standard: 3200, express: 3550 },
};

export const AU_STATES = Object.keys(SHIPPING_RATES);

export function getShippingCost(state, method) {
  const rates = SHIPPING_RATES[state];
  if (!rates) throw new Error(`Unknown state: ${state}`);
  const cost = rates[method];
  if (cost === undefined) throw new Error(`Unknown shipping method "${method}" for state "${state}"`);
  return cost;
}
