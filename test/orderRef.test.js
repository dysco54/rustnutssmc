import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateOrderRef } from '../shop/orderRef.js';

test('matches RSMC-YYYYMMDD-XXXX shape', () => {
  const ref = generateOrderRef(new Date('2026-09-21T00:00:00Z'));
  assert.match(ref, /^RSMC-20260921-[A-Z0-9]{4}$/);
});
