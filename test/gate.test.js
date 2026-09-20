import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCodeWord } from '../shop/gate.js';

test('accepts the exact code word', () => {
  assert.equal(checkCodeWord('RSMC2019'), true);
});

test('is case-insensitive and trims whitespace', () => {
  assert.equal(checkCodeWord('  rsmc2019  '), true);
});

test('rejects an empty or wrong code word', () => {
  assert.equal(checkCodeWord(''), false);
  assert.equal(checkCodeWord('wrong'), false);
});
