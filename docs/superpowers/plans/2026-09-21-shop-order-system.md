# Rustnuts SMC Shop Order System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder Rustnuts SMC shop page with a working, data-driven ordering flow (4 designs × 5 garment types × sizes, code-word-gated Member design, order form, two automated emails) that runs entirely on GitHub Pages + a new Cloudflare Worker.

**Architecture:** `dysco54/rustnutssmc` (GitHub Pages, static, no build step) hosts the rebuilt `shop.html` and two small ES-module JS files. A new Cloudflare Worker (`rustnuts-shop-worker`, separate git repo at `~/rustnuts-shop-worker`) is the single source of truth for the product catalog and pricing — it serves `GET /catalog` (JSON) for the page to render, and `POST /order` to validate the order, recompute the authoritative total server-side, generate an order reference, and send two emails via the Resend API (owner notice to `rustnutsmerch@gmail.com`, pro-forma confirmation to the buyer). The Worker never trusts client-sent prices. The Member design's code-word gate is client-side only, per spec (not a security boundary — a club-membership nicety).

**Tech Stack:** Vanilla HTML/CSS/JS (native ES modules, no bundler — matches the existing static site), Node's built-in `node:test` + `node:assert` for unit tests (zero npm dependencies), Cloudflare Workers (`wrangler`, run via `npx wrangler`, already OAuth-authenticated on this Pi), Resend API for transactional email.

**Spec:** Doc `https://claude.ai/code/artifact/b2d046ea-140c-447f-a521-cf725adcf8ec` ("Rustnuts SMC Shop Update — Claude Code Prompt"), plus two decisions made with Chris in chat on 2026-09-21: (1) email backend = new Cloudflare Worker + Resend, not Netlify Functions (site is actually GitHub Pages, not Netlify as the doc assumed); (2) sender = Resend's shared/test sender, recipient = `rustnutsmerch@gmail.com` as given — no domain-verified sending address (would need club board approval to set up domain-based email for ~6 addresses, out of scope).

## Global Constraints

- Site: `dysco54/rustnutssmc`, GitHub Pages, static files only, no build step, no framework — new JS ships as plain ES modules loaded via `<script type="module">`.
- Keep existing theme exactly: colours `--red:#8C1C24`, `--red-bright:#B92632`, `--ink:#111010`, `--bone:#F4F1EA`, font `Saira Stencil One` for headings (`.display`/`--stencil`), same header/footer markup as current `shop.html`.
- 4 designs: Member, Family, Supporter, a 4th (placeholder name/art, clearly marked). Patches are excluded from the shop entirely (reserved for charity events).
- 5 garment types per design: shirt, hoodie, jumper, singlet, + one more (placeholder 5th type, clearly marked).
- Two-layer pricing: each design has a base price; each garment type within a design has its own price. The Worker computes the authoritative per-line and order total from this — the client never sends a trusted price.
- Only the Member design is gated behind the code word `RSMC2019`; Family, Supporter, and the 4th design need no code word. Gate is client-side only (explicitly acceptable per spec — do not add server-side enforcement).
- Order form fields: name, contact details, delivery choice (ship vs. collect), shipping address (only when "ship" is chosen), and per line item: design, garment type, size, quantity — multiple line items per order, any quantity.
- No payment processing — buyer pays via bank transfer after the pro-forma email arrives. Bank details in the buyer email are placeholder text, clearly marked `PLACEHOLDER — confirm real bank details before go-live`.
- Every order gets a unique order reference (format `RSMC-YYYYMMDD-XXXX`), included in both emails, with buyer instructions to quote it on the bank transfer.
- Owner notification → `rustnutsmerch@gmail.com`. Buyer confirmation → the email address they entered in the form. Both sent from Resend's shared/test sender (no domain verification).
- On-screen confirmation message shown after successful submit (order ref + short thank-you).
- Worker CORS locked to `https://www.rustnutssmc.com.au` and `https://rustnutssmc.com.au` only (same pattern as the existing `rustnuts-calendar-proxy` Worker on this account).
- Never commit `RESEND_API_KEY` — it is a `wrangler secret`, not a `wrangler.toml` var.
- Do not use `npm create cloudflare` / the interactive scaffold — a prior Worker on this account (`rustnuts-calendar-proxy`) shipped with the scaffold's default static-assets binding shadowing `/` and breaking CORS preflight in production. Hand-write `wrangler.toml` and `src/index.js` from scratch instead.

## Review Focus

- **Non-integer or zero/negative quantity, or a qty field left empty** — the spec says "any quantity", but a reasonable buyer expects the form (and the Worker, authoritatively) to reject 0, negative, or non-numeric quantities rather than silently mis-pricing or emailing a broken order. Pinned in Task 3 (`pricing.test.js`) and Task 6 (`priceOrder` rejects invalid items).
- **A garment/size combination that doesn't exist for the chosen design** (e.g. a size not offered for that garment type, or a garment type not in the catalog) — the Worker must reject it with a clear error rather than pricing it at `undefined`/`NaN`. Pinned in Task 6.
- **Someone bypasses the client-side gate and POSTs a Member-design order directly to the Worker without ever entering the code word** — spec says this is acceptable (gate is client-side only, not a security boundary), so the Worker must still accept and correctly price it. Pinned in Task 6 (`priceOrder` treats Member the same as any other design — no gate check server-side) so a future contributor doesn't "fix" this into a server-side block that contradicts the spec.
- **"Ship" selected but shipping address left blank, or "collect" selected with leftover shipping-address text from a prior selection** — the form must not let a ship order submit without an address, and must not send stale address data when the buyer switches back to collect. Pinned in Task 8 (order.js manual verification checklist) and Task 9 (Playwright E2E).
- **The Worker's `RESEND_API_KEY` secret is unset** (fresh clone, local dev, or a slipped deploy) — must fail with a clear 500 + message, not a raw crash or a silent 200 with no email sent. Pinned in Task 7 (`index.js` handler behaviour, verified manually since it's the thin routing layer).

