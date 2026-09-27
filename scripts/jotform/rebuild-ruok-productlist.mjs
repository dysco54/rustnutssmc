// Rebuilds the R U OK page's Product List after the App Builder page-wipe
// incident (2026-09-26). New form 262687623650060 replaces the orphaned
// original 262683674511058.
//
// Usage:
//   node rebuild-ruok-productlist.mjs --dry-run
//   JOTFORM_API_KEY=... node rebuild-ruok-productlist.mjs

import { readFileSync } from 'node:fs';

const apiKey = process.env.JOTFORM_API_KEY;
const dryRun = process.argv.includes('--dry-run');
if (!dryRun && !apiKey) {
  console.error('JOTFORM_API_KEY not set (use --dry-run to preview without writing)');
  process.exit(1);
}

const NEW_RUOK_FORM_ID = '262687623650060';

const manifest = JSON.parse(readFileSync(new URL('./garment-photos-manifest.json', import.meta.url), 'utf8'));
const publicProducts = JSON.parse(readFileSync(new URL('./public-products.json', import.meta.url), 'utf8'));

const publicImages = {};
for (const g of Object.values(manifest.garments)) {
  if (g.publicIndex !== null && g.publicIndex !== undefined) publicImages[g.publicIndex] = g.imageUrl;
}

const ruokProducts = publicProducts.slice(0, 12);

console.log(`\n=== R U OK rebuild target: ${NEW_RUOK_FORM_ID}, ${ruokProducts.length} products ===`);
ruokProducts.forEach((p, i) => {
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

for (const p of ruokProducts) {
  const opts = JSON.parse(p.options);
  const colour = opts.find((o) => o.name === 'Colour');
  if (!colour || colour.properties.trim() !== 'Black\nGrey') {
    throw new Error(`R U OK product "${p.name}" does not have Colour=Black/Grey: ${colour && colour.properties}`);
  }
}
if (ruokProducts.length !== 12) {
  throw new Error('Expected exactly 12 products for R U OK');
}
for (let i = 0; i < 12; i++) {
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

await pushFullProducts(NEW_RUOK_FORM_ID, ruokProducts, publicImages, 'R U OK');

const res = await fetch(`https://api.jotform.com/form/${NEW_RUOK_FORM_ID}/properties?apiKey=${apiKey}`);
const json = await res.json();
const products = json.content.products;
console.log(`\n--- R U OK verify (${products.length} products) ---`);
products.forEach((p, i) => {
  console.log(i, '|', p.name, '| $' + p.price, '| images:', p.images);
});
