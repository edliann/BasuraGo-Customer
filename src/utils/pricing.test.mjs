import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateWasteTypeSubtotal,
  formatPesoAmount,
} from './pricing.ts';

test('calculates a selected waste type fee subtotal by bag quantity', () => {
  assert.equal(calculateWasteTypeSubtotal(10, 3), 30);
  assert.equal(calculateWasteTypeSubtotal(20.5, 2), 41);
});

test('rejects invalid fee or quantity values for display', () => {
  assert.equal(calculateWasteTypeSubtotal(undefined, 1), null);
  assert.equal(calculateWasteTypeSubtotal(-1, 1), null);
  assert.equal(calculateWasteTypeSubtotal(10, 0), null);
  assert.equal(calculateWasteTypeSubtotal(10, 1.5), null);
});

test('formats configured and calculated fees as PHP currency', () => {
  assert.match(formatPesoAmount(10), /10\.00/);
  assert.match(formatPesoAmount(calculateWasteTypeSubtotal(10, 3)), /30\.00/);
});
