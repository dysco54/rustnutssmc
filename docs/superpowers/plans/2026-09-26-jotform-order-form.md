# Jotform Order Form Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Several tasks in this plan are independent of each other (see the Parallelization Map below the header) — when running multiple agents at once, only ever start a task whose `Consumes` are already satisfied.

**Goal:** Replace the Rustnuts SMC merch order form entirely — move it off Tally onto Jotform, keep the buyer-facing website unchanged in appearance, and re-point the two live Make.com automation scenarios at the new platform — without losing any of the working business logic (invoicing, Drive filing, weekly PO/receipt batching).

**Architecture:** Build the Jotform form's field/question skeleton via Jotform's REST API (confirmed to support question creation/editing) for all 9 "Item" groups in one script run. Build every conditional-logic rule (Design→show/hide fields) through Jotform's native editor UI, since Jotform's API is confirmed unable to write conditions. Update `shop/catalog.js` to tag each garment with which of the 3 new Jotform Garment fields it belongs to, and rewrite `shop.html`'s order-button/prefill logic to target Jotform instead of Tally. Re-map Make.com scenarios `7522707` and `7536417` from Tally's submission shape to Jotform's.

**Tech Stack:** Node.js (built-in `fetch`, no dependencies) for the Jotform API build script; Jotform's native form-builder UI (via claude-in-chrome) for conditional logic; vanilla JS (existing `shop.html`/`shop/catalog.js` style — ES modules, no bundler, no framework); Make.com (existing scenarios, edited via their web UI or the `PATCH /api/v2/scenarios/{id}` endpoint for blueprint changes — see Global Constraints).

**Spec:** `docs/superpowers/specs/2026-09-26-jotform-order-form.md`

## Global Constraints

