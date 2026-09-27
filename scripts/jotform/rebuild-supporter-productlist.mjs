// Rebuilds the Supporter page's Product List after the App Builder
// page-wipe incident (2026-09-26). New form 262688121544056 replaces the
// orphaned original 262681878015061.
//
// Usage:
//   node rebuild-supporter-productlist.mjs --dry-run
//   JOTFORM_API_KEY=... node rebuild-supporter-productlist.mjs

import { readFileSync } from 'node:fs';

const apiKey = process.env.JOTFORM_API_KEY;
const dryRun = process.argv.includes('--dry-run');
if (!dryRun && !apiKey) {
  console.error('JOTFORM_API_KEY not set (use --dry-run to preview without writing)');
  process.exit(1);
}

const NEW_SUPPORTER_FORM_ID = '262688121544056';

const manifest = JSON.parse(readFileSync(new URL('./garment-photos-manifest.json', import.meta.url), 'utf8'));
const publicProducts = JSON.parse(readFileSync(new URL('./public-products.json', import.meta.url), 'utf8'));

const publicImages = {};
for (const g of Object.values(manifest.garments)) {
  if (g.publicIndex !== null && g.publicIndex !== undefined) publicImages[g.publicIndex] = g.imageUrl;
}

console.log(`\n=== SUPPORTER rebuild target: ${NEW_SUPPORTER_FORM_ID}, ${publicProducts.length} products ===`);
publicProducts.forEach((p, i) => {
  const opts = JSON.parse(p.options);
  const size = opts.find((o) => o.name === 'Size');
  const colour = opts.find((o) => o.name === 'Colour');
  console.log(
    i, '|', p.name,
    '| $' + p.price,
    '| Size:', size ? size.properties.replace(/\n/g, ',') : '(none)',
    '| Colour:', colour ? colour.properties.replace(/\n/g, ',') : '(none)',
    '| image:', publicImages[i] || '(MISSING)'
  );
});

if (publicProducts.length !== 13) {
  throw new Error('Expected exactly 13 products for Supporter');
}
for (let i = 0; i < 13; i++) {
  if (!publicImages[i]) throw new Error(`Missing publicIndex ${i} image in manifest`);
}

console.log('\nAll sanity checks passed.');

if (dryRun) {
  console.log('\n--dry-run: no writes performed.');
  process.exit(0);
}

async function pushFullProducts(formId, products, imagesByIndex, label) {
  const params = new URLSearchParams();
  products.forEach((p, i) => {
    const full = { ...p };
    full.images = JSON.stringify([imagesByIndex[i]]);
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

await pushFullProducts(NEW_SUPPORTER_FORM_ID, publicProducts, publicImages, 'SUPPORTER');

const res = await fetch(`https://api.jotform.com/form/${NEW_SUPPORTER_FORM_ID}/properties?apiKey=${apiKey}`);
const json = await res.json();
const products = json.content.products;
console.log(`\n--- SUPPORTER verify (${products.length} products) ---`);
products.forEach((p, i) => {
  console.log(i, '|', p.name, '| $' + p.price, '| images:', p.images);
});
