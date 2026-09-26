// Pushes the 13 Public-page products (built by build-public-products.mjs into
// ./public-products.json) to the live Public Product List form via the
// Jotform REST API's generic form-properties endpoint, using indexed
// properties[products][N][field]=value form encoding (confirmed working;
// a single JSON-blob value for properties[products] was tried first and
// silently wiped the products array instead of setting it).
//
// Usage: JOTFORM_API_KEY=... node push-public-products.mjs

import { readFileSync } from 'node:fs';

const apiKey = process.env.JOTFORM_API_KEY;
if (!apiKey) {
  console.error('JOTFORM_API_KEY not set');
  process.exit(1);
}

const formId = '262681878015061'; // publicProductListFormId per app-manifest.json
const products = JSON.parse(readFileSync(new URL('./public-products.json', import.meta.url), 'utf8'));

const params = new URLSearchParams();
products.forEach((p, i) => {
  for (const [key, value] of Object.entries(p)) {
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
console.log('POST status:', res.status, json.message);

// Verify
const verifyRes = await fetch(`https://api.jotform.com/form/${formId}/properties?apiKey=${apiKey}`);
const verifyJson = await verifyRes.json();
const live = verifyJson.content.products || [];
console.log('Live product count:', live.length);
for (const p of live) {
  console.log(' -', p.name, '$' + p.price);
}
