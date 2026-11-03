import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendPickupQuoteItem,
  snapshotPickupQuoteItems,
} from './pickupItems.ts';

test('preserves different and repeated waste lines independently', () => {
  const first = {
    wasteTypeId: 'chemical',
    bagSizeId: 'small',
    quantity: 2,
  };
  const second = {
    wasteTypeId: 'biodegradable',
    bagSizeId: 'large',
    quantity: 1,
  };
  const repeated = {...first, quantity: 1};

  const items = appendPickupQuoteItem(
    appendPickupQuoteItem(
      appendPickupQuoteItem([], first),
      second,
    ),
    repeated,
  );

  assert.deepEqual(items, [first, second, repeated]);
});

test('quote and confirmation payload snapshots contain every added line', () => {
  const selectedItems = [
    {wasteTypeId: 'chemical', bagSizeId: 'small', quantity: 2},
    {wasteTypeId: 'biodegradable', bagSizeId: 'large', quantity: 1},
    {wasteTypeId: 'chemical', bagSizeId: 'small', quantity: 1},
  ];

  const quotePayload = {
    addressId: 'home',
    items: snapshotPickupQuoteItems(selectedItems),
  };
  const confirmationPayload = {
    ...quotePayload,
    submissionId: 'submission-id',
    quoteId: 'quote-id',
  };

  assert.deepEqual(quotePayload.items, selectedItems);
  assert.deepEqual(confirmationPayload.items, selectedItems);
  assert.notEqual(quotePayload.items, selectedItems);
  assert.notEqual(quotePayload.items[0], selectedItems[0]);
});
