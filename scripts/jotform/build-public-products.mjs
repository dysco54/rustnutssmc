// Builds the 13-product JSON payload for the Public Product List (Supporter + R U OK garments)
// and writes it to ./public-products.json for a subsequent curl POST to
// https://api.jotform.com/form/{publicProductListFormId}/properties
//
// Source of truth: shop/catalog.js (GARMENTS + HIVIS_GARMENTS = SUPPORTER_GARMENTS)

import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const RANGE_XS_3XL = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const RANGE_S_3XL = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
const RANGE_XS_5XL = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];

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

const HIVIS = ["JB's Wear 6HVT Hi-Vis Tee", 2700, RANGE_XS_3XL];

const ALL = [...GARMENTS, HIVIS];

function uuidLike() {
  return randomBytes(18).toString('hex').slice(0, 37);
}

function money(cents) {
  return (cents / 100).toFixed(2);
}

const products = ALL.map(([label, cents, sizes], idx) => {
  const isHiVis = label === HIVIS[0];
  const colourValues = isHiVis ? ['Black', 'Grey', 'Hi-Vis'] : ['Black', 'Grey'];
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

writeFileSync(new URL('./public-products.json', import.meta.url), JSON.stringify(products));
console.log('Wrote', products.length, 'products to public-products.json');
for (const p of products) {
  console.log(' -', p.name, '$' + p.price, JSON.parse(p.options).map(o => o.name + ':' + o.properties.replace(/\n/g, '/')).join(' | '));
}
