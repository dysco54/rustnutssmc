const SIZES = ['S', 'M', 'L', 'XL', '2XL'];

const GARMENTS = {
  shirt: { label: 'T-Shirt', price: 3500, sizes: SIZES },
  singlet: { label: 'Singlet', price: 3500, sizes: SIZES },
  hoodie: { label: 'Hoodie', price: 5500, sizes: SIZES },
  jumper: { label: 'Crew Jumper', price: 5000, sizes: SIZES },
  vest: { label: 'Vest (PLACEHOLDER — 5th garment type, confirm with committee)', price: 4000, sizes: SIZES },
};

export const CATALOG = [
  { id: 'member', name: 'Member', gated: true, garments: GARMENTS },
  { id: 'family', name: 'Family', gated: true, garments: GARMENTS },
  { id: 'supporter', name: 'Supporter', gated: false, garments: GARMENTS },
  { id: 'fourth-design', name: 'PLACEHOLDER — 4th design (in progress)', gated: false, garments: GARMENTS },
];
