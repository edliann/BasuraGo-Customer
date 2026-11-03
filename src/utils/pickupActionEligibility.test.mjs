import assert from 'node:assert/strict';
import test from 'node:test';

import {getPickupActionEligibility} from './pickupActionEligibility.ts';

test('allows Customer cancellation for a pending pickup', () => {
  assert.deepEqual(
    getPickupActionEligibility('pending', null, null, true),
    {canCancelRequest: true, canReviewFinalPrice: false},
  );
});

test('allows cancellation and price review for an unconfirmed accepted pickup', () => {
  assert.deepEqual(
    getPickupActionEligibility(
      'accepted',
      'awaiting_customer_confirmation',
      null,
      true,
    ),
    {canCancelRequest: true, canReviewFinalPrice: true},
  );
});

test('allows price review for an accepted pickup with missing pricing stage', () => {
  assert.deepEqual(
    getPickupActionEligibility('accepted', null, null, true),
    {canCancelRequest: false, canReviewFinalPrice: true},
  );
});

test('does not allow review without a history record or after price acceptance', () => {
  assert.deepEqual(
    getPickupActionEligibility('accepted', 'awaiting_final_price', null, false),
    {canCancelRequest: true, canReviewFinalPrice: false},
  );
  assert.deepEqual(
    getPickupActionEligibility(
      'accepted',
      'awaiting_customer_confirmation',
      12000,
      true,
    ),
    {canCancelRequest: true, canReviewFinalPrice: false},
  );
});

test('disables cancellation and price review for terminal and collection states', () => {
  for (const status of [
    'in_progress',
    'awaiting_facility_receipt',
    'completed',
    'cancelled',
  ]) {
    assert.deepEqual(
      getPickupActionEligibility(
        status,
        'awaiting_customer_confirmation',
        null,
        true,
      ),
      {canCancelRequest: false, canReviewFinalPrice: false},
    );
  }
});
