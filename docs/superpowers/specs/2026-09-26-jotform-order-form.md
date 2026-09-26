# Rustnuts SMC Order Form: Tally → Jotform Migration Spec

## Background

The Rustnuts SMC merch order form has been running on Tally (`PdoLpe`) since 2026-09-24-ish, embedded in `shop.html` on `dysco54/rustnutssmc`, feeding two Make.com scenarios (`Rustnuts Merch Order Intake` id `7522707`, `Rustnuts Reminder 1 (Monday)` id `7536417`) that generate invoices, purchase orders, receipts, and reminders.

During final pre-launch testing on 2026-09-26, a real, live leak was found and root-caused: Tally's per-item "Garment" field is a single shared dropdown containing all 21 possible garments (12 standard AS Colour + 8 Youth/Kids/Infant AS Colour + 1 JB's Hi-Vis Tee), gated by CONDITIONAL_LOGIC rules that show/hide individual sibling option blocks based on the item's Design value. This mechanism is confirmed unreliable: Item 1's single-option Hi-Vis gating happened to work, but Item 2's 8-option Youth/Kids/Infant gating leaked live (all 8 options visible regardless of Design) despite an identically-shaped, correctly-configured rule. A parallel rebuild attempt (splitting the dropdown into 3 separate fields per item, each gated at the whole-field level instead of per-option) hit a second, independent Tally bug: freshly-created blocks silently omit the `isHidden` property, rendering unconditionally visible, and the one proven fix (a direct API PATCH setting `isHidden: true`) got blocked by this session's own permission system.

Chris's decision (2026-09-26): **stop fighting Tally. Drop it entirely. Rebuild the whole order form in Jotform.**

## Why Jotform, and what we already know about it

- Jotform's REST API v1 is confirmed to support form and question creation/editing (verified live: created and deleted a real form via `POST /user/forms` and `DELETE /form/{id}` using an account API key).
- Jotform's REST API is confirmed **NOT** able to write conditional logic (Jotform's own support answers: "it's currently not possible to add/edit conditions of the forms via API"). Conditional-logic rules must be built through Jotform's native form-builder UI.
- Jotform's conditional logic model operates on whole fields (show/hide a whole question when another question's answer matches), not on individual options within one shared field — this is exactly the mechanism that worked reliably in Tally too (e.g. the Item1→Item2 "Add another item?" reveal). There is no known equivalent to Tally's per-option-inside-one-dropdown mechanism, so this migration is also an implicit architecture fix: we are not going to attempt per-option hiding again anywhere.
- The account in use (`rustnutsmerch@gmail.com` / username `rustnutsmerch`) is on Jotform's FREE plan with an active 7-day SILVER-tier trial (started 2026-09-26) and has `allowConditionsV2: true` on its account flags.

## Functional requirements (carried over from the Tally form, unchanged)

For each of 9 "Item" groups (Item 1–9), collect:

1. **Design** — single-select: `Member`, `Family`, `Better with you in it!`, `R U OK Rustnuts`.
2. **Garment** — split into 3 fields per item (this is the architecture fix):
   - `Garment (Item N)` — the 12 standard AS Colour garments, **always visible**, no gating. Options (verbatim text, must byte-match `catalog.js` `tallyLabel` strings once ported): `AS Colour Classic Tee — $35 (XS–3XL)`, `AS Colour Low Down Singlet — $30 (S–3XL)`, `AS Colour Made Hood — $60 (S–3XL)`, `AS Colour Made Crew — $60 (S–3XL)`, `AS Colour Stencil Hood — $55 (XS–5XL)`, `AS Colour Zip Hood — $60 (XS–3XL)`, `AS Colour Stencil Crew — $55 (XS–3XL)`, `AS Colour Heavy Tee — $40 (XS–3XL)`, `AS Colour Classic L/S Tee — $40 (XS–3XL)`, `AS Colour Barnard Tank — $30 (XS–3XL)`, `AS Colour Women's Classic Tee — $35 (XS–3XL)`, `AS Colour Women's Classic L/S Tee — $40 (XS–3XL)`.
   - `Garment – Youth/Kids/Infant (Item N)` — 8 options, **visible only when Design = Family**: `AS Youth Long Sleeve — $26.50 (8–16)`, `AS Youth Supply Crew — $29.50 (8–16)`, `AS Youth Supply Hood — $36.50 (8–16)`, `AS Kids Supply Hood — $36.50 (2–6)`, `AS Kids Supply Crew — $29.50 (2–6)`, `AS Kids Long Sleeve — $26.50 (2–6)`, `AS Infant One Piece — $24.40 (0-3m–18-24m)`, `AS Infant Tee — $22.50 (0-3m–18-24m)`.
   - `Garment – Hi-Vis (Item N)` — 1 option, **visible only when Design is `Better with you in it!` OR `R U OK Rustnuts`**: `JB's Wear 6HVT Hi-Vis Tee — $27.00 (XS–3XL)`.
3. **Size** — free text or dropdown depending on garment (carried over as-is from Tally; not part of this migration's functional change).
4. **Colour** — single-select, gated by Design:
   - `Member`, `Family` → `Black` only.
   - `Better with you in it!`, `R U OK Rustnuts` → `Black`, `Grey`. `Better with you in it!` additionally gets `Hi-Vis` as a colour option (tied to the Hi-Vis garment).
   - (This "Grey gating" and "YKI garments lock Colour to Black" rule was mid-fix on Tally when the pivot happened — implement it correctly from scratch in Jotform, don't carry over Tally's half-fixed state.)
5. **Quantity** — number, default 1.
6. **Add another item?** — Yes/No. Yes reveals Item N+1's whole block (Design through Quantity). No ends the item list.

End-of-form fields (club code word, full name, contact info, etc.) are unchanged from the current Tally form structure — read the live Tally form once (read-only, via its API, before it's decommissioned) to carry over exact field labels/requiredness for these if not otherwise documented.

## Non-functional requirements

- Build via API wherever the API supports it (form/question/option creation, property edits). Use the native Jotform UI only for conditional logic, since that's the one thing the API cannot do.
- Every conditional-logic rule must be verified live (published form, fresh browser session, no reused state) for **every** Design value it's supposed to react to — not just spot-checked. This project has already shipped two rounds of "looked right in the editor, leaked live" bugs; do not repeat that pattern.
- The site's "Order this design" button must look visually identical after the swap — this is a backend/platform swap, not a redesign.
- `shop/catalog.js` needs an explicit `family: 'standard' | 'yki' | 'hivis'` tag on every garment entry (confirmed necessary — today there is no way to tell a Youth/Kids/Infant garment apart from a standard one in code; Family design has zero distinguishing marker).
- Make.com's two live scenarios (`7522707`, `7536417`) must be re-pointed at Jotform's webhook/submission shape. Their business logic (formulas, Drive folder routing, Resend email templates, the Monday PO/receipt batching) is correct and working today — this is a re-plumbing job, not a re-architecture. Read `rustnutssmc-order-automation-make.md` (memory file) for the current, correct architecture before touching any module.

## Out of scope for this migration

- Any change to pricing, garment catalog contents (beyond the `family` tag), or Make.com's business logic/timing (weekly Monday PO/receipt batching stays as-is).
- Any change to the buyer-facing website design outside of the order button's backend target.
