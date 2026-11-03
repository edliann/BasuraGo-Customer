import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPickupTimePickerValue,
  formatPickupTime,
  pickupTimeFromPickerEvent,
} from './pickupTime.ts';

test('formats midnight and noon with the correct 12-hour period', () => {
  assert.equal(formatPickupTime('00:00'), '12:00 AM');
  assert.equal(formatPickupTime('11:59'), '11:59 AM');
  assert.equal(formatPickupTime('12:00'), '12:00 PM');
  assert.equal(formatPickupTime('14:45'), '2:45 PM');
  assert.equal(formatPickupTime('23:59'), '11:59 PM');
});

test('does not format invalid stored time strings', () => {
  assert.equal(formatPickupTime('24:00'), '');
  assert.equal(formatPickupTime('9:30'), '');
});

test('builds picker values in Manila time without changing the selected date', () => {
  const value = createPickupTimePickerValue('2026-10-24', '00:15');
  assert.equal(value.toISOString(), '2026-10-23T16:15:00.000Z');
});

test('converts picker selections to backend HH:mm using the picker timezone offset', () => {
  assert.equal(
    pickupTimeFromPickerEvent({
      nativeEvent: {
        timestamp: Date.parse('2026-10-23T16:15:00.000Z'),
        utcOffset: 480,
      },
    }),
    '00:15',
  );
  assert.equal(
    pickupTimeFromPickerEvent({
      nativeEvent: {
        timestamp: Date.parse('2026-10-24T04:45:00.000Z'),
        utcOffset: 480,
      },
    }),
    '12:45',
  );
});
