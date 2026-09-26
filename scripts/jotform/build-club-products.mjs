// Builds the 20-product JSON payload for the Club Product List (Member + Family garments)
// and writes it to ./club-products.json for a subsequent POST to
// https://api.jotform.com/form/{clubProductListFormId}/properties
//
// Source of truth: shop/catalog.js (GARMENTS + YOUTH_INFANT_GARMENTS = FAMILY_GARMENTS)
// Colour is Black-only on the Club page per spec.

import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const RANGE_XS_3XL = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const RANGE_S_3XL = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
const RANGE_XS_5XL = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
const RANGE_YOUTH = ['8', '10', '12', '14', '16'];
const RANGE_KIDS = ['2', '4', '6'];
const RANGE_INFANT = ['0-3m', '3-6m', '6-12m', '12-18m', '18-24m'];

// label, price (cents), sizes
const GARMENTS = [
  ['Classic Tee', 3500, RANGE_XS_3XL],
  ['Low Down Singlet', 3000, RANGE_S_3XL],
  ['Made Hood', 6000, RANGE_S_3XL],
  ['Made Crew', 6000, RANGE_S_3XL],
  ['Stencil Hood', 5500, RANGE_XS_5XL],
  ['Zip Hood', 6000, RANGE_XS_3XL],
  ['Stencil Crew', 5500, RANGE_XS_3XL],
  ['Heavy Tee', 4000, RANGE_XS_3XL],
  ['Classic L/S Tee', 4000, RANGE_XS_3XL],
  ['Barnard Tank', 3000, RANGE_XS_3XL],
  ["Women's Classic Tee", 3500, RANGE_XS_3XL],
  ["Women's Classic L/S Tee", 4000, RANGE_XS_3XL],
];

const YOUTH_INFANT_GARMENTS = [
  ['Youth Long Sleeve', 2650, RANGE_YOUTH],
  ['Youth Supply Crew', 2950, RANGE_YOUTH],
  ['Youth Supply Hood', 3650, RANGE_YOUTH],
  ['Kids Supply Hood', 3650, RANGE_KIDS],
  ['Kids Supply Crew', 2950, RANGE_KIDS],
  ['Kids Long Sleeve', 2650, RANGE_KIDS],
  ['Infant One Piece', 2440, RANGE_INFANT],
  ['Infant Tee', 2250, RANGE_INFANT],
];

const ALL = [...GARMENTS, ...YOUTH_INFANT_GARMENTS];

function uuidLike() {
  return randomBytes(18).toString('hex').slice(0, 37);
}

function money(cents) {
  return (cents / 100).toFixed(2);
}

const products = ALL.map(([label, cents, sizes], idx) => {
  const colourValues = ['Black'];
  const sizeOption = {
    type: 'custom',
    name: 'Size',
    properties: sizes.join('\n'),
    defaultQuantity: '',
    specialPricing: false,
    expanded: false,
    specialPrices: sizes.map(() => '0.00').join(','),
  };
  const colourOption = {
    type: 'custom',
    name: 'Colour',
    properties: colourValues.join('\n'),
    defaultQuantity: '',
    specialPricing: false,
    expanded: false,
    specialPrices: colourValues.map(() => '0.00').join(','),
  };
  return {
    description: '',
    disabled: 'show',
    fitImageToCanvas: 'Yes',
    hasExpandedOption: '',
    hasQuantity: '',
    hasSpecialPricing: '',
    icon: '',
    images: '[]',
    name: label,
    options: JSON.stringify([sizeOption, colourOption]),
    order: String(idx),
    paymentUUID: uuidLike(),
    pid: String(1000 + idx),
    price: money(cents),
    required: '0',
    selected: '0',
  };
});

writeFileSync(new URL('./club-products.json', import.meta.url), JSON.stringify(products));
console.log('Wrote', products.length, 'products to club-products.json');
for (const p of products) {
  console.log(' -', p.name, '$' + p.price, JSON.parse(p.options).map(o => o.name + ':' + o.properties.replace(/\n/g, '/')).join(' | '));
}