---

## Task 1: Worker repo scaffold + order reference generator

**Files:**
- Create: `~/rustnuts-shop-worker/package.json`
- Create: `~/rustnuts-shop-worker/wrangler.toml`
- Create: `~/rustnuts-shop-worker/src/orderRef.js`
- Test: `~/rustnuts-shop-worker/test/orderRef.test.js`

**Interfaces:**
- Produces: `generateOrderRef(date = new Date()) → string` — format `RSMC-YYYYMMDD-XXXX` where `XXXX` is 4 uppercase base36 chars from a random source. Exported from `src/orderRef.js`.

- [ ] **Step 1: Write `package.json` and `wrangler.toml`**

`package.json`:
```json
{
  "name": "rustnuts-shop-worker",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "dev": "npx wrangler dev",
    "deploy": "npx wrangler deploy"
  }
}
```

`wrangler.toml`:
```toml
name = "rustnuts-shop-worker"
main = "src/index.js"
compatibility_date = "2026-09-21"

[vars]
CLUB_EMAIL = "rustnutsmerch@gmail.com"
ALLOWED_ORIGINS = "https://www.rustnutssmc.com.au,https://rustnutssmc.com.au"
```

No `[assets]` / `[site]` block — this Worker serves no static files, only JSON API routes. (This is the exact thing that broke CORS on the calendar-proxy Worker before — see Global Constraints.)

- [ ] **Step 2: Write the failing test**

```javascript
// test/orderRef.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateOrderRef } from '../src/orderRef.js';

test('generateOrderRef matches RSMC-YYYYMMDD-XXXX format', () => {
  const ref = generateOrderRef(new Date('2026-09-21T00:00:00Z'));
  assert.match(ref, /^RSMC-20260921-[A-Z0-9]{4}$/);
});

test('generateOrderRef produces different refs on successive calls', () => {
  const a = generateOrderRef(new Date('2026-09-21T00:00:00Z'));
  const b = generateOrderRef(new Date('2026-09-21T00:00:00Z'));
  assert.notEqual(a, b);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd ~/rustnuts-shop-worker && npm test`
Expected: FAIL — `Cannot find module '../src/orderRef.js'`

- [ ] **Step 4: Write minimal implementation**

```javascript
// src/orderRef.js
export function generateOrderRef(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `RSMC-${y}${m}${d}-${suffix}`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd ~/rustnuts-shop-worker && npm test`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
cd ~/rustnuts-shop-worker
git add package.json wrangler.toml src/orderRef.js test/orderRef.test.js
git commit -m "Scaffold Worker repo, add order reference generator"
```

---

## Task 2: Product catalog (single source of truth)

**Files:**
- Create: `~/rustnuts-shop-worker/src/catalog.js`
- Test: `~/rustnuts-shop-worker/test/catalog.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `CATALOG` (array) — each item: `{ id: string, name: string, memberGated: boolean, basePrice: number /* cents */, garments: { [garmentKey]: { label: string, price: number /* cents */, sizes: string[] } } }`. Exported from `src/catalog.js`. Task 3, 6, 9 all read this shape.

- [ ] **Step 1: Write the failing test**

```javascript
// test/catalog.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../src/catalog.js';

test('CATALOG has exactly 4 designs', () => {
  assert.equal(CATALOG.length, 4);
});

test('every design has 5 garment types, each with a price and at least one size', () => {
  for (const design of CATALOG) {
    const garmentKeys = Object.keys(design.garments);
    assert.equal(garmentKeys.length, 5, `${design.id} should have 5 garment types`);
    for (const key of garmentKeys) {
      const g = design.garments[key];
      assert.equal(typeof g.price, 'number');
      assert.ok(g.price > 0, `${design.id}/${key} price must be positive`);
      assert.ok(Array.isArray(g.sizes) && g.sizes.length > 0, `${design.id}/${key} needs sizes`);
    }
  }
});

test('exactly one design is memberGated, and it is the Member design', () => {
  const gated = CATALOG.filter(d => d.memberGated);
  assert.equal(gated.length, 1);
  assert.equal(gated[0].id, 'member');
});

test('no design id is "patches"', () => {
  assert.ok(!CATALOG.some(d => d.id === 'patches'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/rustnuts-shop-worker && npm test`
