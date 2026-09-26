# Jotform Order Form Migration Implementation Plan (v2 — Product List cart)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This is a full rewrite of the original Tasks 1-7 (the field-split/conditional-logic design) — that design is abandoned, see the spec's "Superseded" section. Tasks 8-11 are carried over with light edits.

**Goal:** Replace the Rustnuts SMC merch order form entirely — move it off Tally onto a proper cart-style Jotform App, keep the buyer-facing website's "Order this design" button working the same way, and re-point the two live Make.com automation scenarios at the new platform.

**Architecture:** A single Jotform **App** (not a plain Form) with 2 pages — "Club" (Member + Family) and "Public" (Better with you in it! + R U OK Rustnuts) — each holding one **Product List** element with that page's full garment catalog (name, price, Size option, Colour option). This eliminates conditional logic entirely: gating is "which page has this product," not "which rule shows this field." A built-in Contact Information page collects buyer details. Checkout uses Jotform's auto-generated checkout form. Total: 3 forms (2 Product Lists + 1 checkout), well under the account's 5-form free-tier cap (confirmed live, see spec).

**Tech Stack:** Jotform Apps' native builder UI (via Playwright, already authenticated) for anything the API doesn't reach — verify API reach before assuming UI-only, same discipline as the rest of this project. Node.js (built-in `fetch`) for any part of the build the API does support. Vanilla JS (existing `shop.html`/`shop/catalog.js` style) for the website side. Make.com (existing scenarios).

**Spec:** `docs/superpowers/specs/2026-09-26-jotform-order-form.md`

## Global Constraints

- Jotform API key lives in the environment as `JOTFORM_API_KEY` — never hardcode it in a committed file.
- This account is capped at **5 forms total** on the free plan. Every Product List element secretly creates its own backing form (and the first one on an app auto-provisions one shared checkout form too). **Confirmed (Task 1): `GET /user/usage` and `GET /user/forms` do NOT surface Jotform Apps' backing forms at all** — both still reported 0 even with 3 real `ENABLED` forms existing. Do not use those endpoints to check the cap. Instead, check cap usage by directly `GET`-ing each known form id from `scripts/jotform/app-manifest.json` (and any other app's ids if one exists) and counting non-`DELETED` results. Current confirmed budget after Task 1: 3 forms used (`clubProductListFormId`, `publicProductListFormId`, `checkoutFormId` — see manifest), 2 forms of headroom. Note the checkout form is **shared across both pages**, not one per page.
- A leftover "Clothing Store App" shell (portal id `262681670954871`) from earlier exploration still exists in My Apps — its backing forms were already deleted, but the app wrapper itself wasn't (no working delete endpoint found for it). It shouldn't consume form-cap budget on its own (it has no products/forms left), but be aware it exists — don't confuse it with the real app (`262681900691865`) when checking My Apps in the UI.
- Do not assume Jotform Apps has no API surface just because the `/app/{id}` DELETE endpoint 404'd (confirmed this session — that only proves DELETE isn't at that path, not that nothing is). Check `GET /app/{id}` and look for a PATCH/PUT before concluding UI-only work is required for any given piece (page creation, product list population, etc.) — verify each one, don't blanket-assume.
- Never reintroduce per-option conditional visibility (inside one field, or one Product List) — that's the exact bug class this whole migration exists to escape. The 2-page split is the gating mechanism; do not try to make it 4-way-precise with conditional rules layered on top without discussing it with Chris first (see spec's accepted trade-off).
- Make.com scenario edits: read `rustnutssmc-order-automation-make.md` (memory file) for the current, correct architecture before changing anything.
- Do not touch the live Tally form (`PdoLpe`) — leave it exactly as-is until the Jotform replacement is verified end-to-end.
- All local file work happens in this worktree (`C:\Users\dyson\repos\rustnutssmc\.claude\worktrees\youth-infant-garments`) — not the stale plain checkout.
- Delete any throwaway/test forms or apps immediately after use (`DELETE /form/{id}`) — this account's 5-form cap makes clutter expensive.

## Review Focus

