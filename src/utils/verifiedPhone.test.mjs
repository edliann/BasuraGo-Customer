import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatPhoneNumberForDisplay,
  getVerifiedPhoneNumber,
} from './verifiedPhone.ts';

test('only returns a number after the trusted profile confirms verification', () => {
  assert.equal(getVerifiedPhoneNumber(false, '+639171234567', null), null);
  assert.equal(getVerifiedPhoneNumber(undefined, null, '+639171234567'), null);
  assert.equal(
    getVerifiedPhoneNumber(true, '+639171234567', '+639999999999'),
    '+639171234567',
  );
  assert.equal(
    getVerifiedPhoneNumber(true, '  ', '+639171234567'),
    '+639171234567',
  );
  assert.equal(getVerifiedPhoneNumber(true, '', null), null);
});

test('formats a verified number for display without changing its stored value', () => {
  const storedValue = '+639171234567';
  assert.equal(
    formatPhoneNumberForDisplay(storedValue, '+63'),
    '+63 917 123 4567',
  );
  assert.equal(storedValue, '+639171234567');
});

test('leaves numbers unchanged when no safe country-code formatting applies', () => {
  assert.equal(formatPhoneNumberForDisplay('09171234567'), '09171234567');
  assert.equal(
    formatPhoneNumberForDisplay('+639171234567', '+64'),
    '+639171234567',
  );
});