Expected: FAIL — `Cannot find module '../src/catalog.js'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/catalog.js
// PLACEHOLDER PRICING — confirm real prices with the committee before go-live.
// Garment prices are per-design (two-layer pricing: design base + garment add-on
// folded into one final per-garment price here, since that's what the Worker
// actually charges — the "base price" is shown on the card as a from-price).
const SIZES = ['S', 'M', 'L', 'XL', '2XL'];

function garmentSet(basePrice, addOns) {
  const garments = {};
  for (const [key, { label, addOn }] of Object.entries(addOns)) {
    garments[key] = { label, price: basePrice + addOn, sizes: SIZES };
  }
  return garments;
}

const GARMENT_ADD_ONS = {
  shirt: { label: 'T-Shirt', addOn: 0 },
  singlet: { label: 'Singlet', addOn: 0 },
  hoodie: { label: 'Hoodie', addOn: 2000 },
  jumper: { label: 'Crew Jumper', addOn: 1500 },
  vest: { label: 'Vest', addOn: 500 },
};

export const CATALOG = [
  {
    id: 'member',
    name: 'Member',
    memberGated: true,
    basePrice: 3500,
    garments: garmentSet(3500, GARMENT_ADD_ONS),
  },
  {
    id: 'family',
    name: 'Family',
    memberGated: false,
    basePrice: 3500,
    garments: garmentSet(3500, GARMENT_ADD_ONS),
  },
  {
    id: 'supporter',
    name: 'Supporter',
    memberGated: false,
    basePrice: 3500,
    garments: garmentSet(3500, GARMENT_ADD_ONS),
  },
  {
    id: 'fourth-design',
    name: 'PLACEHOLDER — 4th design (in progress)',
    memberGated: false,
    basePrice: 3500,
    garments: garmentSet(3500, GARMENT_ADD_ONS),
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/rustnuts-shop-worker && npm test`
Expected: PASS (all tests, including Task 1's)

- [ ] **Step 5: Commit**

```bash
cd ~/rustnuts-shop-worker
git add src/catalog.js test/catalog.test.js
git commit -m "Add product catalog as single source of truth"
```

---

## Task 3: Server-side pricing and order validation

**Files:**
- Create: `~/rustnuts-shop-worker/src/pricing.js`
- Test: `~/rustnuts-shop-worker/test/pricing.test.js`

**Interfaces:**
- Consumes: `CATALOG` shape from Task 2.
- Produces: `priceOrder(items, catalog = CATALOG) → { lines: Array<{designId, garmentKey, size, qty, unitPrice, lineTotal}>, total: number }`, throws `OrderValidationError` (exported, has `.message`) on any invalid item. Task 6 (`index.js`) consumes this directly.

- [ ] **Step 1: Write the failing test**

```javascript
// test/pricing.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceOrder, OrderValidationError } from '../src/pricing.js';
import { CATALOG } from '../src/catalog.js';

test('prices a single valid line item correctly', () => {
  const result = priceOrder([{ designId: 'family', garmentKey: 'shirt', size: 'M', qty: 2 }], CATALOG);
  const unit = CATALOG.find(d => d.id === 'family').garments.shirt.price;
  assert.equal(result.lines[0].unitPrice, unit);
  assert.equal(result.lines[0].lineTotal, unit * 2);
  assert.equal(result.total, unit * 2);
});

test('sums multiple line items into one order total', () => {
  const result = priceOrder([
    { designId: 'family', garmentKey: 'shirt', size: 'M', qty: 1 },
    { designId: 'supporter', garmentKey: 'hoodie', size: 'L', qty: 1 },
  ], CATALOG);
  const shirtPrice = CATALOG.find(d => d.id === 'family').garments.shirt.price;
  const hoodiePrice = CATALOG.find(d => d.id === 'supporter').garments.hoodie.price;
  assert.equal(result.total, shirtPrice + hoodiePrice);
});

test('accepts a Member-design order with no gate check (server does not enforce the code word)', () => {
  const result = priceOrder([{ designId: 'member', garmentKey: 'shirt', size: 'M', qty: 1 }], CATALOG);
  assert.equal(result.total, CATALOG.find(d => d.id === 'member').garments.shirt.price);
});

test('rejects an unknown design id', () => {
  assert.throws(
    () => priceOrder([{ designId: 'nope', garmentKey: 'shirt', size: 'M', qty: 1 }], CATALOG),
    OrderValidationError
  );
});

test('rejects an unknown garment key for a valid design', () => {
  assert.throws(
    () => priceOrder([{ designId: 'family', garmentKey: 'trenchcoat', size: 'M', qty: 1 }], CATALOG),
    OrderValidationError
  );
});

test('rejects a size not offered for that garment', () => {
  assert.throws(
    () => priceOrder([{ designId: 'family', garmentKey: 'shirt', size: 'XXXL', qty: 1 }], CATALOG),
    OrderValidationError
  );
});

test('rejects zero, negative, or non-integer quantity', () => {
  for (const qty of [0, -1, 1.5, NaN]) {
    assert.throws(
      () => priceOrder([{ designId: 'family', garmentKey: 'shirt', size: 'M', qty }], CATALOG),
      OrderValidationError,
      `qty=${qty} should be rejected`
    );
  }
});

test('rejects an empty items array', () => {
  assert.throws(() => priceOrder([], CATALOG), OrderValidationError);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/rustnuts-shop-worker && npm test`
Expected: FAIL — `Cannot find module '../src/pricing.js'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/pricing.js
export class OrderValidationError extends Error {}

export function priceOrder(items, catalog) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new OrderValidationError('Order must contain at least one item.');
  }

  const lines = items.map((item) => {
    const { designId, garmentKey, size, qty } = item ?? {};

    if (!Number.isInteger(qty) || qty <= 0) {
      throw new OrderValidationError(`Invalid quantity for ${designId}/${garmentKey}: ${qty}`);
    }

    const design = catalog.find((d) => d.id === designId);
    if (!design) {
      throw new OrderValidationError(`Unknown design: ${designId}`);
    }

    const garment = design.garments[garmentKey];
    if (!garment) {
      throw new OrderValidationError(`Unknown garment "${garmentKey}" for design "${designId}"`);
    }

    if (!garment.sizes.includes(size)) {
      throw new OrderValidationError(`Size "${size}" not offered for ${designId}/${garmentKey}`);
    }

    const unitPrice = garment.price;
    return { designId, garmentKey, size, qty, unitPrice, lineTotal: unitPrice * qty };
  });

  const total = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  return { lines, total };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/rustnuts-shop-worker && npm test`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
cd ~/rustnuts-shop-worker
git add src/pricing.js test/pricing.test.js
git commit -m "Add server-side authoritative pricing and order validation"
```

---

## Task 4: Email templates

**Files:**
- Create: `~/rustnuts-shop-worker/src/emailTemplates.js`
- Test: `~/rustnuts-shop-worker/test/emailTemplates.test.js`

**Interfaces:**
- Consumes: `priceOrder()` result shape from Task 3, plus buyer-submitted contact fields.
- Produces: `buildOwnerEmail(order) → {subject, text}`, `buildBuyerEmail(order) → {subject, text}`, where `order = { orderRef, lines, total, buyer: {name, email, phone, delivery, address?}, bankDetails }`. Task 6 (`index.js`) calls both.

- [ ] **Step 1: Write the failing test**

```javascript
// test/emailTemplates.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOwnerEmail, buildBuyerEmail } from '../src/emailTemplates.js';

const order = {
  orderRef: 'RSMC-20260921-AB12',
  lines: [{ designId: 'family', garmentKey: 'shirt', size: 'M', qty: 2, unitPrice: 3500, lineTotal: 7000 }],
  total: 7000,
  buyer: { name: 'Jess Rider', email: 'jess@example.com', phone: '0400 000 000', delivery: 'ship', address: '1 Example St, Melbourne VIC 3000' },
  bankDetails: 'PLACEHOLDER — confirm real bank details before go-live. BSB 000-000, Acct 00000000, Name Rustnuts SMC',
};

test('owner email includes order ref, buyer name, every line, and total', () => {
  const email = buildOwnerEmail(order);
  assert.match(email.subject, /RSMC-20260921-AB12/);
  assert.match(email.text, /Jess Rider/);
  assert.match(email.text, /family/);
  assert.match(email.text, /\$70\.00/);
});

test('owner email includes shipping address when delivery is ship', () => {
  const email = buildOwnerEmail(order);
  assert.match(email.text, /1 Example St, Melbourne VIC 3000/);
});

test('owner email omits an address section when delivery is collect', () => {
  const collectOrder = { ...order, buyer: { ...order.buyer, delivery: 'collect', address: undefined } };
  const email = buildOwnerEmail(collectOrder);
  assert.doesNotMatch(email.text, /undefined/);
});

test('buyer email includes order ref, bank details, and a pro-forma line total', () => {
  const email = buildBuyerEmail(order);
  assert.match(email.subject, /RSMC-20260921-AB12/);
  assert.match(email.text, /PLACEHOLDER — confirm real bank details/);
  assert.match(email.text, /\$70\.00/);
  assert.match(email.text, /RSMC-20260921-AB12/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/rustnuts-shop-worker && npm test`
Expected: FAIL — `Cannot find module '../src/emailTemplates.js'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/emailTemplates.js
function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function lineItemsText(lines) {
  return lines
    .map((l) => `  - ${l.designId} / ${l.garmentKey} / size ${l.size} × ${l.qty} = ${formatCents(l.lineTotal)}`)
    .join('\n');
}

export function buildOwnerEmail(order) {
  const { orderRef, lines, total, buyer } = order;
  const addressBlock = buyer.delivery === 'ship' && buyer.address
    ? `Shipping address: ${buyer.address}\n`
    : '';

  const text = [
    `New shop order ${orderRef}`,
    '',
    `Buyer: ${buyer.name}`,
    `Email: ${buyer.email}`,
    `Phone: ${buyer.phone}`,
    `Delivery: ${buyer.delivery}`,
    addressBlock,
    'Items:',
    lineItemsText(lines),
    '',
    `Total: ${formatCents(total)}`,
  ].filter(Boolean).join('\n');

  return { subject: `New order ${orderRef} — ${buyer.name}`, text };
}

export function buildBuyerEmail(order) {
  const { orderRef, lines, total, buyer, bankDetails } = order;

  const text = [
    `Thanks for your order, ${buyer.name}!`,
    '',
    `Order reference: ${orderRef}`,
    '(Please include this reference on your bank transfer so the treasurer can match your payment.)',
    '',
    'Items:',
    lineItemsText(lines),
    '',
    `Total due: ${formatCents(total)}`,
    '',
    'Payment details:',
    bankDetails,
  ].join('\n');

  return { subject: `Your Rustnuts SMC order ${orderRef}`, text };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/rustnuts-shop-worker && npm test`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
cd ~/rustnuts-shop-worker
git add src/emailTemplates.js test/emailTemplates.test.js
git commit -m "Add owner and buyer email templates"
```

---

## Task 5: Request body validation (contact fields)

**Files:**
- Create: `~/rustnuts-shop-worker/src/validateBuyer.js`
- Test: `~/rustnuts-shop-worker/test/validateBuyer.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `validateBuyer(raw) → {name, email, phone, delivery, address?}`, throws `OrderValidationError` (from Task 3's `pricing.js` — reused, not redefined) on missing/malformed fields. Task 6 calls this before `priceOrder`.

- [ ] **Step 1: Write the failing test**

```javascript
// test/validateBuyer.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBuyer } from '../src/validateBuyer.js';
import { OrderValidationError } from '../src/pricing.js';

const base = { name: 'Jess Rider', email: 'jess@example.com', phone: '0400 000 000', delivery: 'collect' };

test('accepts a valid collect order with no address required', () => {
  const buyer = validateBuyer(base);
  assert.equal(buyer.name, 'Jess Rider');
  assert.equal(buyer.delivery, 'collect');
});

test('accepts a valid ship order with an address', () => {
  const buyer = validateBuyer({ ...base, delivery: 'ship', address: '1 Example St, Melbourne VIC 3000' });
  assert.equal(buyer.address, '1 Example St, Melbourne VIC 3000');
});

test('rejects delivery=ship with no address', () => {
  assert.throws(() => validateBuyer({ ...base, delivery: 'ship' }), OrderValidationError);
});

test('rejects delivery=ship with a blank/whitespace-only address', () => {
  assert.throws(() => validateBuyer({ ...base, delivery: 'ship', address: '   ' }), OrderValidationError);
});

test('rejects a missing or malformed email', () => {
  assert.throws(() => validateBuyer({ ...base, email: '' }), OrderValidationError);
  assert.throws(() => validateBuyer({ ...base, email: 'not-an-email' }), OrderValidationError);
});

test('rejects a missing name or phone', () => {
  assert.throws(() => validateBuyer({ ...base, name: '' }), OrderValidationError);
  assert.throws(() => validateBuyer({ ...base, phone: '' }), OrderValidationError);
});

test('rejects a delivery value that is neither ship nor collect', () => {
  assert.throws(() => validateBuyer({ ...base, delivery: 'teleport' }), OrderValidationError);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/rustnuts-shop-worker && npm test`
Expected: FAIL — `Cannot find module '../src/validateBuyer.js'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/validateBuyer.js
import { OrderValidationError } from './pricing.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateBuyer(raw) {
  const name = String(raw?.name ?? '').trim();
  const email = String(raw?.email ?? '').trim();
  const phone = String(raw?.phone ?? '').trim();
  const delivery = raw?.delivery;
  const address = raw?.address ? String(raw.address).trim() : undefined;

  if (!name) throw new OrderValidationError('Name is required.');
  if (!EMAIL_RE.test(email)) throw new OrderValidationError('A valid email is required.');
  if (!phone) throw new OrderValidationError('Phone is required.');
  if (delivery !== 'ship' && delivery !== 'collect') {
    throw new OrderValidationError('Delivery must be "ship" or "collect".');
  }
  if (delivery === 'ship' && !address) {
    throw new OrderValidationError('Shipping address is required when delivery is "ship".');
  }

  return delivery === 'ship' ? { name, email, phone, delivery, address } : { name, email, phone, delivery };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/rustnuts-shop-worker && npm test`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
cd ~/rustnuts-shop-worker
git add src/validateBuyer.js test/validateBuyer.test.js
git commit -m "Add buyer contact field validation"
```

---

## Task 6: Worker HTTP handler (routing, CORS, Resend call)

**Files:**
- Create: `~/rustnuts-shop-worker/src/index.js`

**Interfaces:**
- Consumes: `CATALOG` (Task 2), `priceOrder`/`OrderValidationError` (Task 3), `buildOwnerEmail`/`buildBuyerEmail` (Task 4), `validateBuyer` (Task 5), `generateOrderRef` (Task 1).
- Produces: the deployed Worker's `fetch` handler — `GET /catalog`, `POST /order`, `OPTIONS *`. No further tasks consume this as a JS import; Task 8/9 consume it over HTTP.

This is the thin routing layer wiring the pieces above together, plus the one external side effect (calling Resend) — it is verified manually in Step 4 rather than with `node:test`, per the plan's testing approach: pure logic is unit-tested in Tasks 1–5, this file is the integration glue.

- [ ] **Step 1: Write `src/index.js`**

```javascript
// src/index.js
import { CATALOG } from './catalog.js';
import { priceOrder, OrderValidationError } from './pricing.js';
import { buildOwnerEmail, buildBuyerEmail } from './emailTemplates.js';
import { validateBuyer } from './validateBuyer.js';
import { generateOrderRef } from './orderRef.js';

const BANK_DETAILS_PLACEHOLDER =
  'PLACEHOLDER — confirm real bank details before go-live. BSB 000-000, Acct 00000000, Name Rustnuts SMC';

function corsHeaders(origin, env) {
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

async function sendEmail(env, { to, subject, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Rustnuts SMC Shop <onboarding@resend.dev>',
      to: [to],
      subject,
      text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend send failed (${res.status}): ${body}`);
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? '';
    const cors = corsHeaders(origin, env);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method === 'GET' && url.pathname === '/catalog') {
      return json(CATALOG, 200, cors);
    }

    if (request.method === 'POST' && url.pathname === '/order') {
      if (!env.RESEND_API_KEY) {
        return json({ error: 'Email service is not configured.' }, 500, cors);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Request body must be JSON.' }, 400, cors);
      }

      try {
        const buyer = validateBuyer(body.buyer);
        const { lines, total } = priceOrder(body.items, CATALOG);
        const orderRef = generateOrderRef();
        const order = { orderRef, lines, total, buyer, bankDetails: BANK_DETAILS_PLACEHOLDER };

        const ownerEmail = buildOwnerEmail(order);
        const buyerEmail = buildBuyerEmail(order);

        await sendEmail(env, { to: env.CLUB_EMAIL, ...ownerEmail });
        await sendEmail(env, { to: buyer.email, ...buyerEmail });

        return json({ orderRef, total }, 200, cors);
      } catch (err) {
        if (err instanceof OrderValidationError) {
          return json({ error: err.message }, 400, cors);
        }
        console.error(err);
        return json({ error: 'Could not process order. Please try again or contact the club directly.' }, 502, cors);
      }
    }

    return json({ error: 'Not found' }, 404, cors);
  },
};
```

- [ ] **Step 2: Run the existing unit tests to confirm nothing broke**

Run: `cd ~/rustnuts-shop-worker && npm test`
Expected: PASS (all tests from Tasks 1–5 — `index.js` isn't unit-tested itself, but must not break imports)

- [ ] **Step 3: Manual smoke test with `wrangler dev` (no real API key yet)**

```bash
cd ~/rustnuts-shop-worker && npx wrangler dev --port 8787 &
sleep 3
curl -s http://localhost:8787/catalog | head -c 300
echo
curl -s -X POST http://localhost:8787/order -H "Content-Type: application/json" \
  -d '{"buyer":{"name":"Test","email":"t@example.com","phone":"0400000000","delivery":"collect"},"items":[{"designId":"family","garmentKey":"shirt","size":"M","qty":1}]}'
echo
kill %1
```

Expected: `/catalog` returns the 4-design JSON array; `/order` returns `{"error":"Email service is not configured."}` with status 500 (no `RESEND_API_KEY` set yet — confirms the Global Constraints / Review Focus requirement that a missing key fails clearly instead of crashing).

- [ ] **Step 4: Commit**

```bash
cd ~/rustnuts-shop-worker
git add src/index.js
git commit -m "Add Worker HTTP handler: /catalog, /order, CORS"
```

---

## Task 7: Get a Resend API key and deploy the Worker

This task is mostly manual (an external account only Chris can create) — do the parts that need his input, then deploy.

**Files:**
- Modify: none (secrets are not files)

- [ ] **Step 1: Chris signs up for Resend (free tier) and creates an API key**

Tell Chris: go to https://resend.com, sign up free, create an API key from the dashboard, paste it in chat (per his stated preference — secrets pasted in chat are intentional, not a leak).

- [ ] **Step 2: Set the secret on the Worker**

```bash
cd ~/rustnuts-shop-worker && npx wrangler secret put RESEND_API_KEY
```
(paste the key when prompted)

- [ ] **Step 3: Deploy**

```bash
cd ~/rustnuts-shop-worker && npx wrangler deploy
```

Expected output includes the live URL, e.g. `https://rustnuts-shop-worker.<subdomain>.workers.dev`. Record this URL — Task 8 needs it.

- [ ] **Step 4: Verify the live deploy**

```bash
curl -s https://rustnuts-shop-worker.<subdomain>.workers.dev/catalog | head -c 300
```
Expected: the catalog JSON (confirms the deploy is live and CORS/vars are intact).

- [ ] **Step 5: Commit** (nothing code-side changed, but record the live URL for history)

```bash
cd ~/rustnuts-shop-worker
echo "https://rustnuts-shop-worker.<subdomain>.workers.dev" > DEPLOYED_URL.txt
git add DEPLOYED_URL.txt
git commit -m "Record deployed Worker URL"
```

---

## Task 8: Site — pure client-side helpers (gate check, price formatting)

**Files:**
- Create: `/home/chris/projects/rustnutssmc/package.json`
- Create: `/home/chris/projects/rustnutssmc/shop/gate.js`
- Create: `/home/chris/projects/rustnutssmc/shop/format.js`
- Test: `/home/chris/projects/rustnutssmc/test/gate.test.js`
- Test: `/home/chris/projects/rustnutssmc/test/format.test.js`

**Interfaces:**
- Produces: `checkCodeWord(input) → boolean` (from `shop/gate.js`), `formatCents(cents) → string` (from `shop/format.js`). Task 9's `order.js` imports both.

- [ ] **Step 1: Write `package.json`** (dev-only — does not affect the deployed static site)

```json
{
  "name": "rustnutssmc-site",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Write the failing tests**

```javascript
// test/gate.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCodeWord } from '../shop/gate.js';

test('accepts the exact code word', () => {
  assert.equal(checkCodeWord('RSMC2019'), true);
});

test('is case-insensitive and trims whitespace', () => {
  assert.equal(checkCodeWord('  rsmc2019  '), true);
});

test('rejects an empty or wrong code word', () => {
  assert.equal(checkCodeWord(''), false);
  assert.equal(checkCodeWord('wrong'), false);
});
```

```javascript
// test/format.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCents } from '../shop/format.js';

test('formats whole dollars', () => {
  assert.equal(formatCents(3500), '$35.00');
});

test('formats cents with a non-zero remainder', () => {
  assert.equal(formatCents(3599), '$35.99');
});

test('formats zero', () => {
  assert.equal(formatCents(0), '$0.00');
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /home/chris/projects/rustnutssmc && npm test`
Expected: FAIL — modules not found

- [ ] **Step 4: Write minimal implementation**

```javascript
// shop/gate.js
const CODE_WORD = 'RSMC2019';

export function checkCodeWord(input) {
  return String(input ?? '').trim().toUpperCase() === CODE_WORD;
}
```

```javascript
// shop/format.js
export function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /home/chris/projects/rustnutssmc && npm test`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
cd /home/chris/projects/rustnutssmc
git checkout -b shop-update
git add package.json shop/gate.js shop/format.js test/gate.test.js test/format.test.js
git commit -m "Add code-word gate and price formatting helpers"
```

---

## Task 9: Site — rebuild `shop.html` and `shop/order.js`

**Files:**
- Modify: `/home/chris/projects/rustnutssmc/shop.html`
- Create: `/home/chris/projects/rustnutssmc/shop/order.js`

**Interfaces:**
- Consumes: `checkCodeWord` (Task 8), `formatCents` (Task 8), the deployed Worker's `GET /catalog` / `POST /order` (Task 7's live URL).
- Produces: nothing further consumed by other tasks — this is the top of the stack, verified end-to-end in Task 10.

This is DOM wiring, not pure logic — no `node:test` here (would need `jsdom`, which is unjustified for a one-page club shop). It's verified with the manual checklist in Step 3 and the Playwright pass in Task 10.

- [ ] **Step 1: Rewrite `shop.html`**

Keep the existing `<head>`, theme `<style>` block, `<header>`, and `<footer>` exactly as they are today (same colours, same fonts, same nav). Replace the hero copy (drop the "Store coming soon" badge — ordering is now live) and replace the whole `<!-- PRODUCTS -->` section with a mount point plus the order form skeleton:

```html
<!-- HERO -->
<section class="shop-hero">
  <h1 class="display">The Shop</h1>
  <p>Official Rustnuts SMC merch — built for the road, worn by the family.</p>
</section>

<!-- PRODUCTS -->
<section class="block">
  <div class="wrap">
    <div id="design-grid" class="product-grid">
      <p>Loading products…</p>
    </div>

    <div id="cart-panel" hidden>
      <h2 class="display" style="font-size:1.6rem;margin:30px 0 14px">Your order</h2>
      <ul id="cart-items"></ul>
      <p id="cart-total"></p>
    </div>

    <form id="order-form" hidden>
      <h2 class="display" style="font-size:1.6rem;margin:30px 0 14px">Your details</h2>
      <label>Name <input type="text" name="name" required></label>
      <label>Email <input type="email" name="email" required></label>
      <label>Phone <input type="tel" name="phone" required></label>
      <fieldset>
        <legend>Delivery</legend>
        <label><input type="radio" name="delivery" value="collect" checked> Collect at next meeting</label>
        <label><input type="radio" name="delivery" value="ship"> Ship to me</label>
      </fieldset>
      <label id="address-field" hidden>Shipping address <textarea name="address"></textarea></label>
      <button type="submit">Submit order</button>
    </form>

    <p id="order-confirmation" hidden></p>
    <p id="order-error" hidden></p>
  </div>
</section>
```

Update the SEO/meta description near the top of `<head>` from "Store coming soon" to something reflecting the live shop (one line, e.g. `content="Official Rustnuts SMC merch — order online now."`). Add `<script type="module" src="shop/order.js"></script>` just before `</body>`, replacing the old inline `<script>` block (the year-footer logic and the old front/back toggle both move into `order.js`, since the old two-static-card markup is gone).

- [ ] **Step 2: Write `shop/order.js`**

```javascript
// shop/order.js
import { checkCodeWord } from './gate.js';
import { formatCents } from './format.js';

const WORKER_BASE_URL = 'https://rustnuts-shop-worker.<subdomain>.workers.dev'; // set after Task 7 deploy

const cart = [];
let catalog = [];
const unlockedGated = new Set();

async function loadCatalog() {
  const res = await fetch(`${WORKER_BASE_URL}/catalog`);
  catalog = await res.json();
  renderDesigns();
}

function renderDesigns() {
  const grid = document.getElementById('design-grid');
  grid.innerHTML = '';

  for (const design of catalog) {
    const card = document.createElement('div');
    card.className = 'product-card';

    const gateHtml = design.memberGated && !unlockedGated.has(design.id)
      ? `<div class="gate">
           <input type="text" placeholder="Enter club code word" class="gate-input">
           <button type="button" class="gate-submit">Unlock</button>
         </div>`
      : '';

    const orderHtml = !design.memberGated || unlockedGated.has(design.id)
      ? `<div class="order-controls">
           <select class="garment-select">
             ${Object.entries(design.garments).map(([key, g]) => `<option value="${key}">${g.label} — ${formatCents(g.price)}</option>`).join('')}
           </select>
           <select class="size-select"></select>
           <input type="number" class="qty-input" min="1" value="1">
           <button type="button" class="add-btn">Add to order</button>
         </div>`
      : '';

    card.innerHTML = `
      <div class="product-info">
        <div class="name">${design.name}</div>
        <div class="price">From ${formatCents(design.basePrice)}</div>
      </div>
      ${gateHtml}
      ${orderHtml}
    `;

    if (design.memberGated && !unlockedGated.has(design.id)) {
      card.querySelector('.gate-submit').addEventListener('click', () => {
        const val = card.querySelector('.gate-input').value;
        if (checkCodeWord(val)) {
          unlockedGated.add(design.id);
          renderDesigns();
        } else {
          card.querySelector('.gate-input').style.borderColor = 'var(--red-bright)';
        }
      });
    } else {
      const garmentSelect = card.querySelector('.garment-select');
      const sizeSelect = card.querySelector('.size-select');

      function refreshSizes() {
        const garment = design.garments[garmentSelect.value];
        sizeSelect.innerHTML = garment.sizes.map((s) => `<option value="${s}">${s}</option>`).join('');
      }
      garmentSelect.addEventListener('change', refreshSizes);
      refreshSizes();

      card.querySelector('.add-btn').addEventListener('click', () => {
        const garmentKey = garmentSelect.value;
        const size = sizeSelect.value;
        const qty = parseInt(card.querySelector('.qty-input').value, 10);
        if (!Number.isInteger(qty) || qty <= 0) return;
        cart.push({ designId: design.id, garmentKey, size, qty });
        renderCart();
      });
    }

    grid.appendChild(card);
  }
}

function renderCart() {
  const panel = document.getElementById('cart-panel');
  const list = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');
  const form = document.getElementById('order-form');

  if (cart.length === 0) {
    panel.hidden = true;
    form.hidden = true;
    return;
  }

  panel.hidden = false;
  form.hidden = false;

  let total = 0;
  list.innerHTML = cart.map((item, i) => {
    const design = catalog.find((d) => d.id === item.designId);
    const garment = design.garments[item.garmentKey];
    const lineTotal = garment.price * item.qty;
    total += lineTotal;
    return `<li>${design.name} / ${garment.label} / ${item.size} × ${item.qty} = ${formatCents(lineTotal)}
      <button type="button" data-remove="${i}">Remove</button></li>`;
  }).join('');
  totalEl.textContent = `Total: ${formatCents(total)}`;

  list.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      cart.splice(Number(btn.dataset.remove), 1);
      renderCart();
    });
  });
}

function wireDeliveryToggle() {
  const form = document.getElementById('order-form');
  const addressField = document.getElementById('address-field');
  form.querySelectorAll('input[name="delivery"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const isShip = form.delivery.value === 'ship';
      addressField.hidden = !isShip;
      if (!isShip) form.address.value = '';
    });
  });
}

function wireSubmit() {
  const form = document.getElementById('order-form');
  const confirmation = document.getElementById('order-confirmation');
  const errorEl = document.getElementById('order-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    confirmation.hidden = true;
    errorEl.hidden = true;

    const buyer = {
      name: form.name.value,
      email: form.email.value,
      phone: form.phone.value,
      delivery: form.delivery.value,
      ...(form.delivery.value === 'ship' ? { address: form.address.value } : {}),
    };

    try {
      const res = await fetch(`${WORKER_BASE_URL}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyer, items: cart }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Order failed.');

      confirmation.hidden = false;
      confirmation.textContent = `Thanks, ${buyer.name}! Order ${data.orderRef} submitted — check your email for payment details.`;
      cart.length = 0;
      renderCart();
      form.reset();
    } catch (err) {
      errorEl.hidden = false;
      errorEl.textContent = err.message;
    }
  });
}

