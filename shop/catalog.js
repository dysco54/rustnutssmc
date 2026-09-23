const SIZES = ['S', 'M', 'L', 'XL', '2XL'];

const GARMENTS = {
  shirt: { label: 'T-Shirt', price: 3500, sizes: SIZES },
  singlet: { label: 'Singlet', price: 3500, sizes: SIZES },
  hoodie: { label: 'Hoodie', price: 5500, sizes: SIZES },
  jumper: { label: 'Crew Jumper', price: 5000, sizes: SIZES },
  vest: { label: 'Vest (PLACEHOLDER — 5th garment type, confirm with committee)', price: 4000, sizes: SIZES },
};

export const CATALOG = [
  { id: 'member', name: 'Member', gated: true, garments: GARMENTS, image: 'shop/member-front.jpg', imageBack: 'shop/member-back.jpg', tallyDesign: 'Member' },
  { id: 'family', name: 'Family', gated: true, garments: GARMENTS, image: 'shop/family-front.jpg', imageBack: 'shop/family-back.jpg', tallyDesign: 'Family' },
  { id: 'supporter', name: 'Supporter', gated: false, garments: GARMENTS, image: 'shop/supporter-front.jpg', imageBack: 'shop/supporter-back.jpg', tallyDesign: 'Better with you in it!' },
  { id: 'fourth-design', name: 'RU OK', gated: false, garments: GARMENTS, image: 'shop/fourth-design-front.jpg', tallyDesign: 'R U OK Rustnuts' },
];
