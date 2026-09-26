// scripts/jotform/build-form.mjs
//
// Builds the Rustnuts SMC Jotform order-form field skeleton for all 9 "Item"
// groups via Jotform's REST API, and writes the resulting field/question IDs
// to field-manifest.json.
//
// Usage: JOTFORM_API_KEY=xxx node scripts/jotform/build-form.mjs
//
// API shape verified live 2026-09-26 (throwaway test form, created + deleted):
//   - POST /form/{id}/questions response is `json.content` = the created
//     question object itself, e.g. {type, text, order, name, options, qid}.
//     The qid is `content.qid` directly (a number) — NOT
//     `Object.keys(content)[0]` as an earlier draft assumed.
//   - GET /form/{id}/questions response is `json.content` = an object keyed
//     by qid (as a string), e.g. {"1": {qid: "1", name: ..., options: ...}}.
//   - `options` round-trips as the same pipe-delimited string that was sent.
//   - An individual dropdown option has no separate id — its identity for
//     prefill/conditional-logic targeting is its literal option text.

import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const KEY = process.env.JOTFORM_API_KEY;
if (!KEY) throw new Error('Set JOTFORM_API_KEY');
const BASE = 'https://api.jotform.com';

export async function jf(path, opts = {}) {
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}apiKey=${KEY}`;
  const res = await fetch(url, opts);
  const json = await res.json();
  if (json.responseCode !== 200) throw new Error(`Jotform API error on ${path}: ${JSON.stringify(json)}`);
  return json.content;
}

export function formEncode(obj) {
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

export async function addQuestion(formId, order, type, text, name, options) {
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
  // Verified live: creation response content IS the question object; qid is
  // a direct field on it (a number), not an object key.
  const qid = String(created.qid);
  return { qid, name };
}

export async function buildSkeleton(formId) {
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

  return items;
}

async function main() {
  const form = await jf('/user/forms', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: formEncode({ 'properties[title]': 'Rustnuts SMC Merch Order' }),
  });
  const formId = form.id;
  const items = await buildSkeleton(formId);

  const manifest = { formId, items };
  await writeFile(
    new URL('./field-manifest.json', import.meta.url),
    JSON.stringify(manifest, null, 2)
  );
  console.log(`Done. Form id ${formId}. Manifest written.`);
}

// Only auto-run when this file is executed directly (`node build-form.mjs`),
// not when its exports are imported by a sibling script like build-colour.mjs
// — otherwise importing this module would side-effect a second form creation.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(e); process.exit(1); });
}
