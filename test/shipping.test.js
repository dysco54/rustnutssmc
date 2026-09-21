import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getShippingCost, AU_STATES } from '../shop/shipping.js';

test('returns the standard rate for VIC', () => {
  assert.equal(getShippingCost('VIC', 'standard'), 2000);
});
test('returns the express rate for NT', () => {
  assert.equal(getShippingCost('NT', 'express'), 3550);
});
test('lists all 8 AU states', () => {
  assert.equal(AU_STATES.length, 8);
});
test('throws on an unknown state', () => {
  assert.throws(() => getShippingCost('ZZ', 'standard'));
});
test('throws on an unknown method', () => {
  assert.throws(() => getShippingCost('VIC', 'overnight'));
});