- **A buyer orders a Youth/Kids/Infant or Hi-Vis product but the Colour option list shown doesn't make sense for it** (e.g. a Hi-Vis-colour choice appearing on a plain t-shirt) — the spec's per-product Colour setup needs checking product-by-product, not just once. Pinned in Task 3.
- **The 5-form cap gets silently exceeded mid-build** (e.g. a mis-click creates an extra Product List, or the checkout form gets duplicated) — must be checked via API after every creation step, not assumed. Pinned in Tasks 2 and 3.
- **A submission's product/variant data doesn't map cleanly to what Make.com's existing formulas expect** (they were built around Tally's flat per-item field shape) — must be checked against a real test order's actual submission JSON before assuming the re-map is straightforward. Pinned in Task 9.
- **The Club page's code-word gate is assumed to live inside Jotform but actually needs to stay a website-side gate** — confirm the website still shows/hides the "Order" link to the Club page based on the code word client-side, exactly as today, and that nothing in this migration accidentally exposes a direct Club-page link with no gate at all. Pinned in Task 6.
- **Price mismatch from the cents→dollars conversion** (`catalog.js` stores prices in integer cents, Jotform's Product List price field is decimal dollars) — an off-by-100 error here would silently overcharge or undercharge every order. Pinned in Task 2.

## Parallelization Map

- **Start immediately:** Task 1 (App + page scaffold), independent research groundwork.
- **After Task 1:** Task 2 (Club page Product List) and Task 3 (Public page Product List) — these can run in parallel to each other, they touch different pages.
- **After Tasks 2 + 3:** Task 4 (live verification of the app alone).
- **Independent, run anytime:** Task 5 (Tally reference cleanup — already done, see note in Task 5), Task 8's memory-file already-completed prefill research is now partially obsolete (see Task 6 note).
- **After Task 4:** Task 6 (`shop.html` integration).
- **After Task 4 + Task 6:** Task 7 (Contact Information page + checkout verification).
- **After Task 4 (app verified) + Task 6 (site wired up):** Task 9, Task 10 (Make.com re-mapping — parallel to each other).
- **Last:** Task 11 (full live smoke test).

---

## Task 1: Jotform App scaffold — 2 pages, empty Product Lists

**Files:**
- Create: `scripts/jotform/app-manifest.json` (records the app id, page ids, and Product List/form ids — every later task reads this)

**Interfaces:**
- Produces: `app-manifest.json` — `{ appId, pages: { club: { pageId, productListFormId }, public: { pageId, productListFormId } }, checkoutFormId }`. Every later task in this rewrite reads this file.

- [ ] **Step 1: Check current form usage before creating anything**

```bash
curl -s "https://api.jotform.com/user/usage?apiKey=$JOTFORM_API_KEY"
curl -s "https://api.jotform.com/user/forms?apiKey=$JOTFORM_API_KEY&limit=50" | grep -o '"status":"[A-Z]*"' | sort | uniq -c
```

Confirm 0 non-`DELETED` forms exist before proceeding (the session's test app and skeleton form were already deleted — verify this is still true, someone else may have created something since).

- [ ] **Step 2: Research whether app/page/Product-List creation is reachable via API**

Try, in order, before falling back to UI: `GET https://api.jotform.com/app/{any-existing-app-id-if-one-exists}` (if 404 or unauthorized, note it), search Jotform's docs for "Jotform Apps API" / "portal API" (the internal JSON blob seen this session referenced `window.__portalTableData` and `appInfo` — "portal" may be the internal name for what the UI calls an "App"; search for a `/portal` endpoint). If a working create/edit endpoint is found, use it for Steps 3-4 below instead of the UI and document the exact shape you used. If nothing is found within a reasonable effort (don't burn more than ~15 minutes on this before falling back), proceed with the native UI via Playwright (already authenticated — reuse the existing Jotform tab, or open a fresh one) and note in your report that Apps API access is not available so the following tasks know to expect UI-only work.

- [ ] **Step 3: Create the app** — name it "Rustnuts SMC Merch Order", with exactly 2 pages: "Club" and "Public". Delete any other default pages the template/wizard adds (e.g. a default "Our Location"/appointment page) — those count toward nothing useful and add clutter.

- [ ] **Step 4: Add one empty Product List element to each page**, titled "Garments" (or similar) — don't populate products yet, that's Tasks 2 and 3.

- [ ] **Step 5: Record everything in `app-manifest.json`** — the app id, each page's id, and (critically) the hidden backing form id for each Product List (visible in the app's own JSON state, e.g. via the same `window.__appInfo` inspection technique used during this session's investigation — check `items[].formID` for each `PRODUCT_LIST` entry).

- [ ] **Step 6: Verify form count is now exactly 2** (the two Product List backing forms) via the same usage check as Step 1. If it's higher, something extra got created — find and delete it before continuing.

- [ ] **Step 7: Commit**

```bash
git add scripts/jotform/app-manifest.json
git commit -m "feat: scaffold Jotform App with Club/Public pages and empty Product Lists"
```

---

## Task 2: Club page — populate Product List (Member + Family garments)

**Files:**
- Create: `scripts/jotform/populate-club.mjs` (if API reach was confirmed in Task 1) — otherwise this task is UI-only, record what you did in your report instead of a script.

**Interfaces:**
- Consumes: `app-manifest.json` (`pages.club.productListFormId`).
- Produces: the Club Product List fully populated. No file interface for later tasks — Task 6 only needs to know the app's public URL and page name, not individual product ids.

- [x] **Step 1: Read `shop/catalog.js` in full** in this worktree to get the exact current Member/Family garment data (`GARMENTS` + `YOUTH_INFANT_GARMENTS`, both merged into `FAMILY_GARMENTS`).

- [x] **Step 2: Add all 20 garments** (12 standard + 8 Youth/Kids/Infant) to the Club Product List:
  - Name: use `catalog.js`'s `label` (not `tallyLabel` — that was a Tally-specific matching key, not needed in this architecture; e.g. "Classic Tee", "Youth Long Sleeve").
  - Price: `catalog.js` stores price in **integer cents** (e.g. `3500` = $35.00) — convert to decimal dollars for Jotform's price field (`3500 / 100 = 35.00`). Get this right per the Review Focus item — spot check at least 3 conversions against the spec's dollar amounts before doing all 20.
  - Add a **Size** option per product with values from that garment's `sizes` array in `catalog.js` (e.g. `RANGE_XS_3XL` → `XS, S, M, L, XL, 2XL, 3XL`; `RANGE_YOUTH` → `8, 10, 12, 14, 16`, etc. — use the exact array for that specific garment, they differ).
  - Add a **Colour** option with a single value `Black` on every product (Club page is Black-only per spec).

- [x] **Step 3: Verify count and a few spot-checks** — re-fetch the app's product data (via whatever method Task 1 found — API read or a fresh page-load JSON inspection) and confirm exactly 20 products exist with correct names/prices/size lists.

- [x] **Step 4: Commit** (if a script was used) or note in your report the manual steps taken (if UI-only).

**Result (2026-09-26):** Done via script-based API write (`scripts/jotform/build-club-products.mjs` + `push-club-products.mjs` + `verify-club-products.mjs`), same indexed-field POST pattern as Task 3, after hitting the same shared-editor UI collision documented in Task 3. Fresh GET confirmed 20/20 correct. Committed `6c7a73f`.

---

## Task 3: Public page — populate Product List (Supporter + R U OK garments)

**Files:** Same pattern as Task 2, for the Public page.

**Interfaces:**
- Consumes: `app-manifest.json` (`pages.public.productListFormId`).

- [x] **Step 1: Read `shop/catalog.js`** for the Supporter (`SUPPORTER_GARMENTS` = `GARMENTS` + `HIVIS_GARMENTS`) and R U OK (`GARMENTS`) data.

- [x] **Step 2: Add 13 products** (the 12 standard garments, same as Club, plus the Hi-Vis Tee):
  - Same Name/Price/Size conversion discipline as Task 2.
  - **Colour option**: add `Black` and `Grey` to all 13 products. For the Hi-Vis Tee specifically, also add `Hi-Vis` as a third colour value. (Per the spec: R U OK buyers technically seeing a `Hi-Vis` colour option on the Hi-Vis Tee product is fine — R U OK buyers just wouldn't order that product in the first place; the option list doesn't need to be per-Design-precise, that's the accepted trade-off.)

- [x] **Step 3: Verify count and spot-check**, same as Task 2 Step 3 — expect 13 products.

- [x] **Step 4: Check total form count is still exactly 3** (2 Product Lists + eventual checkout — checkout may not exist yet until a product is actually orderable end to end, check via usage endpoint).

- [x] **Step 5: Commit / report**, same pattern as Task 2.

---

## Task 4: Live verification of the app alone (no website/Make involved)

**Files:** None — verification only.

**Interfaces:**
- Consumes: Tasks 1-3 complete.

- [x] **Step 1:** Open the live published app fresh (new tab, no reused state). Confirm the Club page shows exactly its 20 products with correct prices, and the Public page shows exactly its 13 products with correct prices.

- [x] **Step 2:** On each page, pick 2-3 products, add to cart with different Size/Colour combinations, and confirm the cart total calculates correctly (price × quantity, summed across items).

- [x] **Step 3:** Complete one full test checkout (real submission) to confirm the checkout flow works end to end and produces a real Order record. Note the checkout form id / Orders table id that appears (needed for Task 9).

- [x] **Step 4:** Delete the test order/submission so it doesn't pollute real data (check both the checkout form's submissions and the Orders data table).

**Result (2026-09-26):** All 4 steps pass. Opened `https://www.jotform.com/app/262681900691865` in a fresh Playwright tab reusing the already-authenticated Jotform browser session (a true logged-out/incognito check wasn't run — noted as a caveat, not verified independently). Club page (`/page/0`) confirmed 20/20 products, Public page (`/page/1`) confirmed 13/13 — every name and price matched `shop/catalog.js` price-in-cents/100 exactly. Added 3 items to cart across both pages with different Size/Colour combos (Hi-Vis Tee XL/Hi-Vis $27, Classic Tee M/Grey $35, Low Down Singlet S/Black $30) — cart total summed correctly to $92.00 for 3 items at every step (2-item and 3-item subtotals both checked). Confirmed the Hi-Vis Tee's Colour dropdown shows exactly Black/Grey/Hi-Vis (3 options) and every other product checked (Classic Tee) shows only Black/Grey (2 options, no Hi-Vis leak). No quantity stepper was found in the product dialog or cart UI — each "Add to Cart" click creates one line item at qty 1; incrementing an existing line's quantity wasn't tested and may need a follow-up check before Make.com assumes a `quantity` field varies per line (the real submission JSON does contain a `"quantity":1` key per item, so the field exists, just wasn't exercised at qty>1). Completed one real test checkout (name "TEST DELETE ME", email `test-delete-me@rustnutssmc.invalid`) — checkout succeeded ("We've received your order!"). Test submission id `6662220538992117805` on checkout form `262682306434053`, Jotform order id `01a0dcec16d8700082e93b7b4585084e2ef4`, status `PAID`/`orderreceived`. Deleted via `DELETE /submission/6662220538992117805` — confirmed gone via a fresh `GET .../submissions` (0 active) and `GET /user/portals` (`portalSubmissions` back to 0 for this app — the only "Orders" surface found; there is no separate Jotform Orders table distinct from this form's submissions). Final cap check: all 3 manifest form ids (`262682106860054`, `262681878015061`, `262682306434053`) still `ENABLED` via direct `GET /form/{id}/properties` — no extra forms created.

## Task 5: Tally reference cleanup — status check only

Already completed earlier this session (see prior agent report): grep run, confirmed every remaining Tally reference in `shop.html`/`shop/catalog.js` is load-bearing to the current embed (owned by Task 6 below), nothing else needed cleanup. **No new work here** — Task 6 will naturally remove the load-bearing Tally code as part of replacing it. Skip this task; it's listed only so the task numbering matches prior history in commit messages.

---

## Task 6: `shop.html` — replace Tally embed with a link to the Jotform App

**Files:**
- Modify: `shop.html`

**Interfaces:**
- Consumes: Task 1's `app-manifest.json` (app's public URL / page identifiers).

**Note on prefill:** the earlier field-based prefill research (query param = field's Unique Name) is **not directly applicable** to a Product List cart — there's no single "garment field" to prefill anymore, since garments are cart items a buyer adds themselves by browsing the page. Simplify: the website's job is now just to send the buyer to the **correct page** (Club or Public) for the design they clicked, not to prefill a specific garment/size/colour. Check whether Jotform Apps supports deep-linking to a specific page via URL (e.g. `?page=club` or similar) — verify live, don't assume — and if not, linking to the app's root and letting the buyer pick their own page (with the site's own Design cards still doing the "browse by category" job visually) is an acceptable fallback; note whichever is true in your report.

- [ ] **Step 1: Read the current `openTallyFor` function and its call site in `shop.html` in full.**

- [ ] **Step 2: Replace it** with a much simpler function/link that sends the buyer to the app, targeting the Club or Public page based on `design.gated` (confirmed in the spec: `gated: true` → Club, `gated: false` → Public — verify this still holds for all 4 `CATALOG` entries before relying on it).

- [ ] **Step 3: Keep the existing code-word gate exactly as it is** (Review Focus item) — it should still control whether the "Order" action/link for Member/Family designs is shown at all, client-side, same as today. Don't let this migration accidentally remove or bypass it.

- [ ] **Step 4: Manual browser check** — confirm the "Order this design" button/link looks the same as before and correctly routes to Club vs Public per design.

- [ ] **Step 5: Commit**

```bash
git add shop.html
git commit -m "feat: replace Tally embed with a link to the Jotform Club/Public order app"
```

---

## Task 7: Contact Information page + checkout field parity check

**Files:** None local — Jotform App configuration.

**Interfaces:**
- Consumes: Task 4 (app verified).

- [ ] **Step 1: Read the live Tally form's remaining end-of-form fields once** (read-only API call to `PdoLpe`, it's still published and untouched) — get the exact field list/requiredness for full name, contact info, delivery choice, club code word, etc.

- [ ] **Step 2: Configure Jotform's built-in Contact Information page** to match, adding any fields it doesn't already cover.

- [ ] **Step 3: Verify live** — complete one more test checkout including these fields, confirm every field is captured in the resulting submission/Order record, then delete the test data.

---

## Task 8: Make.com — re-point "Rustnuts Merch Order Intake" (7522707) at Jotform

**Files:** None local — Make.com scenario, edited via `PATCH https://eu1.make.com/api/v2/scenarios/7522707` (confirmed region: **eu1**, not us2/us — verified live this session via the authenticated Make dashboard URL) with body `{blueprint: JSON.stringify(blueprintObject)}`, or via Make's web UI (already authenticated in a dedicated Playwright tab).

**Interfaces:**
- Consumes: Task 4/7's confirmed order/submission shape (exact field names/values as they appear in a real Jotform Order), the app/checkout form id(s).

- [ ] **Step 1: Read `rustnutssmc-order-automation-make.md` (memory file) in full** for the current scenario architecture.

- [ ] **Step 2: Fetch the current blueprint** (`GET /api/v2/scenarios/7522707/blueprint`) and identify every module that reads a Tally-specific field/webhook shape.

- [ ] **Step 3: Set up a Jotform webhook trigger** pointed at the checkout form / Orders table from Task 4/7, replacing the Tally webhook module. Jotform's cart-order payload shape (line items, variants) is structurally different from Tally's flat per-item fields — re-derive every downstream module's field references from a real test order's actual webhook payload, not by guessing at the old Tally-shaped formulas.

- [ ] **Step 4: Submit one real test order** through the live website → Jotform flow with the webhook connected, and confirm the scenario runs end-to-end matching pre-migration behavior (invoice, Drive folder, Resend email).

- [ ] **Step 5: Update `rustnutssmc-order-automation-make.md`** with the new Jotform-based field mappings.

---

## Task 9: Make.com — re-point "Rustnuts Reminder 1 (Monday)" (7536417) at Jotform

**Files:** None local — same editing pattern as Task 8.

**Interfaces:**
- Consumes: same as Task 8, plus Task 8's completed re-mapping if this scenario reads from the Data Store the intake scenario writes (check this dependency first — memory file should say).

- [ ] **Step 1: Read `rustnutssmc-order-automation-make.md`** for this scenario's architecture.

- [ ] **Step 2: Confirm whether this scenario reads Tally/Jotform data directly or only via Make's own Data Store.** If Data Store only, and Task 8 preserves that Data Store's record shape, this task reduces to a smoke test.

- [ ] **Step 3: If it reads platform-specific fields directly, re-map them** following Task 8 Step 3's pattern.

- [ ] **Step 4: Verify** by running the scenario manually against a real test order from Task 8, confirming Supplier PO / Receipt generation still fires correctly for a Paid order.

---

## Task 10: Full live smoke test

**Files:** None — verification only.

**Interfaces:**
- Consumes: everything (Tasks 1-9 complete).

- [ ] **Step 1:** From the live website, click "Order this design" for a Member/Family design and a Supporter/RUOK design, landing on the Club and Public pages respectively, and complete a real order on each (including at least one Youth/Kids/Infant item on Club and the Hi-Vis Tee on Public).

- [ ] **Step 2:** Confirm each order flows correctly through Jotform → Make.com intake scenario → correct invoice + Drive filing + buyer/owner emails.

- [ ] **Step 3:** Mark one test order "Paid" and confirm the Monday scenario would generate its Supplier PO + Receipt correctly (run manually rather than waiting for Monday).

- [ ] **Step 4:** Clean up all test submissions/orders (delete test Jotform data; note any test Drive files/emails to Chris for manual cleanup since those can't be un-sent).

- [ ] **Step 5:** Update `rustnutssmc-jotform-pivot.md` (memory) marking the migration complete, with the final app URL and a one-line pointer to `scripts/jotform/`.
