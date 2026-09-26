// Populates the two NEW Product Lists (Member page, R U OK page) added in
// this task with the 12 standard AS Colour garments each.
//
// Member (new page 12, form 262683647204057): copies club-products.json
// indices 0-11 as-is (already Colour=Black only, correct Size arrays per
// garment) and adds each garment's photo URL from
// garment-photos-manifest.json's clubIndex 0-11.
//
// R U OK (new page 13, form 262683674511058): copies public-products.json
// indices 0-11 as-is (already Colour=Black/Grey, correct Size arrays) and
// adds each garment's photo URL from garment-photos-manifest.json's
// publicIndex 0-11.
//
// Follows the full-object-POST discipline established after Task 12's
// data-loss incident (restore-and-push-photos.mjs): every product write
// sends the COMPLETE object (name/price/options/pid/images/everything),
// never a partial field, even though these are brand-new forms with only
// a single default placeholder product at index 0.
//
// Usage:
//   node build-push-member-ruok.mjs --dry-run   (logs only, no writes)
//   JOTFORM_API_KEY=... node build-push-member-ruok.mjs             (live write)

import { readFileSync } from 'node:fs';

const apiKey = process.env.JOTFORM_API_KEY;
const dryRun = process.argv.includes('--dry-run');
if (!dryRun && !apiKey) {
  console.error('JOTFORM_API_KEY not set (use --dry-run to preview without writing)');
  process.exit(1);
}

const MEMBER_FORM_ID = '262683647204057';
const RUOK_FORM_ID = '262683674511058';

const manifest = JSON.parse(readFileSync(new URL('./garment-photos-manifest.json', import.meta.url), 'utf8'));
const clubProducts = JSON.parse(readFileSync(new URL('./club-products.json', import.meta.url), 'utf8'));
const publicProducts = JSON.parse(readFileSync(new URL('./public-products.json', import.meta.url), 'utf8'));

const clubImages = {};
const publicImages = {};
for (const g of Object.values(manifest.garments)) {
  if (g.clubIndex !== null && g.clubIndex !== undefined) clubImages[g.clubIndex] = g.imageUrl;
  if (g.publicIndex !== null && g.publicIndex !== undefined) publicImages[g.publicIndex] = g.imageUrl;
}

// Member = first 12 (standard garments) of club-products.json, Colour must be Black-only.
const memberProducts = clubProducts.slice(0, 12);
// R U OK = first 12 (standard garments) of public-products.json, Colour must be Black/Grey.
const ruokProducts = publicProducts.slice(0, 12);

function describe(products, imagesByIndex, label) {
  console.log(`\n=== ${label}: ${products.length} products ===`);
  products.forEach((p, i) => {
    const opts = JSON.parse(p.options);
    const size = opts.find((o) => o.name === 'Size');
    const colour = opts.find((o) => o.name === 'Colour');
    console.log(
      i, '|', p.name,
      '| $' + p.price,
      '| Size:', size ? size.properties.replace(/\n/g, ',') : '(none)',
      '| Colour:', colour ? colour.properties.replace(/\n/g, ',') : '(none)',
      '| image:', imagesByIndex[i] || '(MISSING)'
    );
  });
}

describe(memberProducts, clubImages, 'MEMBER (new page 12, form ' + MEMBER_FORM_ID + ')');
describe(ruokProducts, publicImages, 'R U OK (new page 13, form ' + RUOK_FORM_ID + ')');

// Sanity checks before any live write.
for (const p of memberProducts) {
  const opts = JSON.parse(p.options);
  const colour = opts.find((o) => o.name === 'Colour');
  if (!colour || colour.properties.trim() !== 'Black') {
    throw new Error(`MEMBER product "${p.name}" does not have Colour=Black only: ${colour && colour.properties}`);
  }
}
for (const p of ruokProducts) {
  const opts = JSON.parse(p.options);
  const colour = opts.find((o) => o.name === 'Colour');
  if (!colour || colour.properties.trim() !== 'Black\nGrey') {
    throw new Error(`R U OK product "${p.name}" does not have Colour=Black/Grey: ${colour && colour.properties}`);
  }
}
if (memberProducts.length !== 12 || ruokProducts.length !== 12) {
  throw new Error('Expected exactly 12 products for each of Member and R U OK');
}
for (let i = 0; i < 12; i++) {
  if (!clubImages[i]) throw new Error(`Missing clubIndex ${i} image in manifest`);
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

await pushFullProducts(MEMBER_FORM_ID, memberProducts, clubImages, 'MEMBER');
await pushFullProducts(RUOK_FORM_ID, ruokProducts, publicImages, 'R U OK');

for (const [formId, label] of [[MEMBER_FORM_ID, 'MEMBER'], [RUOK_FORM_ID, 'R U OK']]) {
  const res = await fetch(`https://api.jotform.com/form/${formId}/properties?apiKey=${apiKey}`);
  const json = await res.json();
  const products = json.content.products;
  console.log(`\n--- ${label} verify (${products.length} products) ---`);
  products.forEach((p, i) => {
    console.log(i, '|', p.name, '| $' + p.price, '| images:', p.images);
  });
}
