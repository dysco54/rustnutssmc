import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../shop/catalog.js';

test('Barnard Tank tops out at 2XL in every design', () => {
  for (const design of CATALOG) {
    const sizes = design.garments.barnardTank.sizes;
    assert.deepEqual(sizes, ['XS', 'S', 'M', 'L', 'XL', '2XL'], design.id);
  }
});
