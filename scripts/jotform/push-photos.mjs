// Uploads each garment's sourced photo URL (see garment-photos-manifest.json)
// into the matching product's `images` field on the live Club and/or Public
// Jotform Product List forms, via the REST API's generic form-properties
// endpoint (confirmed working for the `images` field on 2026-09-26: a POST of
// properties[products][N][images]=["<url>"] is respected and read back
// unchanged on a fresh GET -- no UI upload was needed for this field).
//
// Only the `images` field is touched per product -- name/price/options are
// left untouched.
//
// Usage: JOTFORM_API_KEY=... node push-photos.mjs

import { readFileSync } from 'node:fs';

const apiKey = process.env.JOTFORM_API_KEY;
if (!apiKey) {
  console.error('JOTFORM_API_KEY not set');
  process.exit(1);
}

const CLUB_FORM_ID = '262682106860054';
const PUBLIC_FORM_ID = '262681878015061';

const manifest = JSON.parse(readFileSync(new URL('./garment-photos-manifest.json', import.meta.url), 'utf8'));

async function pushToForm(formId, entries) {
  const params = new URLSearchParams();
  for (const { index, imageUrl } of entries) {
    params.append(`properties[products][${index}][images]`, JSON.stringify([imageUrl]));
  }
  const url = `https://api.jotform.com/form/${formId}/properties?apiKey=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const json = await res.json();
  console.log(formId, 'POST status:', res.status, json.message);
}

const clubEntries = [];
const publicEntries = [];
for (const [key, g] of Object.entries(manifest.garments)) {
  if (g.clubIndex !== null && g.clubIndex !== undefined) {
    clubEntries.push({ index: g.clubIndex, imageUrl: g.imageUrl, key });
  }
  if (g.publicIndex !== null && g.publicIndex !== undefined) {
    publicEntries.push({ index: g.publicIndex, imageUrl: g.imageUrl, key });
  }
}

console.log(`Club: ${clubEntries.length} products to update`);
console.log(`Public: ${publicEntries.length} products to update`);

await pushToForm(CLUB_FORM_ID, clubEntries);
await pushToForm(PUBLIC_FORM_ID, publicEntries);

// Verify
for (const [formId, label, entries] of [[CLUB_FORM_ID, 'CLUB', clubEntries], [PUBLIC_FORM_ID, 'PUBLIC', publicEntries]]) {
  const res = await fetch(`https://api.jotform.com/form/${formId}/properties?apiKey=${apiKey}`);
  const json = await res.json();
  const products = json.content.products;
  console.log(`\n--- ${label} verify ---`);
  for (const { index, key } of entries) {
    const p = products[index];
    console.log(index, key, '|', p.name, '| images:', p.images);
  }
}