- Jotform API key lives in the environment as `JOTFORM_API_KEY` — never hardcode it in a committed file. Pass it via `JOTFORM_API_KEY=xxx node scripts/jotform/build.mjs`.
- Jotform's REST API **cannot** write conditional logic (confirmed via Jotform's own support answers). Every task that involves a show/hide rule must use claude-in-chrome against the live editor UI, never a raw API call.
- Never guess an unfamiliar platform's request/response shape — verify with one small live call and read the actual response before building the full script (see Task 1 Step 1). This project has already been burned twice tonight by assuming a no-code platform's data model instead of checking it.
- `garment.tallyLabel` in `shop/catalog.js` must byte-match the live Jotform option text exactly, same discipline as the old Tally runbook (`rustnutssmc-tally-website-howto.md`) — a silent mismatch breaks prefill with no visible error. Rename `tallyLabel` → keep the same property name for now (used pervasively) unless a task explicitly renames it; do not introduce a second parallel property that drifts out of sync.
- Never attempt per-option show/hide inside one shared field again (garment OR colour) — this is the exact bug class that killed the Tally build. Every gating rule targets a whole field.
- Make.com scenario edits: read `rustnutssmc-order-automation-make.md` (memory file) for the current, correct architecture (module numbers, Drive folder IDs, the Monday scenario's structure) before changing anything — the business logic in these scenarios is correct and working; only the data-source field bindings change.
- Do not touch the live Tally form (`PdoLpe`) during this migration — leave it exactly as-is (still published, unpublished draft changes abandoned) until the Jotform replacement is verified end-to-end. Do not delete or unpublish it as part of this plan.
- All local file work happens in this worktree (`C:\Users\dyson\repos\rustnutssmc\.claude\worktrees\youth-infant-garments`) — do not edit `C:\Users\dyson\repos\rustnutssmc\shop\catalog.js` directly, it's a stale checkout (10 commits behind).

## Review Focus

- **A buyer picks a Design, the site prefills Jotform, but the field the prefill targets is conditionally hidden at page-load time because Jotform hasn't yet evaluated the also-arriving `design` param** — untested territory (today there's only ever one always-relevant Garment field; the 3-way split introduces a real race between "field prefilled" and "field's visibility resolved"). Pinned in Task 7.
- **Two garments with visually-similar names across the standard/YKI split** (e.g. a future new "AS Kids Classic Tee" added without a family tag) silently defaulting to the wrong one of the 3 Jotform fields. Pinned in Task 5 (require `family` on every entry, no default fallback).
- **A submission where "Add another item?" = Yes but the revealed item's Design is left blank** — must not crash the Make.com formulas that extract Design text per item (existing `substring`/`indexOf` formula pattern assumes a non-empty value). Pinned in Task 9.
- **Item order/numbering drift**: Jotform's question `order` property must keep all 9 items' fields in the same relative sequence as today, or Make's per-item field-position assumptions (if any) break silently. Pinned in Task 1.
- **A Grey or Hi-Vis colour answer surviving on an item after the buyer changes Design back to Member/Family** (stale answer from a previously-visible field, same class of bug flagged in the original 2026-09-21 shop-order-system plan's Review Focus for shipping address). Pinned in Task 3's verification steps.

## Parallelization Map

Run these as separate agents once their `Consumes` are satisfied — this is the answer to "get as many agents working on individual parts via API":

- **Start immediately, fully independent:** Task 1 (Jotform skeleton build), Task 5 (`catalog.js` family tags), Task 6 (Jotform prefill-URL research).
- **After Task 1:** Task 2 (Colour field research + build — appends to the same form Task 1 created).
- **After Tasks 1 + 2:** Task 3 (conditional logic UI build, all 9 items).
- **After Task 3:** Task 4 (live end-to-end verification of the Jotform form alone).
- **After Tasks 1, 2, 5, 6:** Task 7 (`shop.html` integration).
- **Independent, run anytime:** Task 8 (delete Tally remnants from the repo).
- **After Task 4 (form verified) + Task 7 (site wired up):** Task 9, Task 10 (Make.com re-mapping — these two can run in parallel to each other).
- **Last, after everything:** Task 11 (full live smoke test).

---

## Task 1: Jotform field skeleton — all 9 items, via API

**Files:**
- Create: `scripts/jotform/build-form.mjs`
- Create: `scripts/jotform/field-manifest.json` (generated output, commit it — it's the source of truth for field IDs consumed by later tasks)

**Interfaces:**
- Produces: `field-manifest.json` — `{ formId: string, items: [{ item: 1, fields: { design: {qid, name}, garmentStandard: {qid, name, optionQids: {...}}, garmentYki: {...}, garmentHivis: {...}, size: {qid, name}, quantity: {qid, name}, addAnother: {qid, name, yesOptionValue, noOptionValue} } }, ...] }`. Every later task (2, 3, 6, 7, 9, 10) reads this file — do not rename its top-level keys without updating every consumer.

- [ ] **Step 1: Verify Jotform's question-creation API shape with one throwaway call before building anything else**

```bash
JOTFORM_API_KEY=xxx node -e '
const key = process.env.JOTFORM_API_KEY;
const form = await (await fetch(`https://api.jotform.com/user/forms?apiKey=${key}`, {
  method: "POST",
  headers: {"content-type":"application/x-www-form-urlencoded"},
  body: "properties[title]=API Shape Test - Safe To Delete",
})).json();
console.log("form:", JSON.stringify(form.content));
const q = await (await fetch(`https://api.jotform.com/form/${form.content.id}/questions?apiKey=${key}`, {
  method: "POST",
  headers: {"content-type":"application/x-www-form-urlencoded"},
  body: new URLSearchParams({
    "question[type]": "control_dropdown",
    "question[text]": "Test Dropdown",
    "question[order]": "1",
    "question[name]": "testDropdown",
    "question[options]": "OptionA|OptionB|OptionC",
  }),
})).json();
console.log("question create response:", JSON.stringify(q));
const readBack = await (await fetch(`https://api.jotform.com/form/${form.content.id}/questions?apiKey=${key}`)).json();
console.log("read-back shape:", JSON.stringify(readBack.content));
await fetch(`https://api.jotform.com/form/${form.content.id}?apiKey=${key}`, {method:"DELETE"});
'
```

Read the actual output. Confirm: (a) the question object's id field name (likely `qid` inside `readBack.content`, keyed by qid as the object key — confirm the exact shape, don't assume), (b) whether `options` round-trips as a pipe-delimited string or gets normalized to something else, (c) whether a dropdown option's individual identity (for later prefill/conditional-logic targeting) is the option's text itself or a separate id. If any of this differs from what Step 2 below assumes, adjust Step 2 before running it for real — do not run the full 9-item build against unverified assumptions.

- [ ] **Step 2: Write `build-form.mjs`**

```js
// scripts/jotform/build-form.mjs
const KEY = process.env.JOTFORM_API_KEY;
if (!KEY) throw new Error('Set JOTFORM_API_KEY');
const BASE = 'https://api.jotform.com';