document.getElementById('yr')?.replaceChildren(String(new Date().getFullYear()));
wireDeliveryToggle();
wireSubmit();
loadCatalog();
```

- [ ] **Step 3: Manual verification checklist** (open `shop.html` via a local static server — see Task 10 for the exact command — and walk through by hand once before the automated Playwright pass)

- [ ] Member design card shows the gate input, not the order controls, until the correct code word is entered
- [ ] Wrong code word does not unlock the Member design
- [ ] Correct code word (`RSMC2019`) unlocks it and the order controls appear
- [ ] Family/Supporter/4th design show order controls immediately, no gate
- [ ] Selecting a different garment type updates the size dropdown to that garment's sizes
- [ ] "Add to order" appends a cart line with the correct computed price
- [ ] Cart panel and order form are hidden when the cart is empty, visible once an item is added
- [ ] Switching delivery to "ship" reveals the address field; switching back to "collect" hides it and clears any typed address
- [ ] Submitting with "ship" and a blank address shows the Worker's validation error, not a silent failure

- [ ] **Step 4: Commit**

```bash
cd /home/chris/projects/rustnutssmc
git add shop.html shop/order.js
git commit -m "Rebuild shop.html with data-driven ordering, gate, and cart"
```

---

## Task 10: End-to-end browser verification (Playwright) and PR

**Files:** none (verification + a pull request, no new code)

- [ ] **Step 1: Serve the site and the Worker locally together**

```bash
cd /home/chris/rustnuts-shop-worker && npx wrangler dev --port 8787 &
cd /home/chris/projects/rustnutssmc && python3 -m http.server 8000 &
sleep 3
```

(Point `WORKER_BASE_URL` in `shop/order.js` at `http://localhost:8787` temporarily for this local pass only — revert to the deployed URL before committing/pushing, or read it from a `<meta>` tag / query param if a cleaner toggle is preferred at implementation time.)

