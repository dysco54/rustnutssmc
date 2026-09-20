import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCents } from '../shop/format.js';

test('formats whole dollars', () => {
  assert.equal(formatCents(3500), '$35.00');
});

test('formats cents with a non-zero remainder', () => {
  assert.equal(formatCents(3599), '$35.99');
});

test('formats zero', () => {
  assert.equal(formatCents(0), '$0.00');
});