async function jf(path, opts = {}) {
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}apiKey=${KEY}`;
  const res = await fetch(url, opts);
  const json = await res.json();
  if (json.responseCode !== 200) throw new Error(`Jotform API error on ${path}: ${JSON.stringify(json)}`);
  return json.content;
}

function formEncode(obj) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) params.set(k, v);
  return params.toString();
}

const STANDARD_GARMENTS = [
  'AS Colour Classic Tee — $35 (XS–3XL)',
  'AS Colour Low Down Singlet — $30 (S–3XL)',
  'AS Colour Made Hood — $60 (S–3XL)',
  'AS Colour Made Crew — $60 (S–3XL)',
  'AS Colour Stencil Hood — $55 (XS–5XL)',
  'AS Colour Zip Hood — $60 (XS–3XL)',
  'AS Colour Stencil Crew — $55 (XS–3XL)',
  'AS Colour Heavy Tee — $40 (XS–3XL)',
  'AS Colour Classic L/S Tee — $40 (XS–3XL)',
  'AS Colour Barnard Tank — $30 (XS–3XL)',
  "AS Colour Women's Classic Tee — $35 (XS–3XL)",
  "AS Colour Women's Classic L/S Tee — $40 (XS–3XL)",
];
const YKI_GARMENTS = [
  'AS Youth Long Sleeve — $26.50 (8–16)',
  'AS Youth Supply Crew — $29.50 (8–16)',
  'AS Youth Supply Hood — $36.50 (8–16)',
  'AS Kids Supply Hood — $36.50 (2–6)',
  'AS Kids Supply Crew — $29.50 (2–6)',
  'AS Kids Long Sleeve — $26.50 (2–6)',
  'AS Infant One Piece — $24.40 (0-3m–18-24m)',
  'AS Infant Tee — $22.50 (0-3m–18-24m)',
];
const HIVIS_GARMENTS = ["JB's Wear 6HVT Hi-Vis Tee — $27.00 (XS–3XL)"];
const DESIGNS = ['Member', 'Family', 'Better with you in it!', 'R U OK Rustnuts'];

async function addQuestion(formId, order, type, text, name, options) {
  const body = {
    'question[type]': type,
    'question[text]': text,
    'question[order]': String(order),
    'question[name]': name,
  };
  if (options) body['question[options]'] = options.join('|');
  const created = await jf(`/form/${formId}/questions`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: formEncode(body),
  });
  // NOTE: adjust this line if Step 1's verification found a different response shape
  const qid = Object.keys(created)[0];
  return { qid, name };
}

async function main() {
  const form = await jf('/user/forms', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: formEncode({ 'properties[title]': 'Rustnuts SMC Merch Order' }),
  });
  const formId = form.id;
  const items = [];
  let order = 1;

  for (let i = 1; i <= 9; i++) {
    const design = await addQuestion(formId, order++, 'control_dropdown', `Design (Item ${i})`, `design${i}`, DESIGNS);
    const garmentStandard = await addQuestion(formId, order++, 'control_dropdown', `Garment (Item ${i})`, `garment${i}`, STANDARD_GARMENTS);
    const garmentYki = await addQuestion(formId, order++, 'control_dropdown', `Garment – Youth/Kids/Infant (Item ${i})`, `garmentYki${i}`, YKI_GARMENTS);
    const garmentHivis = await addQuestion(formId, order++, 'control_dropdown', `Garment – Hi-Vis (Item ${i})`, `garmentHivis${i}`, HIVIS_GARMENTS);
    const size = await addQuestion(formId, order++, 'control_textbox', `Size (Item ${i})`, `size${i}`);
    const quantity = await addQuestion(formId, order++, 'control_number', `Quantity (Item ${i})`, `quantity${i}`);
    const addAnother = i < 9
      ? await addQuestion(formId, order++, 'control_radio', 'Add another item?', `addAnother${i}`, ['Yes', 'No'])
      : null;
    items.push({ item: i, fields: { design, garmentStandard, garmentYki, garmentHivis, size, quantity, addAnother } });
    console.log(`Item ${i} skeleton built.`);
  }

  const manifest = { formId, items };
  await import('node:fs/promises').then(fs => fs.writeFile(
    new URL('./field-manifest.json', import.meta.url),
    JSON.stringify(manifest, null, 2)
  ));
  console.log(`Done. Form id ${formId}. Manifest written.`);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Run it**

```bash
JOTFORM_API_KEY=xxx node scripts/jotform/build-form.mjs
```

Expected: prints "Item N skeleton built." nine times, then "Done." with a form id.

- [ ] **Step 4: Verify via API read**

```bash
curl -s "https://api.jotform.com/form/<formId>/questions?apiKey=$JOTFORM_API_KEY" | node -e 'process.stdin.pipe(require("stream").Writable({write(c,e,cb){process.stdout.write(c);cb()}}))' | head -c 400
```

Confirm the count of questions matches `9 items × (1 design + 3 garment + 1 size + 1 quantity + up to 1 addAnother) = 9×6 + 8 = 62` questions, and spot-check 2-3 option lists against the spec's verbatim text.

- [ ] **Step 5: Commit**

```bash
git add scripts/jotform/build-form.mjs scripts/jotform/field-manifest.json
git commit -m "feat: build Jotform order form field skeleton for all 9 items via API"
```

---

## Task 2: Colour field — research + build

**Files:**
- Modify: `scripts/jotform/build-form.mjs` (or a new sibling script `scripts/jotform/build-colour.mjs` appending to the existing form — either is fine, keep it simple)
- Modify: `scripts/jotform/field-manifest.json` (add a `colour` entry per item)

**Interfaces:**
- Consumes: `field-manifest.json` (`formId` from Task 1).
- Produces: updated manifest with `items[i].fields.colour` (and, depending on the research outcome below, possibly `colourExtended` — name it whatever the chosen approach needs, but document the final shape in this task's own commit message since Task 3 and Task 7 both read it).

- [ ] **Step 1: Research whether Jotform conditional logic can show/hide individual answer choices within one field, or only whole fields**

Check Jotform's help docs (search "jotform conditional logic show hide specific choice" / "jotform hide answer option") and, if genuinely ambiguous from docs alone, test it directly in a scratch form via the native UI (claude-in-chrome): create a 3-option dropdown, open the conditional logic builder, and check whether the action list offers "hide this specific choice" or only "show/hide this field."

- [ ] **Step 2: Implement Colour per the research finding**

If per-choice hiding IS available and reliable: add one `Colour (Item N)` dropdown per item with options `Black`, `Grey`, `Hi-Vis`, gated per-choice (Black always on; Grey shown for Better/RUOK; Hi-Vis shown only for Better). This is the simpler path — only 3 options, much lower risk than the 21-option Tally dropdown that broke.

If per-choice hiding is NOT available (only whole-field show/hide, matching Garment's architecture): split into `Colour (Item N)` (Black only, always visible — covers Member/Family) and `Colour – Extended (Item N)` (Black, Grey, Hi-Vis — visible only for Better/RUOK; note RUOK should never actually select Hi-Vis since it has no Hi-Vis garment, but leaving the option present and simply unused by RUOK buyers is acceptable — do not build a 3rd colour field just to exclude one option from one design).

Either way, add the corresponding question(s) via the API script (same `addQuestion` helper from Task 1), append to `field-manifest.json`.

- [ ] **Step 3: Run and verify via API read, same pattern as Task 1 Step 4.**

- [ ] **Step 4: Commit**

```bash
git add scripts/jotform/build-form.mjs scripts/jotform/build-colour.mjs scripts/jotform/field-manifest.json
git commit -m "feat: build Jotform Colour field(s) for all 9 items"
```

---

## Task 3: Conditional logic — native UI build, all 9 items

**Files:** None (Jotform-hosted state only). Update memory file `C:\Users\dyson\.claude\projects\C--Users-dyson\memory\rustnutssmc-jotform-pivot.md` with the final rule list once done.

**Interfaces:**
- Consumes: `field-manifest.json` from Tasks 1 and 2 (`formId`, every item's field names/qids).

- [ ] **Step 1: Open the Jotform editor for `formId` via claude-in-chrome, native UI only (no API calls for this task).**

- [ ] **Step 2: For each item 1–9, build these rules using Jotform's conditional logic builder:**
  1. `Design (Item N) is Family` → Show `Garment – Youth/Kids/Infant (Item N)`.
  2. `Design (Item N) is Better with you in it! OR Design (Item N) is R U OK Rustnuts` → Show `Garment – Hi-Vis (Item N)`.
  3. Whatever Colour rule(s) Task 2 settled on (per-choice or whole-field — follow Task 2's committed approach exactly).
  4. `Add another item? (Item N) is Yes` → Show all of Item N+1's fields (for N < 9).

- [ ] **Step 3: Publish.**

- [ ] **Step 4: Live-verify every rule for every item before moving on** (this is the step that was skipped/rushed on Tally and caused the leak — do not skip it here):

For each item, open the live published form fresh (new tab, no reused state), and for each of the 4 Design values, confirm:
- The correct one of the 3 Garment fields is visible, the other 2 are not rendered at all (not just visually hidden — check via `read_page`/DOM inspection that the hidden ones aren't present, not just off-screen).
- The Colour field/options match the spec table in Task 2.
- Switching Design after answering Colour/Garment does not leave a stale answer visible (Review Focus item — re-select Design away from Family/Better and confirm the previously-shown field's answer is cleared, not just hidden with old data intact).

- [ ] **Step 5: Update the memory file with the final rule list and confirmation this is verified for all 9 items.**

---

## Task 4: End-to-end verification of the Jotform form alone (no website/Make involved yet)

**Files:** None — verification only.

**Interfaces:**
- Consumes: Tasks 1–3 complete and published.

- [ ] **Step 1:** Submit one full test order through the live Jotform form directly (not via the website), using 2+ items with different Designs, to confirm the whole chain (skeleton fields + colour + conditional logic + multi-item reveal) works end to end from a real buyer's perspective.

- [ ] **Step 2:** Fetch the submission via API (`GET /form/{formId}/submissions`) and confirm every answer landed in the field you expect, with the exact text needed for Make.com parsing later (Task 9).

- [ ] **Step 3:** Delete the test submission (`DELETE /submission/{id}`) so it doesn't pollute real order data.

---

## Task 5: `catalog.js` — add `family` tag to every garment

**Files:**
- Modify: `shop/catalog.js`

**Interfaces:**
- Produces: every entry in `GARMENTS`, `YOUTH_INFANT_GARMENTS`, `HIVIS_GARMENTS` gains a `family: 'standard' | 'yki' | 'hivis'` property. Consumed by Task 7.

- [ ] **Step 1: Read the current file in full** (`shop/catalog.js` in this worktree) to get exact current entries — do not retype from memory, copy the existing objects and add one property to each.

- [ ] **Step 2: Add the `family` property to each entry**, e.g.:

```js
const GARMENTS = {
  classicTee: { label: 'Classic Tee', tallyLabel: 'AS Colour Classic Tee — $35 (XS–3XL)', price: 3500, sizes: RANGE_XS_3XL, family: 'standard' },
  // ...same pattern for every entry in GARMENTS
};
const YOUTH_INFANT_GARMENTS = {
  youthLongSleeve: { label: 'Youth Long Sleeve', tallyLabel: 'AS Youth Long Sleeve — $26.50 (8–16)', price: 2650, sizes: RANGE_YOUTH, family: 'yki' },
  // ...same pattern for every entry in YOUTH_INFANT_GARMENTS
};
const HIVIS_GARMENTS = {
  jbsHiVisTee: { label: "JB's Wear 6HVT Hi-Vis Tee", tallyLabel: "JB's Wear 6HVT Hi-Vis Tee — $27.00 (XS–3XL)", price: 2700, sizes: RANGE_XS_3XL, family: 'hivis' },
};
```

Do not rename `tallyLabel` in this task — later tasks still read it by that name (renaming it is a separate, optional cleanup, out of scope here to keep this task's diff reviewable).

- [ ] **Step 3: Verify no entry is missing the tag**

```bash
node -e '
import("./shop/catalog.js").then(({CATALOG}) => {
  for (const design of CATALOG) {
    for (const [key, g] of Object.entries(design.garments)) {
      if (!g.family) throw new Error(`Missing family tag: ${design.id}.${key}`);
    }
  }
  console.log("All garments tagged.");
});
'
```

Expected: `All garments tagged.` with no thrown error.

- [ ] **Step 4: Commit**

```bash
git add shop/catalog.js
git commit -m "feat: tag every garment with its Jotform field family (standard/yki/hivis)"
```

---

## Task 6: Research Jotform's URL prefill mechanism

**Confirmed prefill convention (docs research 2026-09-26 — live verification still needed, see below):** The query key is the field's **"Unique Name"** (`https://www.jotform.com/help/71-prepopulating-fields-to-your-jotform-via-url-parameters/`, `.../146-how-to-find-field-ids-and-names/`): `?paramName=value` where `paramName` is that field's Unique Name, e.g. `?design1=Family`. This is a distinct concept from the API's `question[name]` property in the docs' own wording, but per a Jotform staff answer (`jotform.com/answers/3649651-api-and-unique-name-fields`), a field's Unique Name is *initialized from* whatever `question[name]` value is set at creation time and only drifts out of sync if someone later hand-edits the Unique Name in the builder UI — which nothing in this plan does. Since `build-form.mjs` explicitly sets `question[name]` (e.g. `design1`, `garment1`, `garmentYki1`, `garmentHivis1`, `size1`, `quantity1`) at creation, the Unique Name for every field should equal that same string, and Task 7 should be able to use `field-manifest.json`'s `name` values directly as prefill query keys. **Live-verified 2026-09-26** once Task 1's form existed (`formId` `262681787350870`): opened `https://form.jotform.com/262681787350870?design1=Family` in a fresh tab and confirmed the "Design (Item 1)" dropdown was prefilled/selected to "Family" (checked via `read_page` accessibility tree, not just visually). Confirms `question[name]` set at creation IS the prefill query key with no separate Unique Name to reconcile — Task 7 can use `field-manifest.json`'s `name` values directly.

