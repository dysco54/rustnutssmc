// FIX for push-photos.mjs's data-loss bug: POSTing only the `images` key per
// product index REPLACES the whole product object server-side (confirmed by
// re-GET showing name/price/options/pid all dropped, only images+paymentUUID
// left) instead of merging into it. This script restores every field from
// the original club-products.json / public-products.json (the full product
// definitions used to originally populate both lists) and re-adds the
// sourced garment photo's `images` value in the SAME POST, so no field is
// ever sent as a partial/incomplete product object.
//
// Usage: JOTFORM_API_KEY=... node restore-and-push-photos.mjs

import { readFileSync } from 'node:fs';

const apiKey = process.env.JOTFORM_API_KEY;
if (!apiKey) {
  console.error('JOTFORM_API_KEY not set');
  process.exit(1);
}

const CLUB_FORM_ID = '262682106860054';
const PUBLIC_FORM_ID = '262681878015061';

const manifest = JSON.parse(readFileSync(new URL('./garment-photos-manifest.json', import.meta.url), 'utf8'));
const clubProducts = JSON.parse(readFileSync(new URL('./club-products.json', import.meta.url), 'utf8'));
const publicProducts = JSON.parse(readFileSync(new URL('./public-products.json', import.meta.url), 'utf8'));

// Build index -> imageUrl maps from the manifest.
const clubImages = {};
const publicImages = {};
for (const g of Object.values(manifest.garments)) {
  if (g.clubIndex !== null && g.clubIndex !== undefined) clubImages[g.clubIndex] = g.imageUrl;
  if (g.publicIndex !== null && g.publicIndex !== undefined) publicImages[g.publicIndex] = g.imageUrl;
}

async function pushFullProducts(formId, products, imagesByIndex, label) {
  const params = new URLSearchParams();
  products.forEach((p, i) => {
    const full = { ...p };
    if (imagesByIndex[i]) {
      full.images = JSON.stringify([imagesByIndex[i]]);
    }
    for (const [key, value] of Object.entries(full)) {
      params.append(`properties[products][${i}][${key}]`, String(value));
    }
  });
  const url = `https://api.jotform.com/form/${formId}/properties?apiKey=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const json = await res.json();
  console.log(label, formId, 'POST status:', res.status, json.message);
}

await pushFullProducts(CLUB_FORM_ID, clubProducts, clubImages, 'CLUB');
await pushFullProducts(PUBLIC_FORM_ID, publicProducts, publicImages, 'PUBLIC');

for (const [formId, label] of [[CLUB_FORM_ID, 'CLUB'], [PUBLIC_FORM_ID, 'PUBLIC']]) {
  const res = await fetch(`https://api.jotform.com/form/${formId}/properties?apiKey=${apiKey}`);
  const json = await res.json();
  const products = json.content.products;
  console.log(`\n--- ${label} verify (${products.length} products) ---`);
  products.forEach((p, i) => {
    console.log(i, '|', p.name, '| $' + p.price, '| images:', p.images);
  });
}
