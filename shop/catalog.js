const RANGE_XS_3XL = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const RANGE_XS_2XL = ['XS', 'S', 'M', 'L', 'XL', '2XL'];
const RANGE_S_3XL =['S', 'M', 'L', 'XL', '2XL', '3XL'];
const RANGE_XS_5XL = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
const RANGE_2XS_5XL = ['2XS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
const RANGE_YOUTH = ['8', '10', '12', '14', '16'];
const RANGE_KIDS = ['2', '4', '6'];
const RANGE_INFANT = ['0-3m', '3-6m', '6-12m', '12-18m', '18-24m'];

const GARMENTS = {
  classicTee: { label: 'Classic Tee', price: 3500, sizes: RANGE_XS_3XL, family: 'standard' },
  lowDownSinglet: { label: 'Low Down Singlet', price: 3000, sizes: RANGE_S_3XL, family: 'standard' },
  madeHood: { label: 'Made Hood', price: 6000, sizes: RANGE_S_3XL, family: 'standard' },
  madeCrew: { label: 'Made Crew', price: 6000, sizes: RANGE_S_3XL, family: 'standard' },
  stencilHood: { label: 'Stencil Hood', price: 5500, sizes: RANGE_XS_5XL, family: 'standard' },
  zipHood: { label: 'Zip Hood', price: 6000, sizes: RANGE_XS_3XL, family: 'standard' },
  stencilCrew: { label: 'Stencil Crew', price: 5500, sizes: RANGE_XS_3XL, family: 'standard' },
  heavyTee: { label: 'Heavy Tee', price: 4000, sizes: RANGE_XS_3XL, family: 'standard' },
  classicLSTee: { label: 'Classic L/S Tee', price: 4000, sizes: RANGE_XS_3XL, family: 'standard' },
  barnardTank: { label: 'Barnard Tank', price: 3000, sizes: RANGE_XS_2XL, family: 'standard' },
  womensClassicTee: { label: "Women's Classic Tee", price: 3500, sizes: RANGE_XS_3XL, family: 'standard' },
  womensClassicLSTee: { label: "Women's Classic L/S Tee", price: 4000, sizes: RANGE_XS_3XL, family: 'standard' },
};

// Hi-Vis is a JB's workwear range, not standard AS Colour stock — separate garment,
// merged into Supporter's own garments below and scoped to the Hi-Vis colour via
// `colourGarments`.
const HIVIS_GARMENTS = {
  jbsHiVisTee: { label: "JB's Wear 6HVT Hi-Vis Tee", price: 2700, sizes: RANGE_XS_3XL, family: 'hivis' },
};

const SUPPORTER_GARMENTS = { ...GARMENTS, ...HIVIS_GARMENTS };

// Youth/infant sizing is a separate AS Colour range from the adult lineup above —
// merged into Family's own garments below. Family-only, per Chris's request.
const YOUTH_INFANT_GARMENTS = {
  youthLongSleeve: { label: 'Youth Long Sleeve', price: 2650, sizes: RANGE_YOUTH, family: 'yki' },
  youthSupplyCrew: { label: 'Youth Supply Crew', price: 2950, sizes: RANGE_YOUTH, family: 'yki' },
  youthSupplyHood: { label: 'Youth Supply Hood', price: 3650, sizes: RANGE_YOUTH, family: 'yki' },
  kidsSupplyHood: { label: 'Kids Supply Hood', price: 3650, sizes: RANGE_KIDS, family: 'yki' },
  kidsSupplyCrew: { label: 'Kids Supply Crew', price: 2950, sizes: RANGE_KIDS, family: 'yki' },
  kidsLongSleeve: { label: 'Kids Long Sleeve', price: 2650, sizes: RANGE_KIDS, family: 'yki' },
  infantOnePiece: { label: 'Infant One Piece', price: 2440, sizes: RANGE_INFANT, family: 'yki' },
  infantTee: { label: 'Infant Tee', price: 2250, sizes: RANGE_INFANT, family: 'yki' },
};

const FAMILY_GARMENTS = { ...GARMENTS, ...YOUTH_INFANT_GARMENTS };

export const CATALOG = [
  { id: 'member', name: 'Member', gated: false, garments: GARMENTS, image: 'shop/member-front.jpg', imageBack: 'shop/member-back.jpg', colours: ['Black'] },
  { id: 'family', name: 'Family', gated: false, garments: FAMILY_GARMENTS, image: 'shop/family-front.jpg', imageBack: 'shop/family-back.jpg', colours: ['Black'] },
  // `colourViews` links a colour-select option to the Front/Back images that should be
  // shown while that colour is selected. Any colour not listed here (e.g. Black/Grey)
  // falls back to the design's standard `image`/`imageBack`. This keeps the colour
  // dropdown and the Front/Back view toggle in sync — see shop.html `renderDesigns()`.
  { id: 'supporter', name: 'Better with you in it!', gated: false, garments: SUPPORTER_GARMENTS, image: 'shop/supporter-front.jpg', imageBack: 'shop/supporter-back.jpg', colourViews: { 'Hi-Vis': { front: 'shop/supporter-hivis-front.jpg', back: 'shop/supporter-hivis-back.jpg' } }, colours: ['Black', 'Grey', 'Hi-Vis'] },
  { id: 'fourth-design', name: 'RU OK', gated: false, garments: GARMENTS, image: 'shop/fourth-design-front.jpg', colours: ['Black', 'Grey'] },
];