**Files:** None — produces findings consumed by Task 7. Write findings as a short note at the top of Task 7's section in this plan file (edit this plan file in place) once found, so Task 7's implementer doesn't have to re-research.

**Interfaces:**
- Produces: the exact query-string convention Jotform uses to prefill a named field from a URL (consumed by Task 7).

- [ ] **Step 1:** Read Jotform's own docs/help center on form prefill (search "jotform prefill URL parameters", check `api.jotform.com/docs` and `jotform.com/help`). Confirm: does it use the question's `name` property directly as the query key (e.g. `?garment1=AS+Colour+Classic+Tee`), or does it require a different convention (e.g. `?submission[garment1]=...`, or a "unique name" distinct from `name`)? Quote the exact convention with a source link.

- [ ] **Step 2:** Test it live against the form built in Tasks 1-2: construct a URL with a guessed/documented prefill param for one known field (e.g. `design1`), open it in a fresh browser tab, and confirm the field actually shows the prefilled value. Do not trust docs alone — this project has been burned by platform docs not matching live behavior before.

- [ ] **Step 3:** Write the confirmed convention into this plan file under Task 7 (edit this file, add a "Confirmed prefill convention" note) before anyone starts Task 7.

---

## Task 7: `shop.html` — replace Tally embed/prefill with Jotform

