import assert from 'node:assert/strict';
import test from 'node:test';

import {getNextActivePickup} from './nextPickup.ts';

function pickup(pickupId, status, scheduledDate, scheduledTime, createdAt) {
  return {
    pickupId,
    status,
    scheduledDate,
    scheduledTime,
    createdAt,
  };
}

test('returns null when the customer has no pickups', () => {
  assert.equal(getNextActivePickup([]), null);
});

test('returns a pending pickup', () => {
  const pending = pickup(
    'pending-1',
    'pending',
    '2026-10-29',
    '09:30',
    '2026-10-27T00:00:00.000Z',
  );
  assert.equal(getNextActivePickup([pending]), pending);
});

test('returns an accepted pickup', () => {
  const accepted = pickup(
    'accepted-1',
    'accepted',
    '2026-10-29',
    '10:00',
    '2026-10-27T00:00:00.000Z',
  );
  assert.equal(getNextActivePickup([accepted]), accepted);
});

test('selects the earliest scheduled pickup deterministically', () => {
  const later = pickup(
    'pickup-z',
    'accepted',
    '2026-10-30',
    '09:00',
    '2026-10-27T00:00:00.000Z',
  );
  const earlier = pickup(
    'pickup-b',
    'pending',
    '2026-10-29',
    '11:00',
    '2026-10-27T00:00:00.000Z',
  );
  const sameScheduleLowerId = pickup(
    'pickup-a',
    'in_progress',
    '2026-10-29',
    '11:00',
    '2026-10-27T00:00:00.000Z',
  );

  assert.equal(
    getNextActivePickup([later, earlier, sameScheduleLowerId]),
    sameScheduleLowerId,
  );
});

test('excludes completed and cancelled pickups', () => {
  const terminalPickups = [
    pickup('completed', 'completed', '2026-10-29', '09:00', null),
    pickup('cancelled', 'cancelled', '2026-10-29', '10:00', null),
    pickup('canceled', 'canceled', '2026-10-29', '11:00', null),
  ];
  assert.equal(getNextActivePickup(terminalPickups), null);
});

test('orders malformed or missing schedules after valid schedules', () => {
  const malformed = pickup('malformed', 'pending', 'not-a-date', 'xx:yy', null);
  const missing = pickup('missing', 'accepted', null, null, null);
  const scheduled = pickup(
    'scheduled',
    'pending',
    '2026-10-29',
    null,
    null,
  );
  assert.equal(
    getNextActivePickup([malformed, missing, scheduled]),
    scheduled,
  );
});
