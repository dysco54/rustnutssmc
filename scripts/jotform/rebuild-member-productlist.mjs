// Rebuilds the Member page's Product List after the App Builder page-wipe
// incident (2026-09-26). A fresh, blank Product List element was manually
// added back to the Member page in the App Builder, creating NEW form
// 262687652697073 (replacing the orphaned original 262683647204057, which
// still exists and will be deleted separately after this is verified).
//
// Follows the full-object-POST discipline established after the earlier
// partial-write data-loss incident: every product write sends the COMPLETE
// object, never a partial field.
//
// Usage:
//   node rebuild-member-productlist.mjs --dry-run
//   JOTFORM_API_KEY=... node rebuild-member-productlist.mjs

import { readFileSync } from 'node:fs';

const apiKey = process.env.JOTFORM_API_KEY;
const dryRun = process.argv.includes('--dry-run');
if (!dryRun && !apiKey) {
  console.error('JOTFORM_API_KEY not set (use --dry-run to preview without writing)');
  process.exit(1);
}

const NEW_MEMBER_FORM_ID = '262687652697073';

const manifest = JSON.parse(readFileSync(new URL('./garment-photos-manifest.json', import.meta.url), 'utf8'));
const clubProducts = JSON.parse(readFileSync(new URL('./club-products.json', import.meta.url), 'utf8'));

const clubImages = {};
for (const g of Object.values(manifest.garments)) {
  if (g.clubIndex !== null && g.clubIndex !== undefined) clubImages[g.clubIndex] = g.imageUrl;
}

const memberProducts = clubProducts.slice(0, 12);

console.log(`\n=== MEMBER rebuild target: ${NEW_MEMBER_FORM_ID}, ${memberProducts.length} products ===`);
memberProducts.forEach((p, i) => {
  const opts = JSON.parse(p.options);
  const size = opts.find((o) => o.name === 'Size');
  const colour = opts.find((o) => o.name === 'Colour');
  console.log(
    i, '|', p.name,
    '| $' + p.price,
    '| Size:', size ? size.properties.replace(/\n/g, ',') : '(none)',
    '| Colour:', colour ? colour.properties.replace(/\n/g, ',') : '(none)',
    '| image:', clubImages[i] || '(MISSING)'
  );
});

// Sanity checks before any live write.
for (const p of memberProducts) {
  const opts = JSON.parse(p.options);
  const colour = opts.find((o) => o.name === 'Colour');
  if (!colour || colour.properties.trim() !== 'Black') {
    throw new Error(`MEMBER product "${p.name}" does not have Colour=Black only: ${colour && colour.properties}`);
  }
}
if (memberProducts.length !== 12) {
  throw new Error('Expected exactly 12 products for Member');
}
for (let i = 0; i < 12; i++) {
  if (!clubImages[i]) throw new Error(`Missing clubIndex ${i} image in manifest`);
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

await pushFullProducts(NEW_MEMBER_FORM_ID, memberProducts, clubImages, 'MEMBER');

const res = await fetch(`https://api.jotform.com/form/${NEW_MEMBER_FORM_ID}/properties?apiKey=${apiKey}`);
const json = await res.json();
const products = json.content.products;
console.log(`\n--- MEMBER verify (${products.length} products) ---`);
products.forEach((p, i) => {
  console.log(i, '|', p.name, '| $' + p.price, '| images:', p.images);
});