**Files:**
- Modify: `shop.html`

**Interfaces:**
- Consumes: `field-manifest.json` (Tasks 1-2, for the Item-1 field names to prefill), `catalog.js`'s `garment.family` (Task 5), the confirmed prefill convention (Task 6).

- [ ] **Step 1: Read the current `openTallyFor` function and its call site in `shop.html` in full** (this worktree's copy) to get the exact current code before changing it.

- [ ] **Step 2: Replace the Tally-specific embed/prefill code.** The new function should build a Jotform embed URL (or Jotform's iframe embed pattern — check Jotform's own embed docs for the exact iframe `src` format, likely `https://form.jotform.com/{formId}` with query params) and pick the correct one of the 3 Jotform Garment-field prefill params based on `garment.family`:

```js
function openOrderFormFor(design, garment, size, colour) {
  const url = new URL(`https://form.jotform.com/${JOTFORM_FORM_ID}`);
  if (design.tallyDesign) url.searchParams.set(DESIGN_PARAM_NAME, design.tallyDesign);
  if (garment && garment.tallyLabel) {
    const paramName = garment.family === 'yki' ? GARMENT_YKI_PARAM_NAME
      : garment.family === 'hivis' ? GARMENT_HIVIS_PARAM_NAME
      : GARMENT_STANDARD_PARAM_NAME;
    url.searchParams.set(paramName, garment.tallyLabel);
  }
  if (size) url.searchParams.set(SIZE_PARAM_NAME, size);
  if (colour) url.searchParams.set(COLOUR_PARAM_NAME, colour);
  // ...same iframe-src-rebuild pattern as the current openTallyFor, replace TALLY_BASE_SRC with the Jotform equivalent
}
```

Fill in `JOTFORM_FORM_ID` and every `*_PARAM_NAME` constant from `field-manifest.json`'s Item-1 entry and Task 6's confirmed convention — do not invent names.

- [ ] **Step 3: Live-verify the race condition flagged in Review Focus** — load the constructed URL fresh (private/incognito-equivalent, no reused state) with a Design that should reveal `garmentYki1` and confirm the prefilled Youth/Kids/Infant garment value actually appears correctly, not silently dropped because the field was still conditionally hidden when the prefill tried to apply.

- [ ] **Step 4: Manual browser check of the "Order this design" button** — confirm it looks pixel-identical to before (same button styling, same click behavior opening the form), only the destination changed.

- [ ] **Step 5: Commit**

```bash
git add shop.html
git commit -m "feat: replace Tally embed/prefill with Jotform"
```

---

## Task 8: Remove remaining Tally references from the repo

**Files:**
- Modify: `shop.html`, `shop/catalog.js`, and any other file referencing Tally (grep first).

**Interfaces:** None — cleanup only, can run anytime independent of other tasks (just don't let it collide with Task 7 editing the same lines — sequence after Task 7 if both touch `shop.html`).

- [ ] **Step 1: Grep for every Tally reference**

```bash
grep -rniE 'tally|PdoLpe' --include='*.html' --include='*.js' --include='*.md' .
```

- [ ] **Step 2: Remove or update each one** — delete dead `TALLY_BASE_SRC`/Tally-specific constants, CSS classes named after Tally, comments referencing Tally, etc. Leave historical mentions inside `docs/superpowers/plans/*.md` and memory files untouched (they're a record, not live code).

- [ ] **Step 3: Verify the grep comes back clean for live code paths** (`shop.html`, `shop/*.js`) — remaining hits should only be in `docs/`/memory.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove remaining Tally references from the website"
```

---

## Task 9: Make.com — re-point "Rustnuts Merch Order Intake" (7522707) at Jotform

**Files:** None local — Make.com scenario, edited via `PATCH https://us2.make.com/api/v2/scenarios/7522707` (confirm the correct region subdomain from the memory file — do not assume `us2`) with body `{blueprint: JSON.stringify(blueprintObject)}`, or via Make's web UI.

**Interfaces:**
- Consumes: Task 4's confirmed Jotform submission shape (exact field names/values as they appear in a real submission), the live Jotform `formId`.

- [ ] **Step 1: Read `rustnutssmc-order-automation-make.md` (memory file) in full** for the current scenario architecture — every module's role, the Design-field-extraction formula pattern, the Drive folder IDs, the Resend email modules. This is working, correct logic — the goal is re-pointing its data source, not rewriting it.

- [ ] **Step 2: Fetch the current blueprint** (`GET /api/v2/scenarios/7522707/blueprint`) and identify every module that reads a Tally-specific field/webhook shape.

- [ ] **Step 3: Set up a Jotform webhook trigger** replacing the Tally webhook module, pointed at the new form's `formId`. Jotform's webhook payload shape differs from Tally's — re-map each downstream module's field references (e.g. the per-item Design-extraction formula, currently `{{substring(1.\`11\`; 0; indexOf(1.\`11\`; " - "))}}` style — the exact webhook key numbers will change under Jotform, re-derive them from a real test webhook payload rather than guessing).

- [ ] **Step 4: Submit one real test order via the live Jotform form** (or via API) with the webhook connected, and confirm the scenario runs end-to-end: correct invoice generated, correct Drive folder, correct Resend email — matching the pre-migration behavior documented in the memory file.

- [ ] **Step 5: Update `rustnutssmc-order-automation-make.md`** with the new Jotform-based field mappings, replacing the Tally-specific details (keep the parts that didn't change — Drive folder IDs, email templates, Resend setup).

---

## Task 10: Make.com — re-point "Rustnuts Reminder 1 (Monday)" (7536417) at Jotform

**Files:** None local — same Make.com editing pattern as Task 9.

**Interfaces:**
- Consumes: same as Task 9 (Jotform submission shape, `formId`), plus Task 9's completed re-mapping of the intake scenario if this scenario reads from the same Data Store records the intake scenario writes (confirm this dependency by reading the memory file — if the Monday scenario reads Make's own Data Store rather than Jotform directly, this task may only need the Data Store record shape to stay the same, in which case very little changes here).

- [ ] **Step 1: Read `rustnutssmc-order-automation-make.md`** for this scenario's current architecture (reminders, auto-cancel, Supplier PO batching, Receipt generation — added earlier this project).

- [ ] **Step 2: Confirm whether this scenario reads Tally data directly or via the Data Store written by the intake scenario.** If via Data Store only, verify the Data Store record shape is unaffected by the Tally→Jotform swap (it should be, since Task 9 re-maps the intake scenario to write the same Data Store shape) — in that case this task reduces to a smoke-test, not a re-map.

- [ ] **Step 3: If it does read Tally-specific fields directly, re-map them following the same pattern as Task 9 Step 3.**

- [ ] **Step 4: Verify** by triggering the scenario (or waiting for its Monday schedule / running it manually via Make's "Run once") against a real test order created in Task 9 Step 4, and confirm Supplier PO / Receipt generation still fires correctly for a Paid order.

---

## Task 11: Full live smoke test

**Files:** None — verification only.

**Interfaces:**
- Consumes: everything (Tasks 1–10 complete).

- [ ] **Step 1:** From the live website (not a local file), click "Order this design" for at least 3 different designs (Member, Family, Better with you in it!) covering all 3 garment families (standard, YKI, Hi-Vis), and complete a real submission for each.

- [ ] **Step 2:** Confirm each order flows correctly through: Jotform prefill → correct garment/colour/design landed → Make.com intake scenario → correct invoice + Drive filing + buyer/owner emails.

- [ ] **Step 3:** Mark one test order "Paid" and confirm the Monday scenario would generate its Supplier PO + Receipt correctly (run manually rather than waiting for Monday).

- [ ] **Step 4:** Clean up all test submissions/orders created during this task (delete test Jotform submissions, note any test Drive files/emails to Chris for manual cleanup since those can't be un-sent).

- [ ] **Step 5:** Update `rustnutssmc-jotform-pivot.md` (memory) marking the migration complete, with the final live `formId` and a one-line pointer to where the build scripts live (`scripts/jotform/`).
