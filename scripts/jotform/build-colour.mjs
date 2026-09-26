// scripts/jotform/build-colour.mjs
//
// Adds the Colour field(s) for all 9 items to the Jotform order form created
// by build-form.mjs, and appends them to field-manifest.json.
//
// Research finding (2026-09-26, confirmed both by Jotform's own support
// answers — quoted in the spec — and independently via a live web search of
// Jotform's help center): Jotform's conditional logic can only show/hide a
// WHOLE field, never an individual answer choice within one shared field.
// ("It's not possible to hide certain field options based on the user's
// answer on another field... You would need to add multiple fields with
// different options, and then show the right ones using conditional logic."
// — https://www.jotform.com/answers/1899326-, corroborated by
// https://www.jotform.com/answers/2921403-.)
//
// This rules out a single 3-option Colour dropdown gated per-choice (Black
// always on, Grey/Hi-Vis conditionally revealed within the same field) —
// that is exactly the per-option-inside-one-shared-field mechanism that
// broke Tally and is explicitly banned by this project's Global Constraints.
//
// Implemented approach (whole-field split, matching Garment's architecture):
//   - `Colour (Item N)`          — options: Black. Always visible (covers
//                                   Member/Family).
//   - `Colour – Extended (Item N)` — options: Black, Grey, Hi-Vis. Visible
//                                   only when Design is "Better with you in
//                                   it!" or "R U OK Rustnuts" (built as a
//                                   conditional rule in Task 3, native UI).
//     Per the plan's Task 2 Step 2 note: R U OK Rustnuts has no Hi-Vis
//     garment, so its buyers simply never select the Hi-Vis colour option —
//     we do not build a 3rd Colour field just to exclude one option from one
//     Design; that would reintroduce the exact bug class this migration
//     exists to eliminate.
//
// Field order: inserted between Size and Quantity for each item (matching
// the spec's functional field order: Design, Garment, Size, Colour,
// Quantity, Add another item?). Existing Quantity/AddAnother questions (and
// every subsequent item's fields) are shifted via the question-edit API to
// keep the whole form's question order consistent with this sequence.

import { readFile, writeFile } from 'node:fs/promises';
import { jf, formEncode, addQuestion } from './build-form.mjs';

const COLOUR_OPTIONS = ['Black'];
const COLOUR_EXTENDED_OPTIONS = ['Black', 'Grey', 'Hi-Vis'];

async function setOrder(formId, qid, order) {
  await jf(`/form/${formId}/question/${qid}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: formEncode({ 'question[order]': String(order) }),
  });
}

async function main() {
  const manifestPath = new URL('./field-manifest.json', import.meta.url);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const { formId, items } = manifest;

  // Fields per item after adding colour: design, garmentStandard, garmentYki,
  // garmentHivis, size, colour, colourExtended, quantity, addAnother(1-8 only)
  const fieldsPerItemBase = 9; // 7 existing + 2 new colour fields
  let order = 1;

  for (const itemEntry of items) {
    const i = itemEntry.item;
    const f = itemEntry.fields;

    // Existing fields keep their relative order, just shifted to make room.
    await setOrder(formId, f.design.qid, order++);
    await setOrder(formId, f.garmentStandard.qid, order++);
    await setOrder(formId, f.garmentYki.qid, order++);
    await setOrder(formId, f.garmentHivis.qid, order++);
    await setOrder(formId, f.size.qid, order++);

    // New Colour fields, inserted here.
    const colour = await addQuestion(formId, order++, 'control_dropdown', `Colour (Item ${i})`, `colour${i}`, COLOUR_OPTIONS);
    const colourExtended = await addQuestion(formId, order++, 'control_dropdown', `Colour – Extended (Item ${i})`, `colourExtended${i}`, COLOUR_EXTENDED_OPTIONS);

    await setOrder(formId, f.quantity.qid, order++);
    if (f.addAnother) await setOrder(formId, f.addAnother.qid, order++);

    f.colour = colour;
    f.colourExtended = colourExtended;

    console.log(`Item ${i} colour fields added.`);
  }

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('Done. Manifest updated with colour fields.');
}

main().catch(e => { console.error(e); process.exit(1); });
