import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCents } from '../shop/format.js';

test('formats whole dollars', () => {
  assert.equal(formatCents(3500), '$35.00');
});
test('formats cents', () => {
  assert.equal(formatCents(5599), '$55.99');
});