- [ ] **Step 2: Drive it with Playwright** — navigate to `http://localhost:8000/shop.html`, and walk the same checklist as Task 9 Step 3 through the actual browser: snapshot the page, try the wrong code word (assert order controls still absent on the Member card), enter `RSMC2019` (assert controls appear), add a Family shirt + a Member hoodie to the cart (assert both cart lines and the running total), switch delivery to "ship" with the address blank and submit (assert the on-screen error), fill the address and submit (assert the on-screen confirmation text includes an `RSMC-` order ref).

- [ ] **Step 3: Stop the local servers**

```bash
kill %1 %2
```

- [ ] **Step 4: Push the Worker repo and the site branch, open a PR for the site**

```bash
# Worker repo: no GitHub remote exists yet — ask Chris whether he wants one created (his repos are usually private under dysco54) before pushing; if yes, create it and push, if not, leave it local per the DEPLOYED_URL.txt record from Task 7.

cd /home/chris/projects/rustnutssmc
git push -u origin shop-update
gh pr create --title "Shop: data-driven ordering, code-word gate, order emails" --body "Implements the shop update spec — see docs/superpowers/plans/2026-09-21-shop-order-system.md for the full plan and the Worker repo (~/rustnuts-shop-worker, deployed separately) for the order backend."
```

Do not push to `main` directly or merge the PR — stop here and let Chris review, per the repo being a live public site.
