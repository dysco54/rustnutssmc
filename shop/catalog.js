const RANGE_XS_3XL = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const RANGE_S_3XL = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
const RANGE_XS_5XL = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];

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

export const CATALOG = [
  { id: 'member', name: 'Member', gated: true, garments: GARMENTS, image: 'shop/member-front.jpg', imageBack: 'shop/member-back.jpg', tallyDesign: 'Member' },
  { id: 'family', name: 'Family', gated: true, garments: GARMENTS, image: 'shop/family-front.jpg', imageBack: 'shop/family-back.jpg', tallyDesign: 'Family' },
  { id: 'supporter', name: 'Supporter', gated: false, garments: GARMENTS, image: 'shop/supporter-front.jpg', imageBack: 'shop/supporter-back.jpg', tallyDesign: 'Better with you in it!', extraViews: [{ key: 'hivis', label: 'Hi-Vis' }] },
  { id: 'fourth-design', name: 'RU OK', gated: false, garments: GARMENTS, image: 'shop/fourth-design-front.jpg', tallyDesign: 'R U OK Rustnuts' },
];
