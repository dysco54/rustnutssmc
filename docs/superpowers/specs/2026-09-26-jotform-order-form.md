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

## Architecture v2 (superseding the field-split design below) — Jotform Apps / Product List cart

**Decision (2026-09-26, later same session):** Chris asked whether a proper shopfront-with-cart was achievable instead of a long conditional-logic form, since "we're building this from scratch anyway." Investigation found Jotform Apps' **Product List** element — a real cart UI (image, name, price, per-product Size/Colour variant options, Add to Cart, running subtotal) — confirmed live in-account to support named variant options with arbitrary value lists (exactly what Colour/Size need). This also **eliminates the entire conditional-logic bug class** that caused every Tally failure and the Jotform-forms field-split's own near-miss: instead of hiding a field/option based on a Design answer, a garment simply isn't present in a page's product list if it's not valid for that page. No show/hide rule to fail.

**The catch, found and resolved in the same investigation:** Jotform Apps' account is FREE-tier capped at **5 forms total** (`formCount: 5`), and each Product List element is backed by its own hidden Jotform form — a naive 1-page-per-design build (4 designs) plus a checkout form plus any sub-category grouping blows straight through the cap (confirmed live: a 3-page test template alone silently consumed 6 forms). Resolution: collapse to **2 pages** instead of 4, grouped by the real distinguishing rule (club-gated vs public), not by Design 1:1:

- **"Club" page** — Member + Family combined. One Product List containing all 12 standard AS Colour garments plus the 8 Youth/Kids/Infant garments (Family's addition). Colour: Black only.
- **"Public" page** — Better with you in it! + R U OK Rustnuts combined. One Product List containing the same 12 standard garments plus the Hi-Vis Tee (Supporter's addition). Colour: Black, Grey (both), Hi-Vis (as a colour option, tied to ordering the Hi-Vis Tee product specifically).
- **Checkout** — Jotform's auto-generated checkout form (1 form).

Total: **3 forms**, well under the 5-form cap, with 2 forms of headroom.

**Accepted trade-off:** this is not a perfect per-Design catalog — a Member buyer technically sees the Youth/Kids/Infant garments meant for Family, and an R U OK buyer technically sees the Hi-Vis Tee meant for Supporter. This is over-inclusion, not a leak (nobody is shown something meant to be hidden from them; everyone on a shared page sees the same products) — explicitly accepted by Chris as a reasonable trade against re-introducing conditional-logic fragility. Do not try to "fix" this with per-product conditional visibility later without discussing it first — that's the exact trap this whole migration is escaping.

**Per-product structure (both pages):** each garment is one Product List entry with:
- Name = the garment's display name (reuse `catalog.js` `label`, not `tallyLabel` — Jotform's own product name is user-facing, not a prefill-matching key anymore, see below).
- Price = the garment's price (in dollars, Jotform's product price field is decimal dollars not cents — convert from `catalog.js`'s cents).
- A **Size** option (values = that garment's `sizes` array from `catalog.js`, e.g. `RANGE_XS_3XL`).
- A **Colour** option, values per page (`Black` only on Club; `Black`/`Grey` on Public, plus the Hi-Vis product on Public also offers `Hi-Vis` — check live whether Jotform lets a single product's Colour option list differ per-product within the same page; if not, simplest fix is a Colour option on every Public product with all 3 values and a note in the product description that Hi-Vis colour only applies to the Hi-Vis Tee, rather than fighting per-product-conditional option lists).

**Club code word / Member gating:** the code-word gate stays exactly as it is on the website today (client-side only, not a security boundary, per the original 2026-09-21 shop-order-system spec decision) — it gates *access to the Club page link*, not anything inside Jotform. No Jotform-side gating needed for this.

**End-of-form fields** (full name, contact info, delivery choice, etc.): Jotform Apps has a "Contact Information" page type built in — use it, don't hand-roll a form field for each; carry over exact field requiredness from the live Tally form (read once, read-only, before Tally is decommissioned) if Jotform's built-in contact page doesn't already cover it.

## Non-functional requirements

- Prefer the API wherever it reaches (product/page creation is plausible via the same `/form/{id}/questions`-style endpoints Jotform Apps uses under the hood, since each Product List is backed by a real form — verify this, don't assume Apps has zero API surface just because no dedicated Apps API was found in initial docs research). Conditional logic is not needed at all in this architecture, so the earlier "API can't write conditions" constraint is moot for the page-gating decision itself — it may still matter for narrower things like per-product option visibility if that turns out to be needed.
- Every page's product list must be verified live (published app, fresh browser session) showing exactly the intended garments for that page — same "verify live, don't trust the editor" discipline as everywhere else this session.
- The site's "Order this design" button must look visually identical after the swap.
- `shop/catalog.js` needs a way to know which of the 2 pages (Club/Public) a design routes to — simpler than the abandoned 3-way `family` tag, this can likely be derived from the existing `gated` boolean (`gated: true` = Club, `gated: false` = Public) already present on each `CATALOG` entry; confirm this covers all 4 designs correctly before relying on it (Member/Family are `gated: true`, Supporter/RUOK are `gated: false` per the current file — matches the Club/Public split exactly, so a separate tag may not even be needed).
- Make.com's two live scenarios (`7522707`, `7536417`) must be re-pointed at Jotform's order/submission shape (via the Orders data table Jotform Apps generates, or the checkout form's own submissions — check which is more directly webhook-able). Business logic (formulas, Drive folder routing, Resend email templates, Monday PO/receipt batching) stays as-is — re-plumbing, not re-architecture. Read `rustnutssmc-order-automation-make.md` first.

## Out of scope for this migration

- Any change to pricing or the actual garment catalog contents.
- Any change to Make.com's business logic/timing (weekly Monday PO/receipt batching stays as-is).
- Any change to the buyer-facing website design outside of the order button's backend target.
- Re-attempting per-Design (4-way) catalog precision inside Jotform — explicitly accepted as 2-way (Club/Public) for this migration; revisit only as a deliberate, separately-discussed future change.

## Superseded: original field-split design (kept for history, do not build this)

The section below was the original plan before the Product List/cart architecture was found and adopted. It is kept only so the reasoning trail is visible — every task in the plan file now builds the Architecture v2 design above, not this.

<details>
<summary>Original per-item field-split design (superseded)</summary>

For each of 9 "Item" groups (Item 1–9): Design (single-select), Garment split into 3 fields (standard/always-visible, Youth-Kids-Infant/Family-only, Hi-Vis/Supporter-only), Size, Colour (gated by Design), Quantity, "Add another item?" Yes/No revealing the next item. This required per-field conditional logic for every gating rule, built via Jotform's native UI (API confirmed unable to write conditions), and was abandoned in favor of Architecture v2 once the Product List cart option was found to eliminate the need for conditional logic entirely.

</details>
