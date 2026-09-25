const RANGE_XS_3XL = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const RANGE_S_3XL = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
const RANGE_XS_5XL = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
const RANGE_2XS_5XL = ['2XS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
const RANGE_YOUTH = ['8', '10', '12', '14', '16'];
const RANGE_INFANT = ['0-3m', '3-6m', '6-12m', '12-18m', '18-24m'];

// `tallyLabel` must match the corresponding "Garment (Item 1)" option text in the
// Tally form exactly — it's what gets passed through the `garment` hidden field to
// prefill that field. `label`/`price` are for this site's own display only.
const GARMENTS = {
  classicTee: { label: 'Classic Tee', tallyLabel: 'AS Colour Classic Tee — $35 (XS–3XL)', price: 3500, sizes: RANGE_XS_3XL },
  lowDownSinglet: { label: 'Low Down Singlet', tallyLabel: 'AS Colour Low Down Singlet — $30 (S–3XL)', price: 3000, sizes: RANGE_S_3XL },
  madeHood: { label: 'Made Hood', tallyLabel: 'AS Colour Made Hood — $60 (S–3XL)', price: 6000, sizes: RANGE_S_3XL },
  madeCrew: { label: 'Made Crew', tallyLabel: 'AS Colour Made Crew — $60 (S–3XL)', price: 6000, sizes: RANGE_S_3XL },
  stencilHood: { label: 'Stencil Hood', tallyLabel: 'AS Colour Stencil Hood — $55 (XS–5XL)', price: 5500, sizes: RANGE_XS_5XL },
  zipHood: { label: 'Zip Hood', tallyLabel: 'AS Colour Zip Hood — $60 (XS–3XL)', price: 6000, sizes: RANGE_XS_3XL },
  stencilCrew: { label: 'Stencil Crew', tallyLabel: 'AS Colour Stencil Crew — $55 (XS–3XL)', price: 5500, sizes: RANGE_XS_3XL },
  heavyTee: { label: 'Heavy Tee', tallyLabel: 'AS Colour Heavy Tee — $40 (XS–3XL)', price: 4000, sizes: RANGE_XS_3XL },
  classicLSTee: { label: 'Classic L/S Tee', tallyLabel: 'AS Colour Classic L/S Tee — $40 (XS–3XL)', price: 4000, sizes: RANGE_XS_3XL },
  barnardTank: { label: 'Barnard Tank', tallyLabel: 'AS Colour Barnard Tank — $30 (XS–3XL)', price: 3000, sizes: RANGE_XS_3XL },
  womensClassicTee: { label: "Women's Classic Tee", tallyLabel: "AS Colour Women's Classic Tee — $35 (XS–3XL)", price: 3500, sizes: RANGE_XS_3XL },
  womensClassicLSTee: { label: "Women's Classic L/S Tee", tallyLabel: "AS Colour Women's Classic L/S Tee — $40 (XS–3XL)", price: 4000, sizes: RANGE_XS_3XL },
};

// Hi-Vis is a JB's workwear range, not standard AS Colour stock — separate garments,
// no price yet (TBA, so no `price` field; nothing currently renders garment.price
// buyer-facing, see shop.html). Merged into Supporter's own garments below and scoped
// to the Hi-Vis colour via `colourGarments`.
const HIVIS_GARMENTS = {
  jbsHiVisTee: { label: "JB's Hi Vis Trad T-Shirt", tallyLabel: "JB's Hi Vis Trad T-Shirt (XS–5XL)", sizes: RANGE_XS_5XL },
  jbsHiVisHoodie: { label: "JB's 350g Hi Vis Trade Hoodie", tallyLabel: "JB's 350g Hi Vis Trade Hoodie (2XS–5XL)", sizes: RANGE_2XS_5XL },
};

const SUPPORTER_GARMENTS = { ...GARMENTS, ...HIVIS_GARMENTS };

// Youth/infant sizing is a separate AS Colour range from the adult lineup above —
// merged into Family's own garments below. Family-only, per Chris's request.
const YOUTH_INFANT_GARMENTS = {
  youthLongSleeve: { label: 'Youth Long Sleeve', tallyLabel: 'AS Youth Long Sleeve — $26.50 (8–16)', price: 2650, sizes: RANGE_YOUTH },
  youthSupplyCrew: { label: 'Youth Supply Crew', tallyLabel: 'AS Youth Supply Crew — $29.50 (8–16)', price: 2950, sizes: RANGE_YOUTH },
  youthSupplyHood: { label: 'Youth Supply Hood', tallyLabel: 'AS Youth Supply Hood — $36.50 (8–16)', price: 3650, sizes: RANGE_YOUTH },
  kidsSupplyHood: { label: 'Kids Supply Hood', tallyLabel: 'AS Kids Supply Hood — $36.50 (8–16)', price: 3650, sizes: RANGE_YOUTH },
  infantOnePiece: { label: 'Infant One Piece', tallyLabel: 'AS Infant One Piece — $24.40 (0-3m–18-24m)', price: 2440, sizes: RANGE_INFANT },
  infantTee: { label: 'Infant Tee', tallyLabel: 'AS Infant Tee — $22.50 (0-3m–18-24m)', price: 2250, sizes: RANGE_INFANT },
};

const FAMILY_GARMENTS = { ...GARMENTS, ...YOUTH_INFANT_GARMENTS };

export const CATALOG = [
  { id: 'member', name: 'Member', gated: true, garments: GARMENTS, image: 'shop/member-front.jpg', imageBack: 'shop/member-back.jpg', tallyDesign: 'Member', colours: ['Black'] },
  { id: 'family', name: 'Family', gated: true, garments: FAMILY_GARMENTS, image: 'shop/family-front.jpg', imageBack: 'shop/family-back.jpg', tallyDesign: 'Family', colours: ['Black'] },
  // `colourViews` links a colour-select option to the Front/Back images that should be
  // shown while that colour is selected. Any colour not listed here (e.g. Black/Grey)
  // falls back to the design's standard `image`/`imageBack`. This keeps the colour
  // dropdown and the Front/Back view toggle in sync — see shop.html `renderDesigns()`.
  // `colourGarments` restricts which `garments` keys are selectable per colour — used
  // here because Hi-Vis is a separate JB's workwear range, not the standard AS Colour
  // lineup. A colour with no entry (or a design with no `colourGarments` at all) falls
  // back to the full `garments` list. See shop.html `renderDesigns()`/`refreshGarments()`.
  { id: 'supporter', name: 'Better with you in it!', gated: false, garments: SUPPORTER_GARMENTS, image: 'shop/supporter-front.jpg', imageBack: 'shop/supporter-back.jpg', tallyDesign: 'Better with you in it!', colourViews: { 'Hi-Vis': { front: 'shop/supporter-hivis-front.jpg', back: 'shop/supporter-hivis-back.jpg' } }, colourGarments: { Black: Object.keys(GARMENTS), Grey: Object.keys(GARMENTS), 'Hi-Vis': ['jbsHiVisTee', 'jbsHiVisHoodie'] }, colours: ['Black', 'Grey', 'Hi-Vis'] },
  { id: 'fourth-design', name: 'RU OK', gated: false, garments: GARMENTS, image: 'shop/fourth-design-front.jpg', tallyDesign: 'R U OK Rustnuts', colours: ['Black', 'Grey'] },
];
