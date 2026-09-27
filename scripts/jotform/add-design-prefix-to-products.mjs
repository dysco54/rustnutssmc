// Fixes the missing-Design-on-Purchase-Order gap (2026-09-27): the shared
// Checkout form (262682306434053) has no field identifying which of the 4
// Product List pages a cart item came from -- confirmed via a raw webhook
// payload inspection in Make.com (run 9cb94825, scenario 7522707 "Rustnuts
// Merch Order Intake"): the payload's q11_myProducts items carry only
// productName/unitPrice/currency/quantity/subTotal/productOptions, no page
// or form identifier at all.
//
// Fix: prefix each product's own `name` field with its Design, so the
// existing productName -> Items-summary -> PO/Invoice/Receipt pipeline
// (already working, untouched) carries Design through for free.
//
// Full-object-write discipline: POST /form/{id}/properties replaces the
// entire product object at each index -- every field must be resent, never
// just `name`.
//
// Usage:
//   node add-design-prefix-to-products.mjs --dry-run
//   JOTFORM_API_KEY=... node add-design-prefix-to-products.mjs

const apiKey = process.env.JOTFORM_API_KEY;
const dryRun = process.argv.includes('--dry-run');
if (!apiKey) {
  console.error('JOTFORM_API_KEY not set (required even for --dry-run, since reads also need it)');
  process.exit(1);
}

const TARGETS = [
  { label: 'Family', formId: '262688129609066', expectedCount: 20 },
  { label: 'Supporter', formId: '262688121544056', expectedCount: 13 },
  { label: 'Member', formId: '262687652697073', expectedCount: 12 },
  { label: 'R U OK', formId: '262687623650060', expectedCount: 12 },
];

function prefixed(label, name) {
  if (name.startsWith(`${label} - `)) return name; // idempotent re-run guard
  return `${label} - ${name}`;
}

async function getProducts(formId) {
  const res = await fetch(`https://api.jotform.com/form/${formId}/properties?apiKey=${apiKey}`);
  const json = await res.json();
  return json.content.products;
}

async function pushFullProducts(formId, products) {
  const params = new URLSearchParams();
  products.forEach((p, i) => {
    for (const [key, value] of Object.entries(p)) {
      params.append(`properties[products][${i}][${key}]`, String(value));
    }
  });
  const res = await fetch(`https://api.jotform.com/form/${formId}/properties?apiKey=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const json = await res.json();
  return { status: res.status, message: json.message };
}

for (const t of TARGETS) {
  console.log(`\n=== ${t.label} (${t.formId}) ===`);
  const products = await getProducts(t.formId);
  if (products.length !== t.expectedCount) {
    throw new Error(`${t.label}: expected ${t.expectedCount} products, got ${products.length} -- aborting, data may have changed since last check`);
  }

  const renamed = products.map((p) => ({ ...p, name: prefixed(t.label, p.name) }));

  renamed.forEach((p, i) => {
    console.log(i, '|', products[i].name, '->', p.name);
  });

  if (dryRun) {
    console.log(`--dry-run: no writes performed for ${t.label}.`);
    continue;
  }

  const result = await pushFullProducts(t.formId, renamed);
  console.log(`${t.label} POST status:`, result.status, result.message);

  const verify = await getProducts(t.formId);
  const badCount = verify.length !== t.expectedCount;
  const badNames = verify.filter((p, i) => p.name !== renamed[i].name);
  console.log(`${t.label} verify: ${verify.length} products, ${badNames.length} name mismatches${badCount ? ' -- COUNT MISMATCH' : ''}`);
  verify.forEach((p, i) => console.log(' ', i, '|', p.name, '| $' + p.price, '| images:', p.images !== '[]' && p.images !== '' ? 'ok' : 'MISSING'));
}
